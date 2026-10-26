-- =============================================================================
-- MIGRASI (BAGIAN 2) — MITRA PORTAL FASE 1: kolom baru di clients
-- =============================================================================
-- Dijadiin file terpisah karena ALTER TABLE clients butuh AccessExclusiveLock,
-- sementara app kaki5/rosok/laundry nulis ke tabel itu terus-menerus.
-- Kalau digabung transaksi panjang → deadlock (40P01) dan write app ikut
-- kelamaan terblokir.
--
-- Di file ini: lock_timeout pendek (2 detik) → kalau lock belum free, query
-- gagal CEPAT tanpa menahan antrean writer. Retry dilakukan di sisi pemanggil.
--
-- Apply (dengan retry):
--   1..10 | node supabase/apply-migration.js --ref=hhywrvedlwljawgxzpkq \
--            --file=supabase/migration-mitra-portal-fase1-clients-columns.sql --apply
--
-- Kolom ini nullable + default 0 → tidak mengubah perilaku app yang ada.
-- Kolom dipakai RPC code_apply_discount (Fase 3).
-- =============================================================================

begin;

set local lock_timeout = '2s';

alter table public.clients
  add column if not exists purchase_code      text,
  add column if not exists purchase_discount  numeric not null default 0,
  add column if not exists price_paid         numeric,
  add column if not exists voucher_id         uuid,
  add column if not exists referred_by_code   text;

commit;
