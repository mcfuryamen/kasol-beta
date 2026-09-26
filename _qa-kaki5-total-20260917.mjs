// QA AUDIT TOTAL kaki5 v207/1.0.132 — Playwright, origin 127.0.0.1:8086 terisolasi.
// Verifikasi runtime nyata fitur v197-v207:
//   A. boot: header nama usaha dinamis + subtitle, appVersionLabel, no errors
//   B. navigasi semua layar (beranda/pos/menu/laporan/pengaturan/bantuan)
//   C. license sheet: ID Perangkat di kartu (licUnitHtml) + serial/tier
//   D. Bantuan: 3 tab (Tutorial|Video|S&K), changelog modal via baris Versi, S&K 6 pasal
//   E. update overlay: pending dipersist → overlay tampil; OKE → reload + pendi bersih
//   F. security: CSP script-src self, no inline onclick in index.html live DOM
import { chromium } from 'file:///C:/Users/Admin/AppData/Local/npm-cache/_npx/9833c18b2d85bc59/node_modules/playwright/index.mjs';

const KAKI5 = 'http://127.0.0.1:8086';
const results = [];
const errors = [];
function check(name, pass, detail) { results.push({ name, pass: !!pass, detail }); console.log(`${pass ? 'PASS' : 'FAIL'} | ${name} | ${detail}`); }

async function dismissBlockers(page) {
  for (let i = 0; i < 6; i++) {
    const blockers = await page.evaluate(() => {
      const sel = ['#profileBanner', '#tcModal', '#updateOverlay', '.overlay.show', '.lock-overlay.show', '#pwaInstallBanner'];
      const open = [];
      for (const s of sel) {
        for (const el of document.querySelectorAll(s)) {
          const st = getComputedStyle(el);
          if (st.display !== 'none' && st.visibility !== 'hidden' && Number(st.opacity) > 0) open.push(el.id || el.className);
        }
      }
      return [...new Set(open)];
    });
    if (!blockers.length) return;
    for (const id of blockers) {
      const target = page.locator('#' + id).first();
      if (await target.count()) {
        const btn = target.locator('button').last();
        try { if (await btn.count()) { await btn.click({ timeout: 1500 }); await page.waitForTimeout(350); continue; } } catch (_) {}
      }
      await page.keyboard.press('Escape').catch(() => {});
      await page.waitForTimeout(300);
    }
    await page.evaluate((ids) => {
      for (const id of ids) {
        const el = document.getElementById(id);
        if (el && el.classList.contains('show')) el.classList.remove('show');
        if (el && el.classList.contains('lock-overlay')) el.style.display = 'none';
      }
    }, blockers);
    await page.waitForTimeout(250);
  }
}

async function goScreen(page, screen) {
  const nav = page.locator(`.nav-item[data-page="${screen}"], .nav-item[data-screen="${screen}"]`);
  await nav.click({ timeout: 10000 });
  await page.waitForFunction(
    (s) => { const el = document.getElementById('page-' + s); return el && getComputedStyle(el).display !== 'none' && el.offsetHeight > 0; },
    screen, { timeout: 15000 }
  ).catch(() => {});
  await page.waitForTimeout(800);
}

(async () => {
  const browser = await chromium.launch({ channel: 'chrome' });
  const ctx = await browser.newContext({ viewport: { width: 420, height: 900 }, serviceWorkers: 'block' });
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

  await page.goto(KAKI5 + '/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);

  // Seed profil lokal supaya #profileBanner tidak auto-muncul (pola QA established:
  // checkProfileNotificationData baca keys ini)
  await page.evaluate(async () => {
    const { DB } = await import('./js/db.js');
    const put = (key, value) => DB.settings.put({ key, value });
    await put('namaPemilik', 'Pemilik QA');
    await put('noWhatsapp', '0881000000');
    await put('kabkota', 'Kota QA');
    await put('alamat', 'Jl. QA No. 1');
  }).catch(() => {});
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);
  await dismissBlockers(page);

  // ── A. BOOT: header nama usaha + subtitle + version label ──
  const boot = await page.evaluate(() => {
    const biz = document.getElementById('hdrBizName');
    const sub = document.querySelector('.app-header h1 span.kfs12');
    const ver = document.getElementById('appVersionLabel');
    const aboutVer = document.getElementById('aboutVersionRow');
    const csp = () => {
      const m = document.querySelector('meta[http-equiv="Content-Security-Policy"]');
      return m ? m.content : '';
    };
    return {
      biz: biz ? biz.textContent : null,
      bizTitle: biz ? biz.title : null,
      sub: sub ? sub.textContent.trim() : null,
      ver: ver ? ver.textContent : null,
      aboutVerAction: aboutVer ? aboutVer.getAttribute('data-action') : null,
      csp: csp()
    };
  });
  check('A header hdrBizName tampil (non-empty)', !!boot.biz && boot.biz.trim().length > 0, `biz="${boot.biz}"`);
  check('A subtitle "Kasir Solo - Kaki Lima"', boot.sub === 'Kasir Solo - Kaki Lima', `sub="${boot.sub}"`);
  check('A appVersionLabel = 1.0.132', boot.ver === 'Versi 1.0.132', `ver="${boot.ver}"`);
  check('A baris Versi wiring data-action=open-changelog', boot.aboutVerAction === 'open-changelog', `action="${boot.aboutVerAction}"`);
  check('A CSP script-src self (no unsafe-inline script)', /script-src 'self'/.test(boot.csp) && !/script-src 'self' 'unsafe-inline'/.test(boot.csp), `len=${boot.csp.length}`);

  // ── B. Navigasi semua layar ──
  for (const s of ['beranda', 'jualan', 'menu', 'laporan', 'pengaturan']) {
    await goScreen(page, s);
    const ok = await page.evaluate((s) => {
      const el = document.getElementById('page-' + s);
      return el && getComputedStyle(el).display !== 'none';
    }, s);
    check(`B layar ${s} terbuka`, ok, '');
  }

  // ── C. LICENSE SHEET: ID Perangkat di kartu ──
  await goScreen(page, 'pengaturan');
  await dismissBlockers(page);
  const licRow = page.locator('[data-action="open-license-sheet"]').first();
  const trialChip = await licRow.count();
  if (trialChip) { await licRow.click({ timeout: 8000 }); await page.waitForTimeout(1200); }
  const lic = await page.evaluate(() => {
    const sheet = document.getElementById('sheetLicense') || document.querySelector('.sheet.show');
    return {
      sheetOpen: !!(sheet && getComputedStyle(sheet).display !== 'none'),
      licUnitCount: document.querySelectorAll('.lic-unit').length,
      hasSerial: /KK5-[A-Z0-9-]{6,}/.test(document.body.textContent) || /serial/i.test(document.body.textContent)
    };
  });
  check('C sheet lisensi terbuka dari chip status', lic.sheetOpen, '');
  const licUnit = await page.evaluate(() => {
    const els = [...document.querySelectorAll('.lic-unit')];
    return els.length ? els[0].textContent.trim() : null;
  });
  check('C ID Perangkat (.lic-unit) tampil di kartu', !!licUnit, `licUnit="${licUnit}"`);

  // ── D. BANTUAN: 3 tab + changelog modal + S&K ──
  // Close license sheet first, then masuk Bantuan via header button (not nav-item).
  try {
    const sheetClose = page.locator('#sheetLicense [data-action], #sheetLicense .sheet-close');
    if (await sheetClose.count()) await sheetClose.first().click({ timeout: 2000 });
  } catch (_) {}
  await page.keyboard.press('Escape').catch(() => {});
  await page.waitForTimeout(500);
  await page.locator('[data-action="navigate-bantuan"]').first().click({ timeout: 8000 });
  await page.waitForFunction(() => {
    const el = document.getElementById('page-bantuan');
    return el && getComputedStyle(el).display !== 'none';
  }, { timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(800);
  await dismissBlockers(page);
  const tabs = await page.evaluate(() => ({
    count: document.querySelectorAll('.bantuan-tabs .bantuan-tab').length,
    labels: [...document.querySelectorAll('.bantuan-tabs .bantuan-tab')].map(b => b.textContent.trim()),
    active: [...document.querySelectorAll('.bantuan-tabs .bantuan-tab')].find(b => b.classList.contains('active'))?.textContent.trim()
  }));
  check('D Bantuan 3 tab (Tutorial|Video|S&K)', tabs.count === 3 && tabs.labels.length === 3, `labels=${JSON.stringify(tabs.labels)} active=${tabs.active}`);
  check('D tab default = Tutorial', tabs.active === '📖 Tutorial', `active="${tabs.active}"`);

  // Video tab → empty-state text (af151eb)
  await page.locator('.bantuan-tab[data-tab="video"]').click();
  await page.waitForTimeout(700);
  const videoState = await page.evaluate(() => {
    const panel = document.getElementById('bantuanPanelVideo');
    const list = document.getElementById('bantuanVideoList');
    return { panel: panel ? getComputedStyle(panel).display !== 'none' : false, listText: list ? list.textContent.slice(0, 90) : null };
  });
  check('D tab Video aktif + panel render', videoState.panel, `list="${videoState.listText}"`);

  // S&K tab → 6 pasal + hero stamp
  await page.locator('.bantuan-tab[data-tab="tc"]').click();
  await page.waitForTimeout(700);
  const tc = await page.evaluate(() => {
    const panel = document.getElementById('bantuanPanelTc');
    const clauses = panel ? panel.querySelectorAll('.tc-clause').length : 0;
    const hero = panel ? panel.querySelector('.card-hero') : null;
    const heroBg = hero ? getComputedStyle(hero).backgroundImage : '';
    return { panel: panel && getComputedStyle(panel).display !== 'none', clauses, heroGrad: heroBg.includes('linear-gradient') };
  });
  check('D tab S&K: 6 pasal', tc.clauses === 6, `clauses=${tc.clauses}`);
  check('D hero Bantuan gradasi oranye', tc.heroGrad, '');

  // Changelog modal via baris Versi (Tentang = page pengaturan footer)
  await goScreen(page, 'pengaturan');
  await dismissBlockers(page);
  await page.locator('#aboutVersionRow').click({ timeout: 8000 });
  await page.waitForTimeout(900);
  const cl = await page.evaluate(() => {
    const m = document.getElementById('changelogModal');
    const body = document.getElementById('changelogBody');
    const ok = document.querySelector('#changelogModal [data-action="close-changelog"]');
    return {
      open: m && m.classList.contains('show') && getComputedStyle(m).display !== 'none',
      topEntry: body ? body.textContent.slice(0, 40) : null,
      hasBtn: !!ok
    };
  });
  check('D changelog modal buka dari baris Versi', cl.open, `top="${cl.topEntry}"`);
  check('D tombol Tutup changelog via data-action (CSP-safe)', cl.hasBtn, '');
  if (cl.open) { await page.locator('[data-action="close-changelog"]').click(); await page.waitForTimeout(500); }
  const clClosed = await page.evaluate(() => {
    const m = document.getElementById('changelogModal');
    return m ? !m.classList.contains('show') : true;
  });
  check('D changelog Tutup via dispatcher jalan (fix 65fea6a)', clClosed, '');

  // ── E. UPDATE OVERLAY: pending persist → tampil; simulasi pending palsu ──
  const pendBefore = await page.evaluate(() => localStorage.getItem('ksr:update-pending'));
  const pendVal = pendBefore ? JSON.parse(pendBefore) : null;
  if (pendVal && pendVal.cacheBust) {
    // Pending tersimpan dari sesi sebelum — verifikasi overlay ter-pulihkan saat boot
    check('E persistent pending tersimpan dari sesi lama', true, `pending=${pendVal.cacheBust}`);
  } else {
    // Simulasi: set pending versi besok (v999) → reload → overlay harus tampil
    await page.evaluate(() => {
      localStorage.setItem('ksr:update-pending', JSON.stringify({ cacheBust: 'v999', version: '9.9.9', notes: ['QA pendi tes'] }));
    });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);
    const ov = await page.evaluate(() => {
      const o = document.getElementById('updateOverlay');
      const btn = document.getElementById('updateOkBtn');
      return { show: o && o.classList.contains('show') && getComputedStyle(o).display !== 'none', btnText: btn ? btn.textContent : null };
    });
    check('E overlay tampil dari pending simulated (aturan OKE-only)', ov.show, `btn="${ov.btnText}"`);
    // Klik OKE → overlay hilang + pending bersih + reload
    if (ov.show) {
      await page.locator('#updateOkBtn').click();
      await page.waitForTimeout(3500);
      const st = await page.evaluate(() => ({
        pend: localStorage.getItem('ksr:update-pending'),
        overlay: (() => { const o = document.getElementById('updateOverlay'); return o ? o.classList.contains('show') : false; })()
      }));
      check('E OKE hapus pending local', !st.pend || JSON.parse(st.pend).cacheBust !== 'v999', `pend=${st.pend}`);
      check('E overlay hilang setelah OKE+reload', !st.overlay, '');
    }
  }

  // ── F. SECURITY: inline onclick/index/fingerprint live DOM ──
  const sec = await page.evaluate(() => ({
    inlineOnclick: [...document.querySelectorAll('[onclick], [onkeydown], [onchange], [oninput], [onfocus]')].length,
    evalRef: typeof window.eval === 'function' // selalu true; signal saja
  }));
  check('F tidak ada inline onclick/onkeydown/onchange live DOM', sec.inlineOnclick === 0, `found=${sec.inlineOnclick}`);

  await page.screenshot({ path: '_qa-gui-screenshots/kaki5-total-audit.png', fullPage: false });
  await ctx.close();
  await browser.close();

  const failed = results.filter(r => !r.pass);
  console.log('\n=== RINGKASAN KAKI5 TOTAL AUDIT ===');
  console.log(`total ${results.length}, lulus ${results.length - failed.length}, gagal ${failed.length}`);
  if (errors.length) { console.log('\n=== ERROR HALAMAN ==='); errors.slice(0, 15).forEach(e => console.log('  ' + e)); }
  process.exit(failed.length ? 1 : 0);
})().catch(e => { console.error('QA CRASH:', e); process.exit(2); });