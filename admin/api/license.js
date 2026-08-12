/**
 * Vercel Serverless — admin/api/license.js
 * =============================================================================
 * Generate & verifikasi lisensi SERVER-SIDE.
 *
 * Fix C1 (audit): sebelumnya HMAC salt di-hardcode di client JS dan serial
 * bisa digenerate offline oleh siapa pun. Sekarang:
 *   - Salt produk resmi hanya hidup di SERVER (env LICENSE_SALTS, fallback
 *     konstanta di bawah — TIDAK PERNAH dikirim ke browser).
 *   - Client kirim aksi { generate | verify } + input polos; server yang
 *     memegang crypto & salt lalu memproduksi/ memvalidasi serial.
 *   - Endpoint dilindungi gate ADMIN_API_KEY (sama seperti /api/rest).
 *
 * Produk kustom (dibuat via UI) boleh kirim salt override, TAPI hanya saat
 * request (tidak pernah di-bundle statis), dan tetap melewati gate.
 *
 * Environment (Vercel): SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ADMIN_API_KEY,
 *                      LICENSE_SALTS (opsional, JSON override salt per prefix)
 */

// Salt baku produk resmi — SERVER-SIDE ONLY. Nilai harus SAMA persis dengan
// PRODUCT_SALT di tiap app klien supaya serial yang dibuat di sini diterima app.
const DEFAULT_SALTS = {
  KK5: process.env.LICENSE_SALT_KAKI5 || 'KASIRSOLO-KAKI5-HMAC-V2',
  KSR: process.env.LICENSE_SALT_ROSOK || 'KASIRSOLO-ROSOK-HMAC-V2',
  GBK: process.env.LICENSE_SALT_GEROBAK || 'KASIRSOLO-GEROBAK-HMAC-V2',
  RTL: process.env.LICENSE_SALT_RETAIL || 'KASIRSOLO-RETAIL-HMAC-V2'
};

// Merge optional JSON override dari env (mis. LICENSE_SALTS='{"KSR":"..."}')
function getSaltMap() {
  try {
    const override = JSON.parse(process.env.LICENSE_SALTS || '{}');
    return { ...DEFAULT_SALTS, ...override };
  } catch {
    return { ...DEFAULT_SALTS };
  }
}

import { checkAdminGate } from './_gate.js';

export default async function handler(req, res) {
  // Hanya POST dari front-end sendiri (same-origin).
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  // Gate fail-closed + constant-time (sama kebijakan dengan /api/rest).
  const gate = checkAdminGate(req);
  if (!gate.ok) {
    return res.status(gate.code).json({ error: gate.error });
  }

  let body;
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
  } catch {
    return res.status(400).json({ error: 'bad_json' });
  }

  const { action, prefix, deviceCode, expCode, serial, salt } = body || {};
  if (!action) return res.status(400).json({ error: 'missing_action' });

  const upPrefix = String(prefix || '').toUpperCase();
  const saltMap = getSaltMap();
  // Salt server utk produk resmi; kalau bukan produk resmi, boleh pakai override
  // dari client (produk kustom). Salt resmi TIDAK dipengaruhi input client.
  const serverSalt = saltMap[upPrefix] || '';
  const effectiveSalt = serverSalt || (typeof salt === 'string' ? salt : '');

  if (action === 'generate') {
    if (!upPrefix || !deviceCode) {
      return res.status(400).json({ error: 'missing_input' });
    }
    if (!effectiveSalt) {
      return res.status(400).json({ error: 'no_salt_for_prefix' });
    }
    try {
      const mod = await import('../js/license-core.js');
      const serialOut = await mod.generateSerial(upPrefix, effectiveSalt, deviceCode, expCode ?? '99');
      return res.json({ serial: serialOut });
    } catch (e) {
      return res.status(500).json({ error: 'generate_failed', detail: String((e && e.message) || e) });
    }
  }

  if (action === 'verify') {
    if (!upPrefix || !serial || !deviceCode) {
      return res.status(400).json({ error: 'missing_input' });
    }
    if (!effectiveSalt) {
      return res.status(400).json({ error: 'no_salt_for_prefix' });
    }
    try {
      const mod = await import('../js/license-core.js');
      const result = await mod.verifySerial(upPrefix, effectiveSalt, serial, deviceCode);
      result.expiryText = mod.formatExpiry(result.expCode, result.valid && !result.expired ? new Date() : null);
      return res.json(result);
    } catch (e) {
      return res.status(500).json({ error: 'verify_failed', detail: String((e && e.message) || e) });
    }
  }

  return res.status(400).json({ error: 'invalid_action' });
}
