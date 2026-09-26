/** QA fix riwayat rosok: paging per-hari, race render ganda, whitelist bukti, guard tutup buku. */
import { chromium } from 'file:///C:/Users/Admin/AppData/Local/npm-cache/_npx/9833c18b2d85bc59/node_modules/playwright/index.mjs';
import { writeFileSync, mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

const results = [];
const ok = (name, pass, detail = '') => {
  results.push({ name, pass });
  console.log(`${pass ? 'PASS' : 'FAIL'} — ${name}${detail ? ' :: ' + detail : ''}`);
};
const tmp = mkdtempSync(join(tmpdir(), 'qa-riwfix-'));
const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 420, height: 900 } });
const errors = [];
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
await page.goto('http://127.0.0.1:8084/index.html', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2200);

async function safeEval(fn) {
  for (let i = 0; i < 6; i++) {
    try {
      await page.waitForLoadState('domcontentloaded');
      return await Promise.race([
        page.evaluate(fn),
        new Promise((_, rej) => setTimeout(() => rej(new Error('evaluate timeout 8s')), 8000))
      ]);
    } catch (e) { if (i === 5) throw e; await page.waitForTimeout(1200); }
  }
}
async function confirmText() {
  return await safeEval(() => document.getElementById('confirmModal').classList.contains('show') ? document.getElementById('confirmText').textContent : null);
}
async function confirmCancel() {
  await safeEval(() => document.getElementById('confirmCancelBtn').click());
  await page.waitForTimeout(300);
}

await safeEval(() => document.getElementById('profileBanner')?.classList.remove('show'));

// ── Seed 25 transaksi di 25 HARI BERBEDA (lokal) + 3 hari di bulan ini ────
const katInfo = await safeEval(async () => {
  const { db } = await import('/js/db.js');
  await db.transaction('rw', db.transaksi, db.transaksiItem, db.kas, async () => {
    const old = await db.transaksi.where('id').aboveOrEqual(9100).toArray();
    const ids = old.map(t => t.id);
    await db.transaksi.bulkDelete(ids);
    for (const id of ids) await db.transaksiItem.where('transaksiId').equals(id).delete();
    await db.kas.where('refTransaksiId').aboveOrEqual(9100).delete();
  });
  await db.tutupBuku.clear();
  return (await db.kategori.toArray()).slice(0, 2).map(k => ({ id: k.id, nama: k.nama, hargaJual: k.hargaJual, hargaBeli: k.hargaBeli }));
});
const seed = { version: 3, exportDate: new Date().toISOString(), kategori: [], transaksi: [], transaksiItem: [], kas: [], kasShift: [], tutupBuku: [{ tahun: 2026, tanggalTutup: new Date().toISOString() }] };
const base = Date.now();
const p2 = (n) => String(n).padStart(2, '0');
for (let i = 0; i < 25; i++) {
  const kat = katInfo[i % 2];
  const beli = i % 2 === 0;
  const tempo = i % 4 === 0;
  const berat = 1 + (i % 4);
  const harga = beli ? (kat.hargaBeli || 10000) : (kat.hargaJual || 12000);
  const total = berat * harga;
  const d = new Date(base - i * 86400000);
  const tgl = d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate()) + 'T10:00:00';
  const id = 9100 + i;
  seed.transaksi.push({ id, tipe: beli ? 'beli' : 'jual', tanggal: tgl, total, dibayarkan: tempo ? Math.floor(total / 2) : total, sisa: tempo ? total - Math.floor(total / 2) : 0, metodeBayar: 'tunai', kontakNama: 'QA K' + i, ...(i === 0 ? { buktiBayar: 'javascript:alert(1)' } : {}) });
  seed.transaksiItem.push({ id, transaksiId: id, kategoriId: kat.id, kategoriNama: kat.nama, berat, hargaSatuan: harga, subtotal: total });
  seed.kas.push({ id, tanggal: tgl, tipe: beli ? 'keluar' : 'masuk', jumlah: tempo ? Math.floor(total / 2) : total, keterangan: 'QA seed ' + i, refTransaksiId: id, metodeBayar: 'tunai' });
}
const seedFile = join(tmp, 'seed.json');
writeFileSync(seedFile, JSON.stringify(seed));
await safeEval(() => window.showScreen('pengaturan'));
await page.waitForTimeout(300);
await page.setInputFiles('#importFile', seedFile);
await page.waitForTimeout(400);
await page.locator('#confirmOkBtn').click();
await page.waitForTimeout(800);
const cnt = await safeEval(async () => { const { db } = await import('/js/db.js'); return db.transaksi.count(); });
ok('Seed 25 trx di 25 hari terpasang', cnt === 25, `count=${cnt}`);

// ── Periode BULANAN → 25 hari → paging 10 hari/halaman ────────────────────
await safeEval(() => window.showScreen('laporan'));
await safeEval(() => window._ksr_setLaporanPeriode('bulanan'));
await page.waitForTimeout(800);
const g1 = await safeEval(() => ({
  headers: document.querySelectorAll('#riwayatList .riwayat-day-header').length,
  rows: document.querySelectorAll('#riwayatList .row-item').length,
  open: [...document.querySelectorAll('#riwayatList .riwayat-day-panel')].filter(p => p.style.display === 'block').length,
  more: !!document.querySelector('#riwayatList .riwayat-loadmore button')
}));
ok('Paging: halaman-1 = 10 HARI (tanpa duplikat)', g1.headers === 10, `headers=${g1.headers}, rows=${g1.rows}`);
ok('Paging: hari terbaru auto terbuka', g1.open === 1);
ok('Paging: tombol "Muat Lebih Banyak" muncul (15 hari sisa)', g1.more);
await page.evaluate(() => document.querySelector('#riwayatList .riwayat-loadmore button')?.click());
await page.waitForTimeout(500);
const g2 = await safeEval(() => ({
  headers: document.querySelectorAll('#riwayatList .riwayat-day-header').length,
  more: !!document.querySelector('#riwayatList .riwayat-loadmore button')
}));
// Bulan berjalan memuat 14 hari transaksi (14 Sep mundur ke 1 Sep) — semua tampil
// setelah satu APPEND, tombol hilang.
ok('Paging: APPEND → semua hari bulan ini (14), tombol hilang', g2.headers === 14 && !g2.more, `headers=${g2.headers}, more=${g2.more}`);

// ── Toggle akordeon ────────────────────────────────────────────────────────
const tg = await safeEval(() => {
  const hdr = document.querySelector('#riwayatList .riwayat-day-header');
  const panel = hdr.nextElementSibling;
  const before = panel.style.display;
  hdr.click();
  return { before, after: panel.style.display };
});
ok('Toggle akordeon hari bekerja', tg.before !== tg.after, `${tg.before} → ${tg.after}`);

// ── Race render ganda: panggil render 2x beruntun → hasil tetap benar ─────
await safeEval(() => { window._ksr_renderRiwayat(); window._ksr_renderRiwayat(); });
await page.waitForTimeout(700);
const rc = await safeEval(() => ({
  headers: document.querySelectorAll('#riwayatList .riwayat-day-header').length,
  rows: document.querySelectorAll('#riwayatList .row-item').length,
  dupIds: (() => { const ids = [...document.querySelectorAll('#riwayatList .row-item')].map(r => r.getAttribute('onclick')); return ids.length - new Set(ids).size; })()
}));
ok('RACE: render 2x beruntun → kembali halaman-1 (10 hari) tanpa duplikat', rc.headers === 10 && rc.dupIds === 0, `headers=${rc.headers}, dup=${rc.dupIds}, rows=${rc.rows}`);

// ── Whitelist bukti transfer: bukti arbitrer TIDAK dirender (dari seed) ───
await safeEval(() => window._ksr_viewTransaksiDetail(9100));
await page.waitForTimeout(500);
const bw = await safeEval(() => ({
  shown: getComputedStyle(document.getElementById('sheetNota')).display !== 'none',
  proofImg: !!document.querySelector('#notaBody .nota-proof img'),
  proofLabel: /Bukti Transfer/.test(document.getElementById('notaBody').textContent)
}));
ok('Whitelist bukti: sheet nota terbuka', bw.shown);
ok('Whitelist bukti: src arbitrer DITOLAK (img bukti tidak dirender)', !bw.proofImg, `label=${bw.proofLabel}`);
await safeEval(() => window._ksr_closeNota());

// ── Guard tutup buku (tutupBuku 2026 ikut seed) ───────────────────────────
// fire-and-forget: voidTransaksi await showConfirm (modal menunggu klik) —
// evaluate dgn implicit-return akan menggantung menunggu promisenya.
await safeEval(() => { window._ksr_voidTransaksi(9101); });
await page.waitForTimeout(500);
const vt = await confirmText();
ok('Guard tutup buku: confirm void berisi peringatan tahun', !!vt && /SUDAH dikunci dengan Tutup Buku/.test(vt), (vt || '').slice(0, 90));
await confirmCancel();
await safeEval(() => { window._ksr_deleteTransaksi(9102); });
await page.waitForTimeout(500);
const dt = await confirmText();
ok('Guard tutup buku: confirm hapus berisi peringatan tahun', !!dt && /SUDAH dikunci dengan Tutup Buku/.test(dt), (dt || '').slice(0, 90));
await confirmCancel();
// Guard tetap aktif utk screenshot (tak memengaruhi tampilan riwayat)

// ── Screenshot visual baru ────────────────────────────────────────────────
await safeEval(() => window.showScreen('laporan'));
await safeEval(() => window._ksr_setLaporanPeriode('bulanan'));
await page.waitForTimeout(800);
await safeEval(() => document.getElementById('profileBanner')?.classList.remove('show'));
await page.waitForTimeout(300);
await safeEval(() => document.querySelector('#riwayatList')?.closest('.card')?.scrollIntoView({ block: 'start' }));
await page.waitForTimeout(250);
await page.screenshot({ path: '_qa-gui-screenshots/fix-rosok-riwayat-akordeon.png' });
ok('Tanpa pageerror', errors.length === 0, errors.join(' | ').slice(0, 150));

await browser.close();
console.log(`\n${results.filter(r => r.pass).length}/${results.length} PASS`);
process.exit(results.some(r => !r.pass) ? 1 : 0);
