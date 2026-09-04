// ==================== SETTINGS UI (ESM) ====================
// DOM operations only — render, event handling, modal show/hide.
// Delegates pure logic to settings.logic.js.

import {
  regionSummary,
  validateAlamat,
  validateOwner,
  validateWa,
  saveOwnerLogic,
  saveWaLogic,
  saveAlamatLogic,
  saveNamaUsahaLogic,
  loadSettingsData,
  checkProfileNotificationData
} from './settings.logic.js';
import { region } from './settings.logic.js';
import { getLicenseStatus } from './license.js';
import { setupRegionPicker } from './region.js';
import { showToast, formatPhoneDisplay } from './helpers.js';
import { showConfirm } from './confirm.js';
import { ensureSynced, isSyncConfigured, pullCloudProfileIfOnline } from './sync.js';
import { currentPage } from './app-state.js';
import { openModal, closeModal } from './modal.js';

// ⚙️ Saklar "Aktifkan Fitur": opsi metode pembayaran (Tunai/QRIS/Transfer,
// permintaan pemilik 2026-08-31) + fitur buka/tutup kas (v166). Semua lokal
// perangkat, disimpan di tabel `settings` IndexedDB.
// v167: WAJIB jalan PALING AWAL di loadSettings(), sebelum panggilan jaringan
// apa pun. `pullCloudProfileIfOnline()` tidak punya timeout dan `index.html`
// memberi atribut `checked` hardcoded pada keempat saklar, jadi kalau
// loadSettings menggantung/throw di awal, saklar tetap terlihat ON padahal DB
// sudah '0'. Pemilik lalu yakin "fitur kas aktif" sementara gerbang POS sudah
// dilewati. Sinkronisasi tampilan TIDAK BOLEH bergantung pada cloud.
async function syncFeatureSwitches() {
  try {
    const { getSetting } = await import('./db.js');
    const [t, q, tr, kas] = await Promise.all([
      getSetting('payOptTunai', '1'), getSetting('payOptQris', '1'),
      getSetting('payOptTransfer', '1'), getSetting('fiturKas', '1')
    ]);
    const setChk = (id, v) => { const el = document.getElementById(id); if (el) el.checked = v !== '0'; };
    setChk('payOptTunai', t);
    setChk('payOptQris', q);
    setChk('payOptTransfer', tr);
    setChk('fiturKasToggle', kas);
    setFiturKasDesc(kas !== '0');
  } catch (e) { console.warn('[SETTINGS] muat saklar fitur:', e?.message || e); }
}

export async function loadSettings() {
  await syncFeatureSwitches();
  // Cloud-first (permintaan pemilik 2026-08-29): profil = Supabase. Tiap kali
  // halaman Pengaturan dibuka, tarik profil dari server dulu — supaya tampilan
  // selalu cermin data cloud, bukan cache lokal yang bisa basi.
  try { await pullCloudProfileIfOnline(); } catch (e) { console.warn('[SETTINGS] pull profil gagal:', e?.message || e); }
  const data = await loadSettingsData();

  const nameEl = document.getElementById('settingName');
  if (nameEl) nameEl.textContent = data.nama;

  const ownerEl = document.getElementById('settingOwner');
  const waEl = document.getElementById('settingWa');
  const alamatEl = document.getElementById('settingAlamat');
  if (ownerEl) ownerEl.textContent = data.owner || '—';
  if (waEl) waEl.textContent = formatPhoneDisplay(data.wa) || '—';
  if (alamatEl) alamatEl.textContent = data.alamatDisplay;

  // unitId shown in settings (device id)
  const unitEl = document.getElementById('licUnit');
  const lic = await getLicenseStatus();
  if (unitEl) unitEl.textContent = lic.deviceCode ? ('ID Perangkat: ' + lic.deviceCode) : '';

  // Link situs aplikasi — ambil dari Supabase (settings.app_links) utk
  // aplikasi aktif ini, bukan hardcoded. Fallback tetap kasirsolo.app.
  try {
    const { getAppLink } = await import('./app-link.js');
    const url = await getAppLink();
    const linkEl = document.getElementById('appSiteLink');
    if (linkEl && /^https?:\/\//i.test(url)) {
      linkEl.href = url;
      const label = url.replace(/^https?:\/\/(www\.)?/, '').replace(/\/+$/, '');
      linkEl.textContent = '🌐 ' + label;
    }
  } catch (e) {
    console.warn('appSiteLink:', e?.message || e);
  }

  // Saklar fitur sudah disinkronkan di AWAL loadSettings() lewat
  // syncFeatureSwitches(), supaya tidak tertahan oleh panggilan cloud.
  checkProfileNotification();
}

// 💳 Simpan opsi metode pembayaran (saklar) — lokal perangkat + langsung
// di-inject ke modul POS tanpa reload. Minimal satu metode harus aktif.
export async function savePayOptions(changedEl) {
  const chk = id => !!document.getElementById(id)?.checked;
  const opts = { tunai: chk('payOptTunai'), qris: chk('payOptQris'), transfer: chk('payOptTransfer') };
  if (!Object.values(opts).some(Boolean)) {
    if (changedEl) changedEl.checked = true; // kembalikan saklar yang baru dimatikan
    showToast('Minimal satu metode pembayaran aktif', 'error');
    return;
  }
  try {
    const { setSetting } = await import('./db.js');
    await Promise.all([
      setSetting('payOptTunai', opts.tunai ? '1' : '0'),
      setSetting('payOptQris', opts.qris ? '1' : '0'),
      setSetting('payOptTransfer', opts.transfer ? '1' : '0')
    ]);
    try {
      const { setPayOptions } = await import('./pos.ui.js');
      setPayOptions(opts);
    } catch (_) {}
    showToast('✅ Opsi pembayaran diperbarui!');
  } catch (e) {
    console.error('[SETTINGS] simpan opsi pembayaran:', e);
    showToast('Gagal menyimpan opsi pembayaran.', 'error');
  }
}

// ⚙️ Saklar fitur buka/tutup kas (v166, satu blok dengan opsi pembayaran).
// Mematikan fitur = kartu kas hilang dari Beranda, transaksi POS tidak lagi
// minta buka kas, dan blok "Riwayat Buka/Tutup Kas" tidak dirender di Laporan.
// Data shift lama TIDAK dihapus — menyalakan lagi mengembalikan semuanya.
export async function saveFiturKas(changedEl) {
  const el = changedEl || document.getElementById('fiturKasToggle');
  if (!el) return;
  const mau = !!el.checked;

  // v167: bandingkan dengan nilai yang BENAR-BENAR TERSIMPAN di DB.
  // Sebelumnya `terpasang` diambil dari cache modul `fiturKas`, dan cache bisa
  // menyimpang dari DB (penulis lain di tab/jendela lain). Akibatnya baris
  // `if (mau === terpasang) return` di bawah menyimpulkan "tidak ada perubahan"
  // lalu MEMBATALKAN PENULISAN secara diam-diam: saklar terlihat ON, DB tetap
  // '0', gerbang POS tidak aktif. Kalau baca gagal, `tersimpan` = null dan
  // early-return dilewati — menulis ulang sesuai tampilan jauh lebih aman
  // daripada mengabaikan kehendak pemilik.
  let tersimpan = null;
  let shiftBuka = null;
  try {
    const { getSetting } = await import('./db.js');
    tersimpan = (await getSetting('fiturKas', '1')) !== '0';
    if (tersimpan && !mau) {
      const kas = await import('./kas.js');
      shiftBuka = await kas.getOpenShift();
    }
  } catch (e) {
    console.warn('[SETTINGS] baca status fitur kas:', e?.message || e);
    tersimpan = null;
    shiftBuka = null;
  }

  if (tersimpan !== null && mau === tersimpan) return; // tidak ada perubahan (mis. label meneruskan klik)

  if (!mau && shiftBuka) {
    // Shift masih terbuka → jangan matikan diam-diam. Saklar dikembalikan dulu,
    // baru dimatikan kalau pemilik benar-benar yakin.
    el.checked = true;
    showConfirm('⚠️',
      'Kas masih tercatat TERBUKA. Menonaktifkan fitur ini menyembunyikan kartu kas dan membuka blokir transaksi, tapi shift yang berjalan TIDAK ditutup dan tetap tersimpan di riwayat. Matikan fitur buka/tutup kas?',
      'Ya, Matikan Fitur', () => { el.checked = false; simpanFiturKas(false); },
      'Batal');
    return;
  }

  await simpanFiturKas(mau);
}

async function simpanFiturKas(nyalakan) {
  try {
    const { setSetting } = await import('./db.js');
    await setSetting('fiturKas', nyalakan ? '1' : '0');
    try {
      const kas = await import('./kas.js');
      kas.setFiturKasAktif(nyalakan);
      await kas.refreshKasViews(); // kartu Beranda + Laporan langsung ikut berubah
    } catch (_) { /* tampilan tersegar saat halaman dibuka lagi */ }
    setFiturKasDesc(nyalakan);
    showToast(nyalakan ? '✅ Fitur buka/tutup kas aktif!' : '✅ Fitur buka/tutup kas dimatikan.');
  } catch (e) {
    console.error('[SETTINGS] simpan fitur kas:', e);
    showToast('Gagal menyimpan pengaturan fitur kas.', 'error');
  }
}

function setFiturKasDesc(nyalakan) {
  const d = document.getElementById('fiturKasDesc');
  if (!d) return;
  d.textContent = nyalakan
    ? 'Laci punya modal awal; transaksi diblok kalau kas belum dibuka'
    : 'Mati — jualan tanpa buka kas; kartu & riwayat shift disembunyikan';
}

/** Tampilkan/sembunyikan banner "lengkapi profil".
 *  Banner tampil di semua halaman kecuali halaman pengaturan
 *  (saat user mengisi profil, banner disembunyikan agar tidak menutupi form). */
export async function checkProfileNotification() {
  if (currentPage === 'pengaturan') {
    closeModal('profileBanner');
    return;
  }
  const incomplete = await checkProfileNotificationData();
  if (incomplete) {
    await openModal('profileBanner');
  } else {
    closeModal('profileBanner');
  }
}

// Owner Modal (Nama Pemilik)
export async function openOwnerModal() {
  const currentText = document.getElementById('settingOwner')?.textContent || '—';
  document.getElementById('inputOwner').value = currentText === '—' ? '' : currentText;
  await openModal('ownerModal');
}

export function closeOwnerModal() {
  closeModal('ownerModal');
}

export async function saveOwner() {
  const owner = document.getElementById('inputOwner').value.trim();
  const valid = validateOwner({ namaPemilik: owner });
  if (!valid) { showToast('Nama pemilik tidak boleh kosong!', 'error'); return; }
  await saveOwnerLogic({ namaPemilik: owner });
  document.getElementById('settingOwner').textContent = owner || '—';
  closeOwnerModal();
  try {
    const syncResult = await ensureSynced({ force: true });
    if (syncResult?.ok) {
      showToast('✅ Nama pemilik disimpan & tersinkron!');
    } else {
      showToast('✅ Nama pemilik disimpan lokal — gagal sinkron.', 'warning', { duration: 6000 });
    }
  } catch (_) {
    showToast('✅ Nama pemilik disimpan lokal — gagal sinkron.', 'warning', { duration: 6000 });
  }
  checkProfileNotification();
}

// WA Modal (Nomor WhatsApp)
export async function openWaModal() {
  const currentText = document.getElementById('settingWa')?.textContent || '—';
  document.getElementById('inputWa').value = currentText === '—' ? '' : currentText;
  await openModal('waModal');
}

export function closeWaModal() {
  closeModal('waModal');
}

export async function saveWa() {
  const raw = document.getElementById('inputWa').value.trim();
  const res = validateWa({ nomorWA: raw });
  if (!res.valid) { showToast(res.message, 'error'); return; }
  await saveWaLogic({ normalized: res.normalized });
  document.getElementById('settingWa').textContent = formatPhoneDisplay(res.normalized);
  closeWaModal();
  try {
    const syncResult = await ensureSynced({ force: true });
    if (syncResult?.ok) {
      showToast('✅ Nomor WhatsApp disimpan & tersinkron!');
    } else {
      showToast('✅ WhatsApp disimpan lokal — gagal sinkron.', 'warning', { duration: 6000 });
    }
  } catch (_) {
    showToast('✅ WhatsApp disimpan lokal — gagal sinkron.', 'warning', { duration: 6000 });
  }
  checkProfileNotification();
}

// Alamat Modal (region picker + detail)
export async function openAlamatModal() {
  const currentText = document.getElementById('settingAlamat')?.textContent || '—';
  const detailPart = currentText === '—' ? '' : (currentText.split(' — ')[0]);
  document.getElementById('inputAlamat').value = detailPart;

  // isi state awal dari setting tersimpan
  (async () => {
    region.provinsi_id  = await (async () => { const { getSetting } = await import('./db.js'); return getSetting('provinsiId', ''); })();
    region.provinsi     = await (async () => { const { getSetting } = await import('./db.js'); return getSetting('provinsi', ''); })();
    region.kabkota_id   = await (async () => { const { getSetting } = await import('./db.js'); return getSetting('kabkotaId', ''); })();
    region.kabkota      = await (async () => { const { getSetting } = await import('./db.js'); return getSetting('kabkota', ''); })();
    region.kecamatan_id = await (async () => { const { getSetting } = await import('./db.js'); return getSetting('kecamatanId', ''); })();
    region.kecamatan    = await (async () => { const { getSetting } = await import('./db.js'); return getSetting('kecamatan', ''); })();
    region.desa_id      = await (async () => { const { getSetting } = await import('./db.js'); return getSetting('desaId', ''); })();
    region.desa         = await (async () => { const { getSetting } = await import('./db.js'); return getSetting('desa', ''); })();
    setupRegionPicker({
      provSel: 'alamatProvinsi',
      kabSel: 'alamatKabkota',
      kecSel: 'alamatKecamatan',
      desaSel: 'alamatDesa',
      state: region
    });
  })();
  await openModal('alamatModal');
}

export function closeAlamatModal() {
  closeModal('alamatModal');
}

export async function saveAlamat() {
  const alamat = document.getElementById('inputAlamat').value.trim();
  const valid = validateAlamat({ alamat });
  if (!valid) { showToast('Alamat tidak boleh kosong!', 'error'); return; }

  const payload = {
    alamat,
    provinsi_id: region.provinsi_id,
    provinsi: region.provinsi,
    kabkota_id: region.kabkota_id,
    kabkota: region.kabkota,
    kecamatan_id: region.kecamatan_id,
    kecamatan: region.kecamatan,
    desa_id: region.desa_id,
    desa: region.desa
  };
  await saveAlamatLogic(payload);
  document.getElementById('settingAlamat').textContent = await regionSummary();
  closeAlamatModal();
  // Sinkronkan profil ke server + tampilkan hasil ke user.
  // Di-await supaya user tahu hasilnya (sukses/gagal) secara kontekstual.
  try {
    const syncResult = await ensureSynced({ force: true });
    if (syncResult?.ok) {
      showToast('✅ Alamat disimpan & tersinkron!');
    } else {
      showToast('✅ Alamat disimpan lokal — gagal sinkron ke server.', 'warning', { duration: 6000 });
    }
  } catch (_) {
    showToast('✅ Alamat disimpan lokal — gagal sinkron ke server.', 'warning', { duration: 6000 });
  }
  checkProfileNotification();
}

export async function openNameModal() {
  document.getElementById('inputNamaUsaha').value = document.getElementById('settingName')?.textContent || '';
  await openModal('nameModal');
}

export function closeNameModal() {
  closeModal('nameModal');
}

export async function saveNamaUsaha() {
  const nama = document.getElementById('inputNamaUsaha').value.trim();
  if (!nama) { showToast('Nama tidak boleh kosong!', 'error'); return; }
  await saveNamaUsahaLogic({ nama });
  const el = document.getElementById('namaUsaha');
  if (el) el.textContent = nama;
  document.getElementById('settingName').textContent = nama;
  closeNameModal();
  try {
    const syncResult = await ensureSynced({ force: true });
    if (syncResult?.ok) {
      showToast('✅ Nama usaha disimpan & tersinkron!');
    } else {
      showToast('✅ Nama usaha disimpan lokal — gagal sinkron.', 'warning', { duration: 6000 });
    }
  } catch (_) {
    showToast('✅ Nama usaha disimpan lokal — gagal sinkron.', 'warning', { duration: 6000 });
  }
  checkProfileNotification();
}
