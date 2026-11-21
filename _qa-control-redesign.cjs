/**
 * QA Playwright — Redesign Control Center (compact/high-density) 2026-09-10
 * Jalankan: node _qa-control-redesign.cjs   (server 8082 harus hidup)
 */
const { chromium } = require('C:/Users/Admin/AppData/Local/npm-cache/_npx/e41f203b7505f1fb/node_modules/playwright-core');

const BASE = 'http://127.0.0.1:8082/';
const SHOT = 'C:/Users/Admin/Documents/kasol/_qa-gui-screenshots';
// Emoji "asli" (bukan arrow ↗ / bullet ● yang sengaja dipakai sbg glyph desain)
const EMOJI = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2300}-\u{23FF}\u{2B00}-\u{2BFF}\u{FE0F}\u{20E3}]/u;

const results = [];
function check(name, ok, extra = '') {
  results.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'} — ${name}${extra ? ' · ' + extra : ''}`);
}

function rgbOf(color) {
  const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/.exec(color || '');
  return m ? { r: +m[1], g: +m[2], b: +m[3], a: m[4] === undefined ? 1 : +m[4] } : null;
}

(async () => {
  const browser = await chromium.launch({ channel: 'chrome' });

  // ══════════════ DESKTOP 1440×900 ══════════════
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const consoleErrors = [];
  const pageErrors = [];
  page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  page.on('pageerror', e => pageErrors.push(e.message));

  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  // tunggu data Supabase via proxy siap (kpi strip terisi) — toleran kalau kosong
  try { await page.waitForFunction(() => {
    const k = document.querySelectorAll('#statCards .kpi-cell');
    const l = document.querySelectorAll('#dashboardAnalytics .bar-row, #recentActivityCard .row-item');
    return k.length >= 6 && (l.length > 0 || !document.querySelector('#statCards .k-val'));
  }, { timeout: 9000 }); } catch {}
  await page.waitForTimeout(1500);

  // ── 1. DASHBOARD ──
  const strip = page.locator('#statCards.kpi-strip');
  check('D: KPI strip ada (#statCards.kpi-strip)', await strip.count() === 1);
  const kpiCount = await page.locator('#statCards .kpi-cell').count();
  check('D: KPI cell = 7 (6 ringkasan + Aktif 30 Hari)', kpiCount === 7, `dapat ${kpiCount}`);

  const tops = await page.$$eval('#statCards .kpi-cell', els => els.map(e => e.getBoundingClientRect().top));
  check('D: KPI strip SATU BARIS', tops.length >= 2 && Math.max(...tops) - Math.min(...tops) < 2,
    `deltas ${Math.round(Math.max(...tops) - Math.min(...tops))}px`);

  const kpiValBg = await page.$$eval('#statCards .k-val', els =>
    els.map(e => { const c = getComputedStyle(e); return { cls: e.className, bg: c.backgroundColor, color: c.color }; }));
  const bgsTransparent = kpiValBg.every(v => { const c = rgbOf(v.bg); return !c || c.a === 0; });
  check('D: .k-val TANPA background/pita warna (green/orange = teks saja)', bgsTransparent,
    kpiValBg.filter(v => !bgsTransparent).map(v => v.cls + ':' + v.bg).join(' | ') || 'semua transparent');

  const greenVal = kpiValBg.find(v => v.cls.includes('green'));
  const orangeVal = kpiValBg.find(v => v.cls.includes('orange'));
  if (greenVal) { const c = rgbOf(greenVal.color); check('D: .k-val.green teks hijau', c && c.g > c.r && c.g > c.b, greenVal.color); }
  if (orangeVal) { const c = rgbOf(orangeVal.color); check('D: .k-val.orange teks oranye', c && c.r > 150 && c.r > c.b, orangeVal.color); }

  const recItems = await page.locator('#recentActivityCard .row-item').count();
  const recentDots = await page.locator('#recentActivityCard .status-dot').count();
  if (recItems > 0) {
    check('D: Aktivitas Terbaru pakai status dot (bukan emoji)', recentDots > 0 && recentDots === recItems, `${recentDots}/${recItems} dot`);
  } else {
    check('D: Aktivitas Terbaru (data recent kosong — skip dot-check)', true, '0 item recent');
  }

  const statusPills = await page.$$eval('#dashboardAnalytics .bar-label',
    els => els.map(e => e.textContent.trim()));
  const emojiPills = statusPills.filter(t => EMOJI.test(t));
  check('D: label status chart tanpa emoji', emojiPills.length === 0, emojiPills.join(' ') || `${statusPills.length} label bersih`);

  const kpiText = await page.locator('#statCards').textContent();
  check('D: KPI label tanpa emoji', !EMOJI.test(kpiText), EMOJI.exec(kpiText)?.[0] || 'bersih');

  await page.screenshot({ path: SHOT + '/ctl1_dashboard_desktop.png', fullPage: false });

  // ── 2. KATALOG (desktop = tabel) ──
  await page.click('.nav-link[data-screen="catalog"]');
  await page.waitForTimeout(800);
  const tableWrapBox = await page.locator('#catalogTableWrap').boundingBox();
  check('K: tabel katalog tampil di desktop', !!tableWrapBox && tableWrapBox.width > 300, tableWrapBox && `w=${Math.round(tableWrapBox.width)}`);
  const cardsDisplay = await page.$eval('#catalogList', e => getComputedStyle(e).display).catch(() => 'n/a');
  check('K: kartu katalog HIDDEN di desktop', cardsDisplay === 'none', `display=${cardsDisplay}`);

  const rows = page.locator('#catalogTableBody tr');
  const rowCount = await rows.count();
  check('K: baris tabel terisi dari data', rowCount > 0, `${rowCount} baris`);
  if (rowCount > 0) {
    const firstRow = await rows.first().textContent();
    check('K: baris tabel lengkap (nama + harga + status)', /Rp\s?[\d.]/.test(firstRow) && /LIVE|READY|MAINTENANCE|DEVELOPMENT/.test(firstRow), firstRow.replace(/\s+/g, ' ').slice(0, 80));
    const chipCount = await page.locator('#catalogTableBody .domain-chip, #catalogTableBody .tag-pill').count();
    check('K: chip status/kategori di tabel', chipCount > 0, `${chipCount} chip`);
    const icSvgs = await page.locator('#catalogTableBody .ct-icon svg').count();
    check('K: ikon app di tabel = SVG (bukan emoji)', icSvgs >= rowCount, `${icSvgs}/${rowCount} svg`);
    const emojiRow = await rows.first().textContent();
    check('K: baris tabel tanpa emoji', !EMOJI.test(emojiRow));

    // buka sheet via klik baris
    await rows.first().click();
    await page.waitForTimeout(500);
    const sheetOpen = await page.$eval('#sheetCatalog', e => e.classList.contains('open')).catch(() => false);
    check('K: klik baris → sheet edit terbuka', sheetOpen);
    if (sheetOpen) await page.screenshot({ path: SHOT + '/ctl2_katalog_sheet_edit.png' });
    const closeBtn = page.locator('#sheetCatalog .sheet-close, #catalogSheet [aria-label="Tutup"]').first();
    if (await closeBtn.count()) { await closeBtn.click(); await page.waitForTimeout(300); }
  }
  await page.screenshot({ path: SHOT + '/ctl2_katalog_desktop.png' });

  // ── 3. ANALITIK (digabung ke DASHBOARD) ──
  const anBoxes = await page.locator('#dashboardAnalytics .an-box').count();
  check('A: Modul Analitik ada di Dashboard (3 kotak chart)', anBoxes === 3, `dapat ${anBoxes} kotak`);
  const anTitles = await page.$$eval('#dashboardAnalytics .an-title', els => els.map(e => e.textContent.trim()));
  check('A: judul chart lengkap (Pipeline/Aplikasi/Wilayah)',
    anTitles.some(t => /Pipeline/i.test(t)) && anTitles.some(t => /Aplikasi/i.test(t)) && anTitles.some(t => /Wilayah/i.test(t)),
    anTitles.join(' | '));
  const anBg = await page.$$eval('#dashboardAnalytics .k-val', els => els.map(e => getComputedStyle(e).backgroundColor));
  check('A: .k-val analitik tanpa background', anBg.every(bg => { const c = rgbOf(bg); return !c || c.a === 0; }), anBg.join(' | ') || 'n/a');
  const anLabels = await page.$$eval('#dashboardAnalytics .bar-label', els => els.map(e => e.textContent.trim()));
  const anEmoji = anLabels.filter(t => EMOJI.test(t));
  check('A: label bar analitik tanpa emoji', anEmoji.length === 0, anEmoji.join(' ') || `${anLabels.length} label bersih`);
  const anSvgs = await page.locator('#dashboardAnalytics .bar-label svg').count();
  check('A: ikon app bar = SVG', anSvgs > 0, `${anSvgs} svg`);
  const noDupAn = await page.locator('#analyticsBody, #analyticsView').count();
  check('A: tidak ada sisa view Analitik lama', noDupAn === 0, `${noDupAn} sisa`);
  await page.screenshot({ path: SHOT + '/ctl3_analitik_di_dashboard.png' });

  // ── 4. KLIEN — KANBAN (Kelola; nav langsung, tanpa submenu) ──
  await page.click('.nav-link[data-screen="klien"][data-client-view="kelola"]');
  await page.waitForTimeout(600);
  const kanbanHidden = await page.$eval('#kanbanView', e => e.hasAttribute('hidden')).catch(() => true);
  check('Kb: view kanban tampil (hidden dihilangkan)', kanbanHidden === false);
  const tabs = await page.$$eval('#kanbanBoard .kb-tabs button', els => els.map(e => e.textContent.trim()));
  const tabEmoji = tabs.filter(t => EMOJI.test(t));
  check('Kb: tab kanban tanpa emoji', tabEmoji.length === 0, tabEmoji.join(' ') || tabs.join(' / '));
  const kbAvatars = await page.locator('.kanban-card .client-avatar svg').count();
  const kbCards = await page.locator('.kanban-card').count();
  if (kbCards > 0) check('Kb: avatar kartu = SVG', kbAvatars >= kbCards, `${kbAvatars}/${kbCards} svg`);
  else check('Kb: (tanpa kartu data — skip avatar)', true, '0 kartu');
  await page.screenshot({ path: SHOT + '/ctl4_kanban_desktop.png' });

  // ── 5. PENGATURAN (sticky save) ──
  await page.click('.nav-link[data-screen="settings"]');
  await page.waitForTimeout(600);
  const panelFootCount = await page.locator('#screen-settings .panel-foot').count();
  check('P: panel-foot save wrap ada (Info Usaha + Pembayaran)', panelFootCount === 2, `${panelFootCount} blok`);
  const stickyPos = await page.$$eval('#screen-settings .panel-foot', els => els.map(e => getComputedStyle(e).position));
  check('P: tombol simpan STICKY', stickyPos.every(p => p === 'sticky'), stickyPos.join(','));
  const legacyPanels = await page.locator('#setHeroTitle, #appLink_kaki5, #appLinksStatus').count();
  check('P: panel Landing Page & Link Aplikasi SUDAH DIHAPUS', legacyPanels === 0, `${legacyPanels} sisa`);
  await page.screenshot({ path: SHOT + '/ctl5_pengaturan_desktop.png' });

  // ── 6. KONTEN WEB (sanity) ──
  await page.click('.nav-link[data-screen="content"]');
  await page.waitForTimeout(1000);
  const contentTabs = await page.locator('#contentTabs .content-tab, #contentTabs button').count();
  check('C: tab konten web ter-render', contentTabs > 0, `${contentTabs} tab`);
  await page.screenshot({ path: SHOT + '/ctl6_konten_desktop.png' });

  // ── 7. TOKEN LAYOUT ──
  const tokens = await page.evaluate(() => {
    const cs = getComputedStyle(document.body);
    const topbar = document.querySelector('.topbar');
    const sidebar = document.querySelector('.sidebar');
    return {
      bodyFont: cs.fontSize,
      topbarH: topbar ? Math.round(topbar.getBoundingClientRect().height) : null,
      sidebarW: sidebar ? Math.round(sidebar.getBoundingClientRect().width) : null,
    };
  });
  check('L: font body compact (13–14px)', parseFloat(tokens.bodyFont) >= 13 && parseFloat(tokens.bodyFont) <= 14, tokens.bodyFont);
  check('L: topbar 52px', tokens.topbarH >= 48 && tokens.topbarH <= 56, tokens.topbarH + 'px');
  check('L: sidebar 224px', tokens.sidebarW >= 216 && tokens.sidebarW <= 232, tokens.sidebarW + 'px');

  check('D: console error = 0', consoleErrors.length === 0, consoleErrors.slice(0, 3).join(' | '));
  check('D: pageerror = 0', pageErrors.length === 0, pageErrors.slice(0, 3).join(' | '));
  await ctx.close();

  // ══════════════ MOBILE 390×844 ══════════════
  const mctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const mpage = await mctx.newPage();
  const mErrors = [];
  mpage.on('pageerror', e => mErrors.push(e.message));
  await mpage.goto(BASE, { waitUntil: 'domcontentloaded' });
  try { await mpage.waitForFunction(() => document.querySelectorAll('#catalogTableBody tr, #catalogList .catalog-card, #catalogEmpty').length > 0, { timeout: 9000 }); } catch {}
  await mpage.waitForTimeout(1200);

  const mSidebarX = await mpage.$eval('.sidebar', e => e.getBoundingClientRect().x);
  check('M: sidebar off-canvas (x<0) saat awal', mSidebarX < 0, `x=${Math.round(mSidebarX)}`);
  const mBottomNav = await mpage.$eval('#bottomNav', e => { const r = e.getBoundingClientRect(); const c = getComputedStyle(e); return c.display !== 'none' && r.height > 30; });
  check('M: bottom nav tampil', mBottomNav === true);
  const mKpi = await mpage.locator('#statCards .kpi-cell').count();
  check('M: KPI strip render (boleh wrap)', mKpi >= 4, `${mKpi} cell`);
  await mpage.screenshot({ path: SHOT + '/ctl7_dashboard_mobile.png' });

  // katalog mobile = kartu
  await mpage.click('.bnav-item[data-screen="catalog"]');
  await mpage.waitForTimeout(800);
  const mTableDisplay = await mpage.$eval('#catalogTableWrap', e => getComputedStyle(e).display).catch(() => 'n/a');
  check('M: tabel katalog HIDDEN di mobile', mTableDisplay === 'none', `display=${mTableDisplay}`);
  const mCards = await mpage.locator('#catalogList .catalog-card').count();
  check('M: kartu katalog tampil di mobile', mCards > 0, `${mCards} kartu`);
  if (mCards > 0) {
    const cardSvg = await mpage.locator('#catalogList .catalog-card-cover svg').count();
    check('M: cover kartu = SVG', cardSvg >= mCards, `${cardSvg}/${mCards} svg`);
  }
  await mpage.screenshot({ path: SHOT + '/ctl8_katalog_mobile.png' });

  // Mobile: hamburger sengaja disembunyikan (≤1024px) → bottom nav sbg menu utama.
  const mToggleDisplay = await mpage.$eval('.menu-toggle', e => getComputedStyle(e).display);
  check('M: hamburger disembunyikan di mobile (bottom nav gantikan)', mToggleDisplay === 'none', `display=${mToggleDisplay}`);
  const mSidebarStillOff = await mpage.$eval('.sidebar', e => e.getBoundingClientRect().x);
  check('M: sidebar tetap off-canvas (tdk bisa dibuka via hamburger)', mSidebarStillOff < 0, `x=${Math.round(mSidebarStillOff)}`);

  // bottom nav harus menjangkau semua layar — termasuk "Konten" yg tdk ada di bottom-nav lama.
  await mpage.click('.bnav-item[data-screen="content"]');
  await mpage.waitForTimeout(500);
  const contentActive = await mpage.$eval('#screen-content', e => e.classList.contains('active'));
  check('M: bottom nav "Konten" menjangkau layar Konten Web', contentActive === true);
  await mpage.screenshot({ path: SHOT + '/ctl9_konten_mobile_bottomnav.png' });

  check('M: pageerror = 0', mErrors.length === 0, mErrors.slice(0, 3).join(' | '));
  await mctx.close();

  await browser.close();

  const failed = results.filter(r => !r.ok);
  console.log(`\n════════ RESULT: ${results.length - failed.length}/${results.length} passed${failed.length ? ` — GAGAL: ${failed.map(f => f.name).join(' ;; ')}` : ''} ════════`);
  process.exit(failed.length ? 1 : 0);
})().catch(e => { console.error('QA CRASH:', e); process.exit(2); });
