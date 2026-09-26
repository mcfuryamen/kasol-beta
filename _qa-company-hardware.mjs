/**
 * QA adopsi modul hardware (kasol-v2) ke company — halaman /hardware + homepage section.
 * READ-ONLY: tidak menekan tombol yang mengubah data (semua CTA = link WA eksternal).
 * Jalankan: node _qa-company-hardware.mjs
 */
import { chromium } from 'file:///C:/Users/Admin/AppData/Local/npm-cache/_npx/9833c18b2d85bc59/node_modules/playwright/index.mjs';

const BASE = 'http://localhost:13131';
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
page.on('console', (m) => { if (m.type() === 'error') errors.push('DESK: ' + m.text()); });
page.on('pageerror', (e) => errors.push('DESK PAGEERROR: ' + e.message));

await page.goto(BASE + '/hardware', { waitUntil: 'networkidle' });
await page.waitForTimeout(800);

// 1. Hero
const hero = await page.evaluate(() => document.querySelector('.hero h1')?.textContent || '');
ok('Hero "Supply Drop" tampil', /supply/i.test(hero) && /drop/i.test(hero), hero.trim());

// 2. Grid 6 produk terisi dari Supabase/CMS
const cards = await page.locator('.hw-card').count();
ok('Grid 6 produk hardware', cards === 6, `${cards} kartu`);

// 3. Filter kategori
await page.locator('.hw-chip[data-cat="PERIPHERALS"]').click();
await page.waitForTimeout(250);
const periph = await page.locator('.hw-card:not([hidden])').count();
const periphOk = periph === 3;
await page.locator('.hw-chip[data-cat="ANDROID"]').click();
await page.waitForTimeout(250);
const android = await page.locator('.hw-card:not([hidden])').count();
await page.locator('.hw-chip[data-cat="ALL"]').click();
await page.waitForTimeout(250);
const all = await page.locator('.hw-card:not([hidden])').count();
ok('Filter kategori bekerja', periphOk && android === 2 && all === 6, `PERIPH=${periph} ANDROID=${android} ALL=${all}`);

// 4. Semua gambar produk punya src valid (bukan placeholder)
const badImgs = await page.evaluate(() =>
  Array.from(document.querySelectorAll('.hw-thumb img, .hw-stage-img, .hw-thumb-btn img'))
    .filter((i) => !i.src.startsWith('https://images.unsplash.com/')).length
);
ok('Semua gambar dari Unsplash (ada src)', badImgs === 0, `${badImgs} bermasalah`);

// 5. Modal detail terbuka
await page.locator('[data-open="hw-detail-1"]').first().click();
await page.waitForTimeout(300);
const modalOpen = await page.evaluate(() => {
  const m = document.getElementById('hw-detail-1');
  return m && !m.hidden && getComputedStyle(m).display !== 'none';
});
ok('Modal detail produk terbuka', !!modalOpen);
await page.screenshot({ path: SHOT + 'qh1-desktop-modal.png' });

// 6. Isi modal: review, specs, inBox, tombol WA Beli/Nego
const modalDetail = await page.evaluate(() => {
  const m = document.getElementById('hw-detail-1');
  const links = Array.from(m.querySelectorAll('.hw-modal-actions a')).map((a) => a.href);
  return {
    review: !!m.querySelector('.hw-modal-block p')?.textContent.length,
    specs: m.querySelectorAll('.hw-modal-block ul li').length,
    stock: !!Array.from(m.querySelectorAll('.hw-stock')).length,
    wa: links.filter((h) => h.startsWith('https://wa.me/628816566935')).length,
  };
});
ok('Modal: review + specs + badge stock', modalDetail.review && modalDetail.specs >= 8 && modalDetail.stock, JSON.stringify(modalDetail));
ok('Modal: 2 tombol WA ke 628816566935', modalDetail.wa === 2);

// 7. Galeri: klik thumb ke-2 ganti gambar
const gal = await page.evaluate(() => {
  const m = document.getElementById('hw-detail-1');
  const stage = m.querySelector('.hw-stage-img').src;
  const t2 = m.querySelectorAll('.hw-thumb-btn')[1];
  t2.click();
  return { changed: m.querySelector('.hw-stage-img').src !== stage, now: m.querySelector('.hw-stage-img').src };
});
ok('Galeri: thumb mengganti foto utama', gal.changed, gal.now.slice(-40));

// 8. Tutup modal via Escape
await page.keyboard.press('Escape');
await page.waitForTimeout(200);
const modalClosed = await page.evaluate(() => document.getElementById('hw-detail-1').hidden);
ok('Modal: Escape menutup', modalClosed);

// 9. JSON-LD ItemList
const jsonld = await page.evaluate(() => {
  const el = document.querySelector('script[type="application/ld+json"]:not([data-localbusiness])');
  const all = Array.from(document.querySelectorAll('script[type="application/ld+json"]'));
  const itemList = all.map((s) => { try { return JSON.parse(s.textContent); } catch { return null; } }).find((j) => j && j['@type'] === 'ItemList');
  return itemList ? { items: itemList.itemListElement.length, first: itemList.itemListElement[0].item.name } : null;
});
ok('JSON-LD ItemList 6 produk', !!jsonld && jsonld.items === 6, JSON.stringify(jsonld));

// 10. Section instalasi (portfolio PHYSICAL) + link ke /portfolio
const porto = await page.evaluate(() => ({
  cards: document.querySelectorAll('#instalasi .proj-card').length,
  href: document.querySelector('#instalasi .proj-card')?.getAttribute('href') || '',
}));
ok('Section Instalasi Hardware 3 proyek riil', porto.cards === 3 && porto.href.startsWith('/portfolio/'), JSON.stringify(porto));

// 11. CTA WA di kartu (card 1) benar format pesan
const waCard = await page.locator('.hw-card .hw-cta').first().getAttribute('href');
ok('CTA kartu: wa.me + pesan angkut', waCard.startsWith('https://wa.me/628816566935?text=') && /angkut/.test(decodeURIComponent(waCard)), decodeURIComponent(waCard).slice(0, 80));

// 12. Nav "Mesin" → /hardware
const navHw = await page.evaluate(() => Array.from(document.querySelectorAll('header .nav-link')).find((a) => a.textContent.trim() === 'Mesin')?.getAttribute('href'));
ok('Nav header "Mesin" → /hardware', navHw === '/hardware', String(navHw));

// ============ HOMEPAGE ============
await page.goto(BASE + '/', { waitUntil: 'networkidle' });
await page.waitForTimeout(600);
const homeHw = await page.evaluate(() => ({
  cards: document.querySelectorAll('#hardware .card.hw').length,
  withImg: document.querySelectorAll('#hardware .hw-thumb-sm img').length,
  linksToPage: Array.from(document.querySelectorAll('#hardware .hw-link')).filter((a) => /\/hardware#p\d+/.test(a.getAttribute('href'))).length,
  seeAll: !!document.querySelector('#hardware a[href="/hardware"]'),
}));
ok('Homepage: section #hardware 6 kartu + foto + link detail', homeHw.cards === 6 && homeHw.withImg === 6 && homeHw.linksToPage === 6, JSON.stringify(homeHw));
ok('Homepage: tombol Lihat Semua Hardware', homeHw.seeAll);
await page.screenshot({ path: SHOT + 'qh2-home-hardware.png', fullPage: false });
await page.evaluate(() => document.getElementById('hardware').scrollIntoView());
await page.waitForTimeout(400);
await page.screenshot({ path: SHOT + 'qh3-home-hardware-section.png' });

// ============ MOBILE ============
const mp = await browser.newPage({ viewport: { width: 390, height: 844 } });
mp.on('pageerror', (e) => errors.push('MOB PAGEERROR: ' + e.message));
await mp.goto(BASE + '/hardware', { waitUntil: 'networkidle' });
await mp.waitForTimeout(600);
const mGrid = await mp.evaluate(() => getComputedStyle(document.getElementById('hwGrid')).gridTemplateColumns.split(' ').length);
ok('Mobile: grid 1 kolom', mGrid === 1, `${mGrid} kolom`);
await mp.locator('[data-open="hw-detail-5"]').first().click();
await mp.waitForTimeout(300);
const mModal = await mp.evaluate(() => !document.getElementById('hw-detail-5').hidden);
ok('Mobile: modal terbuka', mModal);
await mp.screenshot({ path: SHOT + 'qh4-mobile-modal.png' });
const mOverflow = await mp.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
ok('Mobile: tanpa overflow horizontal', mOverflow <= 0, `${mOverflow}px`);

// ============ Console ============
ok('Console bersih', errors.length === 0, errors.slice(0, 3).join(' | '));

await browser.close();
const fails = results.filter((r) => !r.pass);
console.log(`\n=== ${results.length - fails.length}/${results.length} PASS ===`);
process.exit(fails.length ? 1 : 0);
