// ==================== LICENSE LOGIC (ESM) ====================
// Pure functions + DB-dependent logic. NO DOM operations.
import { setSetting, getSetting } from './db.js';
import { escapeHtml } from './helpers.js';

const PRODUCT_PREFIX = 'KK5';
// PRODUCT_SALT deliberately NOT stored as a plain, greppable constant.
// Derived at runtime from non-obvious fragments so a casual string-scan of the
// bundle doesn't trivially reveal the HMAC key. This is defensive entertainment
// (security-through-obscurity) — the real fix is server-side validation (see
// license.sync.js + CLOUD-ROADMAP.md). Offline PWA can never be truly un-forgeable.
function buildProductSalt() {
  const a = 'KASIR' + 'SOLO';
  const b = 'KAKI' + '5';
  const c = 'HMAC' + '-' + 'V2';
  return [a, b, c].join('-');
}
const PRODUCT_SALT = buildProductSalt();

const B32_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

// Trial config (matches Rosok)
export const TRIAL_DAYS = 7;
export const EXTEND_DAYS = 1;
export const MAX_EXTENSIONS = 20;

// Universal device code (matches admin algorithm)
export function simpleHash(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) { h = (h * 31 + str.charCodeAt(i)) >>> 0; }
  return h;
}

export function b32Encode(bytes, length) {
  let bits = 0, value = 0, out = '';
  for (let i = 0; i < bytes.length; i++) {
    value = (value << 8) | bytes[i];
    bits += 8;
    while (bits >= 5) { out += B32_ALPHABET[(value >>> (bits - 5)) & 31]; bits -= 5; }
  }
  if (bits > 0) out += B32_ALPHABET[(value << (5 - bits)) & 31];
  return length ? out.slice(0, length) : out;
}

// ===== ID PERANGKAT (hardware fingerprint) — bukan instalasi & lintas-browser =====
// "Perangkat" = perangkat FISIK, bukan instalasi browser.
// deviceCode diturunkan DETERMINISTIK dari fingerprint PERANGKAT KERAS yang
// stabil di SEMUA engine browser (Chrome/Firefox/Safari/...). Sinyal yang
// dipakai adalah info OS & hardware (screen, CPU, RAM, timezone) yang identik
// walau ganti browser. SENGJA meng-exclude canvas & WebGL karena rendering
// beda antar engine → kalau dipakai, id berubah walau device sama.
// installId tetap disimpan sebagai penanda INSTALASI (tracking jumlah install),
// TAPI tidak pernah menjadi dasar deviceCode.

// Fallback FNV-1a 64-bit kalau crypto.subtle tidak tersedia (non-secure ctx).
function fnv1a(joined) {
  const bytes = new TextEncoder().encode(joined);
  // 2x 32-bit FNV-1a (kovarian hash 64-bit)
  let h1 = 0x811c9dc5, h2 = 0x01000193;
  for (let i = 0; i < bytes.length; i++) {
    h1 = (h1 ^ bytes[i]) >>> 0;
    h2 = (h2 * 0x01000193) >>> 0;
    h1 = (h1 * 0x01000193) >>> 0;
    h2 = (h2 ^ bytes[i]) >>> 0;
  }
  return new Uint8Array([
    (h1 >>> 24) & 0xff, (h1 >>> 16) & 0xff, (h1 >>> 8) & 0xff, h1 & 0xff,
    (h2 >>> 24) & 0xff, (h2 >>> 16) & 0xff, (h2 >>> 8) & 0xff, h2 & 0xff
  ]);
}

// Fingerprint perangkat fisik, stabil lintas browser. Kembalikan 12-char base32.
// Deterministik pada hardware yang sama → id sama walau ganti browser/re-install.
export async function getDeviceFingerprint() {
  const parts = [];
  const nav = (typeof navigator !== 'undefined') ? navigator : {};

  // Sinyal OS & perangkat keras (stabil di semua engine browser)
  parts.push(nav.platform || '');
  parts.push(String(nav.hardwareConcurrency || ''));   // jumlah core CPU
  parts.push(String(nav.deviceMemory || ''));          // RAM (GiB)
  parts.push(String(nav.maxTouchPoints || 0));         // perangkat touchscreen?
  parts.push(String(new Date().getTimezoneOffset()));  // zona waktu (OS)
  try { parts.push(Intl.DateTimeFormat().resolvedOptions().timeZone || ''); } catch (e) { parts.push(''); }

  // Layar (hardware display) — stabil lintas browser
  try {
    parts.push(String(screen.width) + 'x' + String(screen.height));
    if (typeof screen.devicePixelRatio !== 'undefined') parts.push(String(screen.devicePixelRatio));
  } catch (e) { parts.push('sc:na'); }

  const joined = 'KK5-FP-V2|' + parts.join('|');
  let digest;
  if (crypto && crypto.subtle) {
    digest = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(joined)));
  } else {
    digest = fnv1a(joined);
  }
  return b32Encode(digest, 12);
}

function deriveDeviceCode(seed) {
  const h = simpleHash('DEVICE-' + seed);
  const b36 = h.toString(36).toUpperCase().padStart(8, '0').slice(0, 8);
  return b36.slice(0, 4) + '-' + b36.slice(4, 8);
}

// Identitas perangkat. deviceCode SELALU diturunkan dari fingerprint → browser
// apapun di perangkat fisik yang sama menghasilkan id & database (unit_id) yang
// SAMA. installId hanya penanda instalasi untuk tracking.
export async function getDeviceIdentity() {
  const fingerprint = await getDeviceFingerprint();
  const deviceCode = deriveDeviceCode(fingerprint);

  // Ambil installId lama kalau ada, agar tracking instalasi tetap berlanjut.
  const stored = await getSetting('deviceIdentity', null) || {};
  let installId = stored.installId || await getSetting('installId', null);
  if (!installId) {
    installId = Date.now().toString(36) + Math.random().toString(36).slice(2, 8).toUpperCase();
    await setSetting('installId', installId);
  }

  const identity = { installId, deviceCode, fingerprint };
  await setSetting('deviceIdentity', identity);
  return identity;
}

export async function hmacSignature(data) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(PRODUCT_SALT),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(PRODUCT_SALT + data));
  return b32Encode(new Uint8Array(sig), 6);
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

export async function validateSerial(rawSerial, myDeviceCode, activationDate) {
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

const LICENSE_BACKUP_KEY = 'kasirsolo:kaki5:license';
const ONBOARDED_BACKUP_KEY = 'kasirsolo:kaki5:onboarded';

function readLocalBackup(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch (_) {
    return fallback;
  }
}

function writeLocalBackup(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch (_) { /* storage unavailable */ }
}

async function getLicense() {
  const stored = await getSetting('license', null);
  const lic = stored && typeof stored === 'object' ? stored : readLocalBackup(LICENSE_BACKUP_KEY, {});
  return lic || {};
}

async function saveLicense(lic) {
  await setSetting('license', lic);
  writeLocalBackup(LICENSE_BACKUP_KEY, lic);
}

export { getLicense, saveLicense };

// Tandai lisensi sudah dicabut (revoke) oleh admin. State lokal dipertahankan
// supaya app terkunci ("Lisensi Dinonaktifkan") walau offline — bukan jatuh ke
// trial/onboarding lagi.
export async function markLicenseRevoked(reason) {
  const lic = await getLicense();
  await saveLicense({
    status: 'revoked',
    deviceCode: lic.deviceCode || (await getDeviceIdentity()).deviceCode,
    serial: lic.serial || '',
    revokedAt: new Date().toISOString(),
    revokedReason: reason || 'admin'
  });
}

// Cabut lisensi & hapus state lisensi lokal sepenuhnya (fallback ekstrem).
export async function clearLocalLicense() {
  await setSetting('license', {});
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
  if (lic.status === 'revoked') {
      return { status: 'revoked', deviceCode: lic.deviceCode || deviceCode, revokedAt: lic.revokedAt };
    }
    if (lic.status === 'trial') {
      const end = trialEndDate(lic);
    const left = Math.ceil((end.getTime() - Date.now()) / 86400000);
    if (left <= 0) return { status: 'expired', deviceCode: lic.deviceCode, trialExpired: true, daysLeft: left };
    return { status: 'trial', deviceCode: lic.deviceCode, daysLeft: left, extensionsUsed: lic.extensionsUsed || 0, endDate: end.toISOString() };
  }
  return { status: 'none', deviceCode };
}

export function trialEndDate(lic) {
  const start = new Date(lic.startedAt || new Date().toISOString());
  let extUsed = Number(lic.extensionsUsed) || 0;
  if (!Number.isFinite(extUsed) || extUsed < 0) extUsed = 0;
  const totalDays = TRIAL_DAYS + (extUsed * EXTEND_DAYS);
  const end = new Date(start);
  end.setDate(end.getDate() + totalDays);
  return end;
}

export function daysLeft(lic) {
  const end = trialEndDate(lic);
  const diff = end.getTime() - Date.now();
  return Math.ceil(diff / 86400000);
}

export async function isLicensed() {
  const lic = await getLicense();
  if (lic.status !== 'active') return false;
  return !checkExpired(lic.expCode || '99', lic.startedAt);
}

// ----- Onboarding once-per-device -----
// Flag persisten: onboarding hanya ditampilkan sekali per perangkat.
// Begitu user selesai onboarding (mulai trial), kita tandai 'onboarded';
// jika pernah trial/aktif juga sudah dianggap onboarded (backfill).
export async function isOnboarded() {
  const lic = await getLicense();
  if (lic.status) return true; // pernah trial/aktif/expired = sudah lewat onboarding
  const stored = await getSetting('onboarded', null);
  return stored === true || readLocalBackup(ONBOARDED_BACKUP_KEY, false) === true;
}

export async function markOnboarded() {
  await setSetting('onboarded', true);
  writeLocalBackup(ONBOARDED_BACKUP_KEY, true);
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

// ----- grantExtension (pure logic, no DOM) -----
// Defense-in-depth: the cap is enforced HERE in core logic, not just in the UI,
// so calling grantExtensionLogic() directly (console/devtools) cannot exceed
// MAX_EXTENSIONS. Returns { granted, reason, ... }.
export async function grantExtensionLogic() {
  const lic = await getLicense();
  // Sanitize: never trust a tampered/negative stored counter.
  let extUsed = Number(lic.extensionsUsed) || 0;
  if (!Number.isFinite(extUsed) || extUsed < 0) extUsed = 0;
  if (extUsed >= MAX_EXTENSIONS) {
    return { granted: false, reason: 'max', extUsed, left: 0, lic };
  }
  extUsed += 1;
  lic.extensionsUsed = extUsed;
  lic.lastExtensionAt = new Date().toISOString();
  await saveLicense(lic);
  return { granted: true, lic, extUsed, left: Math.max(0, daysLeft(lic)) };
}
