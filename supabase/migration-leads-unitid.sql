-- ============================================================================
-- KASOL — LEADS DARI PROFIL USER APLIKASI KLIEN (unit_id + anonymous own-RLS)
-- Jalankan SEKALI di Supabase SQL Editor (proyek aktif: hhywrvedlwljawgxzpkq).
--
-- Latar: leads kini di-capture dari PROFIL user aplikasi klien (onboarding &
-- update profil), bukan dari form landing. sync.js (app klien) melakukan
-- upsert `leads` ON CONFLICT (unit_id) dengan session anonymous, sama seperti
-- `clients`. Kolom berikut + RLS own-row membuat upsert anon berjalan.
-- ============================================================================

-- 1) Kolom baru: unit_id (kunci dedupe) + user_id (pemilik anon)
alter table public.leads
  add column if not exists unit_id text,
  add column if not exists user_id uuid references auth.users(id) on delete set null;

-- 2) Unique constraint untuk ON CONFLICT (unit_id) DO UPDATE.
--    Full constraint (bukan partial index) — ON CONFLICT hanya bisa pakai
--    unique constraint/index non-partial. Postgres mensyaratkan nilai NULL
--    boleh dobel (banyak baris tanpa unit_id = aman).
alter table public.leads drop constraint if exists leads_unit_id_key;
alter table public.leads add constraint leads_unit_id_key unique (unit_id);

-- 3) RLS: tiap device (anonymous user) hanya bisa select/update barisnya.
--    INSERT diizinkan (dengan user_id = auth.uid()) — upsert butuh insert + update.
drop policy if exists "leads own select" on public.leads;
create policy "leads own select" on public.leads
  for select using (auth.uid() = user_id);

drop policy if exists "leads own insert" on public.leads;
create policy "leads own insert" on public.leads
  for insert with check (auth.uid() = user_id);

drop policy if exists "leads own update" on public.leads;
create policy "leads own update" on public.leads
  for update using (auth.uid() = user_id);

-- NOTE: hapus policy lama "anon_insert_leads" (with check true) bila masih ada —
--       menggantinya dengan policy own di atas mencegah anon seenaknya insert.
drop policy if exists "anon_insert_leads" on public.leads;

-- 4) Backfill: salin profil yang sudah tersinkron di `clients` ke `leads`
--    (sekali jalan, aman di-idempotent-kan via unique unit_id).
insert into public.leads (unit_id, name, wa, address, app_type, source, status)
select c.unit_id, c.nama_warung, c.no_whatsapp, c.alamat_detail, c.app_type,
       'app-' || c.app_type, 'baru'
from public.clients c
on conflict (unit_id) do nothing;
