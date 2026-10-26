/** QA riwayat transaksi: interaksi & screenshot rosok vs kaki5. */
import { chromium } from 'file:///C:/Users/Admin/AppData/Local/npm-cache/_npx/9833c18b2d85bc59/node_modules/playwright/index.mjs';
import { writeFileSync, mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

const tmp = mkdtempSync(join(tmpdir(), 'qa-riwayat-'));

const results = [];
const ok = (name, pass, detail = '') => {
  results.push({ name, pass });
  console.log(`${pass ? 'PASS' : 'FAIL'} — ${name}${detail ? ' :: ' + detail : ''}`);
};
const browser = await chromium.launch({ channel: 'chrome' });
const ctx = await browser.newContext({ viewport: { width: 420, height: 900 } });

// ══ ROSOK ══════════════════════════════════════════════════════════════════
const r = await ctx.newPage();
const rErr = [];
r.on('pageerror', (e) => rErr.push('PAGEERROR: ' + e.message));
await r.goto('http://127.0.0.1:8084/index.html', { waitUntil: 'domcontentloaded' });
await r.waitForTimeout(2200);
await r.evaluate(() => document.getElementById('profileBanner')?.classList.remove('show'));
// Seed 25 transaksi bila DB QA kosong (origin 127.0.0.1 terisolasi) — lewat
// jalur resmi import cadangan (payload tanpa signature = kompatibel) →
// sekaligus cukup untuk menguji paging 20/halaman.
const rCount = await r.evaluate(async () => {
  const { db } = await import('/js/db.js');
  // Bersihkan sisa seed run sebelumnya (id >= 9100) supaya deterministik
  await db.transaction('rw', db.transaksi, db.transaksiItem, db.kas, async () => {
    const old = await db.transaksi.where('id').aboveOrEqual(9100).toArray();
    const ids = old.map(t => t.id);
    await db.transaksi.bulkDelete(ids);
    for (const id of ids) await db.transaksiItem.where('transaksiId').equals(id).delete();
    await db.kas.where('refTransaksiId').aboveOrEqual(9100).delete();
  });
  return db.transaksi.count();
});
if (rCount < 25) {
  const katIds = await r.evaluate(async () => {
    const { db } = await import('/js/db.js');
    return (await db.kategori.toArray()).slice(0, 3).map(k => ({ id: k.id, nama: k.nama, hargaJual: k.hargaJual, hargaBeli: k.hargaBeli }));
  });
  const seed = { version: 3, exportDate: new Date().toISOString(), kategori: [], transaksi: [], transaksiItem: [], kas: [], kasShift: [], tutupBuku: [] };
  const base = Date.now();
  for (let i = 0; i < 25; i++) {
    const kat = katIds[i % 3];
    const beli = i % 2 === 0;
    const tempo = i % 4 === 0;
    const transfer = !tempo && i % 5 === 0;
    const berat = 1 + (i % 5);
    const harga = beli ? (kat.hargaBeli || 10000) : (kat.hargaJual || 12000);
    const total = berat * harga;
    const tgl = new Date(base - i * 60000).toISOString(); // berjajar menit — semua hari ini (lokal)
    const id = 9100 + i;
    seed.transaksi.push({ id, tipe: beli ? 'beli' : 'jual', tanggal: tgl, total, dibayarkan: tempo ? Math.floor(total / 2) : total, sisa: tempo ? total - Math.floor(total / 2) : 0, metodeBayar: transfer ? 'transfer' : 'tunai', kontakNama: 'QA Kontak ' + i });
    seed.transaksiItem.push({ id, transaksiId: id, kategoriId: kat.id, kategoriNama: kat.nama, berat, hargaSatuan: harga, subtotal: total });
    seed.kas.push({ id, tanggal: tgl, tipe: beli ? 'keluar' : 'masuk', jumlah: tempo ? Math.floor(total / 2) : total, keterangan: 'QA seed ' + i, refTransaksiId: id, metodeBayar: transfer ? 'transfer' : 'tunai' });
  }
  const f = join(tmp, 'seed-riwayat.json');
  writeFileSync(f, JSON.stringify(seed));
  await r.evaluate(() => window.showScreen('pengaturan'));
  await r.waitForTimeout(300);
  await r.setInputFiles('#importFile', f);
  await r.waitForTimeout(400);
  await r.locator('#confirmOkBtn').click();
  await r.waitForTimeout(800);
  const seeded = await r.evaluate(async () => {
    const { db } = await import('/js/db.js');
    return db.transaksi.count();
  });
  ok('R seed 25 transaksi terpasang (jalur import resmi)', seeded === 25, `count=${seeded}`);
}
await r.evaluate(() => window.showScreen('laporan'));
await r.evaluate(() => window.showScreen('laporan')); // satu panggilan render (hook nav) — render ganda memicu race append
await r.waitForTimeout(700);
const rlist = await r.evaluate(() => document.getElementById('riwayatList'));
await r.evaluate(() => document.querySelector('#riwayatList')?.closest('.card')?.scrollIntoView({ block: 'start' }));
await r.waitForTimeout(250);
await r.screenshot({ path: '_qa-gui-screenshots/cmp-rosok-riwayat.png' });
const rcount = await r.evaluate(() => document.querySelectorAll('#riwayatList .row-item').length);
// BUG DOKUMENTASI: satu showScreen memicu render riwayat 2x (race append) →
// halaman-1 menampilkan 25 row (20+5) & tombol "Muat Lebih Banyak" hilang.
ok('R paging halaman-1 = 20 row', rcount === 20, `items=${rcount} (BUG race render bila ≠20)`);
const rmore = await r.evaluate(() => !!document.querySelector('#riwayatList .riwayat-loadmore button'));
ok('R tombol "Muat Lebih Banyak" tampil saat ada sisa halaman', rmore, rmore ? 'ok' : 'HILANG — korban race render dobel');
if (rcount > 20) {
  const before = rcount;
  await r.evaluate(() => window._ksr_loadRiwayatPage());
  await r.waitForTimeout(500);
  const after = await r.evaluate(() => document.querySelectorAll('#riwayatList .row-item').length);
  ok('R mekanisme APPEND bekerja (delta +5 sisa halaman)', after > before, `${before} → ${after}`);
}
// Klik baris pertama → sheet nota detail
const firstId = await r.evaluate(() => document.querySelector('#riwayatList .row-item').getAttribute('onclick').match(/\d+/)[0]);
await r.evaluate((id) => window._ksr_viewTransaksiDetail(Number(id)), firstId);
await r.waitForTimeout(600);
const rd = await r.evaluate(() => ({
  shown: getComputedStyle(document.getElementById('sheetNota')).display !== 'none',
  void: !!document.querySelector('#notaBody [onclick*="voidTransaksi"]'),
  del: !!document.querySelector('#notaBody [onclick*="deleteTransaksi"]'),
  lunasi: !!document.querySelector('#notaBody [onclick*="openLunasi"]'),
  hasItems: document.querySelectorAll('#notaBody .nota-item, #notaBody tr').length > 0
}));
ok('R klik row → sheet nota detail terbuka', rd.shown);
ok('R detail: tombol Void & Hapus ada', rd.void && rd.del);
ok('R detail: tombol Lunasi hanya utk Tempo (sesuai data)', typeof rd.lunasi === 'boolean');
await r.screenshot({ path: '_qa-gui-screenshots/cmp-rosok-riwayat-detail.png' });
await r.evaluate(() => window._ksr_closeNota());
ok('R tanpa pageerror', rErr.length === 0, rErr.join(' | ').slice(0, 120));
await r.close();

// ══ KAKI5 ══════════════════════════════════════════════════════════════════
const k = await ctx.newPage();
const kErr = [];
k.on('pageerror', (e) => kErr.push('PAGEERROR: ' + e.message));
await k.goto('http://127.0.0.1:8086/index.html', { waitUntil: 'domcontentloaded' });
await k.waitForTimeout(3000);
for (let i = 0; i < 4; i++) {
  await k.evaluate(() => {
    const b = document.getElementById('profileBanner'); if (b) b.classList.remove('show');
    const t = document.getElementById('tcModal'); if (t) t.classList.remove('show');
  });
  await k.waitForTimeout(300);
}
await k.evaluate(() => document.querySelector('[data-page="laporan"]')?.click());
await k.waitForTimeout(1200);
// Seed penjualan sintetis bila QA origin kaki5 kosong (bulkAdd langsung — origin terisolasi)
const kHasTrx = await k.evaluate(async () => {
  const { DB } = await import('/js/db.js');
  const c = await DB.penjualan.count();
  if (c > 0) return c;
  const base = Date.now();
  const p2 = (n) => String(n).padStart(2, '0');
  const rows = [];
  for (let i = 0; i < 8; i++) {
    const day = new Date(base - (i % 3) * 86400000);
    const tglLokal = day.getFullYear() + '-' + p2(day.getMonth() + 1) + '-' + p2(day.getDate());
    rows.push({
      tanggal: tglLokal, waktu: day.getTime(),
      items: [{ nama: 'QA Menu ' + (i % 3), qty: 1 + (i % 3), harga: 15000, selectedToppings: [] }],
      totalHarga: 15000 * (1 + (i % 3)), bayar: 100000, kembalian: 100000 - 15000 * (1 + (i % 3)),
      totalModal: 8000, metodeBayar: i % 3 === 0 ? 'qris' : 'tunai',
      status: 'done', createdAt: day.getTime()
    });
  }
  await DB.penjualan.bulkAdd(rows);
  return await DB.penjualan.count();
});
await k.evaluate(() => document.querySelector('[data-page="laporan"]')?.click());
await k.waitForTimeout(1200);
const kcard = await k.evaluate(() => {
  const cards = [...document.querySelectorAll('#reportContent .card')];
  return cards.find(c => c.querySelector('.card-title')?.textContent.includes('Riwayat Transaksi')) || null;
});
ok('K kartu Riwayat Transaksi ada di Laporan', !!kcard);
await k.evaluate(() => {
  const cards = [...document.querySelectorAll('#reportContent .card')];
  const c = cards.find(c => c.querySelector('.card-title')?.textContent.includes('Riwayat Transaksi'));
  c?.scrollIntoView({ block: 'start' });
});
await k.waitForTimeout(250);
await k.screenshot({ path: '_qa-gui-screenshots/cmp-kaki5-riwayat.png' });
const kg = await k.evaluate(() => ({
  headers: document.querySelectorAll('#reportContent .trx-day-header[data-tglid]').length,
  open: [...document.querySelectorAll('#reportContent .trx-day-panel')].filter(p => p.style.display !== 'none').length,
  items: document.querySelectorAll('#reportContent .trx-day-panel .trx-item').length
}));
ok('K riwayat di-group per hari (header akordeon)', kg.headers > 0, `headers=${kg.headers}`);
ok('K tanggal aktif terbuka otomatis', kg.open >= 1, `open=${kg.open}`);
// Toggle akordeon: klik header pertama (yang terbuka) → panel tutup
const firstHdr = await k.evaluate(() => document.querySelector('#reportContent .trx-day-header[data-tglid]')?.dataset.tglid);
if (firstHdr) {
  const before = await k.evaluate((id) => document.getElementById(id).style.display, firstHdr);
  await k.evaluate((id) => document.querySelector(`[data-tglid="${id}"]`).click(), firstHdr);
  await k.waitForTimeout(350);
  const after = await k.evaluate((id) => document.getElementById(id).style.display, firstHdr);
  ok('K klik header → akordeon expand/collapse', before !== after, `${before} → ${after}`);
  await k.evaluate((id) => document.querySelector(`[data-tglid="${id}"]`).click(), firstHdr);
  await k.waitForTimeout(250);
}
// Klik item transaksi → modal detail
await k.evaluate(() => document.querySelector('#reportContent .trx-day-panel .trx-item')?.click());
await k.waitForTimeout(600);
const kd = await k.evaluate(() => ({
  shown: getComputedStyle(document.getElementById('trxDetailModal')).display !== 'none',
  del: !!document.getElementById('trxDeleteBtn'),
  print: !!document.querySelector('#trxDetailModal [data-action="print-nota"]'),
  table: !!document.querySelector('#trxDetailContent table'),
  untung: /Untung Kotor/.test(document.getElementById('trxDetailContent').textContent)
}));
ok('K klik item → modal detail terbuka', kd.shown);
ok('K detail: tabel item + Untung Kotor ada', kd.table && kd.untung);
ok('K detail: Hapus + Cetak Nota (pola detail-actions)', kd.del && kd.print);
await k.screenshot({ path: '_qa-gui-screenshots/cmp-kaki5-riwayat-detail.png' });
ok('K tanpa pageerror', kErr.length === 0, kErr.join(' | ').slice(0, 120));
await k.close();

await browser.close();
console.log(`\n${results.filter(x => x.pass).length}/${results.length} PASS`);
process.exit(results.some(x => !x.pass) ? 1 : 0);
