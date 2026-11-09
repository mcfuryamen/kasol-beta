-- =============================================================================
-- rollback-identity-global-fase-a1.sql
-- Rollback Fase A1 (akun global ekosistem kasol) — idempoten.
-- =============================================================================
-- Yang dihapus:
--   · fungsi helper identity_upsert_by_phone
-- Yang TIDAK dihapus (disengaja):
--   · partner_register / partner_session versi extend — direstore manual ke
--     versi pra-A1 dari:
--       - supabase/migration-mitra-kode-universal-fase2b.sql  (register)
--       - supabase/migration-mitra-portal-fase1.sql §8.1      (session)
--     Cara: create or replace ulang dari file tersebut (kolom return ekstra
--     hanya tambahan, aman kalau dibiarkan — makanya rollback ini ringan).
--   · baris global_identities hasil backfill + nilai global_identity_id di
--     referral_partners — itu DATA akun, bukan kontrak; dibiarkan tidak
--     merusak apa pun (0 dependensi lain).
-- =============================================================================

drop function if exists public.identity_upsert_by_phone(text, text);

-- Konsistensi ACL sesudah drop: tidak ada (fungsi hilang bersama ACL-nya).
