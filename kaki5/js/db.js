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
