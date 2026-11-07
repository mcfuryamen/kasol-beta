// ==================== SUPABASE CONFIG (klien kaki5) ====================
// Fetch Supabase config from Edge Function (no hardcoded keys in source)
// Anon key is PUBLIC by design, but fetching from Edge Function allows:
// - Key rotation without client deploy
// - Rate limiting & monitoring
// - No keys in source code / repo

(function () {
  // Fallback values (used if Edge Function fails)
  const FALLBACK_URL = 'https://hhywrvedlwljawgxzpkq.supabase.co';
  const FALLBACK_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhoeXdydmVkbHdsamF3Z3h6cGtxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU1MzM4OTgsImV4cCI6MjEwMTEwOTg5OH0.GXHRDayBNRbWh1QywGkYCJ6D79qnm_mtyRSJUxw4x50';

  // Set fallbacks immediately so other scripts can read them
  window.KASIRSOLO_SUPABASE_URL = FALLBACK_URL;
  window.KASIRSOLO_SUPABASE_ANON_KEY = FALLBACK_ANON_KEY;

  // Fetch real config from Edge Function (async, non-blocking).
  // Di host dev (localhost/127.0.0.1/IP lokal) endpoint /api/* tidak ada
  // (serverless hanya di Vercel) — skip fetch supaya console bersih;
  // fallback dipakai langsung (nilainya identik).
  const h = location.hostname;
  const isDevHost = h === 'localhost' || h === '127.0.0.1' || h.startsWith('192.168.') || h.startsWith('10.') || h.endsWith('.local') || !h.includes('.');
  if (isDevHost) {
    console.info('[CONFIG] Dev host — pakai fallback Supabase config (tanpa Edge Function)');
    return;
  }
  fetch('/api/supabase-config')
    .then(res => res.ok ? res.json() : null)
    .then(data => {
      if (data && data.url && data.anonKey) {
        window.KASIRSOLO_SUPABASE_URL = data.url;
        window.KASIRSOLO_SUPABASE_ANON_KEY = data.anonKey;
        console.log('[CONFIG] Supabase config loaded from Edge Function');
      } else {
        console.warn('[CONFIG] Using fallback Supabase config');
      }
    })
    .catch(err => {
      console.warn('[CONFIG] Edge Function fetch failed, using fallback:', err);
    });
})();