-- ============================================================================
-- KASOL — LISENSI OTOMATIS: QRIS + PEMBELIAN (Fase 1)
-- Jalankan SEKALI di Supabase SQL Editor (atau via Management API query).
-- Membuat:
--   1) tabel `settings`   (key/value; key 'qris_url' = SATU QRIS utk semua app)
--   2) tabel `pembelian`  (transaksi beli lisensi) + RLS anonymous
--   3) bucket storage `qris` (public) & `bukti` (anon-own)  [dibuat via API]
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) TABEL SETTINGS (key-value), RLS: anon read utk menampilkan QRIS global
-- ----------------------------------------------------------------------------
create table if not exists public.settings (
  key        text primary key,
  value      jsonb not null,
  updated_at timestamptz default now()
);

alter table public.settings enable row level security;

-- anon boleh BACA (qris_url global diperlukan klien utk tampilkan QRIS)
drop policy if exists "settings anon read" on public.settings;
create policy "settings anon read" on public.settings
  for select using (true);

-- tulis via service_role (BYPASS RLS) — dari admin / function

-- seed QRIS kosong (diisi nanti saat admin upload)
insert into public.settings (key, value)
  values ('qris_url', 'null'::jsonb)
  on conflict (key) do nothing;

-- updated_at otomatis utk settings
create or replace function public.set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists settings_set_updated on public.settings;
create trigger settings_set_updated
  before update on public.settings
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- 2) TABEL PEMBELIAN (1 transaksi beli lisensi) + RLS anonymous
-- ----------------------------------------------------------------------------
create table if not exists public.pembelian (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid references auth.users(id) on delete set null,
  unit_id        text not null,              -- K5-XXXX-XXXX (kunci usaha)
  app_type       text not null,              -- kaki5 | rosok | gerobak | retail
  device_code    text not null,              -- tujuan serial (device-bound)
  harga          numeric,                    -- snapshot harga dari products
  status         text default 'menunggu_verifikasi',
                 -- menunggu_verifikasi → 'aktif' | 'ditolak'
  bukti_url      text,                       -- file bukti bayar di bucket `bukti`
  nama_pembayar  text,                       -- opsional: nama/ref transfer
  serial         text,                       -- diisi saat diaktivasi
  license_status text,                       -- snapshot status lisensi klien
  created_at     timestamptz default now(),
  verified_at    timestamptz,
  activated_at   timestamptz
);

create index if not exists pembelian_unit_idx    on public.pembelian (unit_id);
create index if not exists pembelian_status_idx  on public.pembelian (status);
create index if not exists pembelian_created_idx on public.pembelian (created_at desc);

alter table public.pembelian enable row level security;

-- tiap perangkat (anonymous user) hanya bisa insert/lihat/update baris miliknya
drop policy if exists "pembelian own insert" on public.pembelian;
create policy "pembelian own insert" on public.pembelian
  for insert with check (auth.uid() = user_id);

drop policy if exists "pembelian own select" on public.pembelian;
create policy "pembelian own select" on public.pembelian
  for select using (auth.uid() = user_id);

drop policy if exists "pembelian own update" on public.pembelian;
create policy "pembelian own update" on public.pembelian
  for update using (auth.uid() = user_id);

-- NOTE admin baca-saja semua baris via service_role (BYPASS RLS).
-- Aktivasi hanya menulis ulang kolom status/serial oleh service_role/edge fn.

-- ----------------------------------------------------------------------------
-- 3) BUCKET STORAGE — dibuat via Management API (storage endpoint)
--    qris  : public read, admin upload   → qris/merchant-qris.png
--    bukti : anon tulis/baca milik sendiri, admin baca semua
-- ----------------------------------------------------------------------------