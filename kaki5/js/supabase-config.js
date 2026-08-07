// ==================== SUPABASE CONFIG (klien kaki5) ====================
// Baca instruksi ini SEKALI agar sinkronisasi profil ke admin aktif:
//
// 1) Buka dashboard Supabase → Project → Settings → API.
// 2) Salin nilai "anon public" (eyJhbGciOi...).
// 3) Tempel di bawah menggantikan 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhoeXdydmVkbHdsamF3Z3h6cGtxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU1MzM4OTgsImV4cCI6MjEwMTEwOTg5OH0.GXHRDayBNRbWh1QywGkYCJ6D79qnm_mtyRSJUxw4x50'.
//    (JANGAN pakai "service_role" — itu rahasia, bukan untuk browser.)
//
// anon key BERSIFAT PUBLIK & aman dipakai di browser. Nilai ini + RLS
// anonymous auth membuat tiap perangkat hanya bisa mengubah barisnya sendiri.
(function () {
  window.KASIRSOLO_SUPABASE_URL =
    window.KASIRSOLO_SUPABASE_URL ||
    'https://hhywrvedlwljawgxzpkq.supabase.co';
  window.KASIRSOLO_SUPABASE_ANON_KEY =
    window.KASIRSOLO_SUPABASE_ANON_KEY ||
    'PASTE_ANON_KEY_DISINI';
})();
