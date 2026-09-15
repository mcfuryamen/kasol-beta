// ==================== DATABASE (ESM) ====================
// IndexedDB via Dexie. Dexie is loaded globally via <script src="dexie.min.js">
// before the ESM entry, so the `Dexie` global is available here.
import { showToast } from './helpers.js';

const db = new Dexie('KasirSoloKakiLima');

// Upgrade DB terblokir koneksi lain (mis. tab lama yang masih hidup saat
// update PWA di-reload): tanpa ini Dexie.open() menggantung tanpa error dan
// SEMUA daftar (menu/jualan/laporan) tampak "hilang" diam-diam.
// Reload sekali per tab (sessionStorage guard anti-loop); tab tua biasanya
// ikut memuat versi terbaru sehingga upgrade lolos setelah reload.
let _dbBlockedReloaded = false;
db.on('blocked', () => {
  if (_dbBlockedReloaded) return;
  try {
    if (sessionStorage.getItem('ksr:db-blocked-reload')) return;
    sessionStorage.setItem('ksr:db-blocked-reload', String(Date.now()));
  } catch (_) { /* storage blokir — tetap reload sekali */ }
  _dbBlockedReloaded = true;
  console.warn('[DB] Upgrade terblokir koneksi lain — memuat ulang halaman...');
  setTimeout(() => location.reload(), 300);
});

// version 1: existing tables (unchanged — migration-free)
db.version(1).stores({
  menu: '++id, nama, kategori, hargaJual, hargaModal, aktif, urutan',
  penjualan: '++id, tanggal, items, totalHarga, totalModal, bayar, kembalian, waktu',
  pengeluaran: '++id, tanggal, keterangan, kategori, jumlah, waktu',
  pengaturan: 'key'
});

// version 2: add `settings` table — Lapis-1 global schema (lisensi + identitas +
// banner + unitId). New empty table, no data migration required.
db.version(2).stores({
  menu: '++id, nama, kategori, hargaJual, hargaModal, aktif, urutan',
  penjualan: '++id, tanggal, items, totalHarga, totalModal, bayar, kembalian, waktu',
  pengeluaran: '++id, tanggal, keterangan, kategori, jumlah, waktu',
  pengaturan: 'key',
  settings: 'key'
});

// version 3: add `platformMessages` table — platform carousel (admin banner/promo)
db.version(3).stores({
  menu: '++id, nama, kategori, hargaJual, hargaModal, aktif, urutan',
  penjualan: '++id, tanggal, items, totalHarga, totalModal, bayar, kembalian, waktu',
  pengeluaran: '++id, tanggal, keterangan, kategori, jumlah, waktu',
  pengaturan: 'key',
  settings: 'key',
  platformMessages: '++id, order, visibleFrom, visibleUntil'
});

// version 4: tambah `toppingList` (JSON string) dan `hargaOjol` ke tabel menu
//    untuk fitur topping per-menu dan harga khusus ojol — migration-free,
//    Dexie otomatis menangani field baru di baris yang sudah ada.
db.version(4).stores({
  menu: '++id, nama, kategori, hargaJual, hargaModal, aktif, urutan',
  penjualan: '++id, tanggal, items, totalHarga, totalModal, bayar, kembalian, waktu',
  pengeluaran: '++id, tanggal, keterangan, kategori, jumlah, waktu',
  pengaturan: 'key',
  settings: 'key',
  platformMessages: '++id, order, visibleFrom, visibleUntil'
});

// version 5: konsinyasi — field `suplayer`, `pakaiStok`, `stok`, `retur` di tabel menu.
//    Field baru migration-free (Dexie handle otomatis).
//    `suplayer` di-index agar bisa grouping per suplayer di laporan.
//    `settings.kategoriCustom` & `settings.suplayerCustom` simpan daftar custom.
db.version(5).stores({
  menu: '++id, nama, kategori, hargaJual, hargaModal, aktif, urutan, suplayer',
  penjualan: '++id, tanggal, items, totalHarga, totalModal, bayar, kembalian, waktu',
  pengeluaran: '++id, tanggal, keterangan, kategori, jumlah, waktu',
  pengaturan: 'key',
  settings: 'key',
  platformMessages: '++id, order, visibleFrom, visibleUntil'
});

// version 6: fitur "Tahan" — transaksi disimpan dulu, dibayar nanti (komentar
//    browser v148, 2026-09-01). Field `status` membedakan held vs completed;
//    `heldName` label opsional biar user bisa kasih nama ("Meja 3", "Budi").
//    Index `status` agar query daftar held cepat & laporan tidak ikut hitung
//    held sebagai penjualan. Field baru migration-free.
db.version(6).stores({
  menu: '++id, nama, kategori, hargaJual, hargaModal, aktif, urutan, suplayer',
  penjualan: '++id, tanggal, items, totalHarga, totalModal, bayar, kembalian, waktu, status',
  pengeluaran: '++id, tanggal, keterangan, kategori, jumlah, waktu',
  pengaturan: 'key',
  settings: 'key',
  platformMessages: '++id, order, visibleFrom, visibleUntil'
});

// version 7: fitur KAS (adopsi dari rosok, v161) — tiga tabel baru, semuanya
// migration-free (tabel kosong, tidak ada data lama yang perlu diubah).
//   kasShift : satu baris per sesi buka→tutup kas. `status` STRING ('buka'|
//              'tutup') dan di-index — boolean TIDAK ter-index oleh IndexedDB.
//              `tanggalBuka` 'YYYY-MM-DD' di-index untuk lookup harian;
//              `waktuBuka`/`waktuTutup` ms epoch (sama seperti `waktu` di tabel lain).
//   kas      : mutasi uang laci yang BUKAN penjualan/pengeluaran (ambil kas
//              buat setor bank, nambah uang kembalian, dsb) — tidak masuk laba.
//   tutupBuku: snapshot rekap tahunan (sekali per tahun).
db.version(7).stores({
  menu: '++id, nama, kategori, hargaJual, hargaModal, aktif, urutan, suplayer',
  penjualan: '++id, tanggal, items, totalHarga, totalModal, bayar, kembalian, waktu, status',
  pengeluaran: '++id, tanggal, keterangan, kategori, jumlah, waktu',
  pengaturan: 'key',
  settings: 'key',
  platformMessages: '++id, order, visibleFrom, visibleUntil',
  kasShift: '++id, status, tanggalBuka, waktuBuka',
  kas: '++id, tanggal, tipe, shiftId',
  tutupBuku: '++id, tahun'
});

// version 8: SATU jalur pencatatan uang (permintaan pemilik, v164).
//
// Fitur "catat kas manual" di Beranda dihapus — tambah/ambil uang laci sekarang
// dicatat lewat form Pengeluaran/Pemasukan Laporan. Supaya uang yang sudah
// pernah dicatat lewat fitur lama tidak hilang, baris tabel `kas` DIPINDAHKAN
// ke `pengeluaran` sekali saat upgrade:
//   kas.tipe 'masuk'  → pemasukan kategori 'Modal Tambahan'   (non-laba)
//   kas.tipe 'keluar' → pengeluaran kategori 'Setor Bank / Prive' (non-laba)
// Keduanya mode tunai, jadi isi laci tetap sama persis sebelum & sesudah
// migrasi; yang berubah hanya Laba (uang pemilik memang bukan hasil usaha).
//
// Tabel `kas` SENGAJA tidak di-drop: menghapus object store di tengah transaksi
// upgrade berisiko kalau ada perangkat yang datanya belum selesai disalin, dan
// tabel kosong tidak mengganggu apa pun. Tidak ada lagi kode yang membaca atau
// menulisnya — lihat `sumber: 'migrasi-kas-v164'` sebagai penanda arsip.
//
// Index `jenis` + `metodeBayar` ditambahkan karena laporan/kas kini menyaring
// catatan berdasarkan keduanya.
function tanggalDariMs(ms) {
  const d = new Date(Number(ms));
  if (!Number.isFinite(d.getTime())) return '';
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

db.version(8).stores({
  menu: '++id, nama, kategori, hargaJual, hargaModal, aktif, urutan, suplayer',
  penjualan: '++id, tanggal, items, totalHarga, totalModal, bayar, kembalian, waktu, status',
  pengeluaran: '++id, tanggal, keterangan, kategori, jumlah, waktu, jenis, metodeBayar',
  pengaturan: 'key',
  settings: 'key',
  platformMessages: '++id, order, visibleFrom, visibleUntil',
  kasShift: '++id, status, tanggalBuka, waktuBuka',
  kas: '++id, tanggal, tipe, shiftId',
  tutupBuku: '++id, tahun'
}).upgrade(async tx => {
  const kasTabel = tx.table('kas');
  const rows = await kasTabel.toArray();
  if (!rows.length) return;
  const exp = tx.table('pengeluaran');
  let dipindah = 0;
  for (const k of rows) {
    const jumlah = Number(k?.jumlah) || 0;
    if (jumlah <= 0) continue;                    // baris rusak: tidak ada uang yang dipindah
    const masuk = k.tipe === 'masuk';
    const waktu = Number(k.waktu) || Date.now();
    await exp.add({
      tanggal: k.tanggal || tanggalDariMs(waktu),
      waktu,
      keterangan: (k.keterangan || '').trim() || (masuk ? 'Tambah kas (catatan lama)' : 'Ambil kas (catatan lama)'),
      kategori: masuk ? 'Modal Tambahan' : 'Setor Bank / Prive',
      jumlah,
      suplayer: '',
      ...(masuk ? { jenis: 'pemasukan' } : {}),
      metodeBayar: 'tunai',
      shiftId: k.shiftId ?? null,
      sumber: 'migrasi-kas-v164'
    });
    dipindah++;
  }
  await kasTabel.clear();
  console.log('[DB] v164: ' + dipindah + ' catatan kas manual dipindah ke Pengeluaran/Pemasukan');
});

// ==================== SETTINGS ====================
// `settings` uses { key, value } rows keyed on `key`.
export async function getSetting(key, defaultVal) {
  const row = await db.settings.get(key);
  return row && row.value !== undefined ? row.value : defaultVal;
}

export async function setSetting(key, value) {
  await db.settings.put({ key, value });
}

export { showToast };
// Re-export db for convenience
export const DB = db;
