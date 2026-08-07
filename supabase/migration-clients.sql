-- ============================================================================
-- KASOL — SINKRONISASI PROFIL KLIEN (CRM) + ANONYMOUS AUTH
-- Jalankan SEKALI di Supabase SQL Editor.
-- Membuat tabel `clients` (1 baris per outlet/perangkat) + kebijakan RLS
-- berbasis anonymous auth, sehingga tiap perangkat hanya bisa mengubah
-- barisnya sendiri. Admin mengelola semua baris lewat service_role key
-- (yang melewati RLS).
-- ============================================================================

-- 1) Tabel clients
create table if not exists public.clients (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid references auth.users(id) on delete set null, -- pemilik (anonymous user)
  unit_id       text not null unique,       -- contoh: K5-XXXX-XXXX  (kunci natural, dipakai dedupe)
  app_type      text not null,              -- kaki5 | rosok | gerobak | retail | ...
  device_code   text not null,              -- contoh: XXXX-XXXX
  install_id    text,
  nama_warung   text,
  nama_pemilik  text,
  no_whatsapp   text,
  -- Wilayah Indonesia (id kanonik + nama, untuk agregasi analitik yang akurat)
  provinsi_id   text,
  provinsi      text,
  kabkota_id    text,
  kabkota       text,
  kecamatan_id  text,
  kecamatan     text,
  alamat_detail text,
  first_seen    timestamptz default now(),
  last_seen     timestamptz default now(),
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

-- index untuk filter ringan
create index if not exists clients_app_type_idx  on public.clients (app_type);
create index if not exists clients_provinsi_idx on public.clients (provinsi_id);
create index if not exists clients_kabkota_idx  on public.clients (kabkota_id);
create index if not exists clients_last_seen_idx on public.clients (last_seen);

-- 2) RLS
alter table public.clients enable row level security;

-- Tiap perangkat (anonymous user) hanya bisa lihat/insert/update baris miliknya.
create policy "clients own select" on public.clients
  for select using (auth.uid() = user_id);

create policy "clients own insert" on public.clients
  for insert with check (auth.uid() = user_id);

create policy "clients own update" on public.clients
  for update using (auth.uid() = user_id);

-- NOTE:
--  * Admin read/write SEMUA baris via service_role key (BYPASS RLS) — tidak
--    perlu policy khusus anon.
--  * Upsert dari klien pakai `ON CONFLICT (unit_id) DO UPDATE`; policy update
--    memeriksa baris lama milik anon yang sama. Jika perangkat di-reset dan
--    mendapat anonymous user baru, baris lama perlu di-merge admin.

-- 3) updated_at otomatis
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists clients_set_updated on public.clients;
create trigger clients_set_updated
  before update on public.clients
  for each row execute function public.set_updated_at();

-- 4) Contoh query analitik (dipakai halaman Klien admin)
-- count per app:
--   select app_type, count(*) from public.clients group by app_type;
-- sebaran wilayah:
--   select provinsi, count(*) from public.clients group by provinsi order by 2 desc;
--   select kabkota, count(*) from public.clients group by kabkota order by 2 desc;
