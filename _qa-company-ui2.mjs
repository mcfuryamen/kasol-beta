/** QA polesan UI ronde 2: center tombol, pulse seamless, to-top, tabbar aktif. */
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
const mp = await browser.newPage({ viewport: { width: 390, height: 844 } });
mp.on('pageerror', (e) => errors.push('MOB PAGEERROR: ' + e.message));
mp.on('console', (m) => { if (m.type() === 'error') errors.push('MOB CONSOLE: ' + m.text()); });

await mp.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
await mp.waitForTimeout(1000);

// 1. Tombol di .center benar-benar center
const ctr = await mp.evaluate(() => {
  const vw = document.documentElement.clientWidth;
  const btn = document.querySelector('#hardware ~ * .center a, .center a');
  const el = Array.from(document.querySelectorAll('.center a.btn')).find((a) => /hardware/i.test(a.getAttribute('href') || ''));
  const r = (el || btn).getBoundingClientRect();
  const mid = r.left + r.width / 2;
  return { mid, vwMid: vw / 2, off: Math.abs(mid - vw / 2) };
});
ok('Tombol "Lihat Semua Hardware" center', ctr.off <= 4, `offset ${ctr.off.toFixed(1)}px`);

// 2. Pulse marquee bergerak (transform berubah) + loop -50%
await mp.evaluate(() => document.querySelector('.pulse')?.scrollIntoView({ block: 'center' }));
await mp.waitForTimeout(300);
const t1 = await mp.evaluate(() => getComputedStyle(document.querySelector('.pulse-track')).transform);
await mp.waitForTimeout(1200);
const t2 = await mp.evaluate(() => getComputedStyle(document.querySelector('.pulse-track')).transform);
ok('Pulse track beranimasi (transform berubah)', t1 !== t2, `${t1} → ${t2}`);
const kf = await mp.evaluate(() => {
  for (const sheet of document.styleSheets) {
    try {
      for (const r of sheet.cssRules) {
        if (r.name === 'marquee') return r.cssText;
        if (r.cssRules) for (const rr of r.cssRules) if (rr.name === 'marquee') return rr.cssText;
      }
    } catch { /* skip */ }
  }
  return null;
});
ok('Marquee keyframes -50% (seamless)', /-50%/.test(kf || ''), kf);
// gap antar kartu via margin (bukan track gap) -> tidak ada jeda di seam
const gapOk = await mp.evaluate(() => getComputedStyle(document.querySelector('.pulse-track')).columnGap === 'normal' || getComputedStyle(document.querySelector('.pulse-track')).gap === 'normal' || getComputedStyle(document.querySelector('.pulse-track')).gap.startsWith('0'));
ok('Track tanpa gap (seamless di seam)', gapOk);

// 3. Scroll-to-top: hidden awal → muncul setelah scroll → klik naik ke atas
await mp.evaluate(() => window.scrollTo(0, 0));
await mp.waitForTimeout(500);
const top0 = await mp.evaluate(() => {
  const b = document.getElementById('toTop');
  const cs = getComputedStyle(b);
  return { visible: cs.visibility === 'visible' && cs.opacity !== '0', y: window.scrollY };
});
ok('To-top tersembunyi di puncak halaman', !top0.visible);
await mp.evaluate(() => window.scrollTo(0, 1600));
await mp.waitForTimeout(500);
const top1 = await mp.evaluate(() => {
  const b = document.getElementById('toTop');
  const cs = getComputedStyle(b);
  return cs.visibility === 'visible' && Number(cs.opacity) > 0.9;
});
ok('To-top muncul setelah scroll', top1);
await mp.click('#toTop');
await mp.waitForTimeout(1300);
const top2 = await mp.evaluate(() => window.scrollY);
ok('Klik to-top → kembali ke atas', top2 < 40, `scrollY=${top2}`);
await mp.screenshot({ path: SHOT + 'qo1-totop.png' });

// 4. Tab bar: aktif mengikuti halaman
await mp.goto(BASE + '/hardware', { waitUntil: 'domcontentloaded' });
await mp.waitForTimeout(800);
const tabHw = await mp.evaluate(() => document.querySelector('.tabbar a[data-tab="mesin"]')?.classList.contains('active'));
ok('Tab aktif di /hardware = Mesin', !!tabHw);
await mp.goto(BASE + '/#aplikasi', { waitUntil: 'domcontentloaded' });
await mp.waitForTimeout(800);
const tabApp = await mp.evaluate(() => {
  const beranda = document.querySelector('.tabbar a[data-tab="beranda"]').classList.contains('active');
  const aplikasi = document.querySelector('.tabbar a[data-tab="aplikasi"]').classList.contains('active');
  return { beranda, aplikasi };
});
ok('Tab aktif di /#aplikasi = Aplikasi (Beranda lepas)', tabApp.aplikasi && !tabApp.beranda, JSON.stringify(tabApp));
await mp.evaluate(() => window.scrollTo(0, document.body.scrollHeight * 0.4));
await mp.waitForTimeout(400);
await mp.screenshot({ path: SHOT + 'qo2-tabbar.png' });

// 5. Regresi: footer 2 kolom & carousel masih ok, tanpa overflow
const reg = await mp.evaluate(() => {
  const vw = document.documentElement.clientWidth;
  const solusi = Array.from(document.querySelectorAll('.footer-grid > .f-col')).find((c) => c.querySelector('[data-i18n="footer.solusiDigital"]'));
  const car = document.querySelector('#hardware .grid');
  return {
    overflow: document.documentElement.scrollWidth - vw,
    footerHalf: solusi ? solusi.getBoundingClientRect().width < vw * 0.55 : false,
    carousel: getComputedStyle(car).display === 'flex',
  };
});
ok('Regresi: footer 2 kolom & carousel utuh, tanpa overflow', reg.overflow <= 0 && reg.footerHalf && reg.carousel, JSON.stringify(reg));

ok('Console bersih', errors.length === 0, errors.slice(0, 3).join(' | '));
await mp.close();

// Desktop: to-top juga muncul
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on('pageerror', (e) => errors.push('DESK PAGEERROR: ' + e.message));
await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(800);
await page.evaluate(() => window.scrollTo(0, 1200));
await page.waitForTimeout(500);
const dTop = await page.evaluate(() => {
  const cs = getComputedStyle(document.getElementById('toTop'));
  return cs.visibility === 'visible' && Number(cs.opacity) > 0.9;
});
ok('Desktop: to-top bekerja', dTop);
await browser.close();

const fails = results.filter((r) => !r.pass);
console.log(`\n=== ${results.length - fails.length}/${results.length} PASS ===`);
process.exit(fails.length ? 1 : 0);
