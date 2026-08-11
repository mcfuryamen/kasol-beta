// ==================== SETTINGS LOGIC (ESM) ====================
// Pure functions only — NO DOM access, NO window references.
// Handles validation, data transformation, and raw DB save logic.

import { getSetting, setSetting } from './db.js';
import { validatePhone } from './helpers.js';

// State pilihan wilayah Alamat
const region = {
  provinsi_id: '', provinsi: '',
  kabkota_id:  '', kabkota:  '',
  kecamatan_id:'', kecamatan:'',
  desa_id:     '', desa:     ''
};

export { region };

export async function regionSummary() {
  const kab  = await getSetting('kabkota', '');
  const prov = await getSetting('provinsi', '');
  const kec  = await getSetting('kecamatan', '');
  const desa = await getSetting('desa', '');
  const detail = await getSetting('alamat', '');
  const parts = [desa, kec, kab, prov].filter(Boolean).join(', ');
  return parts ? (detail ? detail + ' — ' + parts : parts) : (detail || '—');
}

export function validateAlamat(data) {
  return !(!data.alamat || !data.alamat.trim());
}

export function buildAlamatPayload(data) {
  return {
    alamat:        data.alamat,
    provinsi_id:   data.provinsi_id,
    kabupaten_id:  data.kabkota_id,
    kecamatan_id:  data.kecamatan_id,
    desa_id:       data.desa_id,
    provinsi:      data.provinsi,
    kabkota:       data.kabkota,
    kecamatan:     data.kecamatan,
    desa:          data.desa
  };
}

export function validateOwner(data) {
  return !(!data.namaPemilik || !data.namaPemilik.trim());
}

export function validateWa(data) {
  const res = validatePhone(data.nomorWA);
  return res;
}

export async function saveOwnerLogic(data) {
  await setSetting('namaPemilik', data.namaPemilik.trim());
}

export async function saveWaLogic(data) {
  await setSetting('noWhatsapp', data.normalized);
}

export async function saveAlamatLogic(data) {
  await setSetting('alamat', data.alamat);
  await setSetting('provinsiId', data.provinsi_id);
  await setSetting('provinsi', data.provinsi);
  await setSetting('kabkotaId', data.kabkota_id);
  await setSetting('kabkota', data.kabkota);
  await setSetting('kecamatanId', data.kecamatan_id);
  await setSetting('kecamatan', data.kecamatan);
  await setSetting('desaId', data.desa_id);
  await setSetting('desa', data.desa);
}

export async function saveNamaWarungLogic(data) {
  await setSetting('namaWarung', data.nama.trim());
}

export async function loadSettingsData() {
  const nama = await getSetting('namaWarung', 'Warung Saya');
  const owner = await getSetting('namaPemilik', '—');
  const wa = await getSetting('noWhatsapp', '—');
  const sync = await getSetting('sync', null);
  const kab = await getSetting('kabkota', '');
  const prov = await getSetting('provinsi', '');
  const kec = await getSetting('kecamatan', '');
  const desa = await getSetting('desa', '');
  const detail = await getSetting('alamat', '');
  const parts = [desa, kec, kab, prov].filter(Boolean).join(', ');
  const alamatDisplay = parts ? (detail ? detail + ' — ' + parts : parts) : (detail || '—');
  return { nama, owner, wa, alamatDisplay, sync };
}

export async function checkProfileNotificationData() {
  const pem = await getSetting('namaPemilik', '');
  const wa = await getSetting('noWhatsapp', '');
  const kab = await getSetting('kabkota', '');
  const alamat = await getSetting('alamat', '');
  return !pem || !wa || (!kab && !alamat);
}
