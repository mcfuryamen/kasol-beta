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

import { timingSafeEqual } from 'node:crypto';

const KEY = process.env.ADMIN_API_KEY || '';

export function checkAdminGate(req) {
  // Fail-closed: kalau key belum diset, jangan pernah biarkan request lewat.
  if (!KEY) {
    return { ok: false, code: 503, error: 'server_not_configured' };
  }
  const supplied = req.headers['x-admin-key'];
  if (typeof supplied !== 'string' || supplied.length === 0) {
    return { ok: false, code: 401, error: 'unauthorized' };
  }
  const a = Buffer.from(supplied, 'utf8');
  const b = Buffer.from(KEY, 'utf8');
  // Panjang sama divalidasi eksplisit + banding pakai constant-time.
  const equal = a.length === b.length && timingSafeEqual(a, b);
  if (!equal) {
    return { ok: false, code: 401, error: 'unauthorized' };
  }
  return { ok: true };
}
