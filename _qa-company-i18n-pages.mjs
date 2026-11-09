/** QA i18n lintas halaman — EN diterapkan benar di 6 halaman, tanpa regresi markup. */
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

// Sample cek per halaman: [selector, harapan berisi teks EN]
const CASES = [
  ['/', [
    ['[data-i18n="home.aplikasiTitle"]', /More Than/i],
    ['[data-i18n="home.ctaTitle"]', /Pay Once, Yours for Life/i],
    ['[data-i18n="home.colNew"]', /Kasir Solo Way/i],
  ]],
  ['/hardware', [
    ['[data-i18n="hw.filter.ALL"]', /All Arsenal/i],
    ['[data-i18n="hw.more"]', /View Details/i],
    ['[data-i18n="hw.worth"]', /Why It's Worth It/i],
    ['[data-i18n="hw.order"]', /Order via WA/i],
  ]],
  ['/about', [
    ['[data-i18n="about.heroTitle"]', /I Am Not a/i],
    ['[data-i18n="about.kontakTitle"]', /Talk to Me Directly/i],
    ['[data-i18n="about.lcTitle"]', /Verify It Yourself/i],
  ]],
  ['/visi-misi', [
    ['[data-i18n="visi.misiTitle"]', /We Grind/i],
    ['[data-i18n="visi.dnaTitle"]', /MY.*DNA/i],
    ['[data-i18n="visi.m1T"]', /Break the Expensive Myth/i],
    ['[data-i18n="visi.d6D"]', /hit and run/i],
  ]],
  ['/rekrutmen', [
    ['[data-i18n="rk.heroTitle"]', /Fellow Fighters/i],
    ['[data-i18n="rk.warn"]', /DON'T EVEN TRY/i],
    ['[data-i18n="rk.p1"]', /Civil-Servant Mentality/i],
    ['[data-i18n="rk.d2T"]', /Impact Over Output/i],
  ]],
  ['/portfolio', [
    ['[data-i18n="por.heroTitle"]', /No Fake/i],
    ['[data-i18n="por.terpasang"]', /Installed/i],
    ['[data-i18n="por.more"]', /View Details/i],
  ]],
];

for (const [path, checks] of CASES) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on('pageerror', (e) => errors.push(`${path} PAGEERROR: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`${path} CONSOLE: ${m.text()}`); });
  await page.goto(BASE + path, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(900);
  // Set EN lewat localStorage + reload (simulasi user pindah bahasa lalu jelajah)
  await page.evaluate(() => localStorage.setItem('mks-lang', 'en'));
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(900);

  for (const [sel, re] of checks) {
    const txt = await page.evaluate((s) => document.querySelector(s)?.textContent?.trim() || null, sel);
    ok(`${path} → ${sel}`, txt !== null && re.test(txt), (txt || 'NULL').slice(0, 60));
  }
  // Regresi umum: tidak ada teks 'undefined'/'[object'
  const bad = await page.evaluate(() => /undefined|\[object/i.test(document.body.innerText || ''));
  ok(`${path}: tanpa teks rusak (undefined/[object])`, !bad);
  // SVG ikon tetap ada di elemen yg dibungkus span (rk-warn mis.)
  const svgKept = await page.evaluate(() => document.querySelectorAll('header svg').length > 0);
  ok(`${path}: ikon header tetap ada`, svgKept);
  if (path === '/rekrutmen') {
    const warnSvg = await page.evaluate(() => !!document.querySelector('.rk-warn svg'));
    ok('rekrutmen: ikon peringatan tetap ada setelah i18n', warnSvg);
    await page.evaluate(() => document.getElementById('larangan')?.scrollIntoView({ block: 'center' }));
    await page.waitForTimeout(300);
    await page.screenshot({ path: SHOT + 'qn1-rekrutmen-en.png' });
  }
  if (path === '/hardware') await page.screenshot({ path: SHOT + 'qn2-hardware-en.png' });
  await page.close();
}

ok('Console bersih (tanpa error)', errors.length === 0, errors.slice(0, 3).join(' | '));

await browser.close();
const fails = results.filter((r) => !r.pass);
console.log(`\n=== ${results.length - fails.length}/${results.length} PASS ===`);
process.exit(fails.length ? 1 : 0);
