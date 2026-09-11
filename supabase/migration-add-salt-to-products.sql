-- ============================================================================
-- KASOL — ADD SALT COLUMN TO PRODUCTS TABLE (for license salt)
-- Run via Supabase Management API query or SQL editor.
-- Adds column `salt` TEXT to table `products` and populates with known values.
-- ============================================================================

-- Add column if not exists
alter table public.products add column if not exists salt text;

-- Update known app_types with their salts (from hardcoded PRODUCT_REGISTRY)
update public.products
set salt = case
  when app_type = 'kaki5' then 'KASIRSOLO-KAKI5-HMAC-V2'
  when app_type = 'rosok' then 'KASIRSOLO-ROSOK-HMAC-V2'
  when app_type = 'gerobak' then 'KASIRSOLO-GEROBAK-HMAC-V2'
  when app_type = 'retail' then 'KASIRSOLO-RETAIL-HMAC-V2'
  else salt
end
where app_type in ('kaki5','rosok','gerobak','retail');

-- Ensure salt is not null for known types (optional)
-- alter table public.products alter column salt set not null; -- if desired
