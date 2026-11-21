/** QA modul i18n — saklar globe ID/EN, persist, markup, mobile. */
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

await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1000);

// State awal = Indonesia
const init = await page.evaluate(() => ({
  lang: document.documentElement.lang,
  navJangkauan: document.querySelector('[data-i18n="nav.jangkauan"]')?.textContent.trim(),
  heroHasSpan: !!document.querySelector('[data-i18n="home.heroTitle"] .accent'),
  toggleVisible: !!(document.getElementById('langToggle')?.getBoundingClientRect().width > 0),
}));
ok('Default ID', init.lang === 'id', init.lang);
ok('Nav Jangkauan ID', init.navJangkauan === 'Jangkauan', init.navJangkauan);
ok('Saklar globe tampil', init.toggleVisible);

// 1:1 check — globe box persegi & di kiri CTA WA
const geom = await page.evaluate(() => {
  const g = document.getElementById('langToggle').getBoundingClientRect();
  const cta = document.querySelector('.nav-cta').getBoundingClientRect();
  return {
    square: Math.abs(g.width - g.height) <= 2,
    leftOfCta: g.right <= cta.left + 1,
    w: Math.round(g.width), h: Math.round(g.height),
  };
});
ok('Saklar 1:1 (persegi)', geom.square, `${geom.w}x${geom.h}`);
ok('Saklar di KIRI tombol WA/CTA', geom.leftOfCta);

// Toggle → EN
await page.click('#langToggle');
await page.waitForTimeout(400);
const en = await page.evaluate(() => ({
  lang: document.documentElement.lang,
  navCompany: document.querySelector('[data-i18n="nav.jangkauan"]')?.textContent.trim(),
  hero: document.querySelector('[data-i18n="home.heroTitle"]')?.textContent.trim(),
  heroSpan: document.querySelector('[data-i18n="home.heroTitle"] .accent')?.textContent || null,
  footer: document.querySelector('[data-i18n="footer.tagline"]')?.textContent.slice(0, 30),
  langCur: document.getElementById('langToggle')?.querySelector('.lang-cur')?.textContent,
  aria: document.getElementById('langToggle')?.getAttribute('aria-label'),
  pressed: document.getElementById('langToggle')?.getAttribute('aria-pressed'),
  storage: localStorage.getItem('mks-lang'),
  og: document.querySelector('meta[property="og:locale"]')?.getAttribute('content'),
}));
ok('Toggle → lang=en', en.lang === 'en');
ok('Nav Jangkauan → Coverage', en.navCompany === 'Coverage', en.navCompany);
ok('Hero EN dengan markup span utuh', /Biggest/.test(en.hero) && en.heroSpan === 'POS Machine', en.hero.slice(0, 40));
ok('Footer tagline EN', /Trusted technology/.test(en.footer), en.footer);
ok('Saklar label EN + aria-pressed + lang-cur', en.pressed === 'true' && en.langCur === 'EN', `${en.langCur} ${en.pressed}`);
ok('aria-label ter-update', /Switch language/.test(en.aria), en.aria);
ok('Persist localStorage', en.storage === 'en');
ok('og:locale → en_US', en.og === 'en_US', en.og);
await page.evaluate(() => window.scrollTo(0, 0));
await page.screenshot({ path: SHOT + 'qm1-en-header.png' });

// Reload → tetap EN (persist, tanpa FOUC id→en flash)
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForTimeout(900);
const persisted = await page.evaluate(() => ({
  lang: document.documentElement.lang,
  navCoverage: document.querySelector('[data-i18n="nav.jangkauan"]')?.textContent.trim(),
  // pastikan tidak ada duplikasi markup EN (EN diterapkan dari ID asli, bukan EN→EN)
  heroSpan: document.querySelector('[data-i18n="home.heroTitle"] .accent')?.textContent || null,
}));
ok('Persist setelah reload (EN)', persisted.lang === 'en' && persisted.navCoverage === 'Coverage', JSON.stringify(persisted));
ok('Re-apply EN idempoten (markup tidak dobel)', persisted.heroSpan === 'POS Machine', String(persisted.heroSpan));

// Balik → ID
await page.click('#langToggle');
await page.waitForTimeout(300);
const backId = await page.evaluate(() => ({
  lang: document.documentElement.lang,
  nav: document.querySelector('[data-i18n="nav.jangkauan"]')?.textContent.trim(),
  hero: document.querySelector('[data-i18n="home.heroTitle"]')?.textContent.trim(),
}));
ok('Balik ke ID', backId.lang === 'id' && backId.nav === 'Jangkauan' && /Pusat/.test(backId.hero), backId.nav);
ok('ID restore persis dari DOM asli', /Mesin Kasir/.test(backId.hero), backId.hero.slice(0, 30));

// Chrome i18n ada di halaman lain (nav/footer)
await page.goto(BASE + '/about', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(800);
await page.click('#langToggle');
await page.waitForTimeout(300);
const aboutEn = await page.evaluate(() => ({
  nav: document.querySelector('[data-i18n="nav.jangkauan"]')?.textContent.trim(),
  footerHead: document.querySelector('[data-i18n="footer.hubungi"]')?.textContent.trim(),
}));
ok('Saklar bekerja lintas halaman (Profil)', aboutEn.nav === 'Coverage' && aboutEn.footerHead === 'Contact Us', JSON.stringify(aboutEn));

// Mobile: saklar + tab bar
const mp = await browser.newPage({ viewport: { width: 390, height: 844 } });
mp.on('pageerror', (e) => errors.push('MOB PAGEERROR: ' + e.message));
await mp.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
await mp.waitForTimeout(800);
const mob = await mp.evaluate(() => {
  const g = document.getElementById('langToggle').getBoundingClientRect();
  return {
    visible: g.width > 0,
    square: Math.abs(g.width - g.height) <= 2,
    tabberanda: document.querySelector('[data-i18n="tab.beranda"]')?.textContent.trim(),
  };
});
ok('Mobile: saklar globe 1:1 tampil', mob.visible && mob.square, JSON.stringify(mob));
await mp.click('#langToggle');
await mp.waitForTimeout(300);
const mobEn = await mp.evaluate(() => document.querySelector('[data-i18n="tab.beranda"]')?.textContent.trim());
ok('Mobile: tab bar "Beranda" → "Home"', mobEn === 'Home', String(mobEn));
await mp.screenshot({ path: SHOT + 'qm2-mobile-en.png' });
const mOverflow = await mp.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
ok('Mobile: tanpa overflow horizontal', mOverflow <= 0, `${mOverflow}px`);

ok('Console bersih', errors.length === 0, errors.slice(0, 4).join(' | '));

await browser.close();
const fails = results.filter((r) => !r.pass);
console.log(`\n=== ${results.length - fails.length}/${results.length} PASS ===`);
process.exit(fails.length ? 1 : 0);
