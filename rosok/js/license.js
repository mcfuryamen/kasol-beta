/* =========================================================================
   KASIR SOLO - ROSOK
   license.js — License logic ONLY. Imports: utils.
   No imports from feature modules.
   ========================================================================= */
import { SETTINGS } from './app-state.js';
import { fmtRupiah, fmtDate, setSetting, toast, openOverlay, closeSheet, getWebsiteUrl } from './utils.js';

const PRODUCT_SALT = "KASIRSOLO-ROSOK-HMAC-V2";
const B32_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
const LICENSE_SECRET_V1 = "KasirSoloRosok::PTMesinKasirSolo::v1::JANGAN-SEBARKAN-GENERATOR";
export const TRIAL_DAYS = 7;
export const EXTEND_DAYS = 1;
export const MAX_EXTENSIONS = 20;

export function simpleHash(str) { let h = 0; for (let i = 0; i < str.length; i++) { h = (h * 31 + str.charCodeAt(i)) >>> 0; } return h; }

export function b32Encode(bytes, length) {
  let bits = 0, value = 0, out = '';
  for (let i = 0; i < bytes.length; i++) {
    value = (value << 8) | bytes[i]; bits += 8;
    while (bits >= 5) { out += B32_ALPHABET[(value >>> (bits - 5)) & 31]; bits -= 5; }
  }
  if (bits > 0) out += B32_ALPHABET[(value << (5 - bits)) & 31];
  return length ? out.slice(0, length) : out;
}

export async function hmacSignature(data) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(PRODUCT_SALT), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(PRODUCT_SALT + data));
  return b32Encode(new Uint8Array(sig), 6);
}

export function getDeviceCode(installId) {
  const h = simpleHash('DEVICE-' + installId);
  const b36 = h.toString(36).toUpperCase().padStart(8, '0').slice(0, 8);
  return b36.slice(0, 4) + '-' + b36.slice(4, 8);
}

export function checkExpired(expCode, activationDate) {
  if (expCode === '99') return false;
  if (expCode.endsWith('D')) {
    const days = parseInt(expCode);
    const expiry = new Date(activationDate);
    expiry.setDate(expiry.getDate() + days);
    return new Date() > expiry;
  }
  const months = parseInt(expCode);
  if (!isNaN(months)) {
    const expiry = new Date(activationDate);
    expiry.setMonth(expiry.getMonth() + months);
    return new Date() > expiry;
  }
  return false;
}

export function decodeExpiryLabel(expCode) {
  if (expCode === '99') return 'Seumur Hidup';
  if (expCode.endsWith('D')) return `${parseInt(expCode)} Hari`;
  const m = parseInt(expCode);
  if (!isNaN(m)) return `${m} Bulan`;
  return expCode;
}

export async function validateLicenseKeyV2(rawKey, myDeviceCode, activationDate) {
  const clean = (rawKey || '').trim().toUpperCase().replace(/\s+/g, '');
  const re = /^KSR-([A-Z0-9]{4})-([A-Z0-9]{4})-([A-Z0-9]{2})-([A-Z0-9]{6})$/;
  if (!re.test(clean)) return null;
  const [, d1, d2, exp, sig] = clean.match(re);
  if (d1 + '-' + d2 !== myDeviceCode) return { valid: false, reason: 'device' };
  const expected = await hmacSignature(d1 + d2 + exp);
  if (sig !== expected) return { valid: false, reason: 'Signature HMAC tidak cocok' };
  if (checkExpired(exp, activationDate || new Date().toISOString())) return { valid: false, reason: 'expired' };
  return { valid: true, expiry: exp, expiryLabel: decodeExpiryLabel(exp) };
}

export async function sha256Bytes(text) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return new Uint8Array(digest);
}
export async function hmacBytesV1(text) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(LICENSE_SECRET_V1), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(text));
  return new Uint8Array(sig);
}
export async function deviceCodeV1(deviceId) {
  return b32Encode(await sha256Bytes('DEV::' + deviceId + '::' + LICENSE_SECRET_V1), 6);
}
export async function signCodeV1(expCode, devCode) {
  return b32Encode(await hmacBytesV1(expCode + '-' + devCode), 6);
}
export function dateFromExpCode(expCode) {
  if (expCode === '999999') return null;
  const yy = parseInt(expCode.slice(0, 2), 10), mm = parseInt(expCode.slice(2, 4), 10) - 1, dd = parseInt(expCode.slice(4, 6), 10);
  return new Date(2000 + yy, mm, dd, 23, 59, 59);
}
export async function validateLicenseKeyV1(rawKey, deviceId) {
  const m = /^KSR-(\d{6})-([2-9A-Z]{6})-([2-9A-Z]{6})$/.exec((rawKey || '').trim().toUpperCase());
  if (!m) return null;
  const [, expCode, devCode, sig] = m;
  if (devCode !== await deviceCodeV1(deviceId)) return { valid: false, reason: 'device' };
  if (sig !== await signCodeV1(expCode, devCode)) return { valid: false, reason: 'tampered' };
  const expiry = dateFromExpCode(expCode);
  if (expiry && expiry.getTime() < Date.now()) return { valid: false, reason: 'expired', expiry };
  return { valid: true, expiry };
}

export async function validateLicenseKey(rawKey, deviceId) {
  const myDeviceCode = getDeviceIdForLicense();
  const activationDate = SETTINGS.licenseActivatedAt || SETTINGS.trialStart || new Date().toISOString();
  const resultV2 = await validateLicenseKeyV2(rawKey, myDeviceCode, activationDate);
  if (resultV2 !== null) return resultV2;
  return await validateLicenseKeyV1(rawKey, deviceId);
}

export function getDeviceIdForLicense() {
  return getDeviceCode(SETTINGS.deviceId || SETTINGS.installId || 'UNKNOWN');
}

// ── Trial / License Gate ─────────────────────────────────────────────────
export function trialEndDate(){
  const start = new Date(SETTINGS.trialStart || new Date().toISOString());
  const extUsed = SETTINGS.extensionsUsed || 0;
  const totalDays = TRIAL_DAYS + (extUsed * EXTEND_DAYS);
  const end = new Date(start);
  end.setDate(end.getDate() + totalDays);
  return end;
}

export function daysLeft(){
  const end = trialEndDate();
  const diff = end.getTime() - Date.now();
  return Math.ceil(diff / 86400000);
}

export function isLicensed(){
  if(SETTINGS.licenseStatus !== 'active') return false;
  if(SETTINGS.licenseExpiry && typeof SETTINGS.licenseExpiry === 'string' && SETTINGS.licenseExpiry.length <= 3) {
    return !checkExpired(SETTINGS.licenseExpiry, SETTINGS.licenseActivatedAt || SETTINGS.trialStart || new Date().toISOString());
  }
  if(SETTINGS.licenseExpiry && new Date(SETTINGS.licenseExpiry).getTime() < Date.now()) return false;
  return true;
}

// These are set by app.js after all modules load
let _updateTrialChip = null;
let _renderLicenseInfoCard = null;
let _checkLicenseGate = null;
let _openExtendFlow = null;
let _grantExtension = null;
let _openLicenseSheet = null;

export function setLicenseRefs(refs){
  _updateTrialChip = refs.updateTrialChip;
  _renderLicenseInfoCard = refs.renderLicenseInfoCard;
  _checkLicenseGate = refs.checkLicenseGate;
  _openExtendFlow = refs.openExtendFlow;
  _grantExtension = refs.grantExtension;
  _openLicenseSheet = refs.openLicenseSheet;
}

export function checkLicenseGate(){
  if(_updateTrialChip) _updateTrialChip();
  if(_renderLicenseInfoCard) _renderLicenseInfoCard();
  if(isLicensed()){
    document.getElementById('lockOverlay').classList.remove('show');
    return;
  }
  const left = daysLeft();
  if(left <= 0){
    const extUsed = SETTINGS.extensionsUsed || 0;
    const statusArea = document.getElementById('lockLicenseStatusArea');
    if(statusArea) statusArea.innerHTML = licenseStatusHtml(left, extUsed, 'lockLicenseInput');
    document.getElementById('lockOverlay').classList.add('show');
  } else {
    document.getElementById('lockOverlay').classList.remove('show');
  }
}

export function updateTrialChip(){
  const chip = document.getElementById('trialChip');
  if(isLicensed()){
    chip.textContent = '✓ Aktif';
    chip.classList.remove('warn');
    return;
  }
  const left = daysLeft();
  chip.textContent = left>0 ? `${left} hari lagi` : 'Trial habis';
  chip.classList.toggle('warn', left<=2);
}

export function openLicenseSheet(){
  const left = daysLeft();
  const extUsed = SETTINGS.extensionsUsed || 0;
  const body = document.getElementById('licenseSheetBody');
  body.innerHTML = licenseStatusHtml(left, extUsed, 'licenseKeyInputSheet');
  openOverlay('sheetLicense');
}

export function licenseStatusHtml(left, extUsed, inputId){
  if(isLicensed()){
    const expRaw = SETTINGS.licenseExpiry;
    let expTxt = 'Berlaku seumur hidup';
    if (expRaw && typeof expRaw === 'string' && expRaw.length <= 3) {
      expTxt = 'Masa berlaku: ' + decodeExpiryLabel(expRaw);
    } else if (expRaw) {
      expTxt = 'Berlaku sampai ' + fmtDate(expRaw).split(' ').slice(0,3).join(' ');
    }
    return `<div class="card license-card-active">
      <div class="license-icon">✅</div>
      <div class="badge green compact">✓ Lisensi Aktif</div>
      <p class="license-key"><b>${SETTINGS.licenseKey||'-'}</b></p>
      <p class="license-expiry">Masa berlaku: ${expTxt}</p>
      <p class="license-desc">Lisensi terikat perangkat ini dan membuka semua fitur tanpa batasan.</p>
    </div>`;
  }
  return `
    <div class="card license-card-trial">
      <div class="license-header">
        <div class="license-icon">⏰</div>
        <div class="license-title">Masa Coba Gratis</div>
        <span class="badge ${left>2?'orange':'red'}">${left>0? left+' hari tersisa' : 'Sudah habis'}</span>
      </div>
      <div class="license-description">
        Setiap kali Anda membagikan aplikasi ini ke kontak, Anda akan mendapatkan perpanjangan otomatis yang tersedia 20 kali (maksimal 1 hari per perpanjangan).
      </div>
      <div class="license-extend-section">
        ${extUsed < MAX_EXTENSIONS ? `<button class="btn-extend mt12" onclick="window._ksr_openExtendFlow()">🎁 Tambah 1 Hari Gratis (${MAX_EXTENSIONS-extUsed}x tersisa)</button>` : `<div class="hint mt12">Jatah perpanjangan gratis sudah habis (maks ${MAX_EXTENSIONS}x). Silakan aktivasi lisensi resmi.</div>`}
        <div class="license-usage">Perpanjangan dipakai <b>${extUsed}/${MAX_EXTENSIONS}</b>x</div>
      </div>
    </div>
    <div class="field mt12"><label class="field-label">Kode Lisensi</label><input type="text" id="${inputId}" placeholder="KSR-XXXX-XXXX-XX-XXXXXX" class="uppercase"></div>
    <div class="license-actions">
      <button class="btn-buy-wa" onclick="window._ksr_contactViaWA()">💬 Beli Lisensi via WA</button>
      <button class="btn btn-primary" onclick="window._ksr_activateLicense('${inputId}')">🔓 Aktifkan Lisensi</button>
    </div>
  `;
}

export function renderLicenseInfoCard(){
  const card = document.getElementById('licenseInfoCard');
  if(!card) return;
  const left = daysLeft();
  const extUsed = SETTINGS.extensionsUsed || 0;
  card.innerHTML = licenseStatusHtml(left, extUsed, 'licenseKeyInputSettings');
}

export function contactViaWA(){
  const dc = SETTINGS.deviceCode || getDeviceIdForLicense();
  const text = `Halo, saya ingin aktivasi lisensi Kasir Solo - Rosok.\nDevice Code: ${dc}`;
  window.open(`https://wa.me/628816566935?text=${encodeURIComponent(text)}`, '_blank');
}

export function contactViaEmail(){
  const dc = SETTINGS.deviceCode || getDeviceIdForLicense();
  const subject = 'Aktivasi Lisensi Kasir Solo Rosok';
  const body = `Halo, saya ingin aktivasi lisensi Kasir Solo - Rosok.\nDevice Code: ${dc}`;
  window.location.href = `mailto:owner.kasirsolo@gmail.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

let _activateLicenseTarget = null;
export function setActivateLicenseTarget(fn){ _activateLicenseTarget = fn; }

export async function activateLicense(inputId){
  const key = (document.getElementById(inputId).value || '').trim().toUpperCase();
  if(!key){ toast('Masukkan kode lisensi'); return; }
  toast('Memeriksa lisensi...');
  const deviceId = SETTINGS.deviceId;
  const now = new Date().toISOString();
  try{
    const result = await validateLicenseKey(key, deviceId);
    if(result.valid){
      await setSetting('licenseStatus','active');
      await setSetting('licenseKey', key);
      await setSetting('licenseActivatedAt', now);
      await setSetting('licenseExpiry', result.expiry || null);
      await setSetting('licenseExpiryLabel', result.expiryLabel || '');
      if(_updateTrialChip) _updateTrialChip();
      if(_renderLicenseInfoCard) _renderLicenseInfoCard();
      closeSheet('sheetLicense');
      document.getElementById('lockOverlay').classList.remove('show');
      const msg = result.expiryLabel ? `Lisensi aktif! Masa berlaku: ${result.expiryLabel}` : 'Lisensi berhasil diaktifkan 🎉';
      toast(msg);
    } else if(result.reason === 'device'){
      toast('Kode ini bukan untuk perangkat ini');
    } else if(result.reason === 'expired'){
      toast('Kode lisensi sudah kedaluwarsa');
    } else {
      toast('Kode lisensi tidak valid');
    }
  } catch(err){
    toast('Gagal memeriksa kode lisensi. Coba lagi.');
  }
}

export async function openExtendFlow(){
  const extUsed = SETTINGS.extensionsUsed || 0;
  if(extUsed >= MAX_EXTENSIONS){ toast('Jatah perpanjangan sudah habis'); return; }
  const shareText = `Halo! Saya pakai *Kasir Solo - Rosok* buat catat transaksi rosok saya, gampang & ringan banget. *PT Mesin Kasir Solo* juga menyediakan beragam aplikasi khusus sesuai kebutuhan bisnismu. Info lengkap: WA 0881-6566-935 atau email owner.kasirsolo@gmail.com.\n\nCoba langsung di: ${getWebsiteUrl()}`;
  if('contacts' in navigator && 'ContactsManager' in window){
    try{
      const contacts = await navigator.contacts.select(['name','tel'], {multiple:false});
      if(contacts && contacts.length >= 1){
        await tryShare(shareText);
        if(_grantExtension) _grantExtension();
        return;
      }
    }catch(err){
      // pengguna batal pilih kontak -> lanjut ke fallback share manual di bawah
    }
  }
  await tryShare(shareText);
  const ok = confirm('Apakah kamu berhasil membagikan info aplikasi ini ke kontak rekan atau media sosial? \n\nJika ya, kamu akan dapatkan 1 hari masa coba gratis tambahan.');
  if(ok){ if(_grantExtension) _grantExtension(); }
  else { toast('Bagikan dulu ke kontak untuk klaim tambahan 1 hari'); }
}

export async function tryShare(text){
  if(navigator.share){
    try{ await navigator.share({title:'Kasir Solo - Rosok', text}); }catch(e){}
  } else {
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  }
}

export async function grantExtension(){
  const extUsed = (SETTINGS.extensionsUsed || 0) + 1;
  await setSetting('extensionsUsed', extUsed);
  await setSetting('lastExtensionAt', new Date().toISOString());
  if(_updateTrialChip) _updateTrialChip();
  closeSheet('sheetLicense');
  document.getElementById('lockOverlay').classList.remove('show');
  if(_checkLicenseGate) _checkLicenseGate();
  toast(`Masa coba ditambah 1 hari! 🎉 (${extUsed}/${MAX_EXTENSIONS}) — membagikan info ke kontak membantu kami mengembangkan aplikasi untuk usaha kecil.`);
}

// Global exports for onclick
window._ksr_activateLicense = activateLicense;
window._ksr_openExtendFlow = openExtendFlow;
window._ksr_contactViaWA = contactViaWA;
