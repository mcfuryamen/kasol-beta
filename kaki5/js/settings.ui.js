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
import { ensureSynced, isSyncConfigured, pullCloudProfileIfOnline } from './sync.js';
import { currentPage } from './app-state.js';
import { openModal, closeModal } from './modal.js';

export async function loadSettings() {
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

  // 💳 Pembayaran (QRIS / Transfer) — detail lokal perangkat, disimpan di tabel
  // `settings` IndexedDB (bukan profil cloud). Dipakai panel non-tunai di keranjang.
  try {
    const { getSetting } = await import('./db.js');
    const [qris, bank, acc, name] = await Promise.all([
      getSetting('payQrisUrl', ''), getSetting('payBank', ''),
      getSetting('payAccountNumber', ''), getSetting('payAccountName', '')
    ]);
    const setVal = (id, v) => { const el = document.getElementById(id); if (el) el.value = v || ''; };
    setVal('setPayQrisUrl', qris);
    setVal('setPayBank', bank);
    setVal('setPayAccountNumber', acc);
    setVal('setPayAccountName', name);
  } catch (e) { console.warn('[SETTINGS] muat detail pembayaran:', e?.message || e); }

  checkProfileNotification();
}

// 💳 Simpan detail pembayaran (QRIS + rekening transfer) — lokal perangkat.
export async function savePaySettings() {
  const val = id => (document.getElementById(id)?.value || '').trim();
  const qris = val('setPayQrisUrl');
  if (qris && !/^https?:\/\//i.test(qris)) {
    showToast('URL QRIS harus diawali http:// atau https://', 'error');
    return;
  }
  const payload = {
    payQrisUrl: qris,
    payBank: val('setPayBank'),
    payAccountNumber: val('setPayAccountNumber').replace(/\s+/g, ''),
    payAccountName: val('setPayAccountName')
  };
  try {
    const { setSetting } = await import('./db.js');
    await Promise.all(Object.entries(payload).map(([k, v]) => setSetting(k, v)));
    // Segarkan cache konfigurasi modul POS → panel non-tunai langsung pakai
    // nilai baru tanpa perlu reload halaman.
    try {
      const { setPayConfig } = await import('./pos.ui.js');
      setPayConfig({
        qrisUrl: payload.payQrisUrl, bank: payload.payBank,
        accountNumber: payload.payAccountNumber, accountName: payload.payAccountName
      });
    } catch (_) {}
    showToast('✅ Detail pembayaran disimpan!');
  } catch (e) {
    console.error('[SETTINGS] simpan detail pembayaran:', e);
    showToast('Gagal menyimpan detail pembayaran.', 'error');
  }
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
