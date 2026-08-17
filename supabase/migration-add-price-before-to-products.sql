-- ============================================================================
-- KASOL — ADD PRICE_BEFORE_LABEL COLUMN TO PRODUCTS TABLE
-- "Harga coret": harga asli sebelum diskon, ditampilkan tercoret di aplikasi
-- klien (kaki5) & katalog admin. Nilai NULL = tidak ada harga coret.
-- Safe/idempotent: tidak mengubah data harga yang sudah ada.
-- ============================================================================

alter table public.products
  add column if not exists price_before_label text;
