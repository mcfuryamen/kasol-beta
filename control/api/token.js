/**
 * Vercel Serverless — api/token.js
 * =============================================================================
 * Endpoint publik untuk minta session token (pengganti ADMIN_API_KEY di browser).
 * Tidak perlu autentikasi (login admin masih di-bypass untuk kecepatan akses).
 *
 * Flow browser:
 *   GET /api/token
 *   → { token: "b64url...", expiresIn: 86400, expiresAt: 1234567890 }
 *   → Browser pakai token sebagai header `x-session-key` ke semua endpoint lain.
 *   → Token kadaluarsa otomatis setelah 24 jam; browser refresh ulang via api.js.
 *
 * Token di-sign via HMAC-SHA256 menggunakan ADMIN_API_KEY (server-only, tidak
 * pernah meninggalkan Vercel). Validasi murni kriptografik — tidak ada state
 * server; cocok cold-start Vercel tanpa penalty.
 * =============================================================================
 */

import { mintSessionToken } from './_token.js';

export default async function handler(req, res) {
  // Hanya GET (simple, tanpa body; mudah dipanggil awal dari browser)
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  // ADMIN_API_KEY harus ada di env — fail-closed (sama gate lain)
  const adminKey = process.env.ADMIN_API_KEY || '';
  if (!adminKey) {
    return res.status(503).json({ error: 'server_not_configured' });
  }

  try {
    const { token, expiresAt } = mintSessionToken(adminKey);
    const ttlSeconds = Math.round((expiresAt - Date.now()) / 1000);

    // CORS friendly (SPA biasanya same-origin; header ini tidak mencederai)
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.status(200).json({
      token,
      expiresIn: ttlSeconds,
      expiresAt
    });
  } catch (e) {
    console.error('[api/token] mint failed:', e);
    res.status(502).json({ error: 'token_generation_failed', detail: String(e?.message || e) });
  }
}