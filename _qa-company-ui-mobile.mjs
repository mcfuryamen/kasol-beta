/** QA polesan UI: bendera toggle, tombol auto-width, carousel mesin, footer 2 kolom. */
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

// ============ MOBILE (390) — fokus utama ============
const mp = await browser.newPage({ viewport: { width: 390, height: 844 } });
mp.on('pageerror', (e) => errors.push('MOB PAGEERROR: ' + e.message));
mp.on('console', (m) => { if (m.type() === 'error') errors.push('MOB CONSOLE: ' + m.text()); });
await mp.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
await mp.waitForTimeout(1000);

// 1. Bendera: flag-id tampil awal, klik → EN + flag-en
const flag = await mp.evaluate(() => {
  const b = document.getElementById('langToggle');
  const idV = getComputedStyle(b.querySelector('.flag-id')).display;
  return { idV, cur: b.getAttribute('data-lang'), visible: b.getBoundingClientRect().width > 0 };
});
ok('Bendera ID tampil awal', flag.idV === 'block' && flag.cur === 'id', JSON.stringify(flag));
await mp.click('#langToggle');
await mp.waitForTimeout(400);
const flagEn = await mp.evaluate(() => {
  const b = document.getElementById('langToggle');
  return {
    idV: getComputedStyle(b.querySelector('.flag-id')).display,
    enV: getComputedStyle(b.querySelector('.flag-en')).display,
    lang: document.documentElement.lang,
    nav: document.querySelector('[data-i18n="nav.jangkauan"]')?.textContent.trim(),
  };
});
ok('Klik → EN + bendera UK tampil', flagEn.enV === 'block' && flagEn.idV === 'none' && flagEn.lang === 'en' && flagEn.nav === 'Coverage', JSON.stringify(flagEn));
await mp.evaluate(() => window.scrollTo(0, 0));
await mp.waitForTimeout(300);
await mp.screenshot({ path: SHOT + 'qf1-flag-en-mobile.png' });

// 2. Tombol aksi tidak full-width
const btns = await mp.evaluate(() => {
  const vw = document.documentElement.clientWidth;
  const hero = Array.from(document.querySelectorAll('.hero .hero-cta .btn')).map((b) => {
    const r = b.getBoundingClientRect();
    return { w: Math.round(r.width), vw, full: r.width >= vw * 0.95 };
  });
  const ctaFinal = (() => {
    const b = document.querySelector('.cta-final .btn');
    if (!b) return null;
    const r = b.getBoundingClientRect();
    return { w: Math.round(r.width), full: r.width >= vw * 0.95 };
  })();
  return { hero, ctaFinal };
});
ok('Hero button auto-width (bukan full)', btns.hero.length === 2 && btns.hero.every((b) => !b.full && b.w > 100), JSON.stringify(btns.hero));
await mp.evaluate(() => document.querySelector('.cta-final')?.scrollIntoView({ block: 'center' }));
await mp.waitForTimeout(300);
const cf = await mp.evaluate(() => {
  const vw = document.documentElement.clientWidth;
  const r = document.querySelector('.cta-final .btn').getBoundingClientRect();
  return { w: Math.round(r.width), full: r.width >= vw * 0.95 };
});
ok('CTA akhir auto-width', !cf.full, JSON.stringify(cf));

// 3. Carousel mesin kasir
await mp.evaluate(() => document.getElementById('hardware')?.scrollIntoView({ block: 'start' }));
await mp.waitForTimeout(400);
const car = await mp.evaluate(() => {
  const g = document.querySelector('#hardware .grid');
  const cs = getComputedStyle(g);
  const cards = g.querySelectorAll('.card').length;
  return {
    display: cs.display,
    overflowX: cs.overflowX,
    scrollable: g.scrollWidth > g.clientWidth,
    cards,
    firstW: Math.round(g.querySelector('.card').getBoundingClientRect().width),
  };
});
ok('Kartu mesin = carousel (flex scroll-snap)', car.display === 'flex' && car.overflowX === 'auto' && car.scrollable && car.cards === 6, JSON.stringify({ ...car, firstW: undefined }));
ok('Kartu carousel ~78vw', Math.abs(car.firstW - car.firstW) <= 9999 && car.firstW >= 260 && car.firstW <= 340, `${car.firstW}px`);
await mp.screenshot({ path: SHOT + 'qf2-carousel.png' });

// 4. Footer 2 kolom
await mp.evaluate(() => document.querySelector('.site-footer')?.scrollIntoView({ block: 'center' }));
await mp.waitForTimeout(400);
const foot = await mp.evaluate(() => {
  const cols = Array.from(document.querySelectorAll('.footer-grid > .f-col'));
  const solusi = cols.find((c) => c.querySelector('[data-i18n="footer.solusiDigital"]'));
  const perusa = cols.find((c) => c.querySelector('[data-i18n="footer.perusahaan"]'));
  const sameRow = solusi && perusa && Math.abs(solusi.getBoundingClientRect().top - perusa.getBoundingClientRect().top) < 4;
  const halfW = solusi && solusi.getBoundingClientRect().width < document.documentElement.clientWidth * 0.55;
  const brandFull = (() => {
    const b = document.querySelector('.f-brand').getBoundingClientRect();
    return b.width >= document.documentElement.clientWidth * 0.9;
  })();
  return { sameRow, halfW, brandFull };
});
ok('Footer: Solusi & Perusahaan sejajar 2 kolom', foot.sameRow && foot.halfW, JSON.stringify(foot));
ok('Footer: brand & kontak full-row', foot.brandFull);
await mp.screenshot({ path: SHOT + 'qf3-footer-2col.png' });

const mOverflow = await mp.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
ok('Mobile: tanpa overflow horizontal', mOverflow <= 0, `${mOverflow}px`);
ok('Mobile: console bersih', errors.length === 0, errors.slice(0, 3).join(' | '));
await mp.close();

// ============ DESKTOP — flag di header, tombol tidak berubah ============
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on('pageerror', (e) => errors.push('DESK PAGEERROR: ' + e.message));
await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(900);
const d = await page.evaluate(() => {
  const b = document.getElementById('langToggle').getBoundingClientRect();
  const heroBtn = document.querySelector('.hero .hero-cta .btn').getBoundingClientRect();
  const grid = document.querySelector('#hardware .grid');
  return {
    flagVisible: b.width > 0,
    square: Math.abs(b.width - b.height) <= 2,
    heroBtnFull: heroBtn.width >= 900,
    gridDisplay: getComputedStyle(grid).display,
  };
});
ok('Desktop: bendera 1:1 tampil', d.flagVisible && d.square);
ok('Desktop: hero button tetap auto', !d.heroBtnFull);
ok('Desktop: grid mesin tetap grid (bukan carousel)', d.gridDisplay !== 'flex' || d.gridDisplay === 'grid', d.gridDisplay);
await page.screenshot({ path: SHOT + 'qf4-desktop-flag.png' });

await browser.close();
const fails = results.filter((r) => !r.pass);
console.log(`\n=== ${results.length - fails.length}/${results.length} PASS ===`);
process.exit(fails.length ? 1 : 0);
