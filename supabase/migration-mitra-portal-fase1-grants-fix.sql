-- =============================================================================
-- FIX — grants RPC admin mitra portal (Fase 1)
-- =============================================================================
-- MASALAH: Supabase pasang ALTER DEFAULT PRIVILEGES di schema public yang
-- memberi EXECUTE ke anon + authenticated OTOMATIS saat fungsi dibuat.
-- Jadi `revoke ... from public` TIDAK cukup — grant default itu eksplisit per
-- fungsi, dan harus dicabut satu per satu dari anon & authenticated.
--
-- DAMPAK KALAU TIDAK DIPERBAIKI:
--   - partner_issue_token bisa dipanggil anon → siapa pun bisa meminta token
--     mitra aktif & masuk ke portalnya.
--   - referral_resolve_pending bisa dipanggil anon → siapa pun bisa memicu
--     pelepasan reward.
--
-- Yang BOLEH akses dua fungsi ini: service_role (Control Center / cron).
-- Apply:
--   node supabase/apply-migration.js --ref=hhywrvedlwljawgxzpkq \
--        --file=supabase/migration-mitra-portal-fase1-grants-fix.sql --apply
-- =============================================================================

begin;

revoke all on function public.referral_resolve_pending() from public, anon, authenticated;
grant execute on function public.referral_resolve_pending() to service_role;

revoke all on function public.partner_issue_token(uuid, integer) from public, anon, authenticated;
grant execute on function public.partner_issue_token(uuid, integer) to service_role;

commit;
