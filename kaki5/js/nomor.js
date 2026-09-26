// nomor.js — Penomoran transaksi (prefiks jenis + tanggal + urut harian).
// Format: PREFIX-YYYYMMDD-NNN
//   TRX = penjualan (termasuk pesanan yang ditahan/held — satu deret harian)
//   MSK = pemasukan
//   BLJ = pengeluaran
// Nomor dihitung dari data yang tersimpan (urut terbesar hari itu + 1), bukan
// dari counter terpisah, sehingga tahan terhadap reset settings dan tidak
// memakai ulang nomor transaksi yang sudah dihapus. Urutan reset tiap hari.
import { DB, getSetting, setSetting } from './db.js';

export const NOMOR_PREFIX = { penjualan: 'TRX', pemasukan: 'MSK', pengeluaran: 'BLJ' };

// 'YYYY-MM-DD' -> 'YYYYMMDD'; selain itu pakai tanggal lokal sekarang.
function tglKey(tanggalStr) {
  if (typeof tanggalStr === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(tanggalStr)) {
    return tanggalStr.replace(/-/g, '');
  }
  const d = (tanggalStr instanceof Date) ? tanggalStr : new Date();
  return String(d.getFullYear()) +
    String(d.getMonth() + 1).padStart(2, '0') +
    String(d.getDate()).padStart(2, '0');
}

function pad3(n) { return String(n).padStart(3, '0'); }

// Nomor berikutnya untuk kategori + tanggal. Panggil dari dalam
// DB.transaction('rw', tabelTujuan, ...) supaya dua penulisan serentak tidak
// menghasilkan nomor yang sama (read-max-then-add ikut ter-serialisasi).
export async function nextNomor(kategori, tanggalStr) {
  const prefix = NOMOR_PREFIX[kategori] || 'TRX';
  const tgl = tglKey(tanggalStr);
  const tanggalDash = tgl.slice(0, 4) + '-' + tgl.slice(4, 6) + '-' + tgl.slice(6, 8);
  const table = kategori === 'penjualan' ? DB.penjualan : DB.pengeluaran;
  const re = new RegExp('^' + prefix + '-' + tgl + '-(\\d+)$');
  let max = 0;
  const rows = await table.where('tanggal').equals(tanggalDash).toArray();
  for (const r of rows) {
    const m = re.exec(r.nomor || '');
    if (m) { const n = parseInt(m[1], 10); if (n > max) max = n; }
  }
  return prefix + '-' + tgl + '-' + pad3(max + 1);
}

// Backfill: beri nomor ke transaksi lama yang belum punya, urut waktu (FIFO)
// per kategori & per hari. Idempoten — lewati yang sudah bernomor dan tetap
// perhitungkan urutnya agar nomor berikutnya tidak menabrak. Return jumlah
// record yang baru di-assign.
export async function backfillNomor() {
  let assigned = 0;

  // Penjualan + held -> TRX (satu deret harian).
  const penj = await DB.penjualan.toArray();
  penj.sort((a, b) => (a.waktu || 0) - (b.waktu || 0) || (a.id || 0) - (b.id || 0));
  const seenTRX = {};
  for (const r of penj) {
    const tgl = tglKey(r.tanggal);
    const m = new RegExp('^TRX-' + tgl + '-(\\d+)$').exec(r.nomor || '');
    if (m) { const n = parseInt(m[1], 10); if (n > (seenTRX[tgl] || 0)) seenTRX[tgl] = n; continue; }
    const next = (seenTRX[tgl] || 0) + 1; seenTRX[tgl] = next;
    await DB.penjualan.update(r.id, { nomor: 'TRX-' + tgl + '-' + pad3(next) });
    assigned++;
  }

  // Pemasukan -> MSK, Pengeluaran -> BLJ (satu tabel, dua deret).
  const peng = await DB.pengeluaran.toArray();
  peng.sort((a, b) => (a.waktu || 0) - (b.waktu || 0) || (a.id || 0) - (b.id || 0));
  const seen = {};
  for (const r of peng) {
    const prefix = r.jenis === 'pemasukan' ? 'MSK' : 'BLJ';
    const tgl = tglKey(r.tanggal);
    const ck = prefix + ':' + tgl;
    const m = new RegExp('^' + prefix + '-' + tgl + '-(\\d+)$').exec(r.nomor || '');
    if (m) { const n = parseInt(m[1], 10); if (n > (seen[ck] || 0)) seen[ck] = n; continue; }
    const next = (seen[ck] || 0) + 1; seen[ck] = next;
    await DB.pengeluaran.update(r.id, { nomor: prefix + '-' + tgl + '-' + pad3(next) });
    assigned++;
  }
  return assigned;
}

// Jalankan backfill sekali per perangkat (guard flag di settings).
export async function ensureNomorBackfill() {
  const FLAG = 'nomorBackfill:v1';
  try {
    if ((await getSetting(FLAG)) === '1') return;
    const n = await backfillNomor();
    await setSetting(FLAG, '1');
    if (n > 0) console.log('[NOMOR] backfill: ' + n + ' transaksi diberi nomor');
  } catch (e) {
    console.error('[NOMOR] backfill gagal', e);
  }
}
