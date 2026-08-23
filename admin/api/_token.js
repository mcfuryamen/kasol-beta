/**
 * Session Token — admin/api/_token.js
 * =============================================================================
 * Membuat dan memvalidasi session token pendek (time-limited) sebagai pengganti
 * ADMIN_API_KEY yang tereksekpos ke browser.
 *
 * Principel:
 *   Token di-derivasi dari ADMIN_API_KEY + expiry timestamp menggunakan HMAC-SHA256.
 *   Server MEMANGKU admin key; browser HANYA.peek token yang otomatis kadaluarsa.
 *   Tidak ada state server (token divalidasi murni via crypto) — cocok Vercel cold-start.
 *
 * Format token (base64url):
 *   { "id": "uuid", "exp": 1234567890, "token": "base64url({ id + iat + exp })" }
 *
 * Validasi: recompute HMAC(adminKey, id + iat + exp) dan cek expiry waktu.
 * =============================================================================
 */

import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';

/** Default TTL: 24 jam (ms) */
export const SESSION_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * Hitung signature HMAC-SHA256 dari payload JSON terurut menggunakan ADMIN_KEY.
 * @param {string} adminKey
 * @param {{ id: string, iat: number, exp: number }} payload
 * @returns {string} base64url (tanpa padding)
 */
export function signPayload(adminKey, payload) {
  return createHmac('sha256', adminKey)
    .update(JSON.stringify(payload))
    .digest('base64url');
}

/**
 * Hitung wrapper token akhir.
 * @param {string} adminKey
 * @param {string} tokenId
 * @param {number} iat - issued-at (epoch ms)
 * @param {number} exp - expired-at (epoch ms)
 * @returns {string} token string siap dikirim ke client
 */
export function buildSessionToken(adminKey, tokenId, iat, exp) {
  const payload = { id: tokenId, iat, exp };
  const signature = signPayload(adminKey, payload);
  return Buffer.from(JSON.stringify({ ...payload, token: signature })).toString('base64url');
}

/**
 * Mint session token baru (atau refresh yang sudah ada).
 * @param {string} adminKey
 * @param {number} [ttlMs] - Durasi token, default SESSION_TTL_MS
 * @returns {{ token: string, expiresAt: number }} token string dan epoch ms kadaluarsa
 */
export function mintSessionToken(adminKey, ttlMs = SESSION_TTL_MS) {
  const now = Date.now();
  const tokenId = randomUUID();
  const token = buildSessionToken(adminKey, tokenId, now, now + ttlMs);
  return { token, expiresAt: now + ttlMs };
}

/**
 * Validasi token yang datang dari client (via header x-session-key).
 * Melakukan: decode base64url → parse JSON → recompute signature (constant-time via
 * timingSafeEqual) → cek expiry.
 *
 * @param {string} adminKey
 * @param {string} tokenB64url - nilai header x-session-key
 * @returns {{ ok: boolean, code?: number, error?: string, expiresAt?: number }}
 */
export function validateSessionToken(adminKey, tokenB64url) {
  if (!adminKey) {
    return { ok: false, code: 503, error: 'server_not_configured' };
  }

  if (!tokenB64url || typeof tokenB64url !== 'string' || tokenB64url.length < 20) {
    return { ok: false, code: 401, error: 'unauthorized' };
  }

  let decoded;
  try {
    // base64url → base64 (ganti -_ ke +/, tambah padding)
    const b64 = tokenB64url.replace(/-/g, '+').replace(/_/g, '/');
    const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
    decoded = JSON.parse(Buffer.from(padded, 'base64').toString('utf8'));
  } catch {
    return { ok: false, code: 401, error: 'unauthorized' };
  }

  const { id, iat, exp, token: suppliedSig } = decoded;

  if (!id || typeof iat !== 'number' || typeof exp !== 'number' || !suppliedSig) {
    return { ok: false, code: 401, error: 'unauthorized' };
  }

  // Cek expiry
  if (Date.now() > exp) {
    return { ok: false, code: 401, error: 'token_expired' };
  }

  // Recompute signature (constant-time compare, tanpa reveal key/token asli)
  const expectedSig = signPayload(adminKey, { id, iat, exp });
  const a = Buffer.from(suppliedSig, 'base64url');
  const b = Buffer.from(expectedSig, 'base64url');
  const equal = a.length === b.length && timingSafeEqual(a, b);

  if (!equal) {
    return { ok: false, code: 401, error: 'unauthorized' };
  }

  return { ok: true, expiresAt: exp };
}