// ==================== BACKUP & RESTORE (ESM) ====================
import { DB } from './db.js';
import { todayStr, showToast } from './helpers.js';
import { setCart } from './app-state.js';
import { showConfirm } from './confirm.js';
import { clearCartStorage } from './pos.js';
import { navigateTo } from './navigation.js';

export async function exportData() {
  // Exclude sensitive/device-bound keys from the backup so a shared file never
  // leaks the license serial, installId, or unitId (device identity + CRM data).
  const sensitiveKeys = ['installId', 'unitId', 'deviceIdentity'];
  const settings = (await DB.settings.toArray())
    .filter(r => !sensitiveKeys.includes(r.key))
    .map(r => r.key === 'license' && r.value && typeof r.value === 'object'
      ? { ...r, value: { ...r.value, serial: undefined } }
      : r);
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

// Pure validation — returns null if valid, else an error message (testable)
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
  return null;
}

export async function importData(event) {
  const file = event.target.files[0];
  if (!file) return;
  try {
    const text = await file.text();
    const data = JSON.parse(text);
    const err = validateBackup(data);
    if (err) { showToast(err, 'error'); return; }
    // ensure missing arrays default to []
    data.penjualan = data.penjualan || [];
    data.pengeluaran = data.pengeluaran || [];
    data.pengaturan = data.pengaturan || [];
    data.settings = data.settings || [];
    data.platformMessages = data.platformMessages || [];

    showConfirm('📂', 'Data lama akan diganti dengan data dari file cadangan. Lanjut?', 'Ya, Pulihkan', async () => {
      try {
        await DB.menu.clear();
        await DB.penjualan.clear();
        await DB.pengeluaran.clear();
        await DB.pengaturan.clear();
        await DB.settings.clear();
        await DB.platformMessages.clear();

        if (data.menu.length) await DB.menu.bulkAdd(data.menu);
        if (data.penjualan && data.penjualan.length) await DB.penjualan.bulkAdd(data.penjualan);
        if (data.pengeluaran && data.pengeluaran.length) await DB.pengeluaran.bulkAdd(data.pengeluaran);
        if (data.pengaturan && data.pengaturan.length) await DB.pengaturan.bulkAdd(data.pengaturan);
        if (data.settings && data.settings.length) await DB.settings.bulkAdd(data.settings);
        if (data.platformMessages && data.platformMessages.length) await DB.platformMessages.bulkAdd(data.platformMessages);

        clearCartStorage();
        showToast('✅ Data berhasil dipulihkan!');
        navigateTo('beranda');
      } catch (err) {
        console.error('[Restore] failed:', err);
        showToast('Gagal memulihkan: data rusak!', 'error');
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
