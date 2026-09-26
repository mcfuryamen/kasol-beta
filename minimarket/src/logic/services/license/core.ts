/**
 * minimarket/src/logic/services/license/core.ts
 *
 * Pondasi modul lisensi — mirror persis kaki5/js/license.logic.js (V5).
 * - Signature serial = b32( HMAC-SHA256(key=salt, msg=salt+data), 6 ) — data = d1+d2+exp.
 *   Salt DINAMIS dari kolom `salt` tabel products (kode_produk='MML', app_type='minimarket').
 *   DEFAULT_LICENSE_SALT hanya fallback darurat saat cloud unreachable.
 * - Fingerprint V5: TANPA Canvas/WebGL/platform (akar gejala drift antar-browser)
 *   — sumber stabil saja: hardwareConcurrency, deviceMemory, maxTouchPoints,
 *   layar TERURUT max×min. Tag prefix 'MML-FP-V5|'.
 * - deviceCode = b36(simpleHash('DEVICE-'+fp)) 8 char 'XXXX-XXXX'.
 * - unitId = 'MML-' + deviceCode (eksklusi: lihat logic.getUnitId).
 *
 * CATATAN: core.ts SENGAJA tidak import lapisan network — salt cloud diakses
 * lewat logic.getHmacSalt() dengan dynamic import ke sync.ts.
 */
import { supabase } from '@/data/supabase';

export const APP_TYPE = 'minimarket';
export const PRODUCT_PREFIX = 'MML';
/** Format: MML-XXXX-XXXX-YY-SIGGGG (SIG = HMAC-salted b32 6 char). */
export const SERIAL_REGEX = /^MML-([A-Z0-9]{4})-([A-Z0-9]{4})-([A-Z0-9]{2})-([A-Z0-9]{6})$/;
/** unitId = 'MML-' + deviceCode. */
export const UNIT_ID_PREFIX = 'MML-';
/** Fallback HANYA saat cloud products unavailable (salt asli = kolom `salt` tabel products). */
export const DEFAULT_LICENSE_SALT = 'KASIRSOLO-MINIMARKET-HMAC-V1';

/** Placeholder anon key => JWT gagal auth => semua query reject RLS. */
export function isPlaceholderKey(k: string | null | undefined): boolean {
  if (!k) return true;
  const s = String(k);
  return s.includes('***') || s.includes('...') || /^PASTE/i.test(s) || /^xxxx/i.test(s) || !s.includes('.');
}

/** Supabase npm client (minimarket) — null saat build tanpa config. */
export function getSupabaseClient() {
  return supabase ?? null;
}

// ─── Hash primitif (identik kaki5) ───────────────────────────────────────────
export function simpleHash(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) { h = (h * 31 + str.charCodeAt(i)) >>> 0; }
  return h;
}

/** Base32 Crockford-like (tanpa 0/1/I/O) — port literal b32Encode kaki5. */
export const B32_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

export function b32Encode(bytes: Uint8Array, length?: number): string {
  let bits = 0, value = 0, out = '';
  for (let i = 0; i < bytes.length; i++) {
    value = (value << 8) | bytes[i];
    bits += 8;
    while (bits >= 5) { out += B32_ALPHABET[(value >>> (bits - 5)) & 31]; bits -= 5; }
  }
  if (bits > 0) out += B32_ALPHABET[(value << (5 - bits)) & 31];
  return length ? out.slice(0, length) : out;
}

// ─── SHA-256 (subtle + pure-JS fallback, digest IDENTIK kedua jalur) ─────────
// Fallback pure-JS menggantikan FNV: dulu dua jalur hash menghasilkan digest
// berbeda → satu perangkat melahirkan dua deviceCode tergantung http/https.
const SHA256_K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

function sha256PureBytes(bytes: Uint8Array): Uint8Array {
  const rotr = (x: number, n: number) => ((x >>> n) | (x << (32 - n))) >>> 0;
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

async function sha256Bytes(str: string): Promise<Uint8Array> {
  const enc = new TextEncoder().encode(str);
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    try {
      return new Uint8Array(await crypto.subtle.digest('SHA-256', enc));
    } catch { /* lanjut pure-JS */ }
  }
  return sha256PureBytes(enc);
}

// ─── Fingerprint perangkat (V5, TANPA Canvas/WebGL/platform) ────────────────
// "Perangkat" = perangkat FISIK, bukan instalasi browser. Canvas/WebGL dibuang
// (render beda antar engine → id berubah walau device sama). platform dibuang
// era V4 (bocor antar engine, entropi nol). V5: layar TERURUT max×min — rotasi
// orientasi Android tidak lagi menggeser fingerprint.

/**
 * Fingerprint era LAMA (V3 dgn platform / V4 tanpa platform) — HANYA untuk
 * re-derive masa tenggang serial terbitan era itu (validateSerial).
 * `screenVal` global window dibaca eksplisit supaya tidak ada shadowing TDZ.
 */
async function fingerprintFromSignals(includePlatform: boolean): Promise<string> {
  const parts: string[] = [];
  const nav = (typeof navigator !== 'undefined') ? navigator : ({} as Navigator);
  if (includePlatform) parts.push(nav.platform || '');
  parts.push(String(nav.hardwareConcurrency || ''));
  parts.push(String((nav as any).deviceMemory || ''));
  parts.push(String(nav.maxTouchPoints || 0));
  try {
    parts.push(String(window.screen.width) + 'x' + String(window.screen.height));
  } catch { parts.push('sc:na'); }
  const joined = (includePlatform ? 'MML-FP-V3|' : 'MML-FP-V4|') + parts.join('|');
  return b32Encode(await sha256Bytes(joined), 12);
}

/** Fingerprint V5 aktif — 12 char base32, deterministik per hardware. */
export async function getDeviceFingerprint(): Promise<string> {
  const parts: string[] = [];
  const nav = (typeof navigator !== 'undefined') ? navigator : ({} as Navigator);
  parts.push(String(nav.hardwareConcurrency || ''));
  parts.push(String((nav as any).deviceMemory || ''));
  parts.push(String(nav.maxTouchPoints || 0));
  try {
    const w = Number(window.screen.width) || 0, h = Number(window.screen.height) || 0;
    parts.push(Math.max(w, h) + 'x' + Math.min(w, h));
  } catch { parts.push('sc:na'); }
  const joined = 'MML-FP-V5|' + parts.join('|');
  return b32Encode(await sha256Bytes(joined), 12);
}

/** deviceCode era V3/V4 (masa tenggang serial lama — deterministik, tak disimpan). */
export async function getLegacyV3DeviceCode(): Promise<string> {
  try { return deriveDeviceCode(await fingerprintFromSignals(true)); } catch { return ''; }
}
export async function getLegacyV4DeviceCode(): Promise<string> {
  try { return deriveDeviceCode(await fingerprintFromSignals(false)); } catch { return ''; }
}

/** deviceCode universal (matches admin algorithm): b36 8 char 'XXXX-XXXX'. */
export function deriveDeviceCode(seed: string): string {
  const h = simpleHash('DEVICE-' + seed);
  const b36 = (h >>> 0).toString(36).toUpperCase().padStart(8, '0').slice(0, 8);
  return b36.slice(0, 4) + '-' + b36.slice(4, 8);
}

// ─── HMAC signature ──────────────────────────────────────────────────────────
// data payload serial = d1 + d2 + exp (dua grup kode perangkat + exp code).

/**
 * Signature serial dengan salt EKSPLISIT: sig = b32(HMAC-SHA256(key=salt,
 * msg=salt+data), 6). Dipakai logic.hmacSignature (salt cloud) & quota offline.
 */
export async function hmacSignatureWithSalt(data: string, salt: string): Promise<string> {
  const enc = new TextEncoder();
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const key = await crypto.subtle.importKey('raw', enc.encode(salt),
      { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const sig = await crypto.subtle.sign('HMAC', key, enc.encode(salt + data));
    return b32Encode(new Uint8Array(sig), 6);
  }
  // crypto.subtle mati (harus jarang — fallback pure): hash deterministik lemah.
  return b32Encode(sha256PureBytes(enc.encode(salt + data)), 6);
}

/**
 * Buat serial MML (utility admin/diagnostik).
 * exp: '99' = seumur hidup | 'ND' = selamanya | 'NN' = N bulan.
 * data = d1+d2+exp — format sama dengan yang diverifikasi validateSerial.
 */
export async function generateSerial(deviceCode: string, expCode: string, salt: string): Promise<string> {
  const [d1, d2] = deviceCode.split('-');
  const data = d1 + d2 + expCode;
  const sig = await hmacSignatureWithSalt(data, salt);
  return `${UNIT_ID_PREFIX}${deviceCode}-${expCode}-${sig}`;
}

/** Parse serial → { deviceCode, expCode, sig } atau null. */
export function parseSerial(raw: string): { deviceCode: string; expCode: string; sig: string } | null {
  const clean = (raw || '').trim().toUpperCase().replace(/\s+/g, '');
  const m = clean.match(SERIAL_REGEX);
  if (!m) return null;
  return { deviceCode: m[1] + '-' + m[2], expCode: m[3], sig: m[4] };
}
