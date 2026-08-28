/**
 * Vercel Serverless — kaki5/api/supabase-config.js
 * =============================================================================
 * Menyajikan Supabase config (PUBLIC anon key) untuk klien kaki5.
 *
 * Anon key bersifat PUBLIK by design di Supabase — aman di-serve ke browser.
 * Menyajikannya lewat serverless ini memungkinkan:
 *   - Rotasi key tanpa deploy client
 *   - Rate limiting & monitoring
 *   - Tidak ada key hardcoded di source (bisa kirim lewat env Vercel)
 *
 * Fallback (SUPABASE_URL / SUPABASE_ANON_KEY tidak di-set di env) memakai
 * nilai yang sama dengan fallback client supabase-config.js supaya perilaku
 * konsisten. Endpoint ini menghilangkan 404 `/api/supabase-config`.
 */

const FALLBACK_URL = 'https://hhywrvedlwljawgxzpkq.supabase.co';
const FALLBACK_ANON_KEY = '******';

export default function handler(req, res) {
  const baseUrl = (process.env.SUPABASE_URL || FALLBACK_URL).replace(/\/$/, '');
  const anonKey = process.env.SUPABASE_ANON_KEY || FALLBACK_ANON_KEY;

  res.setHeader('Cache-Control', 'public, max-age=300, stale-while-revalidate=86400');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.status(200).json({ url: baseUrl, anonKey });
}