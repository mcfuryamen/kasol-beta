-- ============================================================
-- migration-sync-errors.sql — T29 Observability Sinkronisasi
-- Dibuat: 2026-08-17
--
-- Latar: 140 user anonymous sign-in sejak 07-08, tapi baris `clients`
-- pertama baru muncul 16-08 — upsert profil gagal senyap ±9 hari tanpa
-- satu pun error terlihat (semua di-catch). Tabel ini membuat kegagalan
-- sync dari semua perangkat tercatat di server, terbaca admin via
-- dashboard / service_role.
--
-- Keamanan:
--  * RLS aktif. Policy INSERT-only untuk anon/authenticated (with check
--    true) — perangkat bisa melapor tapi TIDAK bisa membaca laporan
--    perangkat lain. Tanpa policy SELECT/UPDATE/DELETE.
--  * Admin membaca via service_role (bypass RLS) atau dashboard.
-- ============================================================

create table if not exists public.sync_errors (
  id         bigint generated always as identity primary key,
  unit_id    text,
  app_type   text,
  stage      text,   -- config | session | claim | write | readback | verify
  error      text,
  user_agent text,
  created_at timestamptz not null default now()
);

alter table public.sync_errors enable row level security;

drop policy if exists "sync_errors anon insert only" on public.sync_errors;
create policy "sync_errors anon insert only"
  on public.sync_errors
  for insert
  to anon, authenticated
  with check (true);

create index if not exists sync_errors_created_at_idx on public.sync_errors (created_at desc);
create index if not exists sync_errors_unit_id_idx on public.sync_errors (unit_id);

-- Pembacaan admin (dashboard / SQL editor):
--   select * from sync_errors order by created_at desc limit 100;
