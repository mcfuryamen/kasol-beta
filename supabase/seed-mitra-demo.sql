-- =============================================================================
-- SEED — Mitra DEMO untuk uji portal (Fase 1)
-- =============================================================================
-- ⚠️  INI DATA CONTOH, BUKAN DATA NYATA. Satu mitra fiktif ("Warung Bu Tanti
--     (DEMO)") + 4 referral + 2 pencairan historis. Dipakai buat ngetes
--     portal mitra end-to-end (RPC live, bukan mock).
--
-- Angka dibuat KOHEREN dengan siklus payout 30 hari (mitra referral-only,
-- tanpa lisensi):
--   • 3 referral lama (hold_until sudah lewat) → 150 poinreleased
--   • 1 referral baru (hold_until 30 hari lagi) → 5 poin pending
--   • 2 pencairan lama → 175 poin
--   → points_earned 330 = 150 (siap) + 5 (pending) + 175 (sudah dicairkan)
--   → points_balance 150 · points_pending 5 · rupiah_balance 150.000
--
-- HAPUS:
--   delete from public.referral_partners where code = 'MKS-8F2K';
--   (cascade ke wallet, kode, redemptions, payout_requests)
--
-- Apply:
--   node supabase/apply-migration.js --ref=hhywrvedlwljawgxzpkq \
--        --file=supabase/seed-mitra-demo.sql --apply
-- =============================================================================

begin;

do $$
declare
  v_partner uuid;
  v_wallet  uuid;
  v_code_id uuid;
begin
  -- 1. Mitra (referral-only → siklus payout 30 hari, client_id NULL)
  select id into v_partner
  from public.referral_partners where code = 'MKS-8F2K';

  if v_partner is null then
    insert into public.referral_partners (
      code, nama, no_whatsapp, kota, provinsi, status, tier, notes,
      app_type, app_key, verified_at, approved_at, approved_by
    )
    values (
      'MKS-8F2K', 'Warung Bu Tanti (DEMO)', '628800000000', 'Sukoharjo', 'Jawa Tengah',
      'aktif', 'bronze',
      'DEMO Fase 1 — mitra contoh untuk uji portal mitra. Hapus sebelum produksi.',
      'kaki5', 'kaki5', now(), now(), 'demo-fase1'
    )
    returning id into v_partner;
  else
    update public.referral_partners
       set nama = 'Warung Bu Tanti (DEMO)', status = 'aktif',
           notes = 'DEMO Fase 1 — mitra contoh untuk uji portal mitra. Hapus sebelum produksi.',
           updated_at = now()
     where id = v_partner;
  end if;

  -- 2. Saldo
  select id into v_wallet
  from public.referral_wallets where partner_id = v_partner;

  if v_wallet is null then
    insert into public.referral_wallets (
      partner_id, unit_id, app_type,
      points_balance, points_pending, points_earned, rupiah_balance, withdrawable
    )
    values (v_partner, 'DEMO-MITRA-001', 'kaki5', 150, 5, 330, 150000, 0)
    returning id into v_wallet;
  else
    update public.referral_wallets
       set points_balance = 150, points_pending = 5, points_earned = 330,
           rupiah_balance = 150000, withdrawable = 0, updated_at = now()
     where id = v_wallet;
  end if;

  -- 3. Kode referal (license_codes kind='referral')
  select id into v_code_id
  from public.license_codes where code = 'MKS-8F2K';

  if v_code_id is null then
    insert into public.license_codes (
      code, kind, app_type, owner_partner_id, created_by, status, expires_at,
      discount_type, discount_value, notes
    )
    values (
      'MKS-8F2K', 'referral', 'kaki5', v_partner, 'demo-fase1', 'aktif',
      now() + interval '30 days', 'fixed', 50000,
      'DEMO — kode referal mitra contoh'
    )
    returning id into v_code_id;
  else
    update public.license_codes
       set owner_partner_id = v_partner, status = 'aktif',
           expires_at = now() + interval '30 days', updated_at = now()
     where id = v_code_id;
  end if;

  -- 4. Riwayat referral (3 released + 1 pending)
  if not exists (
    select 1 from public.code_redemptions where code_id = v_code_id
  ) then
    insert into public.code_redemptions (
      code_id, code, channel, unit_id, app_type, discount_value, points_awarded,
      hold_until, points_released_at, referrer_partner_id, status,
      referee_name, referee_city, referee_phone, created_at
    )
    values
      (v_code_id, 'MKS-8F2K', 'diskon', 'K5-DEMO-001', 'kaki5', 50000, 50,
       now() - interval '37 days', now() - interval '37 days', v_partner, 'berhasil',
       'Warung Sembako Jaya', 'Klaten', '628810000001', now() - interval '67 days'),
      (v_code_id, 'MKS-8F2K', 'diskon', 'K5-DEMO-002', 'kaki5', 50000, 50,
       now() - interval '30 days', now() - interval '30 days', v_partner, 'berhasil',
       'Toko Berkah 2', 'Sukoharjo', '628810000002', now() - interval '60 days'),
      (v_code_id, 'MKS-8F2K', 'diskon', 'K5-DEMO-003', 'kaki5', 50000, 50,
       now() - interval '23 days', now() - interval '23 days', v_partner, 'berhasil',
       'Ruko Mama Readers', 'Karanganyar', '628810000003', now() - interval '53 days'),
      (v_code_id, 'MKS-8F2K', 'diskon', 'K5-DEMO-004', 'kaki5', 50000, 5,
       now() + interval '24 days', null, v_partner, 'berhasil',
       'Warung Pak Anto', 'Sragen', '628810000004', now() - interval '6 days');
  end if;

  -- 5. Riwayat pencairan (2x lama → siklus 30 hari sudah lewat, request baru boleh)
  if not exists (
    select 1 from public.payout_requests where partner_id = v_partner
  ) then
    insert into public.payout_requests (
      wallet_id, partner_id, client_id, unit_id, amount_rupiah, points_used,
      payout_type, bank_info, status, admin_note, processed_by, processed_at,
      paid_at, created_at
    )
    values
      (v_wallet, v_partner, null, 'DEMO-MITRA-001', 100000, 100, 'withdraw',
       'BCA 123456 a.n. Tanti (DEMO)', 'dibayar', 'Transfer BCA a.n. Tanti (DEMO)',
       'demo-fase1', now() - interval '32 days', now() - interval '32 days',
       now() - interval '32 days'),
      (v_wallet, v_partner, null, 'DEMO-MITRA-001', 75000, 75, 'withdraw',
       'BCA 123456 a.n. Tanti (DEMO)', 'dibayar', 'Transfer BCA a.n. Tanti (DEMO)',
       'demo-fase1', now() - interval '51 days', now() - interval '51 days',
       now() - interval '51 days');
  end if;
end;
$$;

commit;
