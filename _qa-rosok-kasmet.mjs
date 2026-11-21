/** QA fungsional #kasMet (Ambil dari?) — interaksi select nyata end-to-end. */
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

// M1: interaksi native select → value terbaca
await page.selectOption('#kasMet', 'transfer');
const m1 = await page.evaluate(() => document.getElementById('kasMet').value);
ok('M1 selectOption transfer → value terbaca', m1 === 'transfer', m1);

// M2: simpan penuh lewat form → baris tersimpan metode transfer
await safeEval(() => {
  document.getElementById('kasKet').value = 'Ambil via transfer QA';
  document.getElementById('kasJumlah').value = '75000';
  window.saveKasManual();
});
await page.waitForTimeout(600);
const m2 = await safeEval(async () => {
  const { db } = await import('./js/db.js');
  const row = (await db.kas.toArray()).pop();
  return { metode: row.metodeBayar, jumlah: row.jumlah, manual: row.manual };
});
ok('M2 simpan → metodeBayar transfer tersimpan', m2.metode === 'transfer' && m2.jumlah === 75000 && m2.manual === true, JSON.stringify(m2));

// M3: Buku Kas menampilkan '· transfer'
const m3 = await safeEval(() => {
  const row = document.querySelector('#kasList .row-item[onclick]');
  return row ? row.textContent : '';
});
ok('M3 Buku Kas menandai transfer', /· transfer/.test(m3), m3.slice(0, 80));

// M4: Tutup Kas melompati transfer (dari saldo sistem sejak titik awal)
const m4 = await safeEval(async () => {
  const { db } = await import('./js/db.js');
  const { hitungKasSistemSejak } = await import('./js/kas.js');
  const rows = await db.kas.toArray();
  const transfer = rows.find(r => r.keterangan === 'Ambil via transfer QA');
  const s = await hitungKasSistemSejak(new Date(new Date(transfer.tanggal).getTime() - 60000).toISOString());
  // hanya transfer di jendela ini → kontribusi harus 0
  return { s };
});
ok('M4 transfer tidak menggeser laci (kontribusi 0)', m4.s === 0, 'sistem=' + m4.s);

// M5: buka ulang form → default kembali 'tunai'
const m5 = await safeEval(() => {
  window.openKasForm();
  return document.getElementById('kasMet').value;
});
ok('M5 buka ulang form → default tunai', m5 === 'tunai', m5);

// M6: hint tidak lagi menyebut QRIS (tidak ada opsinya)
const m6 = await safeEval(() => document.querySelector('#sheetKas .hint')?.textContent || '');
ok('M6 hint konsisten tanpa QRIS', !/QRIS/.test(m6), m6.slice(0, 60));

// M7: pilih tunai lagi → save → menggeser laci
await page.selectOption('#kasMet', 'tunai');
await safeEval(() => {
  document.getElementById('kasKet').value = 'Beli atap tenda QA';
  document.getElementById('kasJumlah').value = '30000';
  window.saveKasManual();
});
await page.waitForTimeout(600);
const m7 = await safeEval(async () => {
  const { db } = await import('./js/db.js');
  const { hitungKasSistemSejak } = await import('./js/kas.js');
  const rows = await db.kas.toArray();
  const tunai = rows.find(r => r.keterangan === 'Beli atap tenda QA');
  const s = await hitungKasSistemSejak(new Date(new Date(tunai.tanggal).getTime() - 60000).toISOString());
  return { metode: tunai.metodeBayar, s };
});
ok('M7 tunai menggeser laci (-30000)', m7.metode === 'tunai' && m7.s === -30000, 'sistem=' + m7.s);

ok('Z tanpa pageerror', errors.length === 0, errors.join(' | ').slice(0, 150));
await browser.close();
console.log(`\n${results.filter(r => r.pass).length}/${results.length} PASS`);
process.exit(results.some(r => !r.pass) ? 1 : 0);
