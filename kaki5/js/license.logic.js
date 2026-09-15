// ==================== LICENSE LOGIC (ESM) ====================
// Pure functions + DB-dependent logic. NO DOM operations.
// Salt is now fetched dynamically from Supabase (license.sync.js)
// with local fallback for offline support.
import { setSetting, getSetting } from './db.js';
import { escapeHtml } from './helpers.js';
// fetchProductSalt dipakai lewat dynamic import di getHmacSalt() (lihat ~line 131)
// agar license.logic.js tidak hard-depend ke lapisan network saat modul di-load.
import { clearProductSaltCache } from './license.sync.js';

const PRODUCT_PREFIX = 'KK5';

const B32_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

// ===== KUOTA TRANSAKSI (ganti trial waktu — keputusan pemilik 2026-08-29) =====
// Tier gratis = kuota transaksi selesai per bulan kalender, TANPA batas waktu.
// Angka global diatur admin (products.tx_quota utk app ini; di-cache lokal ke
// settings.trialConfig agar tetap jalan offline). Kuota efektif per perangkat =
// kuota global + lic.txAdjust (adjust +/− dari admin; cloud = sumber kebenaran).
export const DEFAULT_TX_QUOTA = 100;

// Bulan kalender berjalan, format 'YYYY-MM' (kunci siklus kuota).
export function currentTxMonth(nowMs = Date.now()) {
  const d = new Date(nowMs);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
}

// Kuota global bulan ini: config cloud (di-cache oleh license.sync ke
// settings.trialConfig); fallback DEFAULT_TX_QUOTA bila belum pernah online.
export async function getTxQuota() {
  let cfg = null;
  try { cfg = await getSetting('trialConfig', null); } catch (_) { /* storage gagal */ }
  const q = Number(cfg && cfg.txQuota);
  return (Number.isFinite(q) && q > 0) ? Math.floor(q) : DEFAULT_TX_QUOTA;
}

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
// dipakai adalah info OS & hardware (screen, CPU, RAM, touch points, screen resolution) yang identik
// walau ganti browser. SENGJA meng-exclude canvas & WebGL karena rendering
// beda antar engine → kalau dipakai, id berubah walau device sama.
// installId tetap disimpan sebagai penanda INSTALASI (tracking jumlah install),
// TAPI tidak pernah menjadi dasar deviceCode.

// Fallback SHA-256 murni JS kalau crypto.subtle tidak tersedia (non-secure
// ctx, mis. akses via http://IP-LAN). Menggantikan FNV-1a 64-bit: dulu dua
// jalur hash menghasilkan digest BERBEDA untuk input sama (8 vs 32 byte) →
// satu perangkat bisa melahirkan dua deviceCode tergantung lewat http/https.
// Kini semua jalur menghasilkan digest identik dengan crypto.subtle.
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
  dv.setUint32(padded.length - 8, Math.floor(len / 0x20000000)); // bit length hi (input kecil: 0)
  dv.setUint32(padded.length - 4, (len << 3) >>> 0);             // bit length lo
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

// Minta penyimpanan persistent (sekali per sesi, fire-and-forget): tanpa ini
// Android Chrome boleh meng-evict IndexedDB saat tekanan penyimpanan →
// unitId/deviceCode lahir ulang dan perangkat tampil sebagai unit baru di cloud.
let _persistAsked = false;
function requestPersistentStorage() {
  if (_persistAsked) return;
  _persistAsked = true;
  try {
    if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.persist) {
      Promise.resolve(navigator.storage.persisted ? navigator.storage.persisted() : false)
        .then((already) => { if (!already) return navigator.storage.persist(); })
        .catch(() => { /* izin ditolak browser — biarkan */ });
    }
  } catch (_) { /* noop */ }
}

// Fingerprint perangkat fisik, stabil lintas browser. Kembalikan 12-char base32.
// Deterministik pada hardware yang sama → id sama walau ganti browser/re-install.
// V3 (T14, audit 2026-08-17/M4): timezone & devicePixelRatio DIKELUARKAN — dua
// sinyal itu berubah karena ulah OS (bepergian lintas zona waktu, setting zoom
// display), bukan karena ganti perangkat, dan sempat mengusir user valid dengan
// "Kode ini bukan untuk perangkat ini". Diperbolehkan karena belum ada serial
// berbayar yang terbit (semua clients.license_status masih 'belum').
// V4 (port rosok 2026-09-04, audit multi-browser): sinyal `platform` DIBUANG —
// satu-satunya yang bocor antar engine (Chrome/Samsung/WebView = 'Linux
// armv8l', Firefox Android = 'Android' pada hardware identik) sementara
// sumbangan entropinya nol (model HP sama = platform sama juga). deviceCode
// lama V3 TETAK diterima sebagai masa tenggang (getLegacyV3DeviceCode) —
// serial terbitan era V3 tidak mengunci perangkat; lihat validateSerial.
// Fingerprint era LAMA (V3 dgn platform / V4 tanpa platform) — hanya dipakai
// untuk re-derive masa tenggang serial (getLegacyV3/V4DeviceCode). Fingerprint
// aktif kini V5 (getDeviceFingerprint di bawah).
async function fingerprintFromSignals(includePlatform) {
  const parts = [];
  const nav = (typeof navigator !== 'undefined') ? navigator : {};
  if (includePlatform) parts.push(nav.platform || '');
  parts.push(String(nav.hardwareConcurrency || ''));   // jumlah core CPU
  parts.push(String(nav.deviceMemory || ''));          // RAM (GiB)
  parts.push(String(nav.maxTouchPoints || 0));         // perangkat touchscreen?
  try {
    parts.push(String(screen.width) + 'x' + String(screen.height));
  } catch (e) { parts.push('sc:na'); }
  const joined = (includePlatform ? 'KK5-FP-V3|' : 'KK5-FP-V4|') + parts.join('|');
  let digest;
  if (crypto && crypto.subtle) {
    digest = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(joined)));
  } else {
    digest = sha256PureBytes(new TextEncoder().encode(joined));
  }
  return b32Encode(digest, 12);
}

// Fingerprint V5 (2026-09-06, kasus satu perangkat dua deviceCode): sinyal
// layar jadi pasangan TERURUT max×min — rotasi orientasi (screen.width/height
// saling bertukar di browser Android) tidak lagi menggeser fingerprint.
// Pergeseran sinyal lain (setting "Ukuran tampilan" Android, scaling Windows,
// pindah monitor) tetap mungkin, tapi sejak versi ini deviceCode BEKU sekali
// lahir (getDeviceIdentity) sehingga pergeseran tak lagi melahirkan kode baru;
// fingerprint segar hanya diagnostik. Kode era V3 & V4 tetap diterima sebagai
// masa tenggang di validateSerial.
export async function getDeviceFingerprint() {
  const parts = [];
  const nav = (typeof navigator !== 'undefined') ? navigator : {};
  parts.push(String(nav.hardwareConcurrency || ''));   // jumlah core CPU
  parts.push(String(nav.deviceMemory || ''));          // RAM (GiB)
  parts.push(String(nav.maxTouchPoints || 0));         // perangkat touchscreen?
  try {
    const w = Number(screen.width) || 0, h = Number(screen.height) || 0;
    parts.push(Math.max(w, h) + 'x' + Math.min(w, h));
  } catch (e) { parts.push('sc:na'); }
  const joined = 'KK5-FP-V5|' + parts.join('|');
  let digest;
  if (crypto && crypto.subtle) {
    digest = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(joined)));
  } else {
    digest = sha256PureBytes(new TextEncoder().encode(joined));
  }
  return b32Encode(digest, 12);
}

// deviceCode era V3 (masih terikat di serial lama & baris cloud lama).
// Deterministik → bisa dihitung ulang kapan pun, tidak perlu disimpan.
export async function getLegacyV3DeviceCode() {
  try {
    return deriveDeviceCode(await fingerprintFromSignals(true));
  } catch (_) {
    return '';
  }
}

// deviceCode era V4 (2026-09-04, resolusi layar masih mentah) — masa tenggang
// utk serial yang terbit sebelum V5; dipakai validateSerial.
export async function getLegacyV4DeviceCode() {
  try {
    return deriveDeviceCode(await fingerprintFromSignals(false));
  } catch (_) {
    return '';
  }
}

function deriveDeviceCode(seed) {
  const h = simpleHash('DEVICE-' + seed);
  const b36 = h.toString(36).toUpperCase().padStart(8, '0').slice(0, 8);
  return b36.slice(0, 4) + '-' + b36.slice(4, 8);
}

// Identitas perangkat. deviceCode BEKU sekali lahir (2026-09-06, kasus satu
// perangkat dua deviceCode): dulu kode dihitung ulang dari fingerprint tiap
// boot, padahal sinyalnya masih bisa geser tanpa ganti perangkat (rotasi
// layar, setting "Ukuran tampilan" Android, scaling Windows, pindah monitor)
// → perangkat yang sama tampil sebagai dua kode berbeda & serial menolak.
// Kode yang sudah dikenal cloud/serial dipertahankan; fingerprint segar tetap
// dihitung & disimpan hanya sebagai diagnostik. Browser manapun di perangkat
// fisik yang sama yang lahir dari fingerprint yang sama tetap menghasilkan id
// & database (unit_id) yang SAMA. installId hanya penanda instalasi untuk
// tracking.
export async function getDeviceIdentity() {
  requestPersistentStorage();
  const fingerprint = await getDeviceFingerprint();
  const stored = await getSetting('deviceIdentity', null) || {};
  const candidateCode = deriveDeviceCode(fingerprint);
  let deviceCode = stored.deviceCode || candidateCode;
  // KONVERGENSI LEGACY SEKALI (2026-09-06, keluhan "kode perangkat beda antar
  // browser padahal dulu sama"): freeze V5 ikut membekukan kode lama era
  // berbeda (V3/V4/FNV via http) yang tersimpan per browser → divergensi lama
  // antar-browser tersimen dan tidak pernah konvergen lagi. Instalasi TANPA
  // penanda fpVersion (pra-penanda) konvergen SEKALI ke kandidat V5 —
  // deterministik & hash seragam (http/https sama) — lalu membeku seperti
  // biasa. Serial-bound ikut migrasi HANYA bila kode tercemat dalam serial =
  // kandidat V5; selain itu kode tersimpan dipertahankan (masa tenggang
  // V3/V4 di validateSerial yang menang).
  let lic = null;
  try { lic = await getLicense(); } catch (_) { /* storage gagal — anggap non-serial */ }
  const serialBound = !!(lic && lic.status === 'active' && lic.serial);
  // Serial mencematikan kode perangkatnya (KK5-XXXX-XXXX-…). Instalasi
  // serial-bound tetap BOLEH migrasi legacy bila kode tercemat = kandidat V5
  // (validasi serial tetap lolos langsung setelah migrasi — kasus nyata:
  // Chrome terlanjur mengadopsi lisensi sebelum kodenya konvergen); bila
  // tidak, kode tersimpan dipertahankan (masa tenggang V3/V4 yang menang).
  let serialMigratable = true;
  if (serialBound) {
    const m = String(lic.serial || '').trim().toUpperCase()
      .match(/-([A-Z0-9]{4})-([A-Z0-9]{4})-[A-Z0-9]{2}-[A-Z0-9]{6}$/);
    serialMigratable = !!m && (m[1] + '-' + m[2]) === candidateCode;
  }
  // "Terjangkar" = kode tersimpan konsisten dengan fingerprint yang
  // merekamnya: derive(stored.fingerprint) === stored.deviceCode. Penanda
  // fpVersion saja TIDAK cukup — boot dengan kode versi lama bisa menulis
  // penanda tanpa benar-benar migrasi (kasus Chrome: terlanjur serial-bound
  // saat penanda ditulis) → penanda basi memblokir konvergensi selamanya.
  // Migrasi legacy berjalan bila belum berpenanda V5 ATAU tidak terjangkar;
  // freeze hanya untuk yang terjangkar DAN berpenanda (sinyal geser sesudah
  // lahir).
  const anchored = !!(stored.deviceCode && stored.fingerprint &&
    deriveDeviceCode(stored.fingerprint) === stored.deviceCode);
  if (stored.deviceCode && stored.deviceCode !== candidateCode &&
      (stored.fpVersion !== 'V5' || !anchored) &&
      (!serialBound || serialMigratable)) {
    deviceCode = candidateCode;
  }

  // Ambil installId lama kalau ada, agar tracking instalasi tetap berlanjut.
  let installId = stored.installId || await getSetting('installId', null);
  if (!installId) {
    installId = Date.now().toString(36) + Math.random().toString(36).slice(2, 8).toUpperCase();
    await setSetting('installId', installId);
  }

  // candidateCode = kode turunan fingerprint SAAT INI (diagnostik drift);
  // fpVersion 'V5' menandai instalasi sudah era beku yang sah. fingerprint
  // yang direkam harus selalu pasangan sah dari deviceCode: bila kode TIDAK
  // migrasi (freeze), fingerprint lama dipertahankan supaya cek terjangkar
  // tetap konsisten boot berikutnya — jangan ditimpa fingerprint segar.
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

/**
 * Get HMAC salt - fetches from Supabase (cached) with local fallback.
 * This replaces the old hardcoded buildProductSalt().
 */
let _hmacSaltCache = null;

async function getHmacSalt() {
  if (_hmacSaltCache) return _hmacSaltCache;
  
  try {
    const { fetchProductSalt } = await import('./license.sync.js');
    const result = await fetchProductSalt();
    _hmacSaltCache = result.salt;
    return result.salt;
  } catch (e) {
    console.warn('[LICENSE] Failed to get HMAC salt, using fallback:', e?.message || e);
    // Local fallback matches old buildProductSalt(): KASIRSOLO-KAKI5-HMAC-V2
    _hmacSaltCache = 'KASIRSOLO-KAKI5-HMAC-V2';
    return _hmacSaltCache;
  }
}

/**
 * Clear HMAC salt cache (e.g., after salt rotation)
 */
export function clearHmacSaltCache() {
  _hmacSaltCache = null;
  clearProductSaltCache(); // Also clear sync module cache
}

export async function hmacSignature(data) {
  const salt = await getHmacSalt();
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(salt),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(salt + data));
  return b32Encode(new Uint8Array(sig), 6);
}

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
    // L2 (audit 2026-08-17): clamp tanggal supaya 31 Jan + 1 bulan = 28/29 Feb
    // (bukan rollover ke 3 Mar yang memperpanjang lisensi beberapa hari).
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

// ── Anti-rollback jam (T13, audit 2026-08-17/M3) ──────────────────────────
// clockAnchor = waktu tertinggi yang pernah app lihat dalam keadaan jalan
// (diperbarui tiap cek lisensi & tiap sync cloud sukses). Kalau jam perangkat
// tiba-tiba lebih kecil dari anchor - toleransi 2 hari → jam jelas dimundurkan
// → pakai anchor sebagai "sekarang" supaya trial/lisensi yang sudah habis
// tidak hidup lagi. (Wipe storage menghapus anchor — vektor itu ditutup T12
// berjangkar first_seen cloud.)
const CLOCK_TOLERANCE_MS = 2 * 24 * 60 * 60 * 1000;

export async function getEffectiveNow() {
  let anchor = 0;
  try { anchor = Number(await getSetting('clockAnchor', 0)) || 0; } catch (_) { /* storage gagal */ }
  const now = Date.now();
  return (anchor && now < anchor - CLOCK_TOLERANCE_MS) ? anchor : now;
}

export async function bumpClockAnchor() {
  try {
    const anchor = Number(await getSetting('clockAnchor', 0)) || 0;
    const now = Date.now();
    if (now > anchor) await setSetting('clockAnchor', now);
  } catch (_) { /* penyimpanan gagal → abaikan */ }
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
  if ((d1 + '-' + d2) !== myDeviceCode) {
    // Masa tenggang V3/V4 → V5: serial terbitan era fingerprint lama tetap
    // sah — V3 & V4 deterministik, bisa dihitung ulang di browser mana pun.
    const legacyV3 = await getLegacyV3DeviceCode();
    const legacyV4 = await getLegacyV4DeviceCode();
    if ((!legacyV3 || (d1 + '-' + d2) !== legacyV3) &&
        (!legacyV4 || (d1 + '-' + d2) !== legacyV4)) return { valid: false, reason: 'device' };
  }
  const expected = await hmacSignature(d1 + d2 + exp);
  if (sig !== expected) return { valid: false, reason: 'Signature HMAC tidak cocok' };
  if (checkExpired(exp, activationDate || new Date().toISOString())) return { valid: false, reason: 'expired' };
  return { valid: true, expiry: exp, expiryLabel: decodeExpiryLabel(exp) };
}

// ----- License state (persisted in settings table) -----
// trial:   { status:'trial', txMonth:'YYYY-MM', txUsed, txAdjust, deviceCode }
// active:  { status:'active', startedAt, serial, deviceCode, expCode, expiryLabel }
// revoked: { status:'revoked', deviceCode, serial?, revokedAt, revokedReason }

const LICENSE_BACKUP_KEY = 'kasirsolo:kaki5:license';

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

// Mulai/lanjutkan tier gratis berbasis kuota transaksi (idempoten). Bulan
// kalender baru = kuota segar. Tidak ada lagi jangkar waktu — penghitung
// dijaga monotonic oleh reconcile cloud (license.sync): max(lokal, cloud)
// per bulan, jadi hapus data / ganti browser tidak menurunkan penghitung.
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
  return trial;
}

// Naikkan penghitung transaksi bulan berjalan. Dipanggil tepat setelah
// penjualan selesai tersimpan (pos.sync.simpanPenjualanSync). Lisensi aktif
// tidak dibatasi kuota — penghitung tidak perlu dicatat.
export async function incrementTxCount() {
  const lic = await getLicense();
  if (lic.status !== 'trial') return;
  const month = currentTxMonth();
  const used = (lic.txMonth === month ? (Number(lic.txUsed) || 0) : 0) + 1;
  await saveLicense({ ...lic, txMonth: month, txUsed: used });
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

// Guard tabrakan identitas (port rosok 2026-09-04): fingerprint hardware TIDAK
// unik antar perangkat — dua pengguna tipe HP sama menghasilkan deviceCode &
// unit_id sama, dan RLS hybrid (claim unit_id di JWT) membuat mereka saling
// bisa membaca baris. Adopsi lisensi cloud hanya boleh bila baris belum
// diprofilkan ATAU profilnya cocok dengan lokal (nama usaha / no. WA).
// Diekspor — dipakai juga license.sync.js (blok A) & sync.js (pull profil).
export async function cloudProfileMatchesLocal(cloud) {
  const g = async (k) => { try { return String(await getSetting(k, '') || '').trim().toLowerCase(); } catch (_) { return ''; } };
  const cloudUsaha = String(cloud.nama_usaha || '').trim().toLowerCase();
  const cloudWa = String(cloud.no_whatsapp || '').trim().toLowerCase();
  if (!cloudUsaha && !cloudWa) return true; // baris belum diprofilkan → aman
  const localUsaha = await g('namaUsaha') || await g('namaWarung');
  const localWa = await g('noWhatsapp');
  // Lokal kosong (browser baru / install ulang) BUKAN tabrakan — adopsi sah.
  if (!localUsaha && !localWa) return true;
  return (!!cloudUsaha && !!localUsaha && cloudUsaha === localUsaha)
      || (!!cloudWa && !!localWa && cloudWa === localWa);
}

// Persist status aktif dari cloud (tabel `clients`). Sumber kebenaran = server
// (pembayaran sudah diverifikasi admin), jadi TIDAK memvalidasi ulang HMAC /
// binding deviceCode seperti activateSerial() — serial di cloud bisa dibuat
// dengan binding/salt yang berbeda sehingga activateSerial() gagal diam-diam
// dan chip/gate selamanya membaca status 'trial' sementara kartu status
// (yang membaca cloud) menampilkan aktif (bug sinkron chip 2026-08-25).
export async function persistCloudLicense(cloud) {
  if (!cloud || cloud.license_status !== 'aktif') return { valid: false, message: 'Status cloud bukan aktif' };
  const local = await getLicense();
  if (local.status === 'active') return { valid: true, already: true };
  if (!(await cloudProfileMatchesLocal(cloud))) {
    console.warn('[LICENSE] adopsi cloud DITOLAK — profil tidak cocok (indikasi tabrakan identitas sesama model perangkat)');
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

// Check current status (used by the license gate + banner)
export async function getLicenseStatus() {
  const lic = await getLicense();
  const deviceCode = (await getDeviceIdentity()).deviceCode;
  const nowMs = await getEffectiveNow();
  if (nowMs === Date.now()) bumpClockAnchor(); // jam sehat → catat jadi anchor
  // ID Perangkat yang ditampilkan = kode perangkat AKTIF (dari identitas),
  // BUKAN lic.deviceCode — nilai itu tercemat saat aktivasi dan bisa basi
  // setelah konvergensi identitas legacy (kasus Chrome: lisensi terlanjur
  // aktif sebelum kodenya konvergen → kartu Pengaturan menampilkan kode lama
  // padahal identitas sudah konvergen).
  if (!lic || !lic.status) return { status: 'none', deviceCode };
  if (lic.status === 'active') {
    const expired = lic.expCode === '99' ? false : checkExpired(lic.expCode || '99', lic.startedAt, nowMs);
    if (expired) return { status: 'expired', deviceCode, protocol: 'licensed-expired' };
    return { status: 'active', deviceCode, serial: lic.serial, expCode: lic.expCode, expiryLabel: lic.expiryLabel };
  }
  if (lic.status === 'revoked') {
      return { status: 'revoked', deviceCode, revokedAt: lic.revokedAt };
    }
    if (lic.status === 'trial') {
      // Kuota transaksi per bulan kalender (2026-08-29): bulan lain = kuota
      // segar, jadi penghitung dari bulan sebelumnya tidak dibawa.
      const month = currentTxMonth(nowMs);
      const used = lic.txMonth === month ? (Number(lic.txUsed) || 0) : 0;
      const quota = (await getTxQuota()) + (Number(lic.txAdjust) || 0);
      const remaining = quota - used;
      if (remaining <= 0) return { status: 'expired', deviceCode, trialExpired: true, txRemaining: 0, txQuota: quota, txUsed: used };
      return { status: 'trial', deviceCode, txRemaining: remaining, txQuota: quota, txUsed: used };
  }
  return { status: 'none', deviceCode };
}

// (trialEndDate/daysLeft dihapus 2026-08-29 — tier gratis kini berbasis kuota
// transaksi per bulan, lihat getLicenseStatus. Jam efektif anti-rollback tetap
// dipakai untuk kedaluwarsa lisensi BERBAYAR.)

export async function isLicensed() {
  const lic = await getLicense();
  if (lic.status !== 'active') return false;
  return !checkExpired(lic.expCode || '99', lic.startedAt, await getEffectiveNow());
}

// ----- unitId (global DNA) -----
// IMMUTABLE (Opsi 3): unitId hanya boleh lahir SATU KALI dan kemudian diikat
// permanen ke serial/profil. Begitu terikat serial (licenseBind = { serial,... }),
// unitId TIDAK boleh berubah walau fingerprint berubah / data lokal sebagian
// hilang — reassign unit_id hanya lewat RPC `device_assign` di server.
export async function getUnitId() {
  let unitId = await getSetting('unitId', null);
  if (unitId) return unitId;
  // unitId tersimpan hilang tapi lisensi masih mengikat serial → PULIHKAN
  // (defense-in-depth, jangan re-derive jadi perangkat baru).
  const lic = await getLicense();
  if (lic && lic.serial) {
    const { deviceCode } = await getDeviceIdentity();
    const candidate = 'K5-' + deviceCode;
    // Hanya pakai candidate bila itu satu-satunya asal yang masuk akal
    // (tidak ada bukti unit_id pernah beda). Pendekatan aman: re-derive &
    // simpan ulang pada perangkat fisik yang sama.
    await setSetting('unitId', candidate);
    return candidate;
  }
  const { deviceCode } = await getDeviceIdentity();
  const fresh = 'K5-' + deviceCode;
  await setSetting('unitId', fresh);
  return fresh;
}

export async function ensureUnitId() {
  return await getUnitId();
}

// ----- device identity (dipakai modul sync / profil klien) -----
export async function getDeviceCode() {
  return (await getDeviceIdentity()).deviceCode;
}

export async function getInstallId() {
  return (await getDeviceIdentity()).installId;
}

export { clearProductSaltCache };