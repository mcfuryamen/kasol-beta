// ==================== DATABASE (ESM) ====================
// IndexedDB via Dexie. Dexie is loaded globally via <script src="dexie.min.js">
// before the ESM entry, so the `Dexie` global is available here.
import { showToast } from './helpers.js';

const db = new Dexie('KasirSoloKakiLima');

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

// ==================== SETTINGS ====================
// `settings` uses { key, value } rows keyed on `key`.
export async function getSetting(key, defaultVal) {
  const row = await db.settings.get(key);
  return row && row.value !== undefined ? row.value : defaultVal;
}

export async function setSetting(key, value) {
  await db.settings.put({ key, value });
}

// Kept for backward-compat with the old `pengaturan` table (used by legacy
// flows). New code should prefer the `settings` table above.
export async function getPengaturan(key, defaultVal) {
  const row = await db.pengaturan.get(key);
  return row ? row.value : defaultVal;
}

export async function setPengaturan(key, value) {
  await db.pengaturan.put({ key, value });
}

export { showToast };
// Re-export db for convenience
export const DB = db;
