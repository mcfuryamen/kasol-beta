-- =============================================================================
-- FASE 2c — VOUCHER DISKON REFERRAL NGEIKUTI PRODUK YANG DIPILIH REFeree
-- =============================================================================
-- Tanggal : 26/10/2026
-- Alasan  : Companion dari Fase 2b (kode referral mitra universal). Owner:
--           *"mitra bisa menjual semua produk. bahkan seluruh produk yang
--           dijual di kasir solo"*.
--
-- BUG YANG DIPERBAIKI:
--   partner_claim_referral bikin voucher diskon `DSK-…` dengan app_type
--   di-HARDCODE 'kaki5' — padahal referee boleh pilih produk yang mau dibeli
--   di form /r/<kode> (kaki5 / rosok / laundry / minimarket / retail /
--   "semua aplikasi"). Artinya orang yang pilih "Kasir Retail" (Rp 2.500.000)
--   dapat voucher yang ditandai kaki5 — Nggak bisa dipakai buat produk yang
--   dia pilih begitu `code_apply_discount` (Fase 3) ada.
--
-- Yang diubah:
--   · voucher `DSK-…` → app_type = produk yang dipilih referee,
--     atau '*' kalau referee memilih "Semua aplikasi".
--     (Logikanya PERSIS sama dengan yang sudah dipakai di code_redemptions.)
--
-- YANG TIDAK DIUBAH:
--   · code_redemptions.app_type — sudah benar sejak awal (produk yang dibeli).
--   · kode referral mitra (`kind='referral'`) — sudah universal sejak Fase 2b.
--   · partner_claim_referral TIDAK memfilter app_type kode referral, jadi
--     kode universal tetep bisa diklaim untuk produk apa pun.
--   · Tidak ada ALTER TABLE → tidak ada risiko deadlock 40P01.
--
-- Verifikasi setelah apply:
--   node supabase/audit-schema.js --ref=<ref> --only=mitra_rows,mitra_acl
--   → partner_claim_referral tetap executable oleh anon.
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- 1. Fungsi partner_claim_referral — voucher ikut produk pilihan referee
-- -----------------------------------------------------------------------------
-- Body sama persis dengan migration-mitra-registration-fase2.sql, kecuali:
--   · app_type voucher DSK: hardcode 'kaki5' → p_app_type (atau '*')
create or replace function public.partner_claim_referral(
  p_code     text,
  p_nama     text,
  p_wa       text,
  p_kota     text default null,
  p_app_type text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_lc      public.license_codes%rowtype;
  v_partner public.referral_partners%rowtype;
  v_existing public.code_redemptions%rowtype;
  v_nama    text;
  v_wa      text;
  v_cfg     jsonb := '{}'::jsonb;
  v_points  integer := 5;
  v_cycle   integer := 30;
  v_discount     numeric := 50000;
  v_min_purchase numeric := 100000;
  v_expire_days  integer := 30;
  v_voucher text;
  v_unit    text;
begin
  v_nama := btrim(coalesce(p_nama, ''));
  v_wa   := public.partner_norm_wa(p_wa);

  if length(v_nama) < 2 or v_wa is null then
    return jsonb_build_object('ok', false, 'code', 'invalid_input',
      'reason', 'nama dan WhatsApp wajib diisi');
  end if;

  select * into v_lc
  from public.license_codes
  where upper(code) = upper(btrim(coalesce(p_code, '')))
    and kind = 'referral'
  limit 1;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'invalid_code',
      'reason', 'kode referral nggak ketemu');
  end if;
  if v_lc.status <> 'aktif' or v_lc.expires_at <= now() then
    return jsonb_build_object('ok', false, 'code', 'code_expired',
      'reason', 'kode ini udah nggak berlaku');
  end if;
  if v_lc.owner_partner_id is null then
    return jsonb_build_object('ok', false, 'code', 'invalid_code',
      'reason', 'kode ini nggak punya mitra');
  end if;

  select * into v_partner
  from public.referral_partners
  where id = v_lc.owner_partner_id
  limit 1;

  if not found or v_partner.status <> 'aktif' then
    return jsonb_build_object('ok', false, 'code', 'partner_inactive',
      'reason', 'mitranya lagi nggak aktif');
  end if;

  -- Anti self-referral
  if lower(btrim(v_partner.no_whatsapp)) = lower(v_wa) then
    return jsonb_build_object('ok', false, 'code', 'self_referral',
      'reason', 'nggak bisa pakai kode sendiri');
  end if;

  select coalesce(value, '{}'::jsonb) into v_cfg
  from public.settings where key = 'referral_config';
  v_points       := coalesce((v_cfg->>'points_per_free_referral')::int, 5);
  v_discount     := coalesce((v_cfg->>'discount_referral')::numeric, 50000);
  v_min_purchase := coalesce((v_cfg->>'min_purchase_for_discount')::numeric, 100000);
  v_expire_days  := coalesce((v_cfg->>'referral_expire_days')::int, 30);

  -- Siklus payout = status mitra (bukan status refereenya)
  if exists (
    select 1 from public.clients c
    where c.id = v_partner.client_id and c.license_status = 'aktif'
  ) then
    v_cycle := coalesce((v_cfg->>'payout_cycle_days_licensed')::int, 7);
  else
    v_cycle := coalesce((v_cfg->>'payout_cycle_days_referral_only')::int, 30);
  end if;

  -- Sudah pernah klaim? → balikin yang lama, jangan dobel poin.
  select * into v_existing
  from public.code_redemptions
  where code_id = v_lc.id
    and referee_phone = v_wa
  order by created_at desc
  limit 1;

  if found then
    return jsonb_build_object(
      'ok', true,
      'already', true,
      'code', v_partner.code,
      'points', v_existing.points_awarded,
      'discount', v_discount,
      'message', 'kode lo udah kepake. Simpan ya.'
    );
  end if;

  -- Catat ledger reward
  v_unit := 'WEB-' || upper(substr(encode(extensions.gen_random_bytes(4), 'hex'), 1, 8));
  insert into public.code_redemptions (
    code_id, code, channel, unit_id, app_type, discount_value, points_awarded,
    hold_until, referrer_partner_id, status, referee_name, referee_city, referee_phone
  )
  values (
    v_lc.id, v_lc.code, 'diskon', v_unit,
    coalesce(nullif(btrim(coalesce(p_app_type, '')), ''), '*'),
    v_discount, v_points,
    now() + (v_cycle || ' days')::interval,
    v_partner.id, 'berhasil',
    v_nama, nullif(btrim(coalesce(p_kota, '')), ''), v_wa
  );

  -- Saldo mitra: pending + earned (nanti dilepas sama referral_resolve_pending)
  insert into public.referral_wallets (partner_id, app_type, points_pending, points_earned)
  values (v_partner.id, 'kaki5', v_points, v_points)
  on conflict (partner_id) do update
    set points_pending = public.referral_wallets.points_pending + v_points,
        points_earned  = public.referral_wallets.points_earned + v_points,
        updated_at = now();

  -- Voucher diskon buat refereenya.
  -- app_type = produk yang dipilih referee (atau '*' = semua aplikasi).
  v_voucher := 'DSK-' || upper(substr(encode(extensions.gen_random_bytes(4), 'hex'), 1, 6));
  insert into public.license_codes (
    code, kind, app_type, owner_partner_id, created_by, status, expires_at,
    discount_type, discount_value, min_purchase, notes
  )
  values (
    v_voucher, 'voucher',
    coalesce(nullif(btrim(coalesce(p_app_type, '')), ''), '*'),
    v_partner.id, 'referral', 'aktif',
    now() + (v_expire_days || ' days')::interval,
    'fixed', v_discount, v_min_purchase, 'Voucher diskon dari kode referral mitra'
  );

  return jsonb_build_object(
    'ok', true,
    'code', v_partner.code,
    'voucher_code', v_voucher,
    'discount', v_discount,
    'min_purchase', v_min_purchase,
    'points', v_points,
    'expires_at', to_char(now() + (v_expire_days || ' days')::interval, 'YYYY-MM-DD'),
    'message', 'kode diskon lo udah jadi.'
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- 2. Backfill voucher lama (jika ada)
-- -----------------------------------------------------------------------------
-- Voucher yang dibuat lewat referral tadinya selalu 'kaki5'. Product aslinya
-- nggak tersimpan, jadi yang aman = universal ('*') — lebih longgar, nggak
-- pernah salah tolak.
update public.license_codes
   set app_type = '*',
       updated_at = now()
 where kind = 'voucher'
   and created_by = 'referral'
   and owner_partner_id is not null
   and app_type is distinct from '*';

-- -----------------------------------------------------------------------------
-- 3. GRANT (sama seperti Fase 2 — CREATE OR REPLACE mempertahankan ACL,
--    tapi ditulis ulang biar file ini self-contained)
-- -----------------------------------------------------------------------------
revoke all on function public.partner_claim_referral(text, text, text, text, text) from public;
grant execute on function public.partner_claim_referral(text, text, text, text, text)
  to anon, authenticated, service_role;

commit;
