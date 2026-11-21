/**
 * kasol/js/license.logic.js
 * License logic — HMAC-SHA256 serial validation + transaction quota
 * Pure functions + DB-dependent logic. NO DOM operations.
 *
 * Didasarkan dari kaki5/js/license.logic.js dengan adaptasi:
 *   PRODUCT_PREFIX = 'KSL'
 *   Salt = 'KASIRSOLO-KASOL-HMAC-V1' (dari license-core.js)
 *   APP_TYPE = 'kasol'
 *   Fingerprint prefix = 'KSL-FP-V5'
 */
import { getSetting, setSetting } from './db.js';
import { hmacSignature, normalizeDeviceCode } from './license-core.js';
import { quotaEnsure, quotaTickTx } from './quota.offline.js';

// ── Constants ─────────────────────────────────────────────────────────────────
const PRODUCT_PREFIX = 'KSL';
const B32_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
const DEFAULT_TX_QUOTA = 100;
const LICENSE_BACKUP_KEY = 'kasirsolo:kasol:license';

// ── Month helpers ─────────────────────────────────────────────────────────────
export function currentTxMonth(nowMs = Date.now()) {
  const d = new Date(nowMs);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
}

export async function getTxQuota() {
  try {
    const cfg = await getSetting('trialConfig', null);
    const q = Number(cfg && cfg.txQuota);
    return (Number.isFinite(q) && q > 0) ? Math.floor(q) : DEFAULT_TX_QUOTA;
  } catch (_) {
    return DEFAULT_TX_QUOTA;
  }
}

// ── Base32 ───────────────────────────────────────────────────────────────────
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

// ── Simple hash ──────────────────────────────────────────────────────────────
function simpleHash(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) { h = (h * 31 + str.charCodeAt(i)) >>> 0; }
  return h;
}

// ── SHA-256 pure JS fallback ─────────────────────────────────────────────────
const SHA256_K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
]);

function sha256PureBytes(bytes) {
  const rotr = (x, n) => ((x >>> n) | (x << (32 - n))) >>> 0;
  const len = bytes.length;
  const padded = new Uint8Array(((len + 9 + 63) >> 6) << 6);
  padded.set(bytes);
  padded[len] = 0x80;
  const dv = new DataView(padded.buffer);
  dv.setUint32(padded.length - 8, Math.floor(len / 0x20000000));
  dv.setUint32(padded.length - 4, (len << 3) >>> 0);
  const w = new Uint32Array(64);
  let h0 = 0x6a09e667, h1 = 0xbb67ae85, h2 = 0x3c6ef372, h3 = 0xa54ff53a;
  let h4 = 0x510e527f, h5 = 0x9b05688c, h6 = 0x1f83d9ab, h7 = 0x5be0cd19;
  for (let off = 0; off < padded.length; off += 64) {
    for (let i = 0; i < 16; i++) w[i] = dv.getUint32(off + (i << 2));
    for (let i = 16; i < 64; i++) {
      const x = w[i - 15], y = w[i - 2];
      const s0 = rotr(x, 7) ^ rotr(x, 18) ^ (x >>> 3);
      const s1 = rotr(y, 17) ^ rotr(y, 19) ^ (y >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
    }
    let a = h0, b = h1, c = h2, d = h3, e = h4, f = h5, g = h6, h = h7;
    for (let i = 0; i < 64; i++) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const t1 = (h + S1 + ch + SHA256_K[i] + w[i]) >>> 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const mj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (S0 + mj) >>> 0;
      h = g; g = f; f = e; e = (d + t1) >>> 0;
      d = c; c = b; b = a; a = (t1 + t2) >>> 0;
    }
    h0 = (h0 + a) >>> 0; h1 = (h1 + b) >>> 0; h2 = (h2 + c) >>> 0; h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0; h5 = (h5 + f) >>> 0; h6 = (h6 + g) >>> 0; h7 = (h7 + h) >>> 0;
  }
  const out = new Uint8Array(32);
  const odv = new DataView(out.buffer);
  [h0, h1, h2, h3, h4, h5, h6, h7].forEach((v, i) => odv.setUint32(i << 2, v));
  return out;
}

// ── Persistent storage request ────────────────────────────────────────────────
let _persistAsked = false;
function requestPersistentStorage() {
  if (_persistAsked) return;
  _persistAsked = true;
  try {
    if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.persist) {
      Promise.resolve(navigator.storage.persisted ? navigator.storage.persisted() : false)
        .then((already) => { if (!already) return navigator.storage.persist(); })
        .catch(() => { /* izin ditolak */ });
    }
  } catch (_) { /* noop */ }
}

// ── Device fingerprint V5 ───────────────────────────────────────────────────
export async function getDeviceFingerprint() {
  const parts = [];
  const nav = (typeof navigator !== 'undefined') ? navigator : {};
  parts.push(String(nav.hardwareConcurrency || ''));
  parts.push(String(nav.deviceMemory || ''));
  parts.push(String(nav.maxTouchPoints || 0));
  try {
    const w = Number(screen.width) || 0, h = Number(screen.height) || 0;
    parts.push(Math.max(w, h) + 'x' + Math.min(w, h));
  } catch (e) { parts.push('sc:na'); }
  const joined = 'KSL-FP-V5|' + parts.join('|');
  let digest;
  if (crypto && crypto.subtle) {
    digest = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(joined)));
  } else {
    digest = sha256PureBytes(new TextEncoder().encode(joined));
  }
  return b32Encode(digest, 12);
}

function deriveDeviceCode(seed) {
  const h = simpleHash('DEVICE-' + seed);
  const b36 = h.toString(36).toUpperCase().padStart(8, '0').slice(0, 8);
  return b36.slice(0, 4) + '-' + b36.slice(4, 8);
}

// Legacy device codes (V3/V4) for backward compatibility with old serials
export async function getLegacyV3DeviceCode() {
  try {
    const nav = (typeof navigator !== 'undefined') ? navigator : {};
    const parts = [
      String(nav.platform || ''),
      String(nav.hardwareConcurrency || ''),
      String(nav.deviceMemory || ''),
      String(nav.maxTouchPoints || 0)
    ];
    try { parts.push(String(screen.width) + 'x' + String(screen.height)); } catch (_) { parts.push('sc:na'); }
    const joined = 'KSL-FP-V3|' + parts.join('|');
    let digest;
    if (crypto && crypto.subtle) {
      digest = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(joined)));
    } else {
      digest = sha256PureBytes(new TextEncoder().encode(joined));
    }
    return deriveDeviceCode(b32Encode(digest, 12));
  } catch (_) { return ''; }
}

export async function getLegacyV4DeviceCode() {
  try {
    const nav = (typeof navigator !== 'undefined') ? navigator : {};
    const parts = [
      String(nav.hardwareConcurrency || ''),
      String(nav.deviceMemory || ''),
      String(nav.maxTouchPoints || 0)
    ];
    try { const w = Number(screen.width) || 0, h = Number(screen.height) || 0; parts.push(Math.max(w, h) + 'x' + Math.min(w, h)); } catch (_) { parts.push('sc:na'); }
    const joined = 'KSL-FP-V4|' + parts.join('|');
    let digest;
    if (crypto && crypto.subtle) {
      digest = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(joined)));
    } else {
      digest = sha256PureBytes(new TextEncoder().encode(joined));
    }
    return deriveDeviceCode(b32Encode(digest, 12));
  } catch (_) { return ''; }
}

// ── Device identity (frozen once born) ──────────────────────────────────────
export async function getDeviceIdentity() {
  requestPersistentStorage();
  const fingerprint = await getDeviceFingerprint();
  const stored = await getSetting('deviceIdentity', null) || {};
  const candidateCode = deriveDeviceCode(fingerprint);
  let deviceCode = stored.deviceCode || candidateCode;

  // Allow migration if not yet V5 or if drifted but not yet frozen
  const anchored = !!(stored.deviceCode && stored.fingerprint &&
    deriveDeviceCode(stored.fingerprint) === stored.deviceCode);
  if (stored.deviceCode && stored.deviceCode !== candidateCode &&
      (stored.fpVersion !== 'V5' || !anchored) &&
      !(stored.deviceCode && deriveDeviceCode(stored.fingerprint || '') === stored.deviceCode)) {
    deviceCode = candidateCode;
  }

  let installId = stored.installId || await getSetting('installId', null);
  if (!installId) {
    installId = Date.now().toString(36) + Math.random().toString(36).slice(2, 8).toUpperCase();
    await setSetting('installId', installId);
  }

  const identity = {
    installId,
    deviceCode,
    fingerprint: deviceCode === candidateCode ? fingerprint : (stored.fingerprint || fingerprint),
    candidateCode,
    fpVersion: 'V5'
  };
  await setSetting('deviceIdentity', identity);
  return identity;
}

// ── Expiry helpers ───────────────────────────────────────────────────────────
export function checkExpired(expCode, activationDate, nowMs = Date.now()) {
  if (expCode === '99') return false;
  if (expCode.endsWith('D')) {
    const days = parseInt(expCode);
    const expiry = new Date(activationDate);
    expiry.setDate(expiry.getDate() + days);
    return nowMs > expiry.getTime();
  }
  const months = parseInt(expCode);
  if (!isNaN(months)) {
    const expiry = new Date(activationDate);
    const day = expiry.getDate();
    expiry.setDate(1);
    expiry.setMonth(expiry.getMonth() + months);
    const lastDay = new Date(expiry.getFullYear(), expiry.getMonth() + 1, 0).getDate();
    expiry.setDate(Math.min(day, lastDay));
    return nowMs > expiry.getTime();
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

// ── Anti-clock-rollback ──────────────────────────────────────────────────────
const CLOCK_TOLERANCE_MS = 2 * 24 * 60 * 60 * 1000;

export async function getEffectiveNow() {
  try {
    const anchor = Number(await getSetting('clockAnchor', 0)) || 0;
    const now = Date.now();
    return (anchor && now < anchor - CLOCK_TOLERANCE_MS) ? anchor : now;
  } catch (_) { return Date.now(); }
}

export async function bumpClockAnchor() {
  try {
    const anchor = Number(await getSetting('clockAnchor', 0)) || 0;
    const now = Date.now();
    if (now > anchor) await setSetting('clockAnchor', now);
  } catch (_) { /* noop */ }
}

// ── Serial validation ───────────────────────────────────────────────────────
export async function validateSerial(rawSerial, myDeviceCode, activationDate) {
  const clean = (rawSerial || '').trim().toUpperCase().replace(/\s+/g, '');
  const re = new RegExp('^' + PRODUCT_PREFIX + '-([A-Z0-9]{4})-([A-Z0-9]{4})-([A-Z0-9]{2})-([A-Z0-9]{6})$');
  const m = clean.match(re);
  if (!m) return null;
  const [, d1, d2, exp, sig] = m;
  if ((d1 + '-' + d2) !== myDeviceCode) {
    const legacyV3 = await getLegacyV3DeviceCode();
    const legacyV4 = await getLegacyV4DeviceCode();
    if ((!legacyV3 || (d1 + '-' + d2) !== legacyV3) &&
        (!legacyV4 || (d1 + '-' + d2) !== legacyV4)) return { valid: false, reason: 'device' };
  }
  const expected = await hmacSignature(d1 + d2 + exp);
  if (sig !== expected) return { valid: false, reason: 'signature' };
  if (checkExpired(exp, activationDate || new Date().toISOString())) return { valid: false, reason: 'expired' };
  return { valid: true, expiry: exp, expiryLabel: decodeExpiryLabel(exp) };
}

// ── License state persistence ───────────────────────────────────────────────
function readLocalBackup(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch (_) { return fallback; }
}

function writeLocalBackup(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch (_) { /* noop */ }
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

export async function clearLocalLicense() {
  await setSetting('license', {});
}

// ── Trial management ────────────────────────────────────────────────────────
export async function startTrial() {
  const lic = await getLicense();
  if (lic.status === 'active') return { status: 'active' };
  const month = currentTxMonth();
  if (lic.status === 'trial' && lic.txMonth === month) return lic;
  const carry = (lic.status === 'trial' && lic.txMonth === month) ? (Number(lic.txUsed) || 0) : 0;
  const trial = {
    status: 'trial',
    txMonth: month,
    txUsed: carry,
    txAdjust: Number(lic.txAdjust) || 0,
    deviceCode: (await getDeviceIdentity()).deviceCode
  };
  await saveLicense(trial);
  try {
    await quotaEnsure();
  } catch (_) { /* non-critical */ }
  return trial;
}

export async function incrementTxCount() {
  const lic = await getLicense();
  if (lic.status !== 'trial') return;
  const month = currentTxMonth();
  const used = (lic.txMonth === month ? (Number(lic.txUsed) || 0) : 0) + 1;
  await saveLicense({ ...lic, txMonth: month, txUsed: used });
  try { await quotaTickTx(); } catch (_) { /* non-critical */ }
}

// ── Serial activation ────────────────────────────────────────────────────────
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

// ── Cloud profile matching (collision guard) ─────────────────────────────────
export async function cloudProfileMatchesLocal(cloud) {
  const g = async (k) => { try { return String(await getSetting(k, '') || '').trim().toLowerCase(); } catch (_) { return ''; } };
  const cloudUsaha = String(cloud.nama_usaha || '').trim().toLowerCase();
  const cloudWa = String(cloud.no_whatsapp || '').trim().toLowerCase();
  if (!cloudUsaha && !cloudWa) return true;
  const localUsaha = await g('namaUsaha') || await g('namaWarung');
  const localWa = await g('noWhatsapp');
  if (!localUsaha && !localWa) return true;
  return (!!cloudUsaha && !!localUsaha && cloudUsaha === localUsaha)
      || (!!cloudWa && !!localWa && cloudWa === localWa);
}

// ── Persist cloud license ────────────────────────────────────────────────────
export async function persistCloudLicense(cloud) {
  if (!cloud || cloud.license_status !== 'aktif') return { valid: false, message: 'Status cloud bukan aktif' };
  const local = await getLicense();
  if (local.status === 'active') return { valid: true, already: true };
  if (!(await cloudProfileMatchesLocal(cloud))) {
    return { valid: false, message: 'Baris lisensi ini terikat profil usaha lain — hubungi admin' };
  }
  const serial = (cloud.license_serial || '').trim().toUpperCase();
  const m = serial.match(/-([A-Z0-9]{2})-[A-Z0-9]{6}$/);
  const expCode = m ? m[1] : '99';
  let expiryLabel = decodeExpiryLabel(expCode);
  if (cloud.license_expires_at) {
    const d = new Date(cloud.license_expires_at);
    if (!isNaN(d.getTime())) expiryLabel = d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
  }
  const lic = {
    status: 'active',
    startedAt: local.startedAt || new Date().toISOString(),
    serial: serial || local.serial || '',
    deviceCode: local.deviceCode || (await getDeviceIdentity()).deviceCode,
    expCode,
    expiryLabel,
    source: 'cloud'
  };
  await saveLicense(lic);
  return { valid: true, lic };
}

// ── Get current status ──────────────────────────────────────────────────────
export async function getLicenseStatus() {
  const lic = await getLicense();
  const deviceCode = (await getDeviceIdentity()).deviceCode;
  const nowMs = await getEffectiveNow();
  if (nowMs === Date.now()) bumpClockAnchor();
  return { lic, deviceCode, nowMs };
}
