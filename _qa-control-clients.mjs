/**
 * QA visual+fungsional redesign modul Klien (layout pola Katalog).
 * READ-ONLY terhadap data: tidak menekan tombol yang PATCH Supabase.
 * Jalankan: node _qa-control-clients.mjs
 */
import { chromium } from 'file:///C:/Users/Admin/AppData/Local/npm-cache/_npx/9833c18b2d85bc59/node_modules/playwright/index.mjs';

const BASE = 'http://localhost:8082';
const SHOT = 'C:/Users/Admin/Documents/kasol/_qa-gui-screenshots/';
const results = [];
const ok = (name, pass, detail = '') => {
  results.push({ name, pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'} — ${name}${detail ? ' :: ' + detail : ''}`);
};

const browser = await chromium.launch({ channel: 'chrome' });

// ============ DESKTOP ============
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const consoleErrors = [];
page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
page.on('pageerror', (e) => consoleErrors.push('PAGEERROR: ' + e.message));

await page.goto(BASE + '/#klien', { waitUntil: 'networkidle' });
await page.waitForTimeout(1200);

// 1. Tabel klien tampil & terisi di desktop
const rows = await page.locator('#clientsTableBody tr').count();
ok('Desktop: tabel klien terisi', rows > 0, `${rows} baris`);

// 2. Struktur kolom tabel
const heads = await page.locator('#screen-klien .clients-table th').allTextContents();
ok('Desktop: kolom tabel sesuai pola katalog', heads.slice(0, 8).join('|').includes('Klien') && heads.includes('Status') && heads.includes('Kuota'), heads.map(h => h.trim()).filter(Boolean).join(' · '));

// 3. Badge status di sel status
const badgeCount = await page.locator('#clientsTableBody tr td:nth-child(4) .badge').count();
ok('Desktop: chip status per baris', badgeCount === rows, `${badgeCount}/${rows}`);

// 4. Tidak ada sisa kanban
const kanbanGone = await page.locator('#kanbanBoard, .kb-tab, .kanban-card').count();
ok('Desktop: elemen kanban hilang', kanbanGone === 0, `${kanbanGone} sisa`);

// 5. Klik baris pertama → sheet terbuka
await page.locator('#clientsTableBody tr').first().click();
await page.waitForTimeout(400);
const sheetOpen = await page.evaluate(() => document.getElementById('sheetClient')?.classList.contains('open'));
ok('Desktop: klik baris buka sheet detail', !!sheetOpen);
await page.screenshot({ path: SHOT + 'qc1-desktop-sheet.png' });

// 6. Isi sheet: status select + tombol lisensi
const sheetDetail = await page.evaluate(() => {
  const s = document.getElementById('clientSheet');
  return {
    hasStatusSel: !!s?.querySelector('#clientStatusSel'),
    statusOpts: s?.querySelectorAll('#clientStatusSel option').length || 0,
    licBtn: !!Array.from(s?.querySelectorAll('button') || []).find(b => /Lisensi/.test(b.textContent)),
    hasInfo: !!s?.querySelector('.sheet-info'),
    title: s?.querySelector('.sheet-title h3')?.textContent || ''
  };
});
ok('Sheet: select status pipeline', sheetDetail.hasStatusSel && sheetDetail.statusOpts === 6, JSON.stringify(sheetDetail));
ok('Sheet: tombol lisensi ada', sheetDetail.licBtn);
ok('Sheet: grid info terisi', sheetDetail.hasInfo);

// 7. Tutup sheet
await page.evaluate(() => window.closeClientSheet());
await page.waitForTimeout(250);
const closed = await page.evaluate(() => !document.getElementById('sheetClient').classList.contains('open'));
ok('Sheet: tombol tutup bekerja', closed);

// 8. Filter status (client-side saja)
const beforeF = await page.locator('#clientsTableBody tr').count();
await page.selectOption('#clientsStatusFilter', 'aktif');
await page.waitForTimeout(300);
const afterF = await page.locator('#clientsTableBody tr').count();
await page.selectOption('#clientsStatusFilter', '');
await page.waitForTimeout(300);
ok('Filter status memfilter baris', beforeF !== afterF || afterF === 0, `${beforeF} → ${afterF} → kembali ${await page.locator('#clientsTableBody tr').count()}`);

// 9. Dashboard: klik Aktivitas → pindah layar klien + sheet terbuka
await page.evaluate(() => { location.hash = '#dashboard'; });
await page.waitForTimeout(600);
const actRow = page.locator('#recentActivityCard .row-item').first();
const hasAct = await actRow.count();
if (hasAct) {
  await actRow.click();
  await page.waitForTimeout(1000);
  const dashOpen = await page.evaluate(() => ({
    screen: document.getElementById('screen-klien')?.classList.contains('active') || location.hash.includes('klien'),
    sheet: document.getElementById('sheetClient')?.classList.contains('open')
  }));
  ok('Dashboard: baris aktivitas buka sheet klien', dashOpen.screen && dashOpen.sheet, JSON.stringify(dashOpen));
  await page.evaluate(() => window.closeClientSheet());
} else {
  ok('Dashboard: baris aktivitas ada', false, 'tidak ada row-item');
}

// 10. Analitik dashboard masih render (renderAnalytics)
const anBoxes = await page.locator('#dashboardAnalytics .an-box').count();
ok('Dashboard: analitik klien tetap render', anBoxes >= 3, `${anBoxes} box`);

// ============ MOBILE (390×844) ============
const mp = await browser.newPage({ viewport: { width: 390, height: 844 } });
mp.on('pageerror', (e) => consoleErrors.push('MOBILE PAGEERROR: ' + e.message));
await mp.goto(BASE + '/#klien', { waitUntil: 'networkidle' });
await mp.waitForTimeout(1200);

const mTableHidden = await mp.evaluate(() => {
  const el = document.querySelector('.clients-table-wrap');
  return el ? getComputedStyle(el).display === 'none' : null;
});
ok('Mobile: tabel disembunyikan', mTableHidden === true);

const mCards = await mp.locator('#clientsCardList .catalog-card').count();
ok('Mobile: kartu pola katalog tampil', mCards > 0, `${mCards} kartu`);
await mp.screenshot({ path: SHOT + 'qc2-mobile-cards.png' });

if (mCards > 0) {
  await mp.locator('#clientsCardList .catalog-card').first().click();
  await mp.waitForTimeout(400);
  const mSheet = await mp.evaluate(() => document.getElementById('sheetClient')?.classList.contains('open'));
  ok('Mobile: klik kartu buka sheet', !!mSheet);
  await mp.screenshot({ path: SHOT + 'qc3-mobile-sheet.png' });
}

// Overflow horizontal check (mobile)
const overflow = await mp.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
ok('Mobile: tanpa overflow horizontal', overflow <= 0, `${overflow}px`);

// ============ Console errors ============
ok('Console bersih (tanpa error)', consoleErrors.length === 0, consoleErrors.slice(0, 3).join(' | '));

await browser.close();
const fails = results.filter(r => !r.pass);
console.log(`\n=== ${results.length - fails.length}/${results.length} PASS ===`);
process.exit(fails.length ? 1 : 0);
