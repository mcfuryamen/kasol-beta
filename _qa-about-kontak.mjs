/** QA modul Kontak di /about — posisi paling akhir, konten, link, mobile. */
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

const res = await page.goto(BASE + '/about', { waitUntil: 'domcontentloaded' });
ok('HTTP 200', res?.status() === 200, String(res?.status()));
await page.waitForTimeout(800);

const st = await page.evaluate(() => {
  const markas = document.getElementById('markas');
  const band = markas?.querySelector('.office-band');
  const kontak = markas?.querySelector('.contact-grid');
  const bandR = band?.getBoundingClientRect();
  const firstCard = kontak?.querySelector('.contact-card')?.getBoundingClientRect();
  return {
    merged: !!markas && !!band && !!kontak,
    noStandalone: !document.getElementById('kontak'),
    overlap: bandR && firstCard ? firstCard.top < bandR.bottom : false,
    wa: kontak?.querySelector('a[href^="https://wa.me/628816566935"]')?.getAttribute('href') || '',
    mail: kontak?.querySelector('a[href^="mailto:owner.kasirsolo@gmail.com"]')?.getAttribute('href') || '',
    cards: kontak?.querySelectorAll('.contact-card').length || 0,
    legalText: kontak?.textContent.includes('Kartasura') && kontak?.textContent.includes('Blora'),
    phone: kontak?.querySelector('.contact-card h3')?.textContent || '',
    caption: markas?.querySelector('.office-caption h3')?.textContent || '',
  };
});
ok('Kontak menyatu di section markas (tanpa #kontak terpisah)', st.merged && st.noStandalone);
ok('Kartu kontak overlap band foto', st.overlap);
ok('Caption markas tetap ada', /Markas/i.test(st.caption), st.caption);
ok('4 kartu kontak', st.cards === 4, `${st.cards}`);
ok('Link WA benar', st.wa.startsWith('https://wa.me/628816566935'));
ok('Link mailto benar', st.mail === 'mailto:owner.kasirsolo@gmail.com');
ok('Alamat legal (Kartasura) & operasional (Blora) tampil', st.legalText);
ok('Nomor telepon tampil', /\+62/.test(st.phone), st.phone);

await page.evaluate(() => document.getElementById('markas')?.scrollIntoView({ block: 'center' }));
await page.waitForTimeout(400);
await page.screenshot({ path: SHOT + 'qk1-kontak-about.png' });

// Mobile
const mp = await browser.newPage({ viewport: { width: 390, height: 844 } });
mp.on('pageerror', (e) => errors.push('MOB PAGEERROR: ' + e.message));
await mp.goto(BASE + '/about', { waitUntil: 'domcontentloaded' });
await mp.waitForTimeout(800);
const mSt = await mp.evaluate(() => {
  const vw = document.documentElement.clientWidth;
  const cards = Array.from(document.querySelectorAll('#markas .contact-card'));
  const wide = cards.filter((c) => c.getBoundingClientRect().width > vw * 0.8).length;
  return { wide, total: cards.length };
});
ok('Mobile: kartu kontak menumpuk 1 kolom', mSt.wide === mSt.total, JSON.stringify(mSt));
const mOverflow = await mp.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
ok('Mobile: tanpa overflow horizontal', mOverflow <= 0, `${mOverflow}px`);

ok('Console bersih', errors.length === 0, errors.slice(0, 3).join(' | '));

await browser.close();
const fails = results.filter((r) => !r.pass);
console.log(`\n=== ${results.length - fails.length}/${results.length} PASS ===`);
process.exit(fails.length ? 1 : 0);
