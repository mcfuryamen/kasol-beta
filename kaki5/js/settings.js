// ==================== SETTINGS (ESM) ====================
import { getSetting, setSetting } from './db.js';
import { showToast } from './helpers.js';
import { getLicenseStatus, renderLicenseInfoCard } from './license.js';

export async function loadSettings() {
  const nama = await getSetting('namaWarung', 'Warung Saya');
  document.getElementById('settingName').textContent = nama;

  // Owner + WhatsApp + Alamat (dari onboarding; untuk sinkronisasi ke repo admin via Supabase)
  const ownerEl = document.getElementById('settingOwner');
  const waEl = document.getElementById('settingWa');
  const alamatEl = document.getElementById('settingAlamat');
  if (ownerEl) ownerEl.textContent = await getSetting('namaPemilik', '—') || '—';
  if (waEl) waEl.textContent = await getSetting('noWhatsapp', '—') || '—';
  if (alamatEl) alamatEl.textContent = await getSetting('alamat', '—') || '—';

  // unitId shown in settings (device id, sekarang di kartu versi paling bawah)
  const unitEl = document.getElementById('licUnit');
  const lic = await getLicenseStatus();
  if (unitEl) unitEl.textContent = lic.deviceCode ? ('ID Perangkat: ' + lic.deviceCode) : '';
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
  const wa = document.getElementById('inputWa').value.trim();
  if (!wa) { showToast('Nomor WhatsApp tidak boleh kosong!', 'error'); return; }
  await setSetting('noWhatsapp', wa);
  document.getElementById('settingWa').textContent = wa || '—';
  closeWaModal();
  showToast('✅ Nomor WhatsApp disimpan!');
}

// Alamat Modal (Alamat)
export function openAlamatModal() {
  document.getElementById('inputAlamat').value = document.getElementById('settingAlamat').textContent === '—' ? '' : document.getElementById('settingAlamat').textContent;
  document.getElementById('alamatModal').classList.add('show');
}

export function closeAlamatModal() {
  document.getElementById('alamatModal').classList.remove('show');
}

export async function saveAlamat() {
  const alamat = document.getElementById('inputAlamat').value.trim();
  if (!alamat) { showToast('Alamat tidak boleh kosong!', 'error'); return; }
  await setSetting('alamat', alamat);
  document.getElementById('settingAlamat').textContent = alamat || '—';
  closeAlamatModal();
  showToast('✅ Alamat disimpan!');
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
}
