/**
 * QA flip page detail klien — klik kartu/baris → daftar DIGANTI halaman detail; Kembali → daftar.
 * READ-ONLY terhadap data (tidak menekan tombol yang PATCH).
 * Jalankan: node _qa-control-flip.mjs
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

await page.goto(BASE + '/#klien', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(3500);
// Tunggu data Supabase masuk (tabel terisi) sebelum baseline
await page.waitForFunction(() => document.querySelectorAll('#clientsTableBody tr').length > 0, { timeout: 15000 });

// 1. Daftar tampil, detail tersembunyi
const init = await page.evaluate(() => ({
  list: !document.getElementById('clientsList').hidden,
  detailHidden: document.getElementById('clientDetailPage').hidden,
  rows: document.querySelectorAll('#clientsTableBody tr').length,
  sheetGone: !document.getElementById('sheetClient'),
}));
ok('Daftar tampil + sheet dihapus dari DOM', init.list && init.detailHidden && init.sheetGone, JSON.stringify({ ...init, sheetGone: undefined }));

// 2. Klik baris → flip ke detail
const firstName = await page.locator('#clientsTableBody tr .ct-name').first().textContent();
await page.locator('#clientsTableBody tr').first().click();
await page.waitForTimeout(500);
const flip = await page.evaluate(() => ({
  list: document.getElementById('clientsList').hidden,
  detail: !document.getElementById('clientDetailPage').hidden,
  head: document.querySelector('#clientDetailPage .cd-head h3')?.textContent || '',
  hasSel: !!document.querySelector('#clientDetailPage #clientStatusSel'),
  badges: document.querySelectorAll('#clientDetailPage .cd-badges .badge, #clientDetailPage .cd-badges .lic-chip').length,
  panels: document.querySelectorAll('#clientDetailPage .cd-grid > .panel').length,
}));
ok('Flip: daftar diganti halaman detail', flip.list && flip.detail, JSON.stringify(flip));
ok('Detail: judul = nama klien baris pertama', flip.head.trim() === firstName.trim(), `"${flip.head}" vs "${firstName}"`);
ok('Detail: panel profil + kelola + select status', flip.panels === 2 && flip.hasSel && flip.badges >= 2, `panels=${flip.panels} badges=${flip.badges}`);
await page.evaluate(() => window.scrollTo(0, 0));
await page.screenshot({ path: SHOT + 'qf1-detail-page.png' });

// 3. Kembali → daftar tampil lagi
await page.locator('#clientDetailPage .cd-head button').click();
await page.waitForTimeout(400);
const back = await page.evaluate(() => ({
  list: !document.getElementById('clientsList').hidden,
  detail: document.getElementById('clientDetailPage').hidden,
  rows: document.querySelectorAll('#clientsTableBody tr').length,
}));
ok('Kembali: daftar muncul kembali', back.list && back.detail && back.rows === init.rows, JSON.stringify(back));

// 4. Dari Dashboard: baris Aktivitas → klien + detail terbuka
await page.goto(BASE + '/#dashboard', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(3000);
const actRow = page.locator('#recentActivityCard .row-item').first();
if (await actRow.count()) {
  await actRow.click();
  await page.waitForTimeout(1500);
  const viaDash = await page.evaluate(() => ({
    hash: location.hash,
    detail: !document.getElementById('clientDetailPage').hidden,
    head: document.querySelector('#clientDetailPage .cd-head h3')?.textContent || '',
  }));
  ok('Dashboard: klik aktivitas → detail klien terbuka', viaDash.detail && viaDash.head.length > 1, JSON.stringify(viaDash));
  await page.locator('#clientDetailPage .cd-head button').click();
  await page.waitForTimeout(300);
} else {
  ok('Dashboard: baris aktivitas ada', false, 'tidak ada row-item');
}

// ============ MOBILE ============
const mp = await browser.newPage({ viewport: { width: 390, height: 844 } });
mp.on('pageerror', (e) => errors.push('MOB PAGEERROR: ' + e.message));
await mp.goto(BASE + '/#klien', { waitUntil: 'domcontentloaded' });
await mp.waitForTimeout(3500);
await mp.locator('#clientsCardList .catalog-card').first().click();
await mp.waitForTimeout(500);
const mFlip = await mp.evaluate(() => ({
  list: document.getElementById('clientsList').hidden,
  detail: !document.getElementById('clientDetailPage').hidden,
  cols: getComputedStyle(document.querySelector('#clientDetailPage .cd-grid')).gridTemplateColumns.split(' ').length,
}));
ok('Mobile: kartu → flip detail 1 kolom', mFlip.list && mFlip.detail && mFlip.cols === 1, JSON.stringify(mFlip));
await mp.screenshot({ path: SHOT + 'qf2-mobile-detail.png' });
const mOverflow = await mp.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
ok('Mobile: tanpa overflow horizontal', mOverflow <= 0, `${mOverflow}px`);
await mp.locator('#clientDetailPage .cd-head button').click();
await mp.waitForTimeout(300);
const mBack = await mp.evaluate(() => !document.getElementById('clientsList').hidden && document.getElementById('clientDetailPage').hidden);
ok('Mobile: Kembali ke daftar', mBack);

// ============ Console ============
ok('Console bersih (tanpa pageerror)', errors.length === 0, errors.slice(0, 3).join(' | '));

await browser.close();
const fails = results.filter((r) => !r.pass);
console.log(`\n=== ${results.length - fails.length}/${results.length} PASS ===`);
process.exit(fails.length ? 1 : 0);
