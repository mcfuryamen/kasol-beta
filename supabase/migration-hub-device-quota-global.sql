-- ============================================================================
-- HUB — KUOTA PERANGKAT = SATU ANGKA GLOBAL DI KATALOG APLIKASI
-- ============================================================================
-- Keputusan pemilik (2026-11-05):
--   "nilai batas maksimal perangkat itu ditanem di katalog aplikasi. lalu,
--    semua akun merujuk pada angka tersebut. jadi, ga perlu menerapkan manual
--    ke masing-masing akun. kalo angka itu berubah, otomatis semua akun ikut
--    berubah"
--
-- SEBELUM (Fase 1 / B1): `licenses.max_devices` per akun, disetel satu per satu
--   lewat kartu Klien di Control. 3 lisensi kaki5 = 1, rosok = 3, dst.
-- SESUDAH: `products.max_devices` = SATU-SATUNYA sumber kebenaran per aplikasi.
--   Semua lisensi (akun) otomatis memakai angka produk yang ditunjuk
--   `licenses.product_id`. Tidak ada override per akun, tidak ada bulk-apply.
--
-- KENAPA MASIH ADA `licenses.max_devices`?
--   Banyak fungsi lama sudah membacanya (hub_my_licenses, account_create_
--   activation_code, 3 RPC aktivasi, audit-schema.js, Control). Daripada
--   menulis ulang semuanya dan berisiko ada yang tertinggal, kolom itu diubah
--   menjadi MIRROR yang DIJAGA DATABASE:
--     · BEFORE INSERT/UPDATE pada licenses → nilainya DIPAKSA dari produk.
--     · AFTER UPDATE max_devices pada products → semua lisensi produk itu
--       disinkronkan seketika dalam transaksi yang sama.
--   Jadi mustahil ada lisensi yang menyimpan angka berbeda. Tulis langsung ke
--   licenses.max_devices tidak lagi berpengaruh (ditimpa trigger).
--
-- KEBIJAKAN YANG DIPERTAHANKAN:
--   · Perangkat yang SUDAH aktif tidak digusur walau kuota diturunkan.
--   · Kuota penuh → aktivasi perangkat BARU ditolak (`device_limit`), bukan
--     auto-eject (ADR §6.2: step-up PIN + throttle transfer belum ada).
--   · Backfill memakai MAX(licenses.max_devices) per produk supaya TIDAK ADA
--     akun yang kehilangan kapasitas saat migrasi ini di-apply. Admin lalu
--     bisa menaikkan/menurunkan satu angka di Katalog sesuai kebutuhan.
--
-- ROLLBACK (kembali ke per-akun):
--   drop trigger if exists products_propagate_device_quota on public.products;
--   drop trigger if exists licenses_sync_device_quota on public.licenses;
--   drop function if exists public.products_propagate_device_quota();
--   drop function if exists public.licenses_sync_device_quota();
--   drop function if exists public.product_device_quota(uuid);
--   alter table public.products drop column if exists max_devices;
--   -- lalu jalankan ulang migration-hub-device-quota-configurable.sql
-- ============================================================================

begin;

-- ── 1) KOLOM SUMBER KEBENARAN ───────────────────────────────────────────────
alter table public.products
  add column if not exists max_devices integer not null default 2
  check (max_devices between 1 and 99);

comment on column public.products.max_devices is
  'Kuota perangkat per akun untuk aplikasi ini. SATU-SATUNYA sumber kebenaran, diatur di Control > Katalog. Berlaku untuk SEMUA akun; perubahan langsung tersinkron ke licenses lewat trigger.';

comment on column public.licenses.max_devices is
  'DEPRECATED — mirror otomatis dari products.max_devices (trigger licenses_sync_device_quota). Jangan ditulis/dibaca sebagai sumber kebenaran.';

-- ── 2) HELPER: baca kuota dari produk ───────────────────────────────────────
-- Fallback 2 hanya bila produk tidak ada / NULL / 0 (produk baru belum disetel).
create or replace function public.product_device_quota(p_product_id uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    nullif((select p.max_devices from public.products p where p.id = p_product_id), 0),
    2
  )
$$;

revoke all on function public.product_device_quota(uuid) from public, anon;
grant execute on function public.product_device_quota(uuid) to authenticated, service_role;

-- ── 3) TRIGGER: lisensi SELALU mengikuti produk ─────────────────────────────
create or replace function public.licenses_sync_device_quota()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Dipaksa, bukan sekadar default: tulisan manual ke licenses.max_devices
  -- (dari Control lama / skrip backfill lama) tidak boleh menciptakan
  -- pengecualian per akun lagi.
  new.max_devices := public.product_device_quota(new.product_id);
  return new;
end;
$$;

drop trigger if exists licenses_sync_device_quota on public.licenses;
create trigger licenses_sync_device_quota
  before insert or update of product_id, max_devices on public.licenses
  for each row execute function public.licenses_sync_device_quota();

-- ── 4) TRIGGER: ubah angka di Katalog → semua akun ikut ─────────────────────
create or replace function public.products_propagate_device_quota()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- UPDATE ini memicu licenses_sync_device_quota, yang membaca produk (sudah
  -- berisi angka baru karena trigger AFTER) → hasil identik. Tidak ada rekursi
  -- lintas tabel: products → licenses → baca products (SELECT, bukan UPDATE).
  update public.licenses
     set max_devices = new.max_devices
   where product_id = new.id
     and max_devices is distinct from new.max_devices;
  return new;
end;
$$;

drop trigger if exists products_propagate_device_quota on public.products;
create trigger products_propagate_device_quota
  after update of max_devices on public.products
  for each row
  when (old.max_devices is distinct from new.max_devices)
  execute function public.products_propagate_device_quota();

-- ── 5) BACKFILL AMAN ────────────────────────────────────────────────────────
-- Seed dari nilai TERTINGGI yang sudah dipakai lisensi produk itu, supaya
-- tidak ada akun yang turun kapasitas. Produk tanpa lisensi tetap default 2.
-- Contoh live saat migrasi: kaki5 (3 lisensi @1) → 1, rosok (1 @3) → 3.
update public.products p
   set max_devices = greatest(
     coalesce((
       select max(l.max_devices) from public.licenses l where l.product_id = p.id
     ), 2), 1)
 where exists (
   select 1 from public.licenses l where l.product_id = p.id
 );

-- Samakan mirror untuk seluruh lisensi (termasuk yang produknya tak berlisensi
-- lain). UPDATE ini kena trigger BEFORE → nilai diambil dari produk.
update public.licenses set max_devices = max_devices;

-- ── 6) VERIFIKASI DALAM TRANSAKSI ───────────────────────────────────────────
-- Gagalkan migrasi kalau masih ada lisensi yang menyimpang dari produknya.
-- (apply-migration.js --dry-run menjalankan ini lalu rollback, jadi aman.)
do $$
declare
  v_beda integer;
begin
  select count(*)::int into v_beda
    from public.licenses l
    join public.products p on p.id = l.product_id
   where l.max_devices is distinct from p.max_devices;
  if v_beda > 0 then
    raise exception 'Sinkronisasi kuota gagal: % lisensi masih menyimpang', v_beda;
  end if;
end;
$$;

commit;
