-- ============================================================================
-- KASOL — KONSOLIDASI PIPELINE : leads + pembelian → SATU TABEL `clients`
-- Jalankan SEKALI via Management API / Supabase SQL Editor.
-- Tujuan: pipeline penuh Leads → Pembelian → Klien dalam 1 baris per outlet,
-- sehingga halaman Klien admin bisa pakai mode LIST + KANBAN (drag-drop status)
-- dari satu sumber data. Tabel `leads` & `pembelian` di-DROP di akhir.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) TAMBAH KOLOM PIPELINE + LISENSI ke `clients`
--    status        : stage pipeline (baru/dihubungi/tertarik/deal/menunggu_verifikasi/aktif/batal/ditolak)
--    source        : dari mana lead masuk (landing, app-kaki5, referral, dll)
--    email, notes  : data kontak marketing
--    harga, bukti_url, nama_pembayar : data transaksi (dari pembelian)
--    verified_at, activated_at       : timestamp proses
-- ----------------------------------------------------------------------------
alter table public.clients
  add column if not exists status          text default 'baru',
  add column if not exists source          text,
  add column if not exists email           text,
  add column if not exists notes           text,
  add column if not exists harga           numeric,
  add column if not exists bukti_url       text,
  add column if not exists nama_pembayar   text,
  add column if not exists verified_at     timestamptz,
  add column if not exists activated_at    timestamptz;

-- index ringan untuk filter pipeline
create index if not exists clients_status_idx on public.clients (status);

-- ----------------------------------------------------------------------------
-- 2) BACKFILL : gabungkan data `leads` → `clients` (merge by unit_id)
--    Jika baris clients belum ada utk unit_id tsb, INSERT baru dari lead.
-- ----------------------------------------------------------------------------
insert into public.clients (unit_id, app_type, device_code, nama_warung, no_whatsapp, alamat_detail, email, status, source, notes, user_id, created_at, updated_at, lead_source)
select l.unit_id,
       l.app_type,
       coalesce(NULLIF(l.unit_id, ''), 'XXXX-XXXX'),
       l.name,
       l.wa,
       l.address,
       l.email,
       l.status,
       l.source,
       l.notes,
       l.user_id,
       l.created_at,
       l.updated_at,
       l.source
from public.leads l
on conflict (unit_id) do update set
  status        = excluded.status,
  source        = excluded.source,
  email         = coalesce(public.clients.email, excluded.email),
  notes         = coalesce(public.clients.notes, excluded.notes),
  lead_source   = coalesce(public.clients.lead_source, excluded.lead_source),
  updated_at    = now();

-- ----------------------------------------------------------------------------
-- 3) BACKFILL : gabungkan data `pembelian` → `clients` (merge by unit_id)
--    Status pembelian menimpa status pipeline bila lebih lanjut.
-- ----------------------------------------------------------------------------
update public.clients c
set status = case
      when p.status = 'aktif' then 'aktif'
      when p.status = 'verified' then 'menunggu_verifikasi'
      when p.status = 'ditolak' then 'ditolak'
      else c.status
    end,
    harga         = coalesce(c.harga, p.harga),
    bukti_url     = coalesce(c.bukti_url, p.bukti_url),
    nama_pembayar = coalesce(c.nama_pembayar, p.nama_pembayar),
    verified_at   = coalesce(c.verified_at, p.verified_at),
    activated_at  = coalesce(c.activated_at, p.activated_at),
    license_status = case when p.status = 'aktif' then 'aktif' else c.license_status end,
    license_serial = coalesce(c.license_serial, p.serial),
    updated_at    = now()
from public.pembelian p
where p.unit_id = c.unit_id;

-- insert pembelian yang tidak punya baris clients sama sekali (bila ada)
insert into public.clients (unit_id, app_type, device_code, status, harga, bukti_url, nama_pembayar, verified_at, activated_at, license_status, license_serial, user_id, created_at, updated_at)
select p.unit_id, p.app_type, p.device_code,
       case when p.status = 'aktif' then 'aktif' when p.status = 'ditolak' then 'ditolak' else 'menunggu_verifikasi' end,
       p.harga, p.bukti_url, p.nama_pembayar, p.verified_at, p.activated_at,
       case when p.status = 'aktif' then 'aktif' else 'belum' end,
       p.serial, p.user_id, p.created_at, p.created_at
from public.pembelian p
on conflict (unit_id) do nothing;

-- ----------------------------------------------------------------------------
-- 4) (ADA USER KONFIRMASI) DROP TABEL LAMA
--    Jalankan baris drop ini HANYA setelah app klien & edge function
--    sudah berhenti menulis ke leads/pembelian.
-- ----------------------------------------------------------------------------
-- drop table if exists public.pembelian;
-- drop table if exists public.leads;
