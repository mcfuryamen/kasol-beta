-- ============================================================================
-- KASOL — ADD KODE_PRODUK COLUMN TO PRODUCTS TABLE
-- Adds a stable product code used for display/selection identity.
-- Safe/idempotent: does not duplicate price, preserves existing kode_produk values.
-- ============================================================================

alter table public.products
  add column if not exists kode_produk text;

update public.products
set kode_produk = case
  when app_type = 'kaki5' then 'KK5'
  when app_type = 'rosok' then 'KSR'
  when app_type = 'gerobak' then 'GBK'
  when app_type = 'retail' then 'RTL'
  when app_type is not null and btrim(app_type) <> '' then upper(regexp_replace(app_type, '[^a-zA-Z0-9]+', '', 'g'))
  else kode_produk
end
where kode_produk is null or btrim(kode_produk) = '';

create unique index if not exists products_kode_produk_unique_idx
  on public.products (kode_produk)
  where kode_produk is not null and btrim(kode_produk) <> '';
