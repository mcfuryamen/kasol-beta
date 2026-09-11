/* =========================================================================
   KASIR SOLO - ROSOK
   license.js — Lisensi & pembatasan aplikasi (model kaki5).
   Tier gratis = KUOTA TRANSAKSI selesai per bulan kalender, TANPA batas
   waktu (trial 7 hari & extend-share dihapus). Kuota habis → banner
   closable + transaksi terkunci; sisanya aplikasi tetap bisa dieksplor.
   Lisensi berbayar KSR-... membuka semua fitur (validasi V2/V1 sama).
   ========================================================================= */
import { SETTINGS } from './app-state.js';
import { setSetting, getSetting, toast, openOverlay, closeSheet } from './utils.js';
import { refreshTxQuotaConfig, syncLicenseStatusThrottled, fetchProductSalt, verifyAndAssignSerial } from './license.sync.js';

const PRODUCT_SALT = "KASIRSOLO-ROSOK-HMAC-V2";
const B32_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
const LICENSE_SECRET_V1 = "KasirSoloRosok::PTMesinKasirSolo::v1::JANGAN-SEBARKAN-GENERATOR";

// ===== KUOTA TRANSAKSI (pola kaki5) =====
// Angka global diatur admin lewat kartu produk (tabel products, kolom
// tx_quota) di aplikasi admin dan disinkronkan via Supabase
// (license.sync.js → settings.trialConfig, cached untuk offline).
// Kuota segar tiap awal bulan kalender. Tanpa cache cloud → default.
export const DEFAULT_TX_QUOTA = 100;

export function currentTxMonth(nowMs = Date.now()) {
  const d = new Date(nowMs);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
}

export async function getTxQuota() {
  let cfg = null;
  try { cfg = await getSetting('trialConfig', null); } catch (_) { /* storage gagal */ }
  const q = Number(cfg && cfg.txQuota);
  return (Number.isFinite(q) && q > 0) ? Math.floor(q) : DEFAULT_TX_QUOTA;
}

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

export async function hmacSignature(data, salt = PRODUCT_SALT) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(salt), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(salt + data));
  return b32Encode(new Uint8Array(sig), 6);
}

export function getDeviceCode(installId) {
  const h = simpleHash('DEVICE-' + installId);
  const b36 = h.toString(36).toUpperCase().padStart(8, '0').slice(0, 8);
  return b36.slice(0, 4) + '-' + b36.slice(4, 8);
}

// ── IDENTITAS PERANGKAT LINTAS-BROWSER (port kaki5 V3/T14, disempurnakan V4
//    saat audit multi-browser rosok 2026-09-04) ─────────────────────────────
// "Perangkat" = perangkat FISIK, bukan instalasi browser. deviceCode diturunkan
// DETERMINISTIK dari fingerprint perangkat keras yang identik di SEMUA engine
// (Chrome/Firefox/Samsung Internet/WebView) → semua browser di HP yang sama
// menghasilkan deviceCode & unit_id yang SAMA: lisensi, profil cloud, klaim
// device_known, dan cadangan cloud ikut pindah browser, bukan terfragmentasi
// jadi "perangkat baru" tiap ganti browser (model lama rosok: deviceId acak
// per browser = satu perangkat per browser — isu yang diperbaiki sini).
// Sinyal: OS platform, core CPU, RAM, touch points, resolusi layar.
// SENGJA tanpa canvas/WebGL (rendering beda antar engine) dan tanpa
// timezone/devicePixelRatio (diubah OS saat bepergian/zoom — pelajaran T14
// kaki5: sempat mengusir user valid dengan "Kode ini bukan untuk perangkat ini").
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

export async function getDeviceFingerprint() {
  const parts = [];
  const nav = (typeof navigator !== 'undefined') ? navigator : {};
  // V4 (audit multi-browser 2026-09-04): `platform` DIBUANG — satu-satunya
  // sinyal yang bocor antar engine (Chrome/Samsung/WebView = 'Linux armv8l',
  // Firefox Android = 'Android', hardware sama), sementara sumbangan entropinya
  // nol (model HP sama = platform sama juga). Sisa sinyal tetap membedakan
  // antar model perangkat.
  parts.push(String(nav.hardwareConcurrency || ''));
  parts.push(String(nav.deviceMemory || ''));
  parts.push(String(nav.maxTouchPoints || 0));
  // V5 (2026-09-06, kasus satu perangkat dua deviceCode): sinyal layar jadi
  // pasangan TERURUT max×min — rotasi orientasi (screen.width/height saling
  // bertukar di browser Android) tidak lagi menggeser fingerprint. Pergeseran
  // sinyal lain (setting "Ukuran tampilan" Android, scaling Windows, pindah
  // monitor) tetap mungkin, tapi sejak versi ini deviceCode BEKU sekali lahir
  // (getDeviceIdentity) sehingga pergeseran tak lagi melahirkan kode baru;
  // fingerprint segar hanya diagnostik.
  try {
    const w = Number(screen.width) || 0, h = Number(screen.height) || 0;
    parts.push(Math.max(w, h) + 'x' + Math.min(w, h));
  } catch (e) { parts.push('sc:na'); }
  const joined = 'KSR-FP-V5|' + parts.join('|');
  let digest;
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    digest = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(joined)));
  } else {
    digest = sha256PureBytes(new TextEncoder().encode(joined));
  }
  return b32Encode(digest, 12);
}

// deviceCode BEKU sekali lahir (2026-09-06, kasus satu perangkat dua
// deviceCode): dulu kode dihitung ulang dari fingerprint tiap boot, padahal
// sinyalnya masih bisa geser tanpa ganti perangkat → perangkat yang sama tampil
// sebagai dua kode berbeda & serial menolak. Kode yang sudah dikenal
// cloud/serial dipertahankan; fingerprint segar tetap dihitung & disimpan
// hanya sebagai diagnostik. installId (dulu bernama deviceId) tetap disimpan
// sebagai penanda INSTALASI untuk tracking — TIDAK pernah jadi dasar
// deviceCode. legacyDeviceCode dikunci saat migrasi pertama: kode lama turunan
// deviceId acak, dipakai hanya sebagai masa tenggang validasi serial yang
// terbit sebelum switch (lihat validateLicenseKeyV2).
export async function getDeviceIdentity() {
  requestPersistentStorage();
  const fingerprint = await getDeviceFingerprint();
  const stored = await getSetting('deviceIdentity', null) || {};
  const candidateCode = getDeviceCode(fingerprint);
  let deviceCode = stored.deviceCode || candidateCode;
  // KONVERGENSI LEGACY SEKALI (port kaki5 2026-09-06, keluhan "kode perangkat
  // beda antar browser padahal dulu sama"): freeze V5 ikut membekukan kode
  // lama era berbeda (deviceId acak/V4/FNV via http) yang tersimpan per
  // browser → divergensi lama antar-browser tersimen. Instalasi TANPA penanda
  // fpVersion konvergen SEKALI ke kandidat V5 lalu membeku seperti biasa.
  // Serial-bound ikut migrasi HANYA bila kode tercemat dalam serial = kandidat
  // V5; selain itu kode tersimpan dipertahankan (masa tenggang
  // legacyDeviceCode di validateLicenseKeyV2 yang menang).
  let lic = null;
  try { lic = await getLicense(); } catch (_) { /* storage gagal — anggap non-serial */ }
  const serialBound = !!(lic && lic.status === 'active' && lic.serial);
  let serialMigratable = true;
  if (serialBound) {
    const m = String(lic.serial || '').trim().toUpperCase()
      .match(/-([A-Z0-9]{4})-([A-Z0-9]{4})-[A-Z0-9]{2}-[A-Z0-9]{6}$/);
    serialMigratable = !!m && (m[1] + '-' + m[2]) === candidateCode;
  }
  // "Terjangkar" = kode tersimpan konsisten dengan fingerprint yang
  // merekamnya: derive(stored.fingerprint) === stored.deviceCode. Penanda
  // fpVersion saja TIDAK cukup — boot dengan kode versi lama bisa menulis
  // penanda tanpa benar-benar migrasi → penanda basi memblokir konvergensi
  // selamanya. Migrasi legacy berjalan bila belum berpenanda V5 ATAU tidak
  // terjangkar; freeze hanya untuk yang terjangkar DAN berpenanda.
  const anchored = !!(stored.deviceCode && stored.fingerprint &&
    getDeviceCode(stored.fingerprint) === stored.deviceCode);
  if (stored.deviceCode && stored.deviceCode !== candidateCode &&
      (stored.fpVersion !== 'V5' || !anchored) &&
      (!serialBound || serialMigratable)) {
    deviceCode = candidateCode;
  }
  let installId = stored.installId || await getSetting('deviceId', null);
  if (!installId) {
    installId = 'DEV-' + Array.from(crypto.getRandomValues(new Uint8Array(16)), b => b.toString(16).toUpperCase().padStart(2, '0')).join('');
  }
  const identity = {
    installId,
    deviceCode,
    fingerprint: deviceCode === candidateCode ? fingerprint : (stored.fingerprint || fingerprint),
    candidateCode,
    fpVersion: 'V5',
    legacyDeviceCode: stored.legacyDeviceCode || (await getSetting('deviceCode', '')) || ''
  };
  await setSetting('deviceId', installId);
  await setSetting('deviceIdentity', identity);
  return identity;
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
    // Clamp tanggal supaya 31 Jan + 1 bulan = 28/29 Feb (bukan 3 Mar).
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

// ── Anti-rollback jam (T13 kaki5): anchor = waktu tertinggi yang pernah
// dilihat app. Jam perangkat dimundurkan > 2 hari → pakai anchor.
const CLOCK_TOLERANCE_MS = 2 * 24 * 60 * 60 * 1000;

export async function getEffectiveNow() {
  let anchor = 0;
  try { anchor = Number(await getSetting('clockAnchor', 0)) || 0; } catch (_) { /* storage gagal */ }
  const now = Date.now();
  return (anchor && now < anchor - CLOCK_TOLERANCE_MS) ? anchor : now;
}

async function bumpClockAnchor() {
  try {
    const anchor = Number(await getSetting('clockAnchor', 0)) || 0;
    const now = Date.now();
    if (now > anchor) await setSetting('clockAnchor', now);
  } catch (_) { /* penyimpanan gagal → abaikan */ }
}

// ── State lisensi (satu objek di settings.license) ────────────────────────
// trial:  { status:'trial', txMonth:'YYYY-MM', txUsed, txAdjust, deviceCode }
// active: { status:'active', startedAt, serial, deviceCode, expCode?|expiryDate?, expiryLabel }

export async function getLicense() {
  const stored = await getSetting('license', null);
  if (stored && typeof stored === 'object' && stored.status) return stored;
  // Migrasi satu-kali dari skema lama (pra-kuota): lisensi aktif dibawa masuk,
  // sisa trial lama DIBUANG (model waktu tidak berlaku lagi).
  const oldStatus = await getSetting('licenseStatus', null);
  if (oldStatus === 'active') {
    const startedAt = (await getSetting('licenseActivatedAt', null)) || new Date().toISOString();
    const lic = {
      status: 'active',
      startedAt,
      serial: (await getSetting('licenseKey', '')) || '',
      deviceCode: getDeviceIdForLicense(),
      expiryLabel: (await getSetting('licenseExpiryLabel', '')) || ''
    };
    const oldExp = await getSetting('licenseExpiry', null);
    if (typeof oldExp === 'string' && oldExp.length <= 3) lic.expCode = oldExp;
    else if (oldExp) lic.expiryDate = new Date(oldExp).toISOString();
    await saveLicense(lic);
    return lic;
  }
  return {};
}

export async function saveLicense(lic) {
  await setSetting('license', lic);
}

// Identitas unit stabil (kunci baris clients di cloud): 'KSR-' + deviceCode.
// Lahir sekali lalu dipertahankan — dipakai license.sync.js.
export async function ensureUnitId() {
  let unitId = await getSetting('unitId', null);
  if (unitId) return unitId;
  unitId = 'KSR-' + getDeviceIdForLicense();
  await setSetting('unitId', unitId);
  return unitId;
}

// Mulai/lanjutkan tier gratis berbasis kuota (idempoten). Bulan baru = kuota segar.
export async function startTrial() {
  const lic = await getLicense();
  if (lic.status === 'active') return lic;
  const month = currentTxMonth();
  if (lic.status === 'trial' && lic.txMonth === month) return lic;
  const carry = (lic.status === 'trial' && lic.txMonth === month) ? (Number(lic.txUsed) || 0) : 0;
  const trial = {
    status: 'trial',
    txMonth: month,
    txUsed: carry,
    txAdjust: Number(lic.txAdjust) || 0,
    deviceCode: lic.deviceCode || getDeviceIdForLicense()
  };
  await saveLicense(trial);
  return trial;
}

// Naikkan penghitung bulan berjalan. Dipanggil tepat setelah transaksi
// tersimpan. Lisensi aktif tidak dibatasi kuota — tidak perlu dicatat.
export async function incrementTxCount() {
  const lic = await getLicense();
  if (lic.status !== 'trial') return;
  const month = currentTxMonth();
  const used = (lic.txMonth === month ? (Number(lic.txUsed) || 0) : 0) + 1;
  await saveLicense({ ...lic, txMonth: month, txUsed: used });
}

export async function validateLicenseKeyV2(rawKey, myDeviceCode, activationDate) {
  const clean = (rawKey || '').trim().toUpperCase().replace(/\s+/g, '');
  const re = /^KSR-([A-Z0-9]{4})-([A-Z0-9]{4})-([A-Z0-9]{2})-([A-Z0-9]{6})$/;
  if (!re.test(clean)) return null;
  const [, d1, d2, exp, sig] = clean.match(re);
  if (d1 + '-' + d2 !== myDeviceCode) {
    // Masa tenggang migrasi identitas (switch deviceId-acak → fingerprint):
    // serial yang TERBIT sebelum migrasi terikat legacyDeviceCode browser ini.
    // Diterima diam-diam supaya perangkat lama tidak terkunci; browser baru
    // tidak punya legacy (tidak bisa diturunkan dari hardware) → tetap perlu
    // serial baru berbasis fingerprint dari admin.
    const legacy = ((await getSetting('deviceIdentity', null)) || {}).legacyDeviceCode || '';
    if (!legacy || d1 + '-' + d2 !== legacy) return { valid: false, reason: 'device' };
  }
  // Salt dari cloud (products.salt KSR/rosok — admin bisa rotasi), fallback
  // konstanta build. Port fetchProductSalt kaki5 (2026-08-30).
  const { salt } = await fetchProductSalt();
  const expected = await hmacSignature(d1 + d2 + exp, salt);
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
  const activationDate = new Date().toISOString();
  const resultV2 = await validateLicenseKeyV2(rawKey, myDeviceCode, activationDate);
  if (resultV2 !== null) return resultV2;
  return await validateLicenseKeyV1(rawKey, deviceId);
}

export function getDeviceIdForLicense() {
  // Sumber = deviceCode fingerprint yang sudah dihitung boot (settings.deviceCode
  // + settings.deviceIdentity). Fallback 'UNKNOWN' hanya utk pembacaan pra-boot
  // yang seharusnya tidak terjadi (initApp menghitung identitas di langkah 1).
  const di = SETTINGS.deviceIdentity || {};
  return SETTINGS.deviceCode || getDeviceCode(di.fingerprint || 'UNKNOWN');
}

// API state lisensi utk license.sync.js (dioper sebagai parameter — tanpa
// circular import; sync.js tidak mengimpor license.js).
export const licenseStateApi = {
  getLicense,
  saveLicense,
  currentTxMonth,
  getDeviceCode: getDeviceIdForLicense,
  bumpClockAnchor
};

// ── Status (dipakai gate, chip, banner, dan blok transaksi di pos.js) ─────
function licenseExpired(lic, nowMs) {
  if (lic.expCode) return checkExpired(lic.expCode, lic.startedAt, nowMs);
  if (lic.expiryDate) return nowMs > new Date(lic.expiryDate).getTime();
  return false; // tanpa info kedaluwarsa = seumur hidup
}

export async function getLicenseStatus() {
  let lic = await getLicense();
  const nowMs = await getEffectiveNow();
  if (nowMs === Date.now()) bumpClockAnchor(); // jam sehat → catat jadi anchor
  if (!lic || !lic.status) lic = await startTrial();
  const deviceCode = lic.deviceCode || getDeviceIdForLicense();
  if (lic.status === 'active') {
    if (licenseExpired(lic, nowMs)) return { status: 'expired', deviceCode, protocol: 'licensed-expired' };
    return { status: 'active', deviceCode, serial: lic.serial, expiryLabel: lic.expiryLabel };
  }
  if (lic.status === 'trial') {
    const month = currentTxMonth(nowMs);
    const used = lic.txMonth === month ? (Number(lic.txUsed) || 0) : 0;
    const quota = (await getTxQuota()) + (Number(lic.txAdjust) || 0);
    const remaining = quota - used;
    if (remaining <= 0) return { status: 'expired', deviceCode, trialExpired: true, txRemaining: 0, txQuota: quota, txUsed: used };
    return { status: 'trial', deviceCode, txRemaining: remaining, txQuota: quota, txUsed: used };
  }
  return { status: 'none', deviceCode };
}

export async function isLicensed() {
  const st = await getLicenseStatus();
  return st.status === 'active';
}

// ── Wiring antar modul (diisi app.js, hindari circular import) ────────────
let _updateTrialChip = null;
let _renderLicenseInfoCard = null;
let _checkLicenseGate = null;
let _openLicenseSheet = null;

export function setLicenseRefs(refs){
  _updateTrialChip = refs.updateTrialChip;
  _renderLicenseInfoCard = refs.renderLicenseInfoCard;
  _checkLicenseGate = refs.checkLicenseGate;
  _openLicenseSheet = refs.openLicenseSheet;
}

// ── Banner kuota (non-blocking; bisa ditutup untuk sesi ini) ──────────────
let _quotaBannerDismissed = false;

function showQuotaBanner(st) {
  if (_quotaBannerDismissed) return;
  const b = document.getElementById('quotaBanner');
  if (!b) return;
  const txt = document.getElementById('quotaBannerText');
  if (txt) {
    const paid = st.protocol === 'licensed-expired';
    txt.innerHTML = (paid
      ? '🔑 Lisensi berbayar Anda sudah kedaluwarsa — eksplorasi tetap bebas, transaksi terkunci.'
      : '🚫 Kuota transaksi bulan ini habis — eksplorasi tetap bebas, transaksi terkunci.')
      + ' <b>ID Perangkat: ' + (st.deviceCode || '—') + '</b>';
  }
  b.classList.remove('khide');
}

export function hideQuotaBanner(byUser) {
  if (byUser) _quotaBannerDismissed = true;
  const b = document.getElementById('quotaBanner');
  if (b) b.classList.add('khide');
}

// ── Gate — dipanggil saat boot, tiap 60 detik, & setelah transaksi ────────
export async function checkLicenseGate(){
  // Tarik pengaturan kuota terbaru dari cloud (non-blocking bila offline).
  try { await refreshTxQuotaConfig(); } catch(_) { /* offline → pakai cache */ }
  // Sync penuh ter-throttle (5 menit): adopsi lisensi cloud + reconcile
  // penghitung kuota dua-arah. Gagal jaringan = lanjut pakai data lokal.
  try {
    const unitId = await ensureUnitId();
    await syncLicenseStatusThrottled(unitId, licenseStateApi);
  } catch(_) { /* offline → pakai data lokal */ }
  const st = await getLicenseStatus();
  if(_updateTrialChip) await _updateTrialChip(st);
  if(_renderLicenseInfoCard) await _renderLicenseInfoCard();
  if(st.status === 'expired') showQuotaBanner(st);
  else hideQuotaBanner();
}

// ── UI: chip header, kartu status, sheet lisensi, aktivasi ────────────────
export async function updateTrialChip(st){
  const chip = document.getElementById('trialChip');
  if(!chip) return;
  if(!st) st = await getLicenseStatus();
  if(st.status === 'active'){
    chip.innerHTML = '<div class="trial-label-xs">PRO</div><div class="trial-value-sm">✓ Aktif</div>';
    chip.classList.remove('warn');
    return;
  }
  if(st.status === 'expired'){
    chip.innerHTML = '<div class="trial-label-xs">GRATIS</div><div class="trial-value-sm">Kuota habis</div>';
    chip.classList.add('warn');
    return;
  }
  chip.innerHTML = '<div class="trial-label-xs">GRATIS</div><div class="trial-value-sm">' + st.txRemaining + ' trx</div>';
  chip.classList.toggle('warn', st.txRemaining <= 10);
}

function licenseStatusHtml(st, inputId){
  if(st.status === 'active'){
    const expTxt = st.expiryLabel ? 'Masa berlaku: ' + st.expiryLabel : 'Berlaku seumur hidup';
    return `<div class="card license-card-active">
      <div class="license-icon">✅</div>
      <div class="badge green compact">✓ Lisensi Aktif</div>
      <p class="license-key"><b>${(st.serial || '-')}</b></p>
      <p class="license-expiry">${expTxt}</p>
      <p class="license-desc">Lisensi terikat perangkat ini dan membuka semua fitur tanpa batasan.</p>
    </div>`;
  }
  const habis = st.status === 'expired';
  const quota = Number(st.txQuota) || DEFAULT_TX_QUOTA;
  const remaining = habis ? 0 : Math.max(0, Number(st.txRemaining) || 0);
  const used = Math.max(0, quota - remaining);
  const pct = quota > 0 ? Math.min(100, Math.max(4, Math.round((remaining / quota) * 100))) : 0;
  const menunggu = SETTINGS.purchaseStatus === 'menunggu_verifikasi';
  return `
    <div class="card license-card-trial">
      <div class="license-header">
        <div class="license-icon">🎁</div>
        <div class="license-title">Kuota Transaksi Gratis</div>
        <span class="badge ${habis ? 'red' : (remaining <= 10 ? 'orange' : 'green')}">${habis ? 'Habis bulan ini' : 'Sisa ' + remaining + ' transaksi'}</span>
      </div>
      <div class="license-description">Setiap bulan kamu dapat <b>${quota} transaksi</b> gratis tanpa batas waktu — kuota segar lagi di awal bulan. Terpakai <b>${used}</b> bulan ini.</div>
      <div class="license-progress"><span style="width:${pct}%;animation:none"></span></div>
      ${menunggu ? '<div class="badge orange mt8" style="display:inline-block">⏳ Pembayaran menunggu verifikasi admin</div>' : ''}
    </div>
    <div class="license-actions" style="display:flex; flex-direction:column; gap:8px;">
      <button class="btn btn-primary" onclick="window._ksr_openPurchaseSheet()">💳 Beli Lisensi</button>
    </div>
    ${inputId ? `<div class="field mt12"><label class="field-label">Aktivasi Manual (Kode)</label><input type="text" id="${inputId}" placeholder="KSR-XXXX-XXXX-XX-XXXXXX" class="uppercase"></div>
    <div class="license-actions">
      <button class="btn-buy-wa" onclick="window._ksr_contactViaWA()">💬 Beli via WhatsApp</button>
      <button class="btn btn-primary" onclick="window._ksr_activateLicense('${inputId}')">🔓 Aktifkan Kode</button>
    </div>` : ''}
  `;
}

export async function renderLicenseInfoCard(){
  const card = document.getElementById('licenseInfoCard');
  if(!card) return;
  const st = await getLicenseStatus();
  // inputId kosong → tanpa field Kode Lisensi & tombol aktivasi (hanya di sheet lisensi).
  card.innerHTML = licenseStatusHtml(st, '');
}

export function openLicenseSheet(){
  getLicenseStatus().then(st => {
    const body = document.getElementById('licenseSheetBody');
    if(body) body.innerHTML = licenseStatusHtml(st, 'licenseKeyInputSheet');
    openOverlay('sheetLicense');
  });
}

// Rate limit aktivasi manual (pola kaki5 rateLimiters.activateLicense:
// 5 percobaan/menit) — pembatas brute-force ruang kunci HMAC.
const _activateTimes = [];
function rateLimitActivate(){
  const now = Date.now();
  while(_activateTimes.length && now - _activateTimes[0] > 60000) _activateTimes.shift();
  if(_activateTimes.length >= 5) return false;
  _activateTimes.push(now);
  return true;
}

export async function activateLicense(inputId){
  const el = document.getElementById(inputId);
  const key = ((el && el.value) || '').trim().toUpperCase();
  if(!key){ toast('Masukkan kode lisensi'); return; }
  if(!rateLimitActivate()){ toast('Terlalu banyak percobaan aktivasi. Tunggu sebentar.'); return; }
  toast('Memeriksa lisensi...');
  const deviceId = SETTINGS.deviceId;
  try{
    const result = await validateLicenseKey(key, deviceId);
    if(result.valid){
      // Cloud = kebenaran mutlak lisensi (aturan pemilik + pola kaki5
      // license.ui.activateLicense): saat ONLINE, serial HARUS dikenal cloud
      // (device_assign). 'serial-not-found' & 'profile-mismatch' & penolakan
      // lain MEMBLOKIR — kalau tidak, downgrade (A1) di syncLicenseStatus akan
      // mencabut lisensi ini diam-diam ≤5 menit kemudian. Hanya kegagalan
      // jaringan/offline yang boleh lanjut ke validasi HMAC lokal (fallback
      // utk kode yang diterbitkan admin di luar aplikasi).
      try {
        const assign = await verifyAndAssignSerial(key, await ensureUnitId());
        if(!assign.ok && assign.reason !== 'network'){
          if(assign.reason === 'profile-mismatch'){
            // Kunci penuh ala kaki5 renderProfileMismatchOverlay — TANPA tombol
            // tutup (bukan openOverlay, jadi Escape/backdrop tidak menutup).
            const lock = document.getElementById('mismatchLock');
            if(lock) lock.classList.add('show');
            else toast('Profil perangkat tidak cocok dengan serial ini — hubungi admin');
          }
          else if(assign.reason === 'serial-not-found') toast('Serial tidak terdaftar di admin. Periksa kembali kode.');
          else toast('Lisensi ditolak (' + (assign.reason || 'unknown') + '). Hubungi admin.');
          return;
        }
      } catch(_) {}
      const lic = {
        status: 'active',
        startedAt: new Date().toISOString(),
        serial: key,
        deviceCode: getDeviceIdForLicense(),
        expiryLabel: result.expiryLabel || ''
      };
      if(result.expiry && typeof result.expiry === 'string' && result.expiry.length <= 3) lic.expCode = result.expiry;
      else if(result.expiry) lic.expiryDate = new Date(result.expiry).toISOString();
      await saveLicense(lic);
      if(_updateTrialChip) await _updateTrialChip();
      if(_renderLicenseInfoCard) await _renderLicenseInfoCard();
      closeSheet('sheetLicense');
      hideQuotaBanner();
      toast(result.expiryLabel ? `Lisensi aktif! Masa berlaku: ${result.expiryLabel}` : 'Lisensi berhasil diaktifkan 🎉');
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

// Global exports for onclick
window._ksr_activateLicense = activateLicense;
window._ksr_contactViaWA = contactViaWA;
window.hideQuotaBanner = () => hideQuotaBanner(true);
