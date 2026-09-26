-- ============================================================================
-- KASOL — LINK APLIKASI AKTIF (per app client)
-- Menambahkan key `app_links` pada tabel settings. Nilai jsonb berisi peta
-- app_type -> URL situs aplikasi. Klien mengambil link miliknya sendiri dari
-- sini agar footer/share menampilkan link aplikasi yang sesuai (bukan hardcoded).
--
-- Contoh nilai:
--   {
--     "kaki5":   "https://kasirsolo.app",
--     "gerobak": "https://kasirsolo.app/gerobak",
--     "rosok":   "https://kasirsolo.app/rosok",
--     "retail":  "https://kasirsolo.app/retail",
--     "fnb":     "https://kasirsolo.app/fnb"
--   }
--
-- RLS tabel settings sudah mengizinkan anon read (lihat migration-license-qris.sql).
-- ============================================================================

-- Seed default bila key belum ada (tidak menimpa yang sudah di-set admin).
insert into public.settings (key, value)
values (
  'app_links',
  '{
     "kaki5":   "https://kasirsolo.app",
     "gerobak": "https://kasirsolo.app/gerobak",
     "rosok":   "https://kasirsolo.app/rosok",
     "retail":  "https://kasirsolo.app/retail",
     "fnb":     "https://kasirsolo.app/fnb"
   }'::jsonb
)
on conflict (key) do nothing;
