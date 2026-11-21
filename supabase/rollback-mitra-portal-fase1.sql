-- =============================================================================
-- ROLLBACK — MITRA PORTAL FASE 1
-- =============================================================================
-- Membalik supabase/migration-mitra-portal-fase1.sql.
--
-- PENTING:
--   - Aman dijalankan dalam transaksi (DDL Postgres transaksional).
--   - HAPUS SEMUA data mitra, saldo, dan request pencairan yang sudah tercatat.
--     Jangan dipakai di production kalau sudah ada mitra beneran.
--   - Kolom clients (purchase_code, purchase_discount, price_paid, voucher_id,
--     referred_by_code) ikut dilepas.
--
-- Apply:
--   node supabase/apply-migration.js --ref=hhywrvedlwljawgxzpkq \
--        --file=supabase/rollback-mitra-portal-fase1.sql --apply
-- =============================================================================

begin;

-- 1. Fungsi
drop function if exists public.payout_request(text, integer, numeric, text, text);
drop function if exists public.partner_payouts(text);
drop function if exists public.partner_referrals(text);
drop function if exists public.partner_my_balance(text);
drop function if exists public.partner_session(text);
drop function if exists public.partner_issue_token(uuid, integer);
drop function if exists public.referral_resolve_pending();

-- 2. Tabel (urutan FK: children dulu)
drop table if exists public.code_redemptions;
drop table if exists public.license_codes;
drop table if exists public.payout_requests;
drop table if exists public.referral_wallets;
drop table if exists public.referral_partners;

-- 3. Kolom clients
alter table public.clients
  drop column if exists purchase_code,
  drop column if exists purchase_discount,
  drop column if exists price_paid,
  drop column if exists voucher_id,
  drop column if exists referred_by_code;

-- 4. Config
delete from public.settings where key = 'referral_config';

commit;
