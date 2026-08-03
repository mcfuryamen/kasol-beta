/* =========================================================================
   KASIR SOLO - ROSOK
   db.js — Database setup ONLY. Zero imports.
   ========================================================================= */
export const db = new Dexie("KasirSoloRosokDB");
db.version(1).stores({
  settings: 'key',
  kategori: '++id, nama, aktif',
  transaksi: '++id, tipe, tanggal',
  transaksiItem: '++id, transaksiId, kategoriId',
  kas: '++id, tanggal, tipe'
});
db.version(2).stores({
  settings: 'key',
  kategori: '++id, nama, aktif',
  transaksi: '++id, tipe, tanggal',
  transaksiItem: '++id, transaksiId, kategoriId',
  kas: '++id, tanggal, tipe',
  kasShift: '++id, status, waktuBuka'
});
db.version(3).stores({
  settings: 'key',
  kategori: '++id, nama, aktif',
  transaksi: '++id, tipe, tanggal',
  transaksiItem: '++id, transaksiId, kategoriId',
  kas: '++id, tanggal, tipe',
  kasShift: '++id, status, waktuBuka',
  platformMessages: '++id, order, visibleFrom, visibleUntil'
});
db.version(4).stores({
  settings: 'key',
  kategori: '++id, nama, aktif',
  transaksi: '++id, tipe, tanggal',
  transaksiItem: '++id, transaksiId, kategoriId',
  kas: '++id, tanggal, tipe',
  kasShift: '++id, status, waktuBuka',
  platformMessages: '++id, order, visibleFrom, visibleUntil',
  tutupBuku: '++id, tahun'
});
