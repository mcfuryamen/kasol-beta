// js/env-loader.js -- config client admin (STATIS, aman)
// HANYA memuat nilai PUBLIK (SUPABASE_URL & SUPABASE_ANON_KEY) yang aman di browser (RLS aktif).
// SERVICE_ROLE_KEY & ADMIN_API_KEY: server-only (api/*), TIDAK ada di sini.
// Session token: didapat RUNTIME via GET /api/token (HMAC, 24 jam).
// File ini STATIS & dicommit (pola samakan kaki5: tanpa buildCommand).
window.SUPABASE_URL = "https://hhywrvedlwljawgxzpkq.supabase.co";
window.SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhoeXdydmVkbHdsamF3Z3h6cGtxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU1MzM4OTgsImV4cCI6MjEwMTEwOTg5OH0.GXHRDayBNRbWh1QywGkYCJ6D79qnm_mtyRSJUxw4x50";
