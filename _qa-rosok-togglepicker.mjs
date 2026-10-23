/** QA tombol tanggal laporan rosok (fix detached-target auto-close). */
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

// Buka halaman Laporan via navbar
await page.evaluate(() => { const b = document.querySelector('.nav-item[data-screen="laporan"]'); if (b) b.click(); });
await page.waitForTimeout(600);
// Origin QA tanpa profil → banner profil muncul (perilaku app). Tanggalkan
// supaya tidak mengintersep klik uji; owner tidak terdampak (profilnya ada).
await page.evaluate(() => document.getElementById('profileBanner')?.classList.remove('show'));
await page.waitForTimeout(200);

async function pickerOpen() {
  return page.evaluate(() => !!document.querySelector('#reportDateNav .custom-picker'));
}
async function openNavAndToggle() {
  // Pastikan akordeon date-nav terbuka (klik tab aktif bila belum)
  await page.evaluate(() => {
    const box = document.getElementById('reportDateNav');
    if (box && !box.querySelector('.date-nav')) {
      const tab = document.querySelector('#screenLaporanFilter .report-tab.active');
      if (tab) tab.click();
    }
  });
  await page.waitForTimeout(200);
  await page.click('#reportDateNav .toggle-picker-btn');
  await page.waitForTimeout(300);
}

// E1–E4: toggle di semua periode harus MENGHILALKAN picker & TETAP terbuka
for (const p of ['harian', 'mingguan', 'bulanan', 'custom']) {
  await page.evaluate((per) => window._ksr_setLaporanPeriode(per), p);
  await page.waitForTimeout(250);
  await openNavAndToggle();
  const open = await pickerOpen();
  // toggle lagi → tertutup
  await page.click('#reportDateNav .toggle-picker-btn');
  await page.waitForTimeout(250);
  const closed = !(await pickerOpen());
  ok(`E ${p}: klik label buka picker & tetap terbuka`, open);
  ok(`E ${p}: klik label kedua kali menutup picker`, closed);
}

// E5: klik-luar sungguhan menutup picker
await openNavAndToggle();
await page.evaluate(() => document.querySelector('#screenLaporan h2, #screenLaporan .section-label, body').click());
await page.waitForTimeout(300);
ok('E5 klik di luar kartu filter menutup picker', !(await pickerOpen()));

// E6: pilih tanggal di kalender harian → terapkan & tutup
await page.evaluate(() => window._ksr_setLaporanPeriode('harian'));
await page.waitForTimeout(250);
await openNavAndToggle();
const pick = await page.evaluate(() => {
  const cell = [...document.querySelectorAll('#reportDateNav .custom-picker .cal-cell')].find(c => !c.classList.contains('empty') && !c.classList.contains('sel'));
  if (cell) cell.click();
  return !!cell;
});
await page.waitForTimeout(300);
ok('E6 pick tanggal menerapkan filter & menutup picker', pick && !(await pickerOpen()));

// E7: ganti tab periode menutup picker yang terbuka
await openNavAndToggle();
await page.evaluate(() => window._ksr_setLaporanPeriode('bulanan'));
await page.waitForTimeout(300);
ok('E7 ganti tab periode menutup picker', !(await pickerOpen()));

ok('Z tanpa pageerror', errors.length === 0, errors.join(' | ').slice(0, 200));
await browser.close();
console.log(`\n${results.filter(r => r.pass).length}/${results.length} PASS`);
process.exit(results.some(r => !r.pass) ? 1 : 0);
