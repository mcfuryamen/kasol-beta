// ==================== BACKUP & RESTORE (ESM) ====================
import { DB } from './db.js';
import { todayStr, showToast } from './helpers.js';
import { setCart } from './app-state.js';
import { showConfirm } from './confirm.js';
import { clearCartStorage } from './pos.js';
import { navigateTo } from './navigation.js';

// Kunci settings yang TIDAK boleh keluar-masuk file cadangan (T7, audit
// 2026-08-17/H5): lisensi aktif di file cadangan bisa diklon ke perangkat lain
// (ekspor lama menyertakan license.status='active' walau serial sudah dibuang);
// flag onboarded/sync juga spesifik perangkat dan menyesatkan bila dipindah.
// (Array di-inline di sanitizeSettingsRows supaya fungsi berdiri sendiri —
// test_validate.js mengekstraknya tanpa konteks modul.)

// Pure & testable: buang baris settings terlindungi (dipakai ekspor DAN impor,
// supaya file cadangan lama yang masih memuat license pun aman saat dipulihkan).
export function sanitizeSettingsRows(rows) {
  const PROTECTED = ['installId', 'unitId', 'deviceIdentity', 'license', 'onboarded', 'sync'];
  if (!Array.isArray(rows)) return [];
  return rows.filter(r => r && typeof r === 'object' && !PROTECTED.includes(r.key));
}

export async function exportData() {
  // Cadangan = DATA USAHA saja. Identitas perangkat & lisensi tidak ikut
  // (lihat PROTECTED_SETTINGS_KEYS) — file dibagikan ke HP lain tidak
  // membawa lisensi/klaim perangkat.
  const settings = sanitizeSettingsRows(await DB.settings.toArray());
  const data = {
    version: 1,
    exportDate: new Date().toISOString(),
    menu: await DB.menu.toArray(),
    penjualan: await DB.penjualan.toArray(),
    pengeluaran: await DB.pengeluaran.toArray(),
    pengaturan: await DB.pengaturan.toArray(),
    settings,
    platformMessages: await DB.platformMessages.toArray()
  };
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'cadangan-kasirsolo-' + todayStr() + '.json';
  a.click();
  URL.revokeObjectURL(url);
  showToast('✅ Data tersimpan ke file!');
}

// Pure validation — returns null if valid, else an error message (testable).
// Dua lapis (T6, audit 2026-08-17/H4):
//  1. Bentuk umum (array-of-object) — seperti sebelumnya.
//  2. FIELD per tabel + id valid + id unik — file rusak/hasil edit harus
//     DITOLAK DI DEPAN, bukan meledak di tengah proses restore. Digabung
//     dengan transaksi restore, data lama tidak mungkin hilang karena file buruk.
// HARUS tetap fungsi mandiri tanpa referensi luar — test_validate.js
// mengekstrak definisi ini berdiri sendiri.
export function validateBackup(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return 'File tidak valid: bukan objek cadangan!';
  }
  if (typeof data.version !== 'number' || data.version < 1) {
    return 'File tidak valid: versi tidak dikenal!';
  }
  if (!Array.isArray(data.menu)) {
    return 'File tidak valid: data menu hilang/rusak!';
  }
  const ok = arr => !arr || (Array.isArray(arr) &&
    arr.every(r => r && typeof r === 'object' && !Array.isArray(r)));
  if (!ok(data.penjualan) || !ok(data.pengeluaran) || !ok(data.pengaturan) || !ok(data.settings) || !ok(data.platformMessages)) {
    return 'File tidak valid: isi data rusak!';
  }

  // ── Lapis 2: validator field (inline supaya fungsi tetap mandiri) ──
  const isStr = v => typeof v === 'string';
  const isNum = v => typeof v === 'number' && Number.isFinite(v) && v >= 0;
  const isDate = v => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
  const validId = r => r.id === undefined || (Number.isInteger(r.id) && r.id > 0);

  // Menu: nama wajib terisi, harga jual wajib angka >= 0.
  for (const m of data.menu) {
    if (!isStr(m.nama) || !m.nama.trim()) return 'File ditolak: ada menu tanpa nama / nama rusak.';
    if (!isNum(m.hargaJual)) return 'File ditolak: harga jual menu "' + m.nama + '" tidak valid.';
    if (m.hargaModal !== undefined && !isNum(m.hargaModal)) return 'File ditolak: harga modal menu "' + m.nama + '" tidak valid.';
    if (!validId(m)) return 'File ditolak: ada menu dengan id tidak valid.';
  }
  // Penjualan: tanggal format YYYY-MM-DD, total angka, items array.
  const penjualan = data.penjualan || [];
  for (const s of penjualan) {
    if (!isDate(s.tanggal)) return 'File ditolak: ada transaksi dengan tanggal rusak.';
    if (!isNum(s.totalHarga)) return 'File ditolak: ada transaksi dengan total rusak.';
    if (s.items !== undefined && !Array.isArray(s.items)) return 'File ditolak: ada transaksi dengan daftar item rusak.';
    if (!validId(s)) return 'File ditolak: ada transaksi dengan id tidak valid.';
  }
  // Pengeluaran: tanggal + jumlah wajib benar.
  for (const e of (data.pengeluaran || [])) {
    if (!isDate(e.tanggal)) return 'File ditolak: ada pengeluaran dengan tanggal rusak.';
    if (!isNum(e.jumlah)) return 'File ditolak: ada pengeluaran dengan jumlah uang rusak.';
    if (!validId(e)) return 'File ditolak: ada pengeluaran dengan id tidak valid.';
  }
  // settings/pengaturan: key wajib string terisi.
  for (const r of (data.settings || [])) {
    if (!isStr(r.key) || !r.key) return 'File ditolak: ada pengaturan dengan key rusak.';
  }
  for (const r of (data.pengaturan || [])) {
    if (!isStr(r.key) || !r.key) return 'File ditolak: ada pengaturan lama dengan key rusak.';
  }
  // Id duplikat dalam satu tabel akan bikin bulkAdd gagal di tengah jalan —
  // tolak di depan dengan pesan jelas.
  const dupCheck = (arr, label) => {
    const seen = new Set();
    for (const r of arr) {
      if (r.id === undefined) continue;
      if (seen.has(r.id)) return 'File ditolak: ada ' + label + ' dengan id ganda (' + r.id + ').';
      seen.add(r.id);
    }
    return null;
  };
  const dup = dupCheck(data.menu, 'menu') || dupCheck(penjualan, 'transaksi') || dupCheck(data.pengeluaran || [], 'pengeluaran');
  if (dup) return dup;

  return null;
}

export async function importData(event) {
  const file = event.target.files[0];
  if (!file) return;
  try {
    const text = await file.text();
    const data = JSON.parse(text);
    const err = validateBackup(data);
    if (err) { showToast(err, 'error', { duration: 6000 }); return; }
    // ensure missing arrays default to []
    data.penjualan = data.penjualan || [];
    data.pengeluaran = data.pengeluaran || [];
    data.pengaturan = data.pengaturan || [];
    data.settings = sanitizeSettingsRows(data.settings || []);
    data.platformMessages = data.platformMessages || [];

    showConfirm('📂', 'Data lama akan diganti dengan data dari file cadangan. Lanjut?', 'Ya, Pulihkan', async () => {
      try {
        // TRANSAKSI (T6): clear + insert satu paket atomik. Gagal di tabel mana
        // pun = rollback total — data lama tetap utuh (dulu: clear duluan tanpa
        // transaksi, file rusak di tengah = data lenyap).
        await DB.transaction(
          'rw',
          [DB.menu, DB.penjualan, DB.pengeluaran, DB.pengaturan, DB.settings, DB.platformMessages],
          async () => {
            await DB.menu.clear();
            await DB.penjualan.clear();
            await DB.pengeluaran.clear();
            await DB.pengaturan.clear();
            await DB.settings.clear();
            await DB.platformMessages.clear();

            if (data.menu.length) await DB.menu.bulkAdd(data.menu);
            if (data.penjualan.length) await DB.penjualan.bulkAdd(data.penjualan);
            if (data.pengeluaran.length) await DB.pengeluaran.bulkAdd(data.pengeluaran);
            if (data.pengaturan.length) await DB.pengaturan.bulkAdd(data.pengaturan);
            if (data.settings.length) await DB.settings.bulkAdd(data.settings);
            if (data.platformMessages.length) await DB.platformMessages.bulkAdd(data.platformMessages);
          }
        );

        clearCartStorage();
        showToast('✅ Data berhasil dipulihkan!');
        navigateTo('beranda');
      } catch (err) {
        console.error('[Restore] failed:', err);
        showToast('Pemulihan dibatalkan — data lama tetap utuh. (' + String(err?.message || err).slice(0, 120) + ')', 'error', { duration: 6000 });
      }
    });
  } catch (e) {
    console.error('[Import] parse error:', e);
    showToast('Gagal membaca file!', 'error');
  }
  event.target.value = '';
}

export function confirmClearAll() {
  showConfirm('⚠️', 'SEMUA data akan dihapus dan tidak bisa dikembalikan! Yakin?', 'Ya, Hapus Semua', async () => {
    await DB.menu.clear();
    await DB.penjualan.clear();
    await DB.pengeluaran.clear();
    await DB.pengaturan.clear();
    await DB.settings.clear();
    await DB.platformMessages.clear();
    setCart({});
    clearCartStorage();
    showToast('Semua data dihapus');
    navigateTo('beranda');
  });
}
