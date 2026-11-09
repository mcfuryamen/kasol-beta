/** QA layout sheet Catat Kas rosok vs konvensi form (kasus input date telanjang). */
import { chromium } from 'file:///C:/Users/Admin/AppData/Local/npm-cache/_npx/9833c18b2d85bc59/node_modules/playwright/index.mjs';

const results = [];
const ok = (name, pass, detail = '') => {
  results.push({ name, pass });
  console.log(`${pass ? 'PASS' : 'FAIL'} — ${name}${detail ? ' :: ' + detail : ''}`);
};

const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 420, height: 900 } });
const errors = [];
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
await page.goto('http://127.0.0.1:8084/index.html', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2000);

async function safeEval(fn) {
  for (let i = 0; i < 6; i++) {
    try {
      await page.waitForLoadState('domcontentloaded');
      return await page.evaluate(fn);
    } catch (e) {
      if (i === 5) throw e;
      await page.waitForTimeout(1200);
    }
  }
}
await safeEval(() => document.getElementById('profileBanner')?.classList.remove('show'));
await safeEval(() => { window.openKasForm(); });
await page.waitForTimeout(400);

const m = await safeEval(() => {
  const ids = ['kasKet', 'kasKat', 'kasTgl', 'kasJumlah'];
  const rows = ids.map(id => {
    const el = document.getElementById(id);
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return { id, w: Math.round(r.width), h: Math.round(r.height), font: cs.fontFamily.split(',')[0], size: cs.fontSize, full: r.width > 350 };
  });
  const sel = document.getElementById('kasKat');
  const bg = getComputedStyle(sel).backgroundImage;
  const sheet = document.getElementById('sheetKas');
  const btnH = Math.round(document.getElementById('kasJumlah').getBoundingClientRect().height);
  return { rows, chevron: bg.includes('svg'), sheetShown: sheet.classList.contains('show'), btnH };
});
for (const r of m.rows) {
  ok(`L ${r.id}: penuh & konsisten (${r.w}x${r.h}, ${r.font} ${r.size})`, r.full && r.h >= 40 && /Inter/i.test(r.font));
}
ok('L select punya chevron ala kaki5', m.chevron);
ok('L sheet terbuka', m.sheetShown);
await page.screenshot({ path: '_qa-gui-screenshots/rosok-kas-form.png' });

ok('Z tanpa pageerror', errors.length === 0, errors.join(' | ').slice(0, 150));
await browser.close();
console.log(`\n${results.filter(r => r.pass).length}/${results.length} PASS`);
process.exit(results.some(r => !r.pass) ? 1 : 0);
