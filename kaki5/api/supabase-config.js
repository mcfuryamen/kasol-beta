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
// HARUS sama persis dengan FALLBACK_ANON_KEY di kaki5/js/supabase-config.js
// agar klien tidak tertimpa string placeholder. JWT ini PUBLIK (anon key
// Supabase memang di-design untuk di-expose ke browser), jadi aman di-serve.
const FALLBACK_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhoeXdydmVkbHdsamF3Z3h6cGtxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU1MzM4OTgsImV4cCI6MjEwMTEwOTg5OH0.GXHRDayBNRbWh1QywGkYCJ6D79qnm_mtyRSJUxw4x50';

export default function handler(req, res) {
  const baseUrl = (process.env.SUPABASE_URL || FALLBACK_URL).replace(/\/$/, '');
  const anonKey = process.env.SUPABASE_ANON_KEY || FALLBACK_ANON_KEY;

  res.setHeader('Cache-Control', 'public, max-age=300, stale-while-revalidate=86400');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.status(200).json({ url: baseUrl, anonKey });
}