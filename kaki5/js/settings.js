// ==================== SETTINGS (ESM) ====================
import { getSetting, setSetting } from './db.js';
import { showToast, validatePhone, formatPhoneDisplay } from './helpers.js';
import { getLicenseStatus, renderLicenseInfoCard } from './license.js';
import { setupRegionPicker } from './region.js';
import { ensureSynced, isSyncConfigured } from './sync.js';

// State pilihan wilayah Alamat
const region = {
  provinsi_id: '', provinsi: '',
  kabkota_id:  '', kabkota:  '',
  kecamatan_id:'', kecamatan:''
};

async function regionSummary() {
  const kab  = await getSetting('kabkota', '');
  const prov = await getSetting('provinsi', '');
  const detail = await getSetting('alamat', '');
  const parts = [kab, prov].filter(Boolean).join(', ');
  return parts ? (detail ? detail + ' — ' + parts : parts) : (detail || '—');
}

export async function loadSettings() {
  const nama = await getSetting('namaWarung', 'Warung Saya');
  document.getElementById('settingName').textContent = nama;

  // Owner + WhatsApp + Alamat
  const ownerEl = document.getElementById('settingOwner');
  const waEl = document.getElementById('settingWa');
  const alamatEl = document.getElementById('settingAlamat');
  if (ownerEl) ownerEl.textContent = await getSetting('namaPemilik', '—') || '—';
  if (waEl) waEl.textContent = await getSetting('noWhatsapp', '—') || '—';
  if (alamatEl) alamatEl.textContent = await regionSummary();

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
      const s = (await getSetting('sync', null)) || { status: 'none' };
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
  const pem = await getSetting('namaPemilik', '');
  const wa = await getSetting('noWhatsapp', '');
  const kab = await getSetting('kabkota', '');
  const alamat = await getSetting('alamat', '');
  const incomplete = !pem || !wa || (!kab && !alamat);
  banner.classList.toggle('show', incomplete);
}

// Owner Modal (Nama Pemilik)
export function openOwnerModal() {
  document.getElementById('inputOwner').value = document.getElementById('settingOwner').textContent === '—' ? '' : document.getElementById('settingOwner').textContent;
  document.getElementById('ownerModal').classList.add('show');
}

export function closeOwnerModal() {
  document.getElementById('ownerModal').classList.remove('show');
}

export async function saveOwner() {
  const owner = document.getElementById('inputOwner').value.trim();
  if (!owner) { showToast('Nama pemilik tidak boleh kosong!', 'error'); return; }
  await setSetting('namaPemilik', owner);
  document.getElementById('settingOwner').textContent = owner || '—';
  closeOwnerModal();
  showToast('✅ Nama pemilik disimpan!');
  ensureSynced(); checkProfileNotification();
}

// WA Modal (Nomor WhatsApp)
export function openWaModal() {
  document.getElementById('inputWa').value = document.getElementById('settingWa').textContent === '—' ? '' : document.getElementById('settingWa').textContent;
  document.getElementById('waModal').classList.add('show');
}

export function closeWaModal() {
  document.getElementById('waModal').classList.remove('show');
}

export async function saveWa() {
  const raw = document.getElementById('inputWa').value.trim();
  const res = validatePhone(raw);
  if (!res.valid) { showToast(res.message, 'error'); return; }
  await setSetting('noWhatsapp', res.normalized);
  document.getElementById('settingWa').textContent = formatPhoneDisplay(res.normalized);
  closeWaModal();
  showToast('✅ Nomor WhatsApp disimpan!');
  ensureSynced(); checkProfileNotification();
}

// Alamat Modal (region picker + detail)
export function openAlamatModal() {
  document.getElementById('inputAlamat').value =
    document.getElementById('settingAlamat').textContent === '—' ? '' : (document.getElementById('settingAlamat').textContent.split(' — ')[0]);
  // isi state awal dari setting tersimpan
  (async () => {
    region.provinsi_id  = await getSetting('provinsiId', '');
    region.provinsi     = await getSetting('provinsi', '');
    region.kabkota_id   = await getSetting('kabkotaId', '');
    region.kabkota      = await getSetting('kabkota', '');
    region.kecamatan_id = await getSetting('kecamatanId', '');
    region.kecamatan    = await getSetting('kecamatan', '');
    setupRegionPicker({
      provSel: 'alamatProvinsi',
      kabSel: 'alamatKabkota',
      kecSel: 'alamatKecamatan',
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
  if (!alamat) { showToast('Alamat tidak boleh kosong!', 'error'); return; }
  await setSetting('alamat', alamat);
  await setSetting('provinsiId', region.provinsi_id);
  await setSetting('provinsi', region.provinsi);
  await setSetting('kabkotaId', region.kabkota_id);
  await setSetting('kabkota', region.kabkota);
  await setSetting('kecamatanId', region.kecamatan_id);
  await setSetting('kecamatan', region.kecamatan);
  document.getElementById('settingAlamat').textContent = await regionSummary();
  closeAlamatModal();
  showToast('✅ Alamat disimpan!');
  ensureSynced(); checkProfileNotification();
}

export function openNameModal() {
  document.getElementById('inputNamaWarung').value = document.getElementById('settingName').textContent;
  document.getElementById('nameModal').classList.add('show');
}

export function closeNameModal() {
  document.getElementById('nameModal').classList.remove('show');
}

export async function saveNamaWarung() {
  const nama = document.getElementById('inputNamaWarung').value.trim();
  if (!nama) { showToast('Nama tidak boleh kosong!', 'error'); return; }
  await setSetting('namaWarung', nama);
  document.getElementById('namaWarung').textContent = nama;
  document.getElementById('settingName').textContent = nama;
  closeNameModal();
  showToast('✅ Nama warung disimpan!');
  ensureSynced(); checkProfileNotification();
}

// Tombol "Sinkron Sekarang"
export async function syncNow() {
  const res = await ensureSynced({ force: true });
  if (res.ok) showToast('✅ Profil tersinkron ke server');
  return res;
}
window._ksr_syncNow = syncNow;
