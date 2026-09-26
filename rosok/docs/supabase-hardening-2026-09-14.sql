-- =========================================================================
-- HARDENING SUPABASE — audit keamanan rosok 2026-09-14 (sudah DIEKSEKUSI
-- via Supabase Management API pada proyek hhywrvedlwljawgxzpkq).
-- Simpan untuk audit trail + pemulihan (jalankan ulang kalau project
-- di-restore/recreate).
-- =========================================================================

-- 1) Tabel products: cabut semua privilege tulis dari peran browser.
--    Alasan: RLS sudah menolak tulis (policy SELECT saja utk public) TAPI
--    TRUNCATE/REFERENCES di luar cakupan RLS — grants-nya tidak boleh ada.
--    service_role (Control /api/license + edge functions) tidak disentuh.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON public.products FROM anon, authenticated;

-- 2)products: SELECT per-kolom TANPA `salt` (revoke no-op kalau masih ada
--    grant table-level — makanya pakai REVOKE penuh lalu GRANT ulang eksplisit):
--    Ganti daftar kolom bila skema berubah; KECUALIKAN `salt`.
REVOKE SELECT ON public.products FROM anon, authenticated;
GRANT SELECT (id, app_type, name, tagline, description, price_label, features,
              icon, color, order_index, visible, created_at, updated_at,
              store_url, vercel_url, status, kode_produk, price_before_label,
              tx_quota, test_col)
  ON public.products TO anon, authenticated;
-- Daftar = SEMUA kolom per snapshot 2026-09-14 KECUALI `salt` (persis hasil
-- DO block dinamis yang dieksekusi). `test_col` rongsok ikut ter-grant agar
-- file ini bisa dijalankan ulang tanpa mengubah state; buang dari daftar
-- sekaligus saat kolomnya di-drop.

-- Verifikasi pasca-eksekusi (semua harus berubah):
--   SELECT has_column_privilege('anon','public.products','salt','SELECT');   -- false
--   SELECT has_column_privilege('anon','public.products','tx_quota','SELECT');-- true
--   curl -H "apikey: <anon>" "$URL/rest/v1/products?select=salt"             -- 401 42501
--   curl "...?select=tx_quota..." / store_url / price_label                  -- 200

-- IMPAK DIKETAHUI (disengaja, terverifikasi):
-- - kaki5 getHmacSalt()/rosok fetchProductSalt → 401 → fallback konstanta
--   build (nilainya identik dengan cloud saat revoke; jalur serial V2 mati).
-- - ROTASI salt: setelah revoke, klien TIDAK BISA lagi membaca salt cloud.
--   Kalau mau rotasi, HAPUS dulu seluruh jalur fetch+verifikasi klien
--   (lihat peringatan di rosok/AGENTS.md & README Security).
-- - Backup signature (unitId+salt konstanta) = checksum integritas, bukan
--   anti-pemalsuan — didokumentasikan di README/DESIGN 2026-09-14.
-- - Bucket `bukti` MASIH public-read (keputusan: suffix acak di nama file,
--   purchase.js; penguncian penuh butuh perubahan alur baca Control).
--
-- Tabel clients TIDAK disentuh: anon/authenticated memang menulis profil &
-- counter kuota via RLS hybrid (by design).
