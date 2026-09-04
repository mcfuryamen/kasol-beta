// ==================== BACKUP & RESTORE (ESM) ====================
// HMAC-SHA256 signature for backup integrity verification
// Prevents tampering with backup files (transaksi, harga modal, etc.)
import { DB, getSetting, setSetting } from './db.js';
import { todayStr, showToast } from './helpers.js';
import { setCart } from './app-state.js';
import { showConfirm } from './confirm.js';
import { clearCartStorage } from './pos.js';
import { navigateTo } from './navigation.js';
import { getDeviceIdentity, getUnitId, getLicense, getLegacyV3DeviceCode } from './license.logic.js';
import { hmacSignature, b32Encode } from './license.logic.js';
import { getSupabaseClient } from './license.sync.js';

// Kunci settings yang TIDAK boleh keluar-masuk file cadangan (T7, audit
// 2026-08-17/H5): lisensi aktif di file cadangan bisa diklon ke perangkat lain
// (ekspor lama menyertakan license.status='active' walau serial sudah dibuang);
// flag onboarded/sync juga spesifik perangkat dan menyesatkan bila dipindah.
// (Array di-inline di sanitizeSettingsRows supaya fungsi berdiri sendiri —
// test_validate.js mengekstraknya tanpa konteks modul.)

// Pure & testable: buang baris settings terlindungi (dipakai ekspor DAN impor,
// supaya file cadangan lama yang masih memuat license pun aman saat dipulihkan).
// (Sejak v2 cadangan 2026-08-29, settings TIDAK lagi diekspor/dipulihkan sama
// sekali — profil usaha sumber kebenarannya Supabase. Fungsi ini dipertahankan
// untuk kompatibilitas test_validate.js.)
export function sanitizeSettingsRows(rows) {
  const PROTECTED = ['installId', 'unitId', 'deviceIdentity', 'license', 'onboarded', 'sync'];
  if (!Array.isArray(rows)) return [];
  return rows.filter(r => r && typeof r === 'object' && !PROTECTED.includes(r.key));
}

/**
 * Generate HMAC-SHA256 signature for backup data
 * Uses device-bound salt so backup can only be restored on same device
 */
export async function generateBackupSignature(data) {
  const { deviceCode } = await getDeviceIdentity();
  const payload = JSON.stringify(data);
  const sig = await hmacSignature(deviceCode + payload);
  return sig; // 6-char Base32
}

/**
 * Verify backup signature
 * Returns true if valid, false if tampered or from different device
 */
export async function verifyBackupSignature(data, expectedSig) {
  const actualSig = await generateBackupSignature(data);
  if (actualSig === expectedSig) return true;
  // Masa tenggang fingerprint V3→V4 (port rosok 2026-09-04): file lama
  // ditandatangani dengan deviceCode V3 — deterministik, hitung ulang & coba.
  try {
    const legacy = await getLegacyV3DeviceCode();
    if (legacy) {
      const oldSig = await hmacSignature(legacy + JSON.stringify(data));
      if (oldSig === expectedSig) return true;
    }
  } catch (_) { /* verifikasi tambahan opsional */ }
  return false;
}

// Payload cadangan bersama (file lokal & cloud): PRODUK & TRANSAKSI saja
// (permintaan pemilik 2026-08-29) — profil usaha sumber kebenarannya Supabase.
// v161: tabel kas (shift, catat kas manual, tutup buku) IKUT dicadangkan.
// Di rosok tiga tabel ini lupa dimasukkan ke backup sehingga riwayat shift
// dan rekap tahunan hilang saat restore — tidak ikut diadopsi.
// v164 (version 4): kunci `kas` DIHAPUS dari cadangan baru — fitur catat kas
// manual tidak ada lagi, uangnya tercatat di `pengeluaran`. File lama yang masih
// punya kunci `kas` tetap diterima dan dipindahkan saat restore (lihat
// applyBackupData), jadi cadangan sebelum v164 tidak membuat uang hilang.
async function buildBackupPayload() {
  return {
    version: 4,
    exportDate: new Date().toISOString(),
    menu: await DB.menu.toArray(),
    penjualan: await DB.penjualan.toArray(),
    pengeluaran: await DB.pengeluaran.toArray(),
    kasShift: await DB.kasShift.toArray(),
    tutupBuku: await DB.tutupBuku.toArray()
  };
}

// Baris `kas` dari cadangan lama → bentuk catatan pengeluaran/pemasukan.
// Sama persis dengan migrasi db.version(8): 'masuk' jadi Pemasukan kategori
// 'Modal Tambahan', 'keluar' jadi Pengeluaran kategori 'Setor Bank / Prive',
// keduanya tunai sehingga isi laci tidak berubah.
function catatanKasLama(k) {
  const jumlah = Number(k?.jumlah) || 0;
  if (jumlah <= 0) return null;
  const masuk = k.tipe === 'masuk';
  const waktu = Number(k.waktu) || Date.now();
  const d = new Date(waktu);
  const tanggal = /^\d{4}-\d{2}-\d{2}$/.test(k?.tanggal || '')
    ? k.tanggal
    : d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  return {
    tanggal,
    waktu,
    keterangan: (k.keterangan || '').trim() || (masuk ? 'Tambah kas (catatan lama)' : 'Ambil kas (catatan lama)'),
    kategori: masuk ? 'Modal Tambahan' : 'Setor Bank / Prive',
    jumlah,
    suplayer: '',
    ...(masuk ? { jenis: 'pemasukan' } : {}),
    metodeBayar: 'tunai',
    shiftId: k.shiftId ?? null,
    sumber: 'migrasi-kas-v164'
  };
}

// Terapkan isi cadangan: clear + bulkAdd seluruh tabel data dalam SATU
// transaksi atomik (gagal di tengah = rollback total). Dipakai restore file
// lokal & cloud. File lama (v1/v2) tidak punya kunci kas → dianggap kosong.
// Kunci `kas` pada file v3 TIDAK ditulis ke tabel kas lagi — dipindah ke
// `pengeluaran` supaya tetap dihitung oleh Laba dan kas sistem.
async function applyBackupData(data) {
  data.penjualan = data.penjualan || [];
  data.pengeluaran = data.pengeluaran || [];
  data.kasShift = data.kasShift || [];
  data.tutupBuku = data.tutupBuku || [];
  const kasLama = Array.isArray(data.kas)
    ? data.kas.map(catatanKasLama).filter(Boolean)
    : [];
  if (kasLama.length) console.log('[BACKUP] ' + kasLama.length + ' catatan kas lama dipindah ke Pengeluaran/Pemasukan');
  const pengeluaran = data.pengeluaran.concat(kasLama);
  await DB.transaction(
    'rw',
    [DB.menu, DB.penjualan, DB.pengeluaran, DB.kasShift, DB.tutupBuku],
    async () => {
      await DB.menu.clear();
      await DB.penjualan.clear();
      await DB.pengeluaran.clear();
      await DB.kasShift.clear();
      await DB.tutupBuku.clear();
      if (data.menu.length) await DB.menu.bulkAdd(data.menu);
      if (data.penjualan.length) await DB.penjualan.bulkAdd(data.penjualan);
      if (pengeluaran.length) await DB.pengeluaran.bulkAdd(pengeluaran);
      if (data.kasShift.length) await DB.kasShift.bulkAdd(data.kasShift);
      if (data.tutupBuku.length) await DB.tutupBuku.bulkAdd(data.tutupBuku);
    }
  );
  clearCartStorage();
}

export async function exportData() {
  // Cadangan = DATA PRODUK & TRANSAKSI saja (permintaan pemilik 2026-08-29).
  // Profil usaha TIDAK ikut — sumber kebenarannya Supabase (di-pull otomatis
  // saat boot/online). Lisensi & identitas perangkat juga tidak ikut (T7/H5).
  const data = await buildBackupPayload();
  
  // Generate HMAC signature for integrity verification
  const signature = await generateBackupSignature(data);
  data._signature = signature;
  data._signatureVersion = 1;
  
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
export async function validateBackup(data) {
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
  if (!ok(data.penjualan) || !ok(data.pengeluaran) || !ok(data.pengaturan) || !ok(data.settings) || !ok(data.platformMessages) || !ok(data.kasShift) || !ok(data.kas) || !ok(data.tutupBuku)) {
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
  // v161 — Kas: shift, catat kas manual, dan rekap tahunan ikut divalidasi.
  const isStatusShift = v => v === 'buka' || v === 'tutup';
  for (const s of (data.kasShift || [])) {
    if (!isDate(s.tanggalBuka)) return 'File ditolak: ada shift kas dengan tanggal buka rusak.';
    if (!isStatusShift(s.status)) return 'File ditolak: ada shift kas dengan status tidak dikenal.';
    if (s.modalAwal !== undefined && !isNum(s.modalAwal)) return 'File ditolak: ada shift kas dengan modal awal rusak.';
    if (!validId(s)) return 'File ditolak: ada shift kas dengan id tidak valid.';
  }
  for (const k of (data.kas || [])) {
    if (!isDate(k.tanggal)) return 'File ditolak: ada catatan kas dengan tanggal rusak.';
    if (k.tipe !== 'masuk' && k.tipe !== 'keluar') return 'File ditolak: ada catatan kas dengan tipe tidak dikenal.';
    if (!isNum(k.jumlah)) return 'File ditolak: ada catatan kas dengan jumlah uang rusak.';
    if (!validId(k)) return 'File ditolak: ada catatan kas dengan id tidak valid.';
  }
  for (const b of (data.tutupBuku || [])) {
    if (!Number.isInteger(b.tahun) || b.tahun < 2000 || b.tahun > 2100) return 'File ditolak: ada tutup buku dengan tahun tidak valid.';
    if (!isDate(b.tanggalTutup)) return 'File ditolak: ada tutup buku dengan tanggal tutup rusak.';
    if (!validId(b)) return 'File ditolak: ada tutup buku dengan id tidak valid.';
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
  const dup = dupCheck(data.menu, 'menu') || dupCheck(penjualan, 'transaksi') || dupCheck(data.pengeluaran || [], 'pengeluaran')
    || dupCheck(data.kasShift || [], 'shift kas') || dupCheck(data.kas || [], 'catatan kas') || dupCheck(data.tutupBuku || [], 'tutup buku');
  if (dup) return dup;

  // ── Lapis 3: Signature verification (NEW 2026-08-20) ──
  if (data._signature && data._signatureVersion === 1) {
    const { _signature, _signatureVersion, ...dataForVerify } = data;
    const isValid = await verifyBackupSignature(dataForVerify, _signature);
    if (!isValid) {
      return 'File ditolak: Signature tidak valid (file dimodifikasi atau dari perangkat lain).';
    }
  } else {
    // Old backup without signature — warn but allow (backward compatibility)
    console.warn('[BACKUP] File cadangan lama tanpa signature — restore diperbolehkan tapi tidak diverifikasi');
  }

  return null;
}

export async function importData(event) {
  const file = event.target.files[0];
  if (!file) return;
  try {
    const text = await file.text();
    const data = JSON.parse(text);
    const err = await validateBackup(data);
    if (err) { showToast(err, 'error', { duration: 6000 }); return; }
    // ensure missing arrays default to []
    data.penjualan = data.penjualan || [];
    data.pengeluaran = data.pengeluaran || [];

    showConfirm('📂', 'Produk & transaksi akan diganti dengan data dari file cadangan. Profil usaha tidak berubah (mengikuti data server). Lanjut?', 'Ya, Pulihkan', async () => {
      try {
        // v2 (2026-08-29): HANYA produk & transaksi. settings/pengaturan/
        // platformMessages di file lama DIABAIKAN — profil usaha sumber
        // kebenarannya Supabase dan di-pull ulang otomatis setelah restore.
        await applyBackupData(data);

        showToast('✅ Produk & transaksi berhasil dipulihkan!');
        navigateTo('beranda');
        // Profil tetap mengikuti Supabase — segarkan dari server (non-blocking).
        import('./sync.js').then(m => m.pullCloudProfileIfOnline()).catch(() => {});
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

// ==================== CADANGAN CLOUD (Supabase Storage) ====================
// Bucket 'backups' (privat, limit 5MB/file). Path: <unit_id>/cadangan-*.json.
// RLS 'kaki5 backups *': tiap unit cuma bisa akses folder unit-nya sendiri
// (dicocokkan lewat clients.user_id = auth.uid()). Profil TIDAK ikut —
// sumber kebenarannya Supabase. Tanpa signature device-bound agar cadangan
// tetap bisa dipulihkan lintas perangkat (ganti HP / install ulang).
const CLOUD_BUCKET = 'backups';
const CLOUD_KEEP = 10; // simpan maksimal 10 versi terakhir per unit

async function cloudCtx() {
  const sb = getSupabaseClient();
  if (!sb || !navigator.onLine) return null;
  const unitId = await getUnitId();
  return unitId ? { sb, unitId } : null;
}

export async function cloudSaveBackup() {
  const ctx = await cloudCtx();
  if (!ctx) { showToast('Tidak bisa terhubung ke cloud. Cek internet & coba lagi.', 'error', { duration: 5000 }); return; }
  const { sb, unitId } = ctx;
  try {
    const data = await buildBackupPayload();
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const path = `${unitId}/cadangan-${stamp}.json`;
    const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
    const { error } = await sb.storage.from(CLOUD_BUCKET).upload(path, blob, { contentType: 'application/json', upsert: false });
    if (error) throw error;
    // Housekeeping: sisakan CLOUD_KEEP versi terbaru per unit.
    const { data: files } = await sb.storage.from(CLOUD_BUCKET).list(unitId, { sortBy: { column: 'created_at', order: 'desc' } });
    const stale = (files || []).filter(f => f.name !== `${path.split('/').pop()}`).slice(Math.max(0, CLOUD_KEEP - 1));
    if (stale.length) await sb.storage.from(CLOUD_BUCKET).remove(stale.map(f => `${unitId}/${f.name}`));
    showToast('✅ Cadangan tersimpan ke cloud!');
  } catch (e) {
    console.error('[BACKUP] cloud save gagal:', e);
    showToast('Gagal simpan ke cloud: ' + String(e?.message || e).slice(0, 100), 'error', { duration: 6000 });
  }
}

export async function cloudRestoreLatest() {
  const ctx = await cloudCtx();
  if (!ctx) { showToast('Tidak bisa terhubung ke cloud. Cek internet & coba lagi.', 'error', { duration: 5000 }); return; }
  const { sb, unitId } = ctx;
  try {
    const { data: files, error: listErr } = await sb.storage.from(CLOUD_BUCKET).list(unitId, { sortBy: { column: 'created_at', order: 'desc' } });
    if (listErr) throw listErr;
    const latest = (files || []).find(f => f.name.endsWith('.json'));
    if (!latest) { showToast('Belum ada cadangan di cloud. Simpan dulu ya!', 'info', { duration: 5000 }); return; }
    const { data: blob, error: dlErr } = await sb.storage.from(CLOUD_BUCKET).download(`${unitId}/${latest.name}`);
    if (dlErr) throw dlErr;
    const data = JSON.parse(await blob.text());
    const err = await validateBackup(data);
    if (err) { showToast(err, 'error', { duration: 6000 }); return; }
    const tanggal = latest.name.replace('cadangan-', '').replace('.json', '').slice(0, 16).replace('T', ' ');
    showConfirm('☁️', `Pulihkan cadangan cloud (${tanggal})? Produk & transaksi akan diganti. Profil tidak berubah. Lanjut?`, 'Ya, Pulihkan', async () => {
      try {
        await applyBackupData(data);
        showToast('✅ Produk & transaksi dipulihkan dari cloud!');
        navigateTo('beranda');
        import('./sync.js').then(m => m.pullCloudProfileIfOnline()).catch(() => {});
      } catch (err) {
        console.error('[CloudRestore] failed:', err);
        showToast('Pemulihan dibatalkan — data lama tetap utuh.', 'error', { duration: 6000 });
      }
    });
  } catch (e) {
    console.error('[BACKUP] cloud restore gagal:', e);
    showToast('Gagal ambil dari cloud: ' + String(e?.message || e).slice(0, 100), 'error', { duration: 6000 });
  }
}

// ── Penawaran pulih otomatis utk browser baru (port rosok 2026-09-04) ──────
// Data transaksi tetap per-browser (hukum sandbox IndexedDB), tapi browser
// baru di perangkat BERLISENSI yang punya cadangan cloud DITAWARI pemulihan
// (bukan restore diam-diam). Maks 1×/hari; semua kegagalan ditelan diam —
// penawaran tidak boleh mengganggu boot. Dipanggil deferred dari app.js init().
export async function maybeOfferCloudRestore(){
  try {
    if (!navigator.onLine) return;
    const lic = await getLicense();
    if (!lic || lic.status !== 'active') return;          // cadangan cloud = lisensi aktif
    if (await DB.penjualan.count() > 0) return;           // sudah ada data lokal
    const last = Number(await getSetting('restoreOfferAt', 0)) || 0;
    if (Date.now() - last < 24 * 3600 * 1000) return;     // sudah ditawari hari ini
    const ctx = await cloudCtx();
    if (!ctx) return;
    const { sb, unitId } = ctx;
    const { data: files } = await sb.storage.from(CLOUD_BUCKET).list(unitId, { sortBy: { column: 'created_at', order: 'desc' } });
    const latest = (files || []).find(f => f.name.endsWith('.json'));
    if (!latest) return;                                   // belum ada cadangan
    await setSetting('restoreOfferAt', Date.now());
    const { data: blob, error: dlErr } = await sb.storage.from(CLOUD_BUCKET).download(`${unitId}/${latest.name}`);
    if (dlErr || !blob) return;
    const data = JSON.parse(await blob.text());
    const err = await validateBackup(data);
    if (err) return;
    const tanggal = latest.name.replace('cadangan-', '').replace('.json', '').slice(0, 16).replace('T', ' ');
    showConfirm('☁️', `Browser ini belum punya data, tapi perangkatmu punya cadangan cloud (${tanggal}). Pulihkan sekarang? Produk, transaksi, dan data kas akan diisi dari cadangan.`, 'Ya, Pulihkan', async () => {
      try {
        await applyBackupData(data);
        showToast('✅ Data dipulihkan dari cloud!');
        navigateTo('beranda');
        import('./sync.js').then(m => m.pullCloudProfileIfOnline()).catch(() => {});
      } catch (e) {
        console.error('[RestoreOffer] gagal:', e);
        showToast('Pemulihan gagal — data tetap seperti semula.', 'error', { duration: 6000 });
      }
    });
  } catch (_) { /* nice-to-have — jangan pernah ganggu boot */ }
}

export function confirmClearAll() {
  // L5 (audit 2026-08-17): status lisensi perangkat SENGAJA dipertahankan
  // (anti reset-trial) — teks menyebutnya jujur supaya tidak menyesatkan.
  showConfirm('⚠️', 'SEMUA data usaha akan dihapus dan tidak bisa dikembalikan! Status lisensi perangkat tetap tersimpan. Yakin?', 'Ya, Hapus Semua', async () => {
    await DB.menu.clear();
    await DB.penjualan.clear();
    await DB.pengeluaran.clear();
    await DB.kasShift.clear();
    await DB.kas.clear();
    await DB.tutupBuku.clear();
    await DB.pengaturan.clear();
    await DB.settings.clear();
    await DB.platformMessages.clear();
    setCart({});
    clearCartStorage();
    showToast('Semua data dihapus');
    navigateTo('beranda');
  });
}

// generateBackupSignature & verifyBackupSignature are already exported inline
// at their declarations above (see line 32 & 43) — a second export statement
// here caused "Duplicate export" and broke the ESM import of app.js.