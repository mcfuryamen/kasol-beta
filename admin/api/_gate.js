/**
 * Shared gate helper — admin/api/_gate.js
 * =============================================================================
 * Fail-closed + constant-time check untuk semua endpoint admin.
 *
 * Pola lama (bug H1): `const gate = env || ''; if (gate && header !== gate) 401`
 *   → Kalau ADMIN_API_KEY kosong, `gate` = '' → `if (gate && ...)` false →
 *   SEMUA request dibiarkan lewat (open-gate). Itu critical.
 *
 * Pola baru:
 *   - `checkAdminGate(req)` mengembalikan { ok, code, error }.
 *   - Kalau ADMIN_API_KEY TIDAK diset di env → **fail-closed** → 503 (server
 *     misconfigured), BUKAN biarkan lewat.
 *   - Perbandingan header pakai `timingSafeEqual` (constant-time) biar gak
 *     bocorin panjang/isi key lewat timing.
 *
 * CATATAN (konteks pemilik): login admin resmi masih DITUNDA — ini bukan
 * pengganti auth, cuma pematokan gate eksisting biar gak terbuka. Upgrade
 * ke JWT admin (JWT_SECRET sudah disiapkan di env) = follow-up terpisah.
 */

import { timingSafeEqual, createHmac } from 'node:crypto';
import { validateSessionToken } from './_token.js';

const ADMIN_KEY = process.env.ADMIN_API_KEY || '';

/**
 * Cek apakah kredensial yang masuk valid. Prioritas: x-session-key (time-limited,
 * di-generate server-side) → fallback x-admin-key (legacy, untuk backward compat).
 *
 * Sesuai logika audit: ADMIN_API_KEY seharusnya TIDAK PERNAH dikirim dari browser.
 * Fungsi ini tetap ada untuk cadangan environment yang belum migrasi penuh.
 */
export function checkAdminGate(req) {
  // Fail-closed: kalau admin key belum di-set, jangan pernah biarkan request lewat.
  if (!ADMIN_KEY) {
    return { ok: false, code: 503, error: 'server_not_configured' };
  }

  // ── Prioritas 1: x-session-key (time-limited, derivasi admin key, tidak diekspos) ──
  const sessionKey = req.headers['x-session-key'];
  if (typeof sessionKey === 'string' && sessionKey.length > 0) {
    const v = validateSessionToken(ADMIN_KEY, sessionKey);
    if (v.ok) return { ok: true };
    if (v.error === 'token_expired') return { ok: false, code: 401, error: 'token_expired', refresh: true };
    if (v.error === 'unauthorized') return { ok: false, code: 401, error: 'token_unauthorized', refresh: true };
    return v;
  }

  // ── Prioritas 2: x-admin-key (legacy — fallback, segera dihilangkan) ──
  const supplied = req.headers['x-admin-key'];
  if (typeof supplied === 'string' && supplied.length > 0) {
    const a = Buffer.from(supplied, 'utf8');
    const b = Buffer.from(ADMIN_KEY, 'utf8');
    const equal = a.length === b.length && timingSafeEqual(a, b);
    if (equal) return { ok: true };
  }

  return { ok: false, code: 401, error: 'unauthorized' };
}
