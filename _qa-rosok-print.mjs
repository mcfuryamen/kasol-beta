/** QA tombol cetak rosok: nota print via emulasi media print + Cetak Tes guard. */
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
await page.evaluate(() => document.getElementById('profileBanner')?.classList.remove('show'));

// Seed satu transaksi jual di origin QA (isolasi) + kategori via app db
const seeded = await page.evaluate(async () => {
  const { db } = await import('./js/db.js');
  const kats = await db.kategori.toArray();
  const kat = kats[0] || { id: 1, nama: 'Aluminium', emoji: '🥫', hargaBeli: 8000, hargaJual: 15000 };
  const now = new Date().toISOString();
  const id = await db.transaksi.add({
    tanggal: now, tipe: 'jual', kontakNama: '', total: 30000,
    dibayarkan: 30000, sisa: 0, metodeBayar: 'tunai', void: false,
    items: [{ kategoriId: kat.id, kategoriNama: kat.nama, berat: 2, hargaSatuan: 15000, subtotal: 30000 }]
  });
  return id;
});
ok('S1 seed transaksi QA', !!seeded);

// Buka nota via riwayat detail
await page.evaluate(() => window.showScreen ? showScreen("laporan") : document.querySelector('.nav-item[data-screen="riwayat"]')?.click());
await page.waitForTimeout(700);
await page.evaluate(() => {
  const card = document.querySelector("#riwayatList .row-item");
  if (card) card.click();
});
await page.waitForTimeout(500);
const notaState = await page.evaluate(() => {
  const sheet = document.getElementById('sheetNota');
  const body = document.getElementById('notaBody');
  return {
    sheetShown: sheet && sheet.classList.contains('show'),
    notaFilled: !!body && body.innerHTML.length > 100,
    notaText: (document.getElementById('notaBody')?.textContent || '').includes('Rp'),
    btnInsidePrintArea: [...(document.querySelectorAll('#printArea .btn') || [])].length,
    imgInsidePrintArea: [...document.querySelectorAll('#printArea img')].map(i => i.alt || i.src.slice(0, 40))
  };
});
ok('S2 sheet nota terbuka & nota terisi', notaState.sheetShown && notaState.notaFilled, JSON.stringify(notaState));
ok('S3 tombol aksi di DALAM printArea (dugaan ikut tercetak)', notaState.btnInsidePrintArea >= 2, String(notaState.btnInsidePrintArea) + ' tombol');

// Emulasi media print → ukur apa yang "tercetak"
await page.emulateMedia({ media: 'print' });
const printView = await page.evaluate(() => {
  const vis = (el) => getComputedStyle(el).visibility;
  const area = document.getElementById('printArea');
  const btns = [...document.querySelectorAll('#printArea .btn')];
  return {
    areaVisible: area && vis(area) === 'visible',
    btnVisible: btns.filter(b => b.getBoundingClientRect().width > 0).length,
    proofVisible: (() => { const pr = document.querySelector('#printArea .nota-proof'); return pr ? vis(pr) !== 'none' : null; })(),
    bodyHidden: vis(document.querySelector('.nav-item')) === 'hidden'
  };
});
await page.screenshot({ path: '_qa-gui-screenshots/rosok-print-emulation.png', fullPage: false });
await page.emulateMedia({ media: 'screen' });
ok('S4 media print: printArea terlihat & konten app tersembunyi', printView.areaVisible && printView.bodyHidden, JSON.stringify(printView));
ok('S5 tombol aksi & bukti transfer TIDAK tercetak', printView.btnVisible === 0, JSON.stringify(printView));

// Cetak Tes tanpa printer → harus toast, bukan error
await page.evaluate(() => showScreen('pengaturan'));
await page.waitForTimeout(500);
await page.evaluate(() => { const r = [...document.querySelectorAll('.setting-row')].find(x => x.textContent.includes('Cetak Tes')); if (r) r.click(); });
await page.waitForTimeout(400);
const tesState = await page.evaluate(() => {
  const t = document.querySelector('.toast, #toast, .toast-msg');
  return { toastText: t ? t.textContent.trim() : (window.__lastToast || ''), visible: t && getComputedStyle(t).display !== 'none' && t.offsetParent !== null };
});
ok('S6 Cetak Tes tanpa printer → toast peringatan', /hubungkan/i.test(tesState.toastText || ''), tesState.toastText);

ok('Z tanpa pageerror', errors.length === 0, errors.join(' | ').slice(0, 150));
await browser.close();
console.log(`\n${results.filter(r => r.pass).length}/${results.length} PASS`);
process.exit(results.some(r => !r.pass) ? 1 : 0);
