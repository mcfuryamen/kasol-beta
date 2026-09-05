/* =========================================================================
   KASIR SOLO - ROSOK
   backup.js — Data & Cadangan (adopsi komprehensif kaki5).
   - Payload v3: kategori, transaksi, transaksiItem, kas, kasShift, tutupBuku.
     settings/license TIDAK ikut (T7: anti-klon lisensi; profil usaha sumber
     kebenarannya Supabase — di-adopsi ulang otomatis setelah restore).
   - Signature HMAC device-bound utk file lokal (anti file dimodifikasi);
     cadangan cloud TANPA signature agar bisa dipulihkan lintas perangkat.
   - Restore atomik: clear+bulkAdd 6 tabel dalam SATU db.transaction.
   - Validasi 3 lapis: bentuk umum → field per tabel + id unik → signature.
   - Cloud: bucket `backups`, path tetap `backups/<unit_id>/cadangan-latest.json`
     (upsert) — probe 2026-09-03: upload/download/delete OK via anon-JWT hybrid,
     LIST policy tidak terbuka sehingga pola `list()` kaki5 tidak dipakai.
   - Cloud khusus lisensi aktif (🔒, keputusan pemilik model kuota).
   ========================================================================= */
import { db } from './db.js';
import { toast, showLoading, hideLoading, getSetting, setSetting, openOverlay, closeSheet } from './utils.js';
import { showConfirm } from './confirm.js';
import { SETTINGS, openShiftCache } from './app-state.js';
import { hmacSignature, isLicensed, ensureUnitId } from './license.js';
import { refreshAll } from './dashboard.js';
import { ensureSession, getSupabaseClient } from './license.sync.js';

const BACKUP_VERSION = 3;
const CLOUD_BUCKET = 'backups';

// ── Payload ───────────────────────────────────────────────────────────────
async function buildBackupPayload(){
  return {
    version: BACKUP_VERSION,
    exportDate: new Date().toISOString(),
    kategori: await db.kategori.toArray(),
    transaksi: await db.transaksi.toArray(),
    transaksiItem: await db.transaksiItem.toArray(),
    kas: await db.kas.toArray(),
    kasShift: await db.kasShift.toArray(),
    tutupBuku: await db.tutupBuku.toArray()
  };
}

// Terapkan cadangan: clear + bulkAdd 6 tabel dalam SATU transaksi atomik
// (gagal di tengah = rollback total — data lama tak mungkin rusak).
async function applyBackupData(data){
  data.transaksiItem = data.transaksiItem || [];
  data.kas = data.kas || [];
  data.kasShift = data.kasShift || [];
  data.tutupBuku = data.tutupBuku || [];
  await db.transaction('rw', db.kategori, db.transaksi, db.transaksiItem, db.kas, db.kasShift, db.tutupBuku, async () => {
    await db.kategori.clear();
    await db.transaksi.clear();
    await db.transaksiItem.clear();
    await db.kas.clear();
    await db.kasShift.clear();
    await db.tutupBuku.clear();
    if (data.kategori.length) await db.kategori.bulkAdd(data.kategori);
    if (data.transaksi.length) await db.transaksi.bulkAdd(data.transaksi);
    if (data.transaksiItem.length) await db.transaksiItem.bulkAdd(data.transaksiItem);
    if (data.kas.length) await db.kas.bulkAdd(data.kas);
    if (data.kasShift.length) await db.kasShift.bulkAdd(data.kasShift);
    if (data.tutupBuku.length) await db.tutupBuku.bulkAdd(data.tutupBuku);
  });
}

// ── Signature (device-bound, kaki5) ───────────────────────────────────────
async function generateBackupSignature(data){
  const unitId = await ensureUnitId();
  const payload = JSON.stringify(data);
  return hmacSignature(unitId + payload);
}
async function verifyBackupSignature(data, expectedSig){
  const actual = await generateBackupSignature(data);
  if (actual === expectedSig) return true;
  // Post-re-anchor (audit multi-browser 2026-09-04): file lama ditandatangani
  // dengan unit_id SEBELUM migrasi — coba ulang dengan unit_id asal yang
  // tercatat di settings.unitReanchor.from, jangan tolak cadangan sah.
  try {
    const ra = await getSetting('unitReanchor', null);
    if (ra && ra.from) {
      const old = await hmacSignature(ra.from + JSON.stringify(data));
      if (old === expectedSig) return true;
    }
  } catch (_) { /* verifikasi tambahan bersifat opsional */ }
  return false;
}

// ── Validasi 3 lapis (pola T6 kaki5, disesuaikan skema rosok) ─────────────
export async function validateBackup(data){
  if (!data || typeof data !== 'object' || Array.isArray(data)) return 'File tidak valid: bukan objek cadangan!';
  if (typeof data.version !== 'number' || data.version < 1) return 'File tidak valid: versi tidak dikenal!';
  if (data.version > BACKUP_VERSION) return 'Cadangan dari versi aplikasi yang lebih baru — update aplikasi dulu';
  if (!Array.isArray(data.kategori)) return 'File tidak valid: data kategori hilang/rusak!';
  const okArr = a => !a || (Array.isArray(a) && a.every(r => r && typeof r === 'object' && !Array.isArray(r)));
  if (!okArr(data.transaksi) || !okArr(data.transaksiItem) || !okArr(data.kas) || !okArr(data.kasShift) || !okArr(data.tutupBuku)) {
    return 'File tidak valid: isi data rusak!';
  }
  const isStr = v => typeof v === 'string';
  const isNum = v => typeof v === 'number' && Number.isFinite(v) && v >= 0;
  const isISO = v => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(v);
  const validId = r => r.id === undefined || (Number.isInteger(r.id) && r.id > 0);

  for (const k of data.kategori) {
    if (!isStr(k.nama) || !k.nama.trim()) return 'File ditolak: ada kategori tanpa nama / nama rusak.';
    if (!isNum(k.hargaBeli) || !isNum(k.hargaJual)) return 'File ditolak: harga kategori "' + k.nama + '" tidak valid.';
    if (k.stokKg !== undefined && !isNum(k.stokKg)) return 'File ditolak: stok kategori "' + k.nama + '" tidak valid.';
    if (!validId(k)) return 'File ditolak: ada kategori dengan id tidak valid.';
  }
  for (const t of (data.transaksi || [])) {
    if (t.tipe !== 'beli' && t.tipe !== 'jual') return 'File ditolak: ada transaksi dengan tipe tidak dikenal.';
    if (!isISO(t.tanggal)) return 'File ditolak: ada transaksi dengan tanggal rusak.';
    if (!isNum(t.total)) return 'File ditolak: ada transaksi dengan total rusak.';
    if (t.sisa !== undefined && !isNum(t.sisa)) return 'File ditolak: ada transaksi dengan sisa tempo rusak.';
    if (!validId(t)) return 'File ditolak: ada transaksi dengan id tidak valid.';
  }
  for (const it of (data.transaksiItem || [])) {
    if (!Number.isInteger(it.transaksiId) || it.transaksiId <= 0) return 'File ditolak: ada item dengan transaksiId tidak valid.';
    if (!isStr(it.kategoriNama) || !it.kategoriNama.trim()) return 'File ditolak: ada item tanpa nama kategori.';
    if (!isNum(it.berat) || it.berat <= 0) return 'File ditolak: ada item dengan berat rusak.';
    if (!isNum(it.hargaSatuan) || !isNum(it.subtotal)) return 'File ditolak: ada item dengan harga rusak.';
    if (!validId(it)) return 'File ditolak: ada item dengan id tidak valid.';
  }
  for (const k of (data.kas || [])) {
    if (!isISO(k.tanggal)) return 'File ditolak: ada catatan kas dengan tanggal rusak.';
    if (k.tipe !== 'masuk' && k.tipe !== 'keluar') return 'File ditolak: ada catatan kas dengan tipe tidak dikenal.';
    if (!isNum(k.jumlah)) return 'File ditolak: ada catatan kas dengan jumlah uang rusak.';
    if (!validId(k)) return 'File ditolak: ada catatan kas dengan id tidak valid.';
  }
  for (const s of (data.kasShift || [])) {
    if (!isISO(s.waktuBuka)) return 'File ditolak: ada shift kas dengan waktu buka rusak.';
    if (s.status !== 'buka' && s.status !== 'tutup') return 'File ditolak: ada shift kas dengan status tidak dikenal.';
    if (s.modalAwal !== undefined && !isNum(s.modalAwal)) return 'File ditolak: ada shift kas dengan modal awal rusak.';
    if (!validId(s)) return 'File ditolak: ada shift kas dengan id tidak valid.';
  }
  for (const b of (data.tutupBuku || [])) {
    if (!Number.isInteger(b.tahun) || b.tahun < 2000 || b.tahun > 2100) return 'File ditolak: ada tutup buku dengan tahun tidak valid.';
    if (!isISO(b.tanggalTutup)) return 'File ditolak: ada tutup buku dengan tanggal tutup rusak.';
    if (!validId(b)) return 'File ditolak: ada tutup buku dengan id tidak valid.';
  }
  const dupCheck = (arr, label) => {
    const seen = new Set();
    for (const r of arr) {
      if (r.id === undefined) continue;
      if (seen.has(r.id)) return 'File ditolak: ada ' + label + ' dengan id ganda (' + r.id + ').';
      seen.add(r.id);
    }
    return null;
  };
  const dup = dupCheck(data.kategori, 'kategori') || dupCheck(data.transaksi || [], 'transaksi')
    || dupCheck(data.transaksiItem || [], 'item transaksi') || dupCheck(data.kas || [], 'catatan kas')
    || dupCheck(data.kasShift || [], 'shift kas') || dupCheck(data.tutupBuku || [], 'tutup buku');
  if (dup) return dup;

  if (data._signature && data._signatureVersion === 1) {
    const { _signature, _signatureVersion, ...dataForVerify } = data;
    const ok = await verifyBackupSignature(dataForVerify, _signature);
    if (!ok) return 'File ditolak: Signature tidak valid (file dimodifikasi atau dari perangkat lain).';
  } else {
    console.warn('[BACKUP] File tanpa signature — restore diperbolehkan tanpa verifikasi (kompatibilitas file lama/cloud).');
  }
  return null;
}

// ── Export lokal (file .json) ─────────────────────────────────────────────
export async function exportData(){
  showLoading('Menyiapkan cadangan...');
  try {
    if (openShiftCache) toast('Perhatian: kas masih terbuka — cadangan akan menyertakan shift berjalan');
    const data = await buildBackupPayload();
    data._signature = await generateBackupSignature(data);
    data._signatureVersion = 1;
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const d = new Date();
    const ds = d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
    a.href = url;
    a.download = 'cadangan-rosok-' + ds + '.json';
    a.click();
    URL.revokeObjectURL(url);
    toast('✅ Cadangan tersimpan ke file!');
  } catch (e) {
    console.error('Export error:', e);
    toast('Gagal mengekspor data');
  } finally { hideLoading(); }
}

// ── Import lokal (file → validate → confirm → restore atomik) ─────────────
export async function importData(event){
  const file = event.target.files[0];
  if (!file) return;
  showLoading('Memeriksa file cadangan...');
  try {
    if (openShiftCache) toast('Perhatian: kas masih terbuka — cadangan akan menyertakan shift berjalan');
    const data = JSON.parse(await file.text());
    const err = await validateBackup(data);
    hideLoading();
    if (err) { toast(err); event.target.value = ''; return; }
    if (!(await showConfirm({ icon:'📂', text:'Semua data (kategori, transaksi, kas, tutup buku) akan diganti dengan isi file cadangan. Profil usaha tidak berubah. Lanjutkan?', okLabel:'Ya, Pulihkan' }))) { event.target.value = ''; return; }
    showLoading('Memulihkan data...');
    try {
      await applyBackupData(data);
      hideLoading();
      toast('✅ Data berhasil dipulihkan!');
      refreshAll();
      if(typeof window.updateKasBarButtons === 'function') window.updateKasBarButtons();
      renderLaporanIfVisible();
    } catch (err) {
      hideLoading();
      console.error('[Restore] gagal:', err);
      toast('Pemulihan dibatalkan — data lama tetap utuh. (' + String(err?.message || err).slice(0, 100) + ')');
    }
  } catch (e) {
    hideLoading();
    console.error('[Import] parse error:', e);
    toast('Gagal membaca file!');
  }
  event.target.value = '';
}
function renderLaporanIfVisible(){
  if (typeof window._ksr_renderLaporan === 'function') window._ksr_renderLaporan();
}

// ── Cadangan Cloud (Supabase Storage `backups`, khusus lisensi aktif) ─────
const LATEST_PATH = (unitId) => `backups/${unitId}/cadangan-latest.json`;

async function cloudCtx(){
  if (!isLicensed()) return { err: 'locked' };
  if (!navigator.onLine) return { err: 'offline' };
  // Buat/ambil client lewat getSupabaseClient() — dulu baca global mentah,
  // sehingga pesan "muat ulang halaman" muncul walau satu panggilan bisa berhasil.
  const sb = getSupabaseClient();
  if (!sb) return { err: 'nosupabase' };
  const unitId = await ensureUnitId();
  let s = null;
  try { s = await ensureSession(sb, unitId); } catch (_) {}
  if (!s) return { err: 'session' };
  return { sb, unitId };
}

export async function cloudSaveBackup(){
  const ctx = await cloudCtx();
  if (ctx.err) return cloudErr(ctx.err);
  const { sb, unitId } = ctx;
  showLoading('Menyimpan cadangan ke cloud...');
  try {
    const data = await buildBackupPayload(); // tanpa signature device-bound → lintas perangkat
    const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
    const { error } = await sb.storage.from(CLOUD_BUCKET)
      .upload(`${unitId}/cadangan-latest.json`, blob, { contentType: 'application/json', upsert: true });
    if (error) throw error;
    await setSetting('lastCloudBackupAt', new Date().toISOString());
    hideLoading();
    toast('✅ Cadangan tersimpan ke cloud!');
  } catch (e) {
    hideLoading();
    console.error('[CloudSave]', e);
    toast('Gagal simpan ke cloud: ' + String(e?.message || e).slice(0, 90));
  }
}

export async function cloudRestoreLatest(){
  const ctx = await cloudCtx();
  if (ctx.err) return cloudErr(ctx.err);
  const { sb, unitId } = ctx;
  showLoading('Mengambil cadangan dari cloud...');
  try {
    if (openShiftCache) toast('Perhatian: kas masih terbuka — cadangan akan menyertakan shift berjalan');
    const { data: blob, error } = await sb.storage.from(CLOUD_BUCKET)
      .download(`${unitId}/cadangan-latest.json`);
    if (error) {
      hideLoading();
      if (String(error.message || '').includes('not found')) { toast('Belum ada cadangan di cloud. Simpan dulu ya!'); return; }
      throw error;
    }
    const data = JSON.parse(await blob.text());
    const err = await validateBackup(data);
    hideLoading();
    if (err) { toast(err); return; }
    if (!(await showConfirm({ icon:'☁️', text:'Pulihkan cadangan cloud? Semua data saat ini akan diganti dengan isi cadangan. Lanjutkan?', okLabel:'Ya, Pulihkan' }))) return;
    showLoading('Memulihkan data...');
    try {
      await applyBackupData(data);
      hideLoading();
      toast('✅ Data dipulihkan dari cloud!');
      refreshAll();
      if(typeof window.updateKasBarButtons === 'function') window.updateKasBarButtons();
      renderLaporanIfVisible();
    } catch (err) {
      hideLoading();
      console.error('[CloudRestore] gagal:', err);
      toast('Pemulihan dibatalkan — data lama tetap utuh.');
    }
  } catch (e) {
    hideLoading();
    console.error('[CloudRestore]', e);
    toast('Gagal ambil dari cloud: ' + String(e?.message || e).slice(0, 90));
  }
}

function cloudErr(kind){
  const msg = {
    locked: '🔒 Cadangan cloud khusus lisensi aktif — aktifkan lisensi dulu ya',
    offline: 'Tidak ada koneksi internet — coba lagi saat online',
    nosupabase: 'Konfigurasi server belum termuat — muat ulang halaman',
    session: 'Sesi server gagal dibuat — coba lagi sebentar'
  }[kind] || 'Gagal mengakses cloud';
  toast(msg);
}

// ── Penawaran pulih otomatis utk browser baru (audit multi-browser 2026-09-04) ─
// Data transaksi tetap per-browser (hukum sandbox IndexedDB — kaki5 sama), tapi
// browser baru di perangkat BERLISENSI yang punya cadangan cloud kini DITAWARI
// pemulihan sekali sehari (bukan restore diam-diam). Dipanggil deferred dari
// initApp; semua kegagalan ditelan diam — penawaran tidak boleh mengganggu boot.
export async function maybeOfferCloudRestore(){
  try {
    if (!navigator.onLine) return;
    if (!(await isLicensed())) return;
    if (await db.transaksi.count() > 0) return;            // sudah ada data lokal
    const last = Number(await getSetting('restoreOfferAt', 0)) || 0;
    if (Date.now() - last < 24 * 3600 * 1000) return;      // sudah ditawari hari ini
    const ctx = await cloudCtx();
    if (ctx.err) return;
    const { data: blob, error } = await ctx.sb.storage.from(CLOUD_BUCKET)
      .download(`${ctx.unitId}/cadangan-latest.json`);
    if (error || !blob) return;                            // belum ada cadangan
    await setSetting('restoreOfferAt', Date.now());
    if (!document.getElementById('sheetRestoreOffer')) return;
    openOverlay('sheetRestoreOffer');
  } catch (_) { /* nice-to-have — jangan pernah ganggu boot */ }
}

export function acceptRestoreOffer(){
  closeSheet('sheetRestoreOffer');
  cloudRestoreLatest();
}
export function declineRestoreOffer(){
  closeSheet('sheetRestoreOffer');
}

// ── Hapus semua data (pola kaki5: lisensi SENGAJA dipertahankan) ──────────
export async function confirmClearAll(){
  if (!(await showConfirm({ icon:'🗑️', text:'SEMUA data usaha (kategori, transaksi, kas, tutup buku) akan dihapus dan tidak bisa dikembalikan! Status lisensi perangkat tetap tersimpan. Yakin?', okLabel:'Ya, Hapus' }))) return;
  if (!(await showConfirm({ icon:'🗑️', text:'Konfirmasi terakhir: hapus SEMUA data sekarang?', okLabel:'Hapus Sekarang' }))) return;
  showLoading('Menghapus data...');
  try {
    await db.transaction('rw', db.kategori, db.transaksi, db.transaksiItem, db.kas, db.kasShift, db.tutupBuku, async () => {
      await db.kategori.clear();
      await db.transaksi.clear();
      await db.transaksiItem.clear();
      await db.kas.clear();
      await db.kasShift.clear();
      await db.tutupBuku.clear();
    });
    await setSetting('payOptions', { tunai: true, transfer: true, tempo: true });
    hideLoading();
    toast('Semua data dihapus');
    refreshAll();
    if(typeof window.updateKasBarButtons === 'function') window.updateKasBarButtons();
  } catch (e) {
    hideLoading();
    console.error('Clear all error:', e);
    toast('Gagal menghapus data');
  }
}


// Global exports utk onclick/onchange di HTML
window.exportData = exportData;
window.importData = importData;
window.cloudSaveBackup = cloudSaveBackup;
window.cloudRestoreLatest = cloudRestoreLatest;
window.confirmClearAll = confirmClearAll;
window._ksr_acceptRestoreOffer = acceptRestoreOffer;
window._ksr_declineRestoreOffer = declineRestoreOffer;
