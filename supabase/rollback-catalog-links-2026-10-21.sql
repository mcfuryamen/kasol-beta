-- ============================================================================
-- ROLLBACK: supabase/migration-fix-catalog-links-2026-10-21.sql
-- Mengembalikan SEMUA nilai ke kondisi sebelum migrasi 2026-10-21.
-- Jalankan dengan: node supabase/apply-migration.js \
--                    --ref=hhywrvedlwljawgxzpkq \
--                    --file=supabase/rollback-catalog-links-2026-10-21.sql --apply
-- (dry-run dulu: --dry-run)
-- ============================================================================

-- 1) Kembalikan store_url / vercel_url persis seperti semula.
UPDATE public.products
   SET store_url  = 'https://retail.kasirsolo.com',
       vercel_url = NULL,
       updated_at = now()
 WHERE app_type = 'retail';

UPDATE public.products
   SET store_url  = 'test.example.com',
       vercel_url = 'vercel.example.com',
       updated_at = now()
 WHERE app_type = 'konveksi';

UPDATE public.products
   SET store_url  = 'https://kasirsolo.app/minimarket',
       vercel_url = 'https://minimarket-kasol.vercel.app',
       updated_at = now()
 WHERE app_type = 'minimarket';

UPDATE public.products
   SET store_url  = NULL,
       vercel_url = 'https://rosokbeta.vercel.app',
       updated_at = now()
 WHERE app_type = 'rosok';

-- 2) Kembalikan visible = true untuk 5 produk yang disembunyikan.
UPDATE public.products
   SET visible   = TRUE,
       updated_at = now()
 WHERE app_type IN ('bengkel', 'klinik', 'masjid', 'tpa', 'konveksi');

-- 3) Kembalikan settings.app_links ke nilai lama (semua kasirsolo.app).
UPDATE public.settings
   SET value = jsonb_build_object(
         'fnb',     'https://kasirsolo.app/fnb',
         'gerobak', 'https://kasirsolo.app/gerobak',
         'kaki5',   'https://kasirsolo.app',
         'retail',  'https://kasirsolo.app/retail',
         'rosok',   'https://kasirsolo.app/rosok'
       ),
       updated_at = now()
 WHERE key = 'app_links';
