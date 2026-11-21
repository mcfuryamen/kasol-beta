/**
 * Vercel Serverless — api/social-oauth.js
 * =============================================================================
 * Jalur OAuth Meta untuk Control Center:
 *   • Facebook Login for Business → Page + Instagram Business
 *   • Threads API                → akun Threads
 *
 * GET  /api/social-oauth?code=..&state=..   → callback dari Meta (popup)
 * POST /api/social-oauth { action, ... }     → start / status / disconnect
 *
 * Gate:
 *   - POST  → WAJIB lolos checkAdminGate (x-session-key / x-admin-key).
 *   - GET   → TIDAK digate. Callback datang dari redirect Meta, jadi tidak
 *             membawa header kita. Keamanannya datang dari `state`: nilai
 *             acak yang server buat sendiri saat 'start', disimpan di tabel
 *             settings, dan langsung dihapus saat dipakai (sekali pakai).
 *
 * Env (server-side, JANGAN pernah dimasukin ke browser):
 *   FB_APP_ID, FB_APP_SECRET      → Meta App (dipakai OAuth & tukar token)
 *   CONTROL_PUBLIC_URL             → origin Control (untuk redirect_uri)
 *   atau VERCEL_URL                → dipakai otomatis sebagai https://{VERCEL_URL}
 *
 * Inti logika ada di api/_social-oauth-core.js (sumber tunggal dev & produksi).
 * =============================================================================
 */
import { checkAdminGate } from './_gate.js';
import { makeSocialOauthCore, oauthCallbackHtml } from './_social-oauth-core.js';

function resolvePublicUrl(req) {
  const explicit = String(process.env.CONTROL_PUBLIC_URL || '').trim();
  if (explicit) return explicit.replace(/\/$/, '');
  const vercel = String(process.env.VERCEL_URL || '').trim();
  if (vercel) return `https://${vercel.replace(/\/$/, '')}`;
  // Fallback dev lokal: pakai host dari request (proxy/port dev).
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  if (host) {
    const proto = String(req.headers['x-forwarded-proto'] || 'http').split(',')[0];
    return `${proto}://${host}`;
  }
  return '';
}

function makeCore(req) {
  return makeSocialOauthCore({
    supabaseUrl: process.env.SUPABASE_URL,
    serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    appId: process.env.FB_APP_ID,
    appSecret: process.env.FB_APP_SECRET,
    publicUrl: resolvePublicUrl(req),
  });
}

export default async function handler(req, res) {
  const core = makeCore(req);

  // ── GET: callback dari Meta ─────────────────────────────────────────────────
  if (req.method === 'GET') {
    const q = req.query || {};
    const result = await core.handleCallback({
      code: q.code,
      state: q.state,
      error: q.error,
      error_description: q.error_description,
      errorCode: q.error_code,
      errorReason: q.error_reason,
    });
    return res.status(result.ok ? 200 : 400).send(oauthCallbackHtml(result));
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });

  const gate = checkAdminGate(req);
  if (!gate.ok) {
    if (gate.error === 'token_expired' || gate.error === 'token_unauthorized') {
      return res.status(401).json({ error: gate.error, refresh: true });
    }
    return res.status(gate.code).json({ error: gate.error });
  }

  let body;
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
  } catch {
    return res.status(400).json({ error: 'bad_json' });
  }

  try {
    switch (body?.action) {
      case 'status':
        return res.status(200).json(await core.status());
      case 'start': {
        const platform = body.platform === 'threads' ? 'threads' : 'facebook';
        const out = await core.start(platform);
        return res.status(out.ok ? 200 : 400).json(out);
      }
      case 'disconnect': {
        const platform = body.platform === 'threads' ? 'threads' : 'facebook';
        return res.status(200).json(await core.disconnect(platform));
      }
      case 'refresh-threads':
        return res.status(200).json(await core.refreshThreads());
      default:
        return res.status(400).json({ error: 'invalid_action' });
    }
  } catch (e) {
    return res.status(500).json({ error: String(e?.message || e).slice(0, 300) });
  }
}
