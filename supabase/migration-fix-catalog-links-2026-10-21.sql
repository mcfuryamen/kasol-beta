-- ============================================================================
-- Fix katalog produk: hapus link mati, pasang link hidup, sembunyikan produk
-- tanpa aplikasi yang benar-benar ada.
-- Tanggal : 2026-10-21
-- Target  : project Supabase produksi `hhywr`
--
-- KONTEKS
-- Halaman jualan `shop-kasol.vercel.app` membaca tabel `products` dengan filter
-- `visible = eq.true` dan TANPA filter `status`. Jadi setiap produk yang
-- `visible = true` tayang sebagai kartu, dan tombol "Buka Aplikasi" memakai
-- `products.store_url` verbatim:
--   - store_url NULL  -> tombol "Konsultasi" (WA) + badge DEVELOPMENT
--   - store_url isi   -> tombol "Buka Aplikasi" ke URL itu
--
-- Temuan (verifikasi HTTP/DNS langsung, 2026-10-21):
--   retail      store_url=https://retail.kasirsolo.com  -> NXDOMAIN  (mati)
--   konveksi    store_url=test.example.com              -> NXDOMAIN  (placeholder)
--   minimarket  store_url=https://kasirsolo.app/minimarket -> NXDOMAIN (domain lama)
--   rosok       store_url=NULL padahal rosok.kasirsolo.com hidup (HTTP 200)
--               vercel_url=https://rosokbeta.vercel.app  -> 404 (strip hilang;
--               yang hidup adalah rosok-BETA.vercel.app dengan strip)
--
-- ROLLBACK: supabase/rollback-catalog-links-2026-10-21.sql
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1) ROSOK: pasang link hidup.
--    store_url  -> domain produksi (dipakai kartu katalog + footer app)
--    vercel_url -> beta yang benar (dengan strip)
-- ---------------------------------------------------------------------------
UPDATE public.products
   SET store_url  = 'https://rosok.kasirsolo.com',
       vercel_url = 'https://rosok-beta.vercel.app',
       updated_at = now()
 WHERE app_type = 'rosok';

-- ---------------------------------------------------------------------------
-- 2) BUANG LINK MATI (retail, konveksi, minimarket).
--    Semua jadi NULL -> kartu katalog otomatis berubah jadi "Konsultasi"
--    (WA), tidak ada lagi klik ke domain yang tidak ada.
--    Efek samping yang disengaja: fallback link di dalam aplikasi
--    (kaki5/js/app-link.js: store_url > vercel_url > settings.app_links)
--    turun ke settings.app_links, yang di langkah 4 diperbarui ke domain hidup.
-- ---------------------------------------------------------------------------
UPDATE public.products
   SET store_url  = NULL,
       vercel_url = NULL,
       updated_at = now()
 WHERE app_type IN ('retail', 'konveksi', 'minimarket');

-- ---------------------------------------------------------------------------
-- 3) SEMBUNYIKAN 5 PRODUK TANPA APLIKASI LIVE.
--    Kriteria: tidak ada URL live, tidak ada client terdaftar, dan salt HMAC-nya
--    NULL (jadi tidak ada aplikasi yang ambil salt/kuota dari baris ini).
--
--    PENTING — 'laundry' & 'retail' SENGAJA TIDAK DISENTUH:
--      * keduanya punya salt HMAC + salinan app lokal (node_modules/kasir-*),
--        dan purchase.js memfilter `.eq('visible', true)` saat ambil harga,
--        jadi disembunyikan akan mematikan tombol "Beli" di aplikasi itu;
--      * laundry punya 2 client terdaftar (users sungguhan).
--    Sisa 5 di bawah: bengkel, klinik, masjid, tpa, konveksi (semua salt NULL,
--    0 client, tanpa app live) -> aman disembunyikan tanpa efek samping.
-- ---------------------------------------------------------------------------
UPDATE public.products
   SET visible   = FALSE,
       updated_at = now()
 WHERE app_type IN ('bengkel', 'klinik', 'masjid', 'tpa', 'konveksi');

-- ---------------------------------------------------------------------------
-- 4) SETTINGS.app_links — fallback link dalam aplikasi.
--    Nilai lama semua menunjuk ke `kasirsolo.app` yang sudah NXDOMAIN
--    (sudah dipakai 4 app sebagai fallback). Arahkan ke domain yang hidup:
--      - kaki5/rosok -> subdomain app masing-masing
--      - sisanya     -> corporate www.kasirsolo.com
--    Menambah key 'laundry' & 'minimarket' (sebelumnya tidak ada) supaya
--    fallback kedua app itu tidak jatuh ke kasirsolo.app yang mati.
-- ---------------------------------------------------------------------------
UPDATE public.settings
   SET value = jsonb_build_object(
         'fnb',        'https://www.kasirsolo.com',
         'gerobak',    'https://www.kasirsolo.com',
         'kaki5',      'https://kaki5.kasirsolo.com',
         'laundry',    'https://www.kasirsolo.com',
         'minimarket', 'https://www.kasirsolo.com',
         'retail',     'https://www.kasirsolo.com',
         'rosok',      'https://rosok.kasirsolo.com'
       ),
       updated_at = now()
 WHERE key = 'app_links';
