// ==================== LISENSI (ESM) ====================
// Kaki Lima license — adopts the full Kasir Solo trial & license feature set
// from the Rosok app: 7-day trial, share-to-extend (20x, +1 hari), paid serial
// (KK5 prefix, HMAC-SHA256 v2).
// Follows the universal Kasir Solo v2-HMAC scheme (see admin/docs/04-license-system.md).
// NOTE: Validation here is OFFLINE (HMAC local) as the current fallback; the
// cloud target is server-side validation via Supabase (Lapisan Meta/CRM), see
// ../CLOUD-ROADMAP.md. The scaffolding keeps a single gate point so the server
// check can be added later without touching the app flow.
import { setSetting, getSetting } from './db.js';
import { showToast } from './helpers.js';

const PRODUCT_PREFIX = 'KK5';
const PRODUCT_SALT   = 'KASIRSOLO-KAKI5-HMAC-V2';

const B32_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

// Trial config (matches Rosok)
export const TRIAL_DAYS = 7;
export const EXTEND_DAYS = 1;
export const MAX_EXTENSIONS = 20;

// Universal device code (matches admin algorithm)
function simpleHash(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) { h = (h * 31 + str.charCodeAt(i)) >>> 0; }
  return h;
}

function b32Encode(bytes, length) {
  let bits = 0, value = 0, out = '';
  for (let i = 0; i < bytes.length; i++) {
    value = (value << 8) | bytes[i];
    bits += 8;
    while (bits >= 5) { out += B32_ALPHABET[(value >>> (bits - 5)) & 31]; bits -= 5; }
  }
  if (bits > 0) out += B32_ALPHABET[(value << (5 - bits)) & 31];
  return length ? out.slice(0, length) : out;
}

// Generate a stable installId (kept in settings) and derive deviceCode
async function getDeviceIdentity() {
  let installId = await getSetting('installId', null);
  if (!installId) {
    installId = Date.now().toString(36) + Math.random().toString(36).slice(2, 8).toUpperCase();
    await setSetting('installId', installId);
  }
  const h = simpleHash('DEVICE-' + installId);
  const b36 = h.toString(36).toUpperCase().padStart(8, '0').slice(0, 8);
  const deviceCode = b36.slice(0, 4) + '-' + b36.slice(4, 8);
  return { installId, deviceCode };
}

async function hmacSignature(data) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(PRODUCT_SALT),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(PRODUCT_SALT + data));
  return b32Encode(new Uint8Array(sig), 6);
}

function checkExpired(expCode, activationDate) {
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

function decodeExpiryLabel(expCode) {
  if (expCode === '99') return 'Seumur Hidup';
  if (expCode.endsWith('D')) return `${parseInt(expCode)} Hari`;
  const m = parseInt(expCode);
  if (!isNaN(m)) return `${m} Bulan`;
  return expCode;
}

async function validateSerial(rawSerial, myDeviceCode, activationDate) {
  const clean = (rawSerial || '').trim().toUpperCase().replace(/\s+/g, '');
  const re = new RegExp('^' + PRODUCT_PREFIX + '-([A-Z0-9]{4})-([A-Z0-9]{4})-([A-Z0-9]{2})-([A-Z0-9]{6})$');
  const m = clean.match(re);
  if (!m) return null;
  const [, d1, d2, exp, sig] = m;
  if ((d1 + '-' + d2) !== myDeviceCode) return { valid: false, reason: 'device' };
  const expected = await hmacSignature(d1 + d2 + exp);
  if (sig !== expected) return { valid: false, reason: 'Signature HMAC tidak cocok' };
  if (checkExpired(exp, activationDate || new Date().toISOString())) return { valid: false, reason: 'expired' };
  return { valid: true, expiry: exp, expiryLabel: decodeExpiryLabel(exp) };
}

// ----- License state (persisted in settings table) -----
// license = { status: 'trial'|'active'|'expired', startedAt, serial?, deviceCode?,
//             expCode? , extensionsUsed?, lastExtensionAt? }

async function getLicense() {
  const lic = await getSetting('license', null) || {};
  return lic;
}

async function saveLicense(lic) {
  await setSetting('license', lic);
}

// Start a fresh 7-day trial (only if not already activated)
export async function startTrial() {
  const lic = await getLicense();
  if (lic.status === 'active') return { status: 'active' };
  const now = new Date().toISOString();
  if (!lic.startedAt) {
    const trial = { status: 'trial', startedAt: now, deviceCode: (await getDeviceIdentity()).deviceCode, extensionsUsed: 0 };
    await saveLicense(trial);
    return trial;
  }
  // trial already started (e.g. expired but clicked again) — return existing
  return lic;
}

// Activate with a paid serial. Returns result object for UI feedback.
export async function activateSerial(rawSerial) {
  const { deviceCode } = await getDeviceIdentity();
  const serial = (rawSerial || '').trim().toUpperCase();
  const result = await validateSerial(serial, deviceCode, new Date().toISOString());
  if (!result || !result.valid) {
    if (result && result.reason === 'device') return { valid: false, message: 'Kode ini bukan untuk perangkat ini.' };
    if (result && result.reason === 'expired') return { valid: false, message: 'Kode lisensi sudah kedaluwarsa.' };
    return { valid: false, message: 'Serial tidak valid.' };
  }
  const m = serial.match(/-([A-Z0-9]{2})-[A-Z0-9]{6}$/);
  const expCode = m ? m[1] : '99';
  const lic = { status: 'active', startedAt: new Date().toISOString(), serial, deviceCode, expCode, expiryLabel: result.expiryLabel };
  await saveLicense(lic);
  return { valid: true, message: '✅ Lisensi aktif! Masa berlaku: ' + result.expiryLabel };
}

// Check current status (used by the license gate + banner)
export async function getLicenseStatus() {
  const lic = await getLicense();
  const deviceCode = (await getDeviceIdentity()).deviceCode;
  if (!lic || !lic.status) return { status: 'none', deviceCode };
  if (lic.status === 'active') {
    const expired = lic.expCode === '99' ? false : checkExpired(lic.expCode || '99', lic.startedAt);
    if (expired) return { status: 'expired', deviceCode: lic.deviceCode, protocol: 'licensed-expired' };
    return { status: 'active', deviceCode: lic.deviceCode, serial: lic.serial, expCode: lic.expCode, expiryLabel: lic.expiryLabel };
  }
  if (lic.status === 'trial') {
    const end = trialEndDate(lic);
    const left = Math.ceil((end.getTime() - Date.now()) / 86400000);
    if (left <= 0) return { status: 'expired', deviceCode: lic.deviceCode, trialExpired: true, daysLeft: left };
    return { status: 'trial', deviceCode: lic.deviceCode, daysLeft: left, extensionsUsed: lic.extensionsUsed || 0, endDate: end.toISOString() };
  }
  return { status: 'none', deviceCode };
}

function trialEndDate(lic) {
  const start = new Date(lic.startedAt || new Date().toISOString());
  const extUsed = lic.extensionsUsed || 0;
  const totalDays = TRIAL_DAYS + (extUsed * EXTEND_DAYS);
  const end = new Date(start);
  end.setDate(end.getDate() + totalDays);
  return end;
}

function daysLeft(lic) {
  const end = trialEndDate(lic);
  const diff = end.getTime() - Date.now();
  return Math.ceil(diff / 86400000);
}

async function isLicensed() {
  const lic = await getLicense();
  if (lic.status !== 'active') return false;
  return !checkExpired(lic.expCode || '99', lic.startedAt);
}

// ----- unitId (global DNA) -----
export async function getUnitId() {
  let unitId = await getSetting('unitId', null);
  if (!unitId) {
    const { deviceCode } = await getDeviceIdentity();
    unitId = 'K5-' + deviceCode;
    await setSetting('unitId', unitId);
  }
  return unitId;
}

export async function ensureUnitId() {
  await getUnitId();
}

// ----- device identity (dipakai modul sync / profil klien) -----
export async function getDeviceCode() {
  return (await getDeviceIdentity()).deviceCode;
}

export async function getInstallId() {
  return (await getDeviceIdentity()).installId;
}

// ----- UI wiring (refs injected by app.js to avoid circular imports) -----
let _updateTrialChip = null;
let _renderLicenseInfoCard = null;
let _checkLicenseGate = null;
let _openExtendFlow = null;
let _grantExtension = null;
let _openLicenseSheet = null;

export function setLicenseRefs(refs) {
  _updateTrialChip = refs.updateTrialChip;
  _renderLicenseInfoCard = refs.renderLicenseInfoCard;
  _checkLicenseGate = refs.checkLicenseGate;
  _openExtendFlow = refs.openExtendFlow;
  _grantExtension = refs.grantExtension;
  _openLicenseSheet = refs.openLicenseSheet;
}

// ── Trial / License UI ─────────────────────────────────────────────────
export function openOverlay(id) {
  const el = document.getElementById(id);
  if (el) el.classList.add('show');
}
export function closeOverlay(id) {
  const el = document.getElementById(id);
  if (el) el.classList.remove('show');
}
function closeSheet(id) { closeOverlay(id); }
export { closeSheet };

export async function checkLicenseGate() {
  // Jika gate full-screen (onboarding / trial-habis) sedang tampil, jangan pop lock —
  // gate sendiri yang menangani state. (Smart gate → hindari double overlay.)
  const gateEl = document.getElementById('licenseGate');
  if (gateEl && gateEl.style.display !== 'none') return;

  const lic = await getLicense();
  const left = daysLeft(lic);
  if (await isLicensed()) {
    if (_updateTrialChip) _updateTrialChip();
    if (_renderLicenseInfoCard) _renderLicenseInfoCard();
    const lock = document.getElementById('lockOverlay');
    if (lock) lock.classList.remove('show');
    return;
  }
  // not licensed (trial running or expired)
  if (_updateTrialChip) _updateTrialChip();
  if (_renderLicenseInfoCard) _renderLicenseInfoCard();
  if (left <= 0) {
    const extUsed = lic.extensionsUsed || 0;
    const area = document.getElementById('lockLicenseStatusArea');
    if (area) area.innerHTML = licenseStatusHtml(left, extUsed, 'lockLicenseInput');
    const lock = document.getElementById('lockOverlay');
    if (lock) lock.classList.add('show');
  }
}

export async function updateTrialChip() {
  const chip = document.getElementById('trialChip');
  if (!chip) return;
  if (await isLicensed()) {
    chip.innerHTML = '<div class="trial-label-xs">LISENSI</div><div class="trial-value-sm">✓ Aktif</div>';
    chip.classList.remove('warn');
    return;
  }
  const lic = await getLicense();
  const left = daysLeft(lic);
  chip.innerHTML = '<div class="trial-label-xs">TRIAL</div><div class="trial-value-sm">' + (left > 0 ? left + ' hari' : 'Habis') + '</div>';
  chip.classList.toggle('warn', left <= 2);
}

export async function openLicenseSheet() {
  const lic = await getLicense();
  const left = daysLeft(lic);
  const extUsed = lic.extensionsUsed || 0;
  const body = document.getElementById('licenseSheetBody');
  if (body) body.innerHTML = licenseStatusHtml(left, extUsed, 'licenseKeyInputSheet');
  openOverlay('sheetLicense');
}

export function licenseStatusHtml(left, extUsed, inputId) {
  return `
    <div class="card license-card-trial">
      <div class="license-header">
        <div class="license-icon">⏰</div>
        <div class="license-title">Masa Coba Gratis</div>
        <span class="badge ${left > 2 ? 'orange' : 'red'}">${left > 0 ? left + ' hari tersisa' : 'Sudah habis'}</span>
      </div>
      <div class="license-description">
        Setiap kali Anda membagikan aplikasi ini ke kontak, Anda akan mendapatkan perpanjangan otomatis yang tersedia 20 kali (maksimal 1 hari per perpanjangan).
      </div>
      <div class="license-extend-section">
        ${extUsed < MAX_EXTENSIONS ? `<button class="btn-extend mt12" onclick="window._ksr_openExtendFlow()">🎁 Tambah 1 Hari Gratis</button>` : `<div class="hint mt12">Jatah perpanjangan gratis sudah habis (maks ${MAX_EXTENSIONS}x). Silakan aktivasi lisensi resmi.</div>`}\n        <div class="license-usage">Perpanjangan dipakai <b>${extUsed}/${MAX_EXTENSIONS}</b>x</div>
      </div>
    </div>
    <div class="field mt12"><label class="field-label">Kode Lisensi</label><input type="text" id="${inputId}" placeholder="KK5-XXXX-XXXX-XX-XXXXXX" class="form-input uppercase"></div>
    <div class="license-actions">
      <button class="btn-buy-wa" onclick="window._ksr_contactViaWA()">💬 Beli Lisensi</button>
      <button class="btn btn-primary" onclick="window._ksr_activateLicense('${inputId}')">🔓 Aktifkan</button>
    </div>
  `;
}

export async function renderLicenseInfoCard() {
  const card = document.getElementById('licenseInfoCard');
  if (!card) return;
  if (await isLicensed()) {
    const lic = await getLicense();
    const expTxt = lic.expiryLabel ? 'Masa berlaku: ' + escapeHtml(lic.expiryLabel) : 'Berlaku seumur hidup';
    card.innerHTML = `
      <div class="card license-card-active">
        <div class="license-icon">✅</div>
        <div class="badge green compact">✓ Lisensi Aktif</div>
        <p class="license-key"><b>${escapeHtml(lic.serial || '-')}</b></p>
        <p class="license-expiry">${expTxt}</p>
        <p class="license-desc">Lisensi terikat perangkat ini dan membuka semua fitur tanpa batasan.</p>
      </div>`;
    return;
  }
  const lic = await getLicense();
  const left = daysLeft(lic);
  const extUsed = lic.extensionsUsed || 0;
  card.innerHTML = licenseStatusHtml(left, extUsed, 'licenseKeyInputSettings');
}

export async function contactViaWA() {
  const { deviceCode } = await getDeviceIdentity();
  const text = `Halo, saya ingin aktivasi lisensi Kasir Solo - Kaki Lima.\nKode Perangkat: ${deviceCode}\nAplikasi: Kasir Solo Kaki Lima`;
  window.open('https://wa.me/628816566935?text=' + encodeURIComponent(text), '_blank');
}

export async function openExtendFlow() {
  const lic = await getLicense();
  const extUsed = lic.extensionsUsed || 0;
  if (extUsed >= MAX_EXTENSIONS) { showToast('Jatah perpanjangan sudah habis', 'error'); return; }
  const shareText = 'Halo! Saya pakai *Kasir Solo - Kaki Lima* buat catat jualan saya, gampang & ringan banget. *PT Mesin Kasir Solo* juga menyediakan beragam aplikasi khusus sesuai kebutuhan bisnismu. Info lengkap: WA 0881-6566-935 atau email owner.kasirsolo@gmail.com.\n\nCoba langsung di: https://kasirsolo.app';
  if ('contacts' in navigator && 'ContactsManager' in window) {
    try {
      const contacts = await navigator.contacts.select(['name', 'tel'], { multiple: false });
      if (contacts && contacts.length >= 1) {
        await tryShare(shareText);
        if (_grantExtension) _grantExtension();
        return;
      }
    } catch (err) {
      // user cancelled — fall through
    }
  }
  await tryShare(shareText);
  const ok = confirm('Apakah kamu berhasil membagikan info aplikasi ini ke kontak rekan atau media sosial? \n\nJika ya, kamu akan dapatkan 1 hari masa coba gratis tambahan.');
  if (ok) { if (_grantExtension) _grantExtension(); }
  else { showToast('Bagikan dulu ke kontak untuk klaim tambahan 1 hari', 'error'); }
}

export async function tryShare(text) {
  if (navigator.share) {
    try { await navigator.share({ title: 'Kasir Solo - Kaki Lima', text }); } catch (e) {}
  } else {
    window.open('https://wa.me/?text=' + encodeURIComponent(text), '_blank');
  }
}

export async function grantExtension() {
  const lic = await getLicense();
  const extUsed = (lic.extensionsUsed || 0) + 1;
  lic.extensionsUsed = extUsed;
  lic.lastExtensionAt = new Date().toISOString();
  await saveLicense(lic);
  const left = daysLeft(lic);
  if (_updateTrialChip) _updateTrialChip();
  if (_renderLicenseInfoCard) _renderLicenseInfoCard();
  closeOverlay('sheetLicense');
  document.getElementById('lockOverlay')?.classList.remove('show');
  if (_checkLicenseGate) _checkLicenseGate();
  showToast('Masa coba ditambah 1 hari! 🎉 (' + extUsed + '/' + MAX_EXTENSIONS + ')');
}

export async function activateLicense(inputId) {
  const key = (document.getElementById(inputId).value || '').trim().toUpperCase();
  if (!key) { showToast('Masukkan kode lisensi', 'error'); return; }
  showToast('Memeriksa lisensi...');
  const res = await activateSerial(key);
  if (res.valid) {
    if (_updateTrialChip) _updateTrialChip();
    if (_renderLicenseInfoCard) _renderLicenseInfoCard();
    closeOverlay('sheetLicense');
    const lock = document.getElementById('lockOverlay');
    if (lock) lock.classList.remove('show');
    const gate = document.getElementById('licenseGate');
    if (gate) gate.style.display = 'none';
    showToast(res.message);
  } else {
    showToast(res.message || 'Kode lisensi tidak valid', 'error');
  }
}

// Window wiring terpusat di app.js (lihat app.js:114-117).
// (Audit 2026-08-09: hapus self-wire dari license.js — duplikat dgn app.js)
