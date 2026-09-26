/** QA halaman /visi-misi company — konten, submenu Perusahaan, sitemap, mobile. */
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

// 1. Halaman render
const res = await page.goto(BASE + '/visi-misi', { waitUntil: 'domcontentloaded' });
ok('HTTP 200', res?.status() === 200, String(res?.status()));
await page.waitForTimeout(800);

const body = await page.evaluate(() => ({
  h1: document.querySelector('.hero h1')?.textContent?.trim() || '',
  visi: document.querySelector('.visi-quote')?.textContent || '',
  misi: document.querySelectorAll('.misi-card').length,
  dna: document.querySelectorAll('.dna-card').length,
  quote: document.querySelector('.quote-card p')?.textContent || '',
  by: document.querySelector('.quote-by')?.textContent || '',
  bigQuote: document.querySelector('.quote-big h2')?.textContent || '',
}));
ok('Hero "Mimpi Gede & Kerja Keras."', /Mimpi Gede/i.test(body.h1) && /Kerja Keras/i.test(body.h1), body.h1);
ok('Kartu Visi ada', /Benteng Pertahanan Digital #1/i.test(body.visi), body.visi.slice(0, 60));
ok('4 kartu misi', body.misi === 4, `${body.misi}`);
ok('6 kartu DNA', body.dna === 6, `${body.dna}`);
ok('Kutipan founder (Amin Maghfuri)', /AMIN MAGHFURI/i.test(body.by), body.by);
ok('Headline kutipan besar', /SENJATA PERANG/i.test(body.bigQuote));
await page.evaluate(() => window.scrollTo(0, 0));
await page.screenshot({ path: SHOT + 'qv1-visi-hero.png' });
await page.evaluate(() => document.getElementById('misi')?.scrollIntoView());
await page.waitForTimeout(400);
await page.screenshot({ path: SHOT + 'qv2-misi-dna.png' });
await page.evaluate(() => document.getElementById('kutipan')?.scrollIntoView());
await page.waitForTimeout(400);
await page.screenshot({ path: SHOT + 'qv3-quote.png' });

// 2. Submenu Perusahaan
const nav = await page.evaluate(() => {
  const group = Array.from(document.querySelectorAll('.nav-group')).find((g) => /Perusahaan/i.test(g.textContent || ''));
  const links = Array.from(group?.querySelectorAll('.nav-menu a') || []).map((a) => ({ t: a.textContent?.trim(), h: a.getAttribute('href') }));
  return links;
});
ok('Submenu Perusahaan: Profil + Visi & Misi', nav.length === 2 && nav[1].h === '/visi-misi' && /Visi/i.test(nav[1].t || ''), JSON.stringify(nav));

// 3. Sitemap
const sm = await page.evaluate(async () => (await fetch('/sitemap.xml')).text());
ok('Sitemap berisi /visi-misi', sm.includes('/visi-misi'));

// 4. Aktif dari nav (klik submenu)
await page.evaluate(() => { location.href = '/'; });
await page.waitForTimeout(800);
await page.hover('.nav-parent');
await page.waitForTimeout(300);
const menuVisible = await page.evaluate(() => {
  const group = Array.from(document.querySelectorAll('.nav-group')).find((g) => /Perusahaan/i.test(g.textContent || ''));
  const menu = group?.querySelector('.nav-menu');
  if (!menu) return false;
  const cs = getComputedStyle(menu);
  return cs.display !== 'none';
});
ok('Dropdown terbuka saat hover', menuVisible);
await page.screenshot({ path: SHOT + 'qv4-dropdown.png' });

// ============ MOBILE ============
const mp = await browser.newPage({ viewport: { width: 390, height: 844 } });
mp.on('pageerror', (e) => errors.push('MOB PAGEERROR: ' + e.message));
await mp.goto(BASE + '/visi-misi', { waitUntil: 'domcontentloaded' });
await mp.waitForTimeout(800);
const mCols = await mp.evaluate(() => {
  const vw = document.documentElement.clientWidth;
  const stack = (sel) => {
    const cards = Array.from(document.querySelectorAll(sel + ' > .card'));
    const wide = cards.filter((c) => c.getBoundingClientRect().width > vw * 0.8).length;
    return { wide, total: cards.length };
  };
  const misi = stack('.misi-grid');
  const dna = stack('.dna-grid');
  return { misi, dna };
});
ok('Mobile: misi & dna menumpuk 1 kolom', mCols.misi.wide === mCols.misi.total && mCols.dna.wide === mCols.dna.total, JSON.stringify(mCols));
const mOverflow = await mp.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
ok('Mobile: tanpa overflow horizontal', mOverflow <= 0, `${mOverflow}px`);
await mp.screenshot({ path: SHOT + 'qv5-mobile-visi.png', fullPage: false });

ok('Console bersih', errors.length === 0, errors.slice(0, 3).join(' | '));

await browser.close();
const fails = results.filter((r) => !r.pass);
console.log(`\n=== ${results.length - fails.length}/${results.length} PASS ===`);
process.exit(fails.length ? 1 : 0);
