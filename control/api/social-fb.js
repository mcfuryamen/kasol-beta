/**
 * Vercel Serverless — api/social-fb.js
 * =============================================================================
 * Executor posting Facebook Page (Fase 1 fitur Sosmed) + cek koneksi.
 * Jalur RESMI: Meta Graph API — bukan scraping.
 *
 * Inti logika hidup di api/_social-fb-core.js — SATU SUMBER bersama mirror dev
 * di server.js (jangan tulis ulang logikanya di sini).
 * Kredensial Page (page_id + page access token long-lived) disimpan di tabel
 * `settings` key 'social_fb' — server-side only, tak pernah ke browser.
 *
 * Body: { action, ... }
 *   - 'test'     : { page_id, page_token } → verifikasi kredensial
 *   - 'post'     : { id }                  → posting satu row social_posts
 *   - 'post-due' : {}                      → posting approved yang jatuh tempo
 *
 * Gate: sama dengan endpoint admin lain (x-session-key / x-admin-key).
 * =============================================================================
 */

import { checkAdminGate } from './_gate.js';
import { makeSocialFbCore } from './_social-fb-core.js';

export default async function handler(req, res) {
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

  const core = makeSocialFbCore({
    supabaseUrl: process.env.SUPABASE_URL,
    serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  });
  const { status, json } = await core.handle(body);
  return res.status(status).json(json);
}
