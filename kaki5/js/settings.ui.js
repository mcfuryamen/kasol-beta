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
  saveNamaWarungLogic,
  loadSettingsData,
  checkProfileNotificationData
} from './settings.logic.js';
import { region } from './settings.logic.js';
import { getLicenseStatus } from './license.js';
import { setupRegionPicker } from './region.js';
import { showToast, formatPhoneDisplay } from './helpers.js';
import { ensureSynced, isSyncConfigured } from './sync.js';

export async function loadSettings() {
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

  // Status sinkronisasi
  const syncText = document.getElementById('syncStatusText');
  if (syncText) {
    if (!isSyncConfigured()) {
      syncText.textContent = 'Status: belum dikonfigurasi (anon key)';
    } else {
      const s = data.sync || { status: 'none' };
      const map = { none: 'Belum pernah', pending: 'Menunggu (offline)', synced: '✅ Tersinkron' };
      syncText.innerHTML = 'Status: ' + (map[s.status] || s.status) +
        (s.syncedAt ? '<br><small>Terakhir: ' + new Date(s.syncedAt).toLocaleString('id-ID') + '</small>' : '');
    }
  }

  checkProfileNotification();
}

/** Tampilkan/sembunyikan banner "lengkapi profil" di beranda */
export async function checkProfileNotification() {
  const banner = document.getElementById('profileBanner');
  if (!banner) return;
  const incomplete = await checkProfileNotificationData();
  banner.classList.toggle('show', incomplete);
}

// Owner Modal (Nama Pemilik)
export function openOwnerModal() {
  const currentText = document.getElementById('settingOwner')?.textContent || '—';
  document.getElementById('inputOwner').value = currentText === '—' ? '' : currentText;
  document.getElementById('ownerModal').classList.add('show');
}

export function closeOwnerModal() {
  document.getElementById('ownerModal').classList.remove('show');
}

export async function saveOwner() {
  const owner = document.getElementById('inputOwner').value.trim();
  const valid = validateOwner({ namaPemilik: owner });
  if (!valid) { showToast('Nama pemilik tidak boleh kosong!', 'error'); return; }
  await saveOwnerLogic({ namaPemilik: owner });
  document.getElementById('settingOwner').textContent = owner || '—';
  closeOwnerModal();
  showToast('✅ Nama pemilik disimpan!');
  ensureSynced({ force: true });
  checkProfileNotification();
}

// WA Modal (Nomor WhatsApp)
export function openWaModal() {
  const currentText = document.getElementById('settingWa')?.textContent || '—';
  document.getElementById('inputWa').value = currentText === '—' ? '' : currentText;
  document.getElementById('waModal').classList.add('show');
}

export function closeWaModal() {
  document.getElementById('waModal').classList.remove('show');
}

export async function saveWa() {
  const raw = document.getElementById('inputWa').value.trim();
  const res = validateWa({ nomorWA: raw });
  if (!res.valid) { showToast(res.message, 'error'); return; }
  await saveWaLogic({ normalized: res.normalized });
  document.getElementById('settingWa').textContent = formatPhoneDisplay(res.normalized);
  closeWaModal();
  showToast('✅ Nomor WhatsApp disimpan!');
  ensureSynced({ force: true });
  checkProfileNotification();
}

// Alamat Modal (region picker + detail)
export function openAlamatModal() {
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
  document.getElementById('alamatModal').classList.add('show');
}

export function closeAlamatModal() {
  document.getElementById('alamatModal').classList.remove('show');
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
  showToast('✅ Alamat disimpan!');
  ensureSynced({ force: true });
  checkProfileNotification();
}

export function openNameModal() {
  document.getElementById('inputNamaWarung').value = document.getElementById('settingName')?.textContent || '';
  document.getElementById('nameModal').classList.add('show');
}

export function closeNameModal() {
  document.getElementById('nameModal').classList.remove('show');
}

export async function saveNamaWarung() {
  const nama = document.getElementById('inputNamaWarung').value.trim();
  if (!nama) { showToast('Nama tidak boleh kosong!', 'error'); return; }
  await saveNamaWarungLogic({ nama });
  const el = document.getElementById('namaWarung');
  if (el) el.textContent = nama;
  document.getElementById('settingName').textContent = nama;
  closeNameModal();
  showToast('✅ Nama warung disimpan!');
  ensureSynced({ force: true });
  checkProfileNotification();
}
