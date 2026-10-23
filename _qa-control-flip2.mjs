/**
 * QA flip page modul Katalog (form edit) & Konten Web (editor item).
 * Save test konten = NO-OP (simpan tanpa mengubah isi → data identik).
 * Jalankan: node _qa-control-flip2.mjs
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

// ============ KATALOG ============
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));

await page.goto(BASE + '/#catalog', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(3500);
await page.waitForFunction(() => document.querySelectorAll('#catalogTableBody tr').length > 0, { timeout: 15000 });

// 1. Klik baris software → flip ke halaman edit
const swName = (await page.locator('#catalogTableBody tr .ct-name').first().textContent()).replace(/HOT/g, '').trim();
await page.locator('#catalogTableBody tr').first().click();
await page.waitForTimeout(400);
const swFlip = await page.evaluate(() => ({
  page: !document.getElementById('catalogEditPage').hidden,
  tabs: document.getElementById('catalogTabs').hidden,
  views: ['catViewSoftware', 'catViewHardware', 'catViewLayanan'].every((id) => document.getElementById(id).hidden),
  name: document.getElementById('catName')?.value || '',
  fields: document.querySelectorAll('#catalogEditPage [id^="cat"]').length,
}));
ok('Katalog: klik baris software → halaman edit', swFlip.page && swFlip.tabs && swFlip.views && swFlip.name.trim() === swName.trim(), JSON.stringify({ namaTabel: swName, namaForm: swFlip.name }));
ok('Katalog: form edit terisi field lengkap', swFlip.fields >= 10, `${swFlip.fields} field`);
await page.screenshot({ path: SHOT + 'qg1-catalog-edit.png' });

// 2. Batal → kembali ke daftar
await page.locator('#catalogEditPage .cd-head button').click();
await page.waitForTimeout(300);
const swBack = await page.evaluate(() => ({
  page: document.getElementById('catalogEditPage').hidden,
  tabs: !document.getElementById('catalogTabs').hidden,
  rows: document.querySelectorAll('#catalogTableBody tr').length,
}));
ok('Katalog: Batal → daftar kembali', swBack.page && swBack.tabs && swBack.rows > 0, JSON.stringify(swBack));

// 3. FAB → form tambah kosong
await page.locator('#fabCatalog').click();
await page.waitForTimeout(300);
const swNew = await page.evaluate(() => ({
  title: document.querySelector('#catalogEditPage .cd-title h3')?.textContent || '',
  name: document.getElementById('catName')?.value || '',
  appTypeRo: document.getElementById('catAppType')?.readOnly,
}));
ok('Katalog: FAB → form Tambah kosong', /Tambah/.test(swNew.title) && swNew.name === '' && !swNew.appTypeRo, JSON.stringify(swNew));
await page.locator('#catalogEditPage .cd-head button').click();
await page.waitForTimeout(200);

// 4. Hardware row → halaman edit hardware
await page.locator('#catalogTabs .content-tab[data-ctab="hardware"]').click();
await page.waitForTimeout(400);
await page.locator('#hwTableBody tr').first().click();
await page.waitForTimeout(300);
const hwFlip = await page.evaluate(() => ({
  page: !document.getElementById('catalogEditPage').hidden,
  name: document.getElementById('hwName')?.value || '',
  specs: (document.getElementById('hwSpecs')?.value || '').split('\n').filter(Boolean).length,
}));
ok('Katalog: hardware → halaman edit terisi', hwFlip.page && /MKS/.test(hwFlip.name) && hwFlip.specs === 5, JSON.stringify(hwFlip));
await page.locator('#catalogEditPage .cd-head button').click();
await page.waitForTimeout(200);

// 5. Layanan row → halaman edit layanan
await page.locator('#catalogTabs .content-tab[data-ctab="layanan"]').click();
await page.waitForTimeout(300);
await page.locator('#svcTableBody tr').first().locator('.ct-actions button').first().click();
await page.waitForTimeout(300);
const svcFlip = await page.evaluate(() => ({
  page: !document.getElementById('catalogEditPage').hidden,
  title: document.getElementById('svcTitle')?.value || '',
}));
ok('Katalog: layanan → halaman edit terisi', svcFlip.page && svcFlip.title.length > 3, JSON.stringify(svcFlip));
await page.locator('#catalogEditPage .cd-head button').click();
await page.waitForTimeout(200);

// ============ KONTEN WEB ============
await page.goto(BASE + '/#content', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(3500);
await page.waitForFunction(() => document.querySelectorAll('#contentBody .content-card').length > 0, { timeout: 15000 });

// 6. Daftar proyek read-only (tanpa Simpan Semua)
const cList = await page.evaluate(() => ({
  cards: document.querySelectorAll('#contentBody .content-card').length,
  saveAll: !!document.getElementById('contentSave'),
}));
ok('Konten: daftar proyek read-only (Simpan Semua hilang)', cList.cards > 0 && !cList.saveAll, JSON.stringify(cList));

// 7. Klik kartu → halaman edit item
const cHead = await page.locator('#contentBody .content-card-t').first().textContent();
await page.locator('#contentBody .content-card').first().click();
await page.waitForTimeout(300);
const cFlip = await page.evaluate(() => ({
  head: document.querySelector('#contentBody .cd-head h3')?.textContent || '',
  title: document.getElementById('fld-title')?.value || '',
  fields: document.querySelectorAll('#contentBody [data-k]').length,
  save: !!document.getElementById('contentItemSave'),
  del: !!document.getElementById('contentItemDel'),
}));
ok('Konten: klik kartu → halaman edit item', cFlip.fields === 9 && cFlip.save && cFlip.del && cFlip.head.trim() === cHead.trim(), JSON.stringify({ ...cFlip, head: cFlip.head }));
ok('Konten: field judul terisi', cFlip.title.length > 3, cFlip.title);
await page.screenshot({ path: SHOT + 'qg2-content-item.png' });

// 8. Simpan NO-OP (tanpa ubah isi) → sukses & kembali ke daftar
const beforeRow = await page.evaluate(async () => {
  const mod = await import('./js/api.js?v=20260911c').catch(() => null);
  return null;
});
await page.locator('#contentItemSave').click();
await page.waitForTimeout(2000);
const cAfterSave = await page.evaluate(() => ({
  list: document.querySelectorAll('#contentBody .content-card').length,
  itemGone: !document.querySelector('#contentBody .cd-head'),
}));
ok('Konten: Simpan no-op sukses → kembali ke daftar', cAfterSave.list > 0 && cAfterSave.itemGone, JSON.stringify(cAfterSave));

// 9. Tambah → form kosong → Batal tanpa menulis
await page.locator('#contentAdd').click();
await page.waitForTimeout(300);
const cNew = await page.evaluate(() => ({
  title: document.querySelector('#contentBody .cd-head h3')?.textContent || '',
  titleVal: document.getElementById('fld-title')?.value || '',
}));
ok('Konten: + Tambah → form kosong', /Tambah/.test(cNew.title) && cNew.titleVal === '', JSON.stringify(cNew));
await page.locator('#contentBack').click();
await page.waitForTimeout(300);
const cCountAfterBatal = await page.evaluate(() => document.querySelectorAll('#contentBody .content-card').length);
ok('Konten: Batal tambah tidak menambah item', cCountAfterBatal === cList.cards, `${cCountAfterBatal} kartu`);

// ============ MOBILE ============
const mp = await browser.newPage({ viewport: { width: 390, height: 844 } });
mp.on('pageerror', (e) => errors.push('MOB PAGEERROR: ' + e.message));
await mp.goto(BASE + '/#catalog', { waitUntil: 'domcontentloaded' });
await mp.waitForTimeout(3500);
await mp.waitForFunction(() => document.querySelectorAll('#catalogTableBody tr').length > 0, { timeout: 15000 });
await mp.locator('#catalogTabs .content-tab[data-ctab="hardware"]').click();
await mp.waitForTimeout(400);
await mp.locator('#hwCardList .catalog-card').first().click();
await mp.waitForTimeout(300);
const mFlip = await mp.evaluate(() => ({
  page: !document.getElementById('catalogEditPage').hidden,
  name: document.getElementById('hwName')?.value || '',
}));
ok('Mobile: kartu hardware → halaman edit', mFlip.page && /MKS/.test(mFlip.name), JSON.stringify(mFlip));
await mp.screenshot({ path: SHOT + 'qg3-mobile-edit.png' });
const mOverflow = await mp.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
ok('Mobile: tanpa overflow horizontal', mOverflow <= 0, `${mOverflow}px`);

// ============ Console ============
ok('Console bersih (tanpa pageerror)', errors.length === 0, errors.slice(0, 3).join(' | '));

await browser.close();
const fails = results.filter((r) => !r.pass);
console.log(`\n=== ${results.length - fails.length}/${results.length} PASS ===`);
process.exit(fails.length ? 1 : 0);
