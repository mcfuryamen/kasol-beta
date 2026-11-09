/** QA /rekrutmen — konten, nav dropdown 4 link tanpa Portfolio top-level, sitemap, mobile. */
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
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text()); });

const res = await page.goto(BASE + '/rekrutmen', { waitUntil: 'domcontentloaded' });
ok('HTTP 200', res?.status() === 200, String(res?.status()));
await page.waitForTimeout(800);

const body = await page.evaluate(() => ({
  h1: document.querySelector('.hero h1')?.textContent?.replace(/\s+/g, ' ').trim() || '',
  dna: document.querySelectorAll('.rk-card').length,
  pills: Array.from(document.querySelectorAll('.rk-pill')).map((p) => p.textContent.trim()),
  empty: document.querySelector('.rk-empty h3')?.textContent || '',
  cv: document.querySelector('.rk-empty a.btn')?.getAttribute('href') || '',
  quoteSub: document.querySelector('#dna .section-head .sub')?.textContent || '',
}));
ok('Hero "Partner Perjuangan."', /Gue Gak Cari Karyawan/i.test(body.h1) && /Partner Perjuangan/i.test(body.h1), body.h1);
ok('3 kartu DNA', body.dna === 3, `${body.dna}`);
ok('Sub DNA cerita 2022', /2022/.test(body.quoteSub));
ok('4 pill larangan', body.pills.length === 4 && body.pills.every((p) => p.length > 5), body.pills.join(' | '));
ok('Empty state "Gue Belum Buka Lowongan"', /Belum Buka Lowongan/.test(body.empty), body.empty);
ok('Tombol CV → wa.me 628816566935', body.cv.startsWith('https://wa.me/628816566935'), body.cv.slice(0, 60));
await page.evaluate(() => window.scrollTo(0, 0));
await page.screenshot({ path: SHOT + 'qr1-rekrutmen-hero.png' });
await page.evaluate(() => document.getElementById('larangan')?.scrollIntoView({ block: 'center' }));
await page.waitForTimeout(400);
await page.screenshot({ path: SHOT + 'qr2-larangan.png' });
await page.evaluate(() => document.getElementById('posisi')?.scrollIntoView({ block: 'center' }));
await page.waitForTimeout(400);
await page.screenshot({ path: SHOT + 'qr3-posisi.png' });

// Nav: Portfolio pindah ke dropdown, Rekrutmen ada, top-level hilang
const nav = await page.evaluate(() => ({
  topLevelPortfolio: Array.from(document.querySelectorAll('header .nav > a.nav-link')).some((a) => /Portfolio/i.test(a.textContent || '')),
  dropdown: Array.from(document.querySelectorAll('.nav-group .nav-menu a')).map((a) => ({ t: a.textContent?.trim(), h: a.getAttribute('href') })),
}));
ok('Portfolio TIDAK lagi top-level', !nav.topLevelPortfolio);
ok('Dropdown Perusahaan: Profil, Visi & Misi, Rekrutmen, Portfolio',
  nav.dropdown.length === 4 &&
  nav.dropdown.map((d) => d.h).join(',') === '/about,/visi-misi,/rekrutmen,/portfolio', JSON.stringify(nav.dropdown));

// Link dari dropdown berfungsi
await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(600);
await page.hover('.nav-parent');
await page.waitForTimeout(250);
await page.locator('.nav-menu a[href="/rekrutmen"]').click();
await page.waitForTimeout(700);
const navOk = await page.evaluate(() => location.pathname === '/rekrutmen' && !!document.querySelector('.rk-empty'));
ok('Navigasi dropdown → /rekrutmen bekerja', navOk);

// Sitemap
const sm = await page.evaluate(async () => (await fetch('/sitemap.xml')).text());
ok('Sitemap berisi /rekrutmen', sm.includes('/rekrutmen'));

// Mobile
const mp = await browser.newPage({ viewport: { width: 390, height: 844 } });
mp.on('pageerror', (e) => errors.push('MOB PAGEERROR: ' + e.message));
await mp.goto(BASE + '/rekrutmen', { waitUntil: 'domcontentloaded' });
await mp.waitForTimeout(800);
const mSt = await mp.evaluate(() => {
  const vw = document.documentElement.clientWidth;
  const cards = Array.from(document.querySelectorAll('.rk-grid > .card'));
  const wide = cards.filter((c) => c.getBoundingClientRect().width > vw * 0.8).length;
  return { wide, total: cards.length };
});
ok('Mobile: kartu DNA menumpuk 1 kolom', mSt.wide === mSt.total, JSON.stringify(mSt));
const mOverflow = await mp.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
ok('Mobile: tanpa overflow horizontal', mOverflow <= 0, `${mOverflow}px`);

ok('Console bersih', errors.length === 0, errors.slice(0, 3).join(' | '));

await browser.close();
const fails = results.filter((r) => !r.pass);
console.log(`\n=== ${results.length - fails.length}/${results.length} PASS ===`);
process.exit(fails.length ? 1 : 0);
