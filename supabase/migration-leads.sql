-- ============================================================================
-- KASOL — LEADS TABLE (Marketing Leads from Landing Page)
-- Jalankan SEKALI di Supabase SQL Editor.
-- ============================================================================

-- 1) Tabel leads
create table if not exists public.leads (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,              -- Nama bisnis / kontak
  wa            text,                       -- WhatsApp (format 628xxx)
  email         text,                       -- Email (opsional)
  address       text,                       -- Alamat / lokasi
  app_type      text,                       -- Aplikasi yang diminati (retail, rosok, dll)
  source        text default 'landing',     -- Sumber: landing, wa, referral, dll
  status        text not null default 'baru', -- baru | dihubungi | tertarik | deal | batal
  notes         text,                       -- Catatan internal
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

-- Index untuk filter & search
create index if not exists leads_status_idx on public.leads (status);
create index if not exists leads_app_type_idx on public.leads (app_type);
create index if not exists leads_created_idx on public.leads (created_at desc);
create index if not exists leads_wa_idx on public.leads (wa);

-- 2) RLS
alter table public.leads enable row level security;

-- Admin (service_role) BYPASS RLS - full access
create policy "service_role_all_leads" on public.leads
  for all using (true);

-- Landing page (anon) - INSERT ONLY (capture leads)
-- Anon key hanya bisa INSERT, tidak bisa read/update/delete
create policy "anon_insert_leads" on public.leads
  for insert with check (true);

-- 3) updated_at otomatis
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists leads_set_updated on public.leads;
create trigger leads_set_updated
  before update on public.leads
  for each row execute function public.set_updated_at();

-- 4) Contoh query admin
-- select * from leads order by created_at desc;
-- select status, count(*) from leads group by status;
-- select app_type, count(*) from leads group by app_type;