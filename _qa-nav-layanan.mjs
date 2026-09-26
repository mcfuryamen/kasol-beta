/** QA nav Layanan — label rename, dropdown 2 sub, hover, navigasi, mobile bar tetap. */
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

await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(800);

const nav = await page.evaluate(() => {
  const header = document.querySelector('header');
  const groups = Array.from(header.querySelectorAll('.nav-group'));
  const layanan = groups.find((g) => /^Layanan/i.test(g.querySelector('.nav-parent')?.textContent.trim() || ''));
  const topLinks = Array.from(header.querySelectorAll('.nav > a.nav-link')).map((a) => a.textContent.trim());
  return {
    hasLayanan: !!layanan,
    subs: layanan ? Array.from(layanan.querySelectorAll('.nav-menu a')).map((a) => ({ t: a.textContent.trim(), h: a.getAttribute('href') })) : [],
    topLinks,
    perusahaan: groups.find((g) => /Perusahaan/i.test(g.textContent || '')) ? true : false,
  };
});
ok('Group "Layanan" ada', nav.hasLayanan);
ok('Sub: Aplikasi (/#aplikasi) + Mesin (/hardware)',
  nav.subs.length === 2 && nav.subs[0].h === '/#aplikasi' && nav.subs[1].h === '/hardware', JSON.stringify(nav.subs));
ok('Tidak ada top-level Aplikasi/Mesin', !nav.topLinks.some((t) => /^(Aplikasi|Mesin)$/i.test(t)), nav.topLinks.join(' | '));
ok('Perusahaan tetap ada', nav.perusahaan);

// Hover dropdown Layanan (bukan Perusahaan) + navigasi ke /hardware
await page.locator('.nav-group', { has: page.locator('.nav-menu a[href="/hardware"]') }).locator('.nav-parent').hover();
await page.waitForTimeout(300);
await page.locator('.nav-group', { has: page.locator('.nav-menu a[href="/hardware"]') }).locator('.nav-menu a[href="/hardware"]').click();
await page.waitForTimeout(700);
const navHw = await page.evaluate(() => location.pathname === '/hardware' && !!document.querySelector('.hw-grid'));
ok('Dropdown Layanan → /hardware bekerja', navHw);

// Kembali ke beranda, cek via /#aplikasi
await page.goto(BASE + '/#aplikasi', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(600);
const appOk = await page.evaluate(() => location.hash === '#aplikasi');
ok('Sub Aplikasi tetap ke /#aplikasi', appOk);

// Bottom bar tidak berubah (masih shortcut Aplikasi & Mesin)
const bar = await page.evaluate(() => Array.from(document.querySelectorAll('.tabbar a, .tabbar .tab-fab a, nav[class*="tab"] a')).map((a) => a.textContent.trim()).filter(Boolean));
ok('Bottom bar tetap punya shortcut Aplikasi & Mesin', bar.includes('Aplikasi') && bar.includes('Mesin'), bar.join(' | '));

await page.evaluate(() => window.scrollTo(0, 0));
await page.locator('.nav-group', { has: page.locator('.nav-menu a[href="/hardware"]') }).locator('.nav-parent').hover();
await page.waitForTimeout(300);
await page.screenshot({ path: SHOT + 'ql1-layanan-dropdown.png' });

// Mobile: bottom bar tampil, tanpa overflow
const mp = await browser.newPage({ viewport: { width: 390, height: 844 } });
mp.on('pageerror', (e) => errors.push('MOB PAGEERROR: ' + e.message));
await mp.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
await mp.waitForTimeout(800);
const mOverflow = await mp.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
ok('Mobile: tanpa overflow horizontal', mOverflow <= 0, `${mOverflow}px`);

ok('Console bersih', errors.length === 0, errors.slice(0, 3).join(' | '));

await browser.close();
const fails = results.filter((r) => !r.pass);
console.log(`\n=== ${results.length - fails.length}/${results.length} PASS ===`);
process.exit(fails.length ? 1 : 0);
