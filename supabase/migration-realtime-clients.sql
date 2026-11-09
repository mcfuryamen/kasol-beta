-- ============================================================================
-- migration-realtime-clients.sql — Dokumentasi & jaminan idempoten (2026-09-04)
-- ============================================================================
-- Kontrak sinkronisasi klien (kaki5 & rosok) bergantung pada Supabase Realtime
-- postgres_changes pada tabel `clients`:
--   * kaki5/js/purchase.js & rosok/js/purchase.js subscribe channel
--     `license:<unitId>` — filter `unit_id=eq.<unitId>` event UPDATE.
--   * Admin aktivasi/revoke via PATCH clients → push realtime instan ke
--     perangkat (tanpa ini klien hanya tahu lewat polling 30 dtk / gate 60 dtk).
--
-- Fakta audit: publication ini selama ini hanya dikonfigurasi lewat dashboard
-- (tidak ada jejaknya di repo). File ini membuat keadaan itu DEKLARATIF dan
-- bisa diterapkan ulang ke proyek baru. Idempoten — aman dijalankan walau
-- tabel sudah masuk publication.
--
-- Terapkan:  supabase db execute --file supabase/migration-realtime-clients.sql
--   (atau paste di SQL Editor proyek hhywrvedlwljawgxzpkq).
-- ============================================================================

-- 1) Pastikan publication bawaan realtime ada (dibuat Supabase otomatis;
--    guard untuk proyek blank yang belum pernah menyentuh Realtime).
do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
end $$;

-- 2) Masukkan `clients` bila belum masuk (add table tidak mendukung IF NOT
--    EXISTS — dibungkus cek pg_publication_tables).
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime'
       and schemaname = 'public'
       and tablename = 'clients'
  ) then
    alter publication supabase_realtime add table public.clients;
  end if;
end $$;

-- 3) Catat di RLS: realtime menerapkan policy SELECT tabel untuk menentukan
--    baris yang dikirim ke tiap subscriber (anon hanya melihat barisnya lewat
--    policy "clients hybrid" — user_id ATAU claim unit_id di JWT sesi anon).
--    Tidak ada perubahan policy di sini; hanya pengingat kontrak.
