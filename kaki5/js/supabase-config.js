// ==================== SUPABASE CONFIG (klien kaki5) ====================
// Anon key BERSIFAT PUBLIK & aman dipakai di browser. Nilai ini + RLS
// anonymous auth membuat tiap perangkat hanya bisa mengubah barisnya sendiri.
// BUG FIX 2026-08: anon key sebelumnya placeholder 'PASTE...' → sync.js
// getClient() null → notif "sinkronisasi belum dikonfigurasi". Kini anon key
// asli sudah di-embed. JANGAN pakai service_role (rahasia, bukan untuk browser).
(function () {
  window.KASIRSOLO_SUPABASE_URL =
    window.KASIRSOLO_SUPABASE_URL ||
    'https://hhywrvedlwljawgxzpkq.supabase.co';
  window.KASIRSOLO_SUPABASE_ANON_KEY =
    window.KASIRSOLO_SUPABASE_ANON_KEY ||
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhoeXdydmVkbHdsamF3Z3h6cGtxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU1MzM4OTgsImV4cCI6MjEwMTEwOTg5OH0.GXHRDayBNRbWh1QywGkYCJ6D79qnm_mtyRSJUxw4x50';
})();
