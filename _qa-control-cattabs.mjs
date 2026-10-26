/**
 * QA modul Katalog 3 tab (Software | Hardware | Layanan) di control.
 * Save test = NO-OP (tulis ulang data identik — net zero terhadap Supabase).
 * Jalankan: node _qa-control-cattabs.mjs
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
const errors = [];

// ============ DESKTOP ============
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));

await page.goto(BASE + '/#catalog', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(3500);

// 1. Tiga tab tampil
const tabs = await page.locator('#catalogTabs .content-tab').allTextContents();
ok('3 tab katalog tampil', tabs.length === 3 && /Software/.test(tabs[0]) && /Hardware/.test(tabs[1]) && /Layanan/.test(tabs[2]), tabs.join(' | '));

// 2. Tab software: tabel terisi & view lain tersembunyi
const swRows = await page.locator('#catalogTableBody tr').count();
const swVisible = await page.evaluate(() => !document.getElementById('catViewSoftware').hidden && document.getElementById('catViewHardware').hidden && document.getElementById('catViewLayanan').hidden);
ok('Tab Software default: tabel products terisi', swRows > 0 && swVisible, `${swRows} baris`);
await page.screenshot({ path: SHOT + 'qt1-software-tab.png' });

// 3. Klik tab Hardware: tabel 6 baris + foto
await page.locator('#catalogTabs .content-tab[data-ctab="hardware"]').click();
await page.waitForTimeout(600);
const hwRows = await page.locator('#hwTableBody tr').count();
const hwImgs = await page.locator('#hwTableBody .hw-admin-thumb').count();
const hwVisible = await page.evaluate(() => document.getElementById('catViewHardware').hidden === false && document.getElementById('catViewSoftware').hidden === true);
ok('Tab Hardware: 6 baris dari site_content', hwRows === 6 && hwVisible, `${hwRows} baris, ${hwImgs} foto`);
await page.screenshot({ path: SHOT + 'qt2-hardware-tab.png' });

// 4. Sheet edit hardware terbuka dari klik baris + field terisi
await page.locator('#hwTableBody tr').first().click();
await page.waitForTimeout(400);
const hwSheet = await page.evaluate(() => {
  const ov = document.getElementById('sheetHw');
  const name = document.getElementById('hwName')?.value || '';
  const price = document.getElementById('hwPrice')?.value || '';
  const specs = (document.getElementById('hwSpecs')?.value || '').split('\n').filter(Boolean).length;
  return { open: ov?.classList.contains('open'), name, price, specs };
});
ok('Sheet edit hardware terbuka + data terisi', hwSheet.open && /MKS Fighter V1/.test(hwSheet.name) && hwSheet.price === '3500000' && hwSheet.specs === 5, JSON.stringify(hwSheet));
await page.screenshot({ path: SHOT + 'qt3-hw-sheet.png' });

// 5. Save NO-OP (data identik ditulis balik) → PATCH bekerja tanpa mengubah konten
const before = await page.evaluate(async () => {
  const r = await fetch('/api/rest', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path: '/rest/v1/site_content?select=value&key=eq.hardware' }) });
  return null; // placeholder — pakai jalur app di bawah
}).catch(() => null);
// Jalur andal: baca lewat app state global (window.__lastHw tidak ada) → bandingkan via SQL dilakukan manual.
// Simpan (data di sheet = data asli baris pertama) → harus sukses & tidak mengubah isi.
await page.evaluate(() => window.saveHw(0));
await page.waitForTimeout(1500);
const hwSheetClosed = await page.evaluate(() => !document.getElementById('sheetHw').classList.contains('open'));
ok('Save hardware (no-op) sukses & sheet tertutup', hwSheetClosed);

// 6. Tab Layanan: 3 baris + sheet terbuka
await page.locator('#catalogTabs .content-tab[data-ctab="layanan"]').click();
await page.waitForTimeout(500);
const svcRows = await page.locator('#svcTableBody tr').count();
ok('Tab Layanan: 3 baris dari site_content', svcRows === 3, `${svcRows} baris`);
await page.locator('#svcTableBody tr').first().click();
await page.waitForTimeout(400);
const svcSheet = await page.evaluate(() => {
  const ov = document.getElementById('sheetSvc');
  return { open: ov?.classList.contains('open'), title: document.getElementById('svcTitle')?.value || '', sub: document.getElementById('svcSubtitle')?.value || '' };
});
ok('Sheet edit layanan terbuka + data terisi', svcSheet.open && svcSheet.title.length > 3, JSON.stringify(svcSheet));
await page.evaluate(() => window.closeSvcSheet());
await page.screenshot({ path: SHOT + 'qt4-layanan-tab.png' });

// 7. FAB hanya di tab aktif (masing-masing di dalam view container)
await page.locator('#catalogTabs .content-tab[data-ctab="hardware"]').click();
await page.waitForTimeout(300);
const fabState = await page.evaluate(() => {
  const vis = (id) => { const el = document.getElementById(id); return el && el.offsetParent !== null; };
  return { sw: vis('fabCatalog'), hw: vis('fabHw'), svc: vis('fabSvc') };
});
ok('FAB per tab (hardware aktif)', fabState.hw && !fabState.sw && !fabState.svc, JSON.stringify(fabState));

// ============ MOBILE ============
const mp = await browser.newPage({ viewport: { width: 390, height: 844 } });
mp.on('pageerror', (e) => errors.push('MOB PAGEERROR: ' + e.message));
await mp.goto(BASE + '/#catalog', { waitUntil: 'domcontentloaded' });
await mp.waitForTimeout(3500);
await mp.locator('#catalogTabs .content-tab[data-ctab="hardware"]').click();
await mp.waitForTimeout(500);
const mHw = await mp.evaluate(() => ({
  cards: document.querySelectorAll('#hwCardList .catalog-card').length,
  tableHidden: getComputedStyle(document.getElementById('hwTableWrap')).display === 'none',
}));
ok('Mobile: kartu hardware tampil, tabel sembunyi', mHw.cards === 6 && mHw.tableHidden, JSON.stringify(mHw));
await mp.screenshot({ path: SHOT + 'qt5-mobile-hw-cards.png' });
const mOverflow = await mp.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
ok('Mobile: tanpa overflow horizontal', mOverflow <= 0, `${mOverflow}px`);

// ============ Console ============
ok('Console bersih (tanpa pageerror)', errors.length === 0, errors.slice(0, 3).join(' | '));

await browser.close();
const fails = results.filter((r) => !r.pass);
console.log(`\n=== ${results.length - fails.length}/${results.length} PASS ===`);
process.exit(fails.length ? 1 : 0);
