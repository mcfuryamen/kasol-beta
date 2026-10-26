-- ============================================================================
-- KASOL — DAFTAR MINIMARKET KE KATALOG SOFTWARE (public.products)
-- Jalankan SEKALI di Supabase SQL Editor.
--
-- Tabel `products` adalah source-of-truth katalog software untuk:
--   - Landing page (showcase produk + link store)
--   - Admin panel → Katalog (CRUD katalog software/hardware/layanan)
--   - License activation (salt + kode_produk + tx_quota)
--   - TX quota tier gratis (bulanan per app_type)
--
-- Schema produk (lihat control/docs/03-data-schema.md:178-199):
--   id, app_type, kode_produk, salt, name, tagline, description, icon,
--   price_label, price_before_label, features, color, order_index, visible,
--   status, store_url, vercel_url, tx_quota, tutorials, active,
--   created_at, updated_at
--
-- Minimarket (Preact/TypeScript POS klien) selaras dengan:
--   - core.ts:    PRODUCT_PREFIX='MML'
--   - core.ts:    DEFAULT_LICENSE_SALT='KASIRSOLO-MINIMARKET-HMAC-V2'
--   - sync.ts:    fallback salt & kode_produk fetch dari products.salt
--   - logic.ts:   DEFAULT_TX_QUOTA=100
-- ============================================================================

-- 1) Defensive: pastikan kolom katalog yang dipakai admin/landing ada.
--    (kolom inti sudah dari CREATE TABLE; kolom tambahan ditambahkan idempotent.)
alter table public.products
  add column if not exists tagline          text,
  add column if not exists features         jsonb default '[]',
  add column if not exists color            text,
  add column if not exists status           text,
  add column if not exists store_url        text,
  add column if not exists vercel_url       text,
  add column if not exists tutorials        jsonb default '[]',
  add column if not exists active           boolean default true;

-- 2) INSERT row minimarket ke katalog (idempotent via ON CONFLICT).
insert into public.products (
  name, tagline, description, icon,
  app_type, kode_produk, salt,
  price_label, price_before_label,
  features, color,
  order_index, visible, status,
  store_url, vercel_url,
  tx_quota, tutorials, active
)
values (
  'Minimarket (Kasir Solo)',
  'POS modern untuk minimarket & retail kecil',
  'Aplikasi kasir POS modern untuk minimarket, toko kelontong, dan retail kecil. Preact + Vite, full offline-capable dengan sinkronisasi cloud opsional. TX quota 100 transaksi/bulan tier gratis, lisensi lifetime Rp 199.000.',
  '🛒',

  'minimarket', 'MML', 'KASIRSOLO-MINIMARKET-HMAC-V2',

  'Rp 199.000 / lifetime',
  'Rp 299.000',

  '[
     "POS kasir full touchscreen",
     "Manajemen stok opname + mutasi",
     "Manajemen pelanggan tier (Bronze/Silver/Gold)",
     "Manajemen supplier + purchase order",
     "Keuangan kas + laporan laba-rugi",
     "Promo & voucher diskon",
     "Multi-staf dengan role owner/manager/kasir/gudang",
     "Print struk thermal 58/80mm",
     "Offline-first (Dexie IndexedDB)",
     "Auto-license activation via Supabase"
   ]'::jsonb,
  'orange',

  4,           -- di bawah kaki5/rosok/retail (urutan katalog)
  true,        -- tampilkan di landing & katalog admin
  'ready',     -- kartu landing auto-update saat deploy production

  'https://kasirsolo.app/minimarket',
  'https://minimarket-kasol.vercel.app',

  100,
  '[]'::jsonb, -- tutorial list (diisi via UI katalog admin nanti)
  true
)
on conflict (kode_produk) where kode_produk is not null and btrim(kode_produk) <> '' do nothing;

-- 3) Jaga-jaga: kalau row sudah ada tapi salt/app_type/kode_produk/tx_quota
--    salah (misal migrasi lama jalan tanpa minimarket), bayar via UPDATE.
update public.products
set salt = 'KASIRSOLO-MINIMARKET-HMAC-V2',
    app_type = coalesce(app_type, 'minimarket'),
    kode_produk = coalesce(kode_produk, 'MML'),
    tx_quota = coalesce(tx_quota, 100)
where app_type = 'minimarket'
  and (salt is null or salt <> 'KASIRSOLO-MINIMARKET-HMAC-V2');

-- 4) updated_at otomatis kalau belum ada trigger (pola migrasi produk lainnya).
create or replace function public.set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists products_set_updated on public.products;
create trigger products_set_updated
  before update on public.products
  for each row execute function public.set_updated_at();