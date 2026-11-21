-- ============================================================================
-- MIGRASI: Mitra security hardening — fix hasil audit keamanan aplikasi mitra
--
-- Fix 1 (HIGH): policy "settings anon read" (USING true) membuka SELURUH isi
--   tabel settings ke anon — termasuk key "ai_providers" yang menyimpan API
--   key OpenRouter (sk-or-v1-...). Diganti whitelist key yang memang info
--   publik. Konsumen /rest/v1/settings di aplikasi: hanya agent/* (server
--   side) dan control/* (proxy admin) — dua-duanya pakai service key
--   (bypass RLS), jadi app publik tidak sedang bergantung ke policy anon ini.
--
-- Fix 2 (MEDIUM): partner_claim_referral tanpa rate limit. Kode referral
--   24-bit entropy (MKS-XXXXXX) rawan di-enumerasi kalau klaim tak dibatasi.
--   Tambah guard (basis: baris code_redemptions 1 jam terakhir):
--     - per-WA : maks 3 klaim baru / jam (referee_phone)
--     - global : maks 120 klaim baru / jam
--   Klaim idempoten (WA sama + kode sama → balikin voucher lama) dicek
--   SEBELUM rate limit → tidak terdampak.
--
-- Catatan:
--   - create or replace + revoke/grant eksplisit (Postgres auto-grant
--     EXECUTE ke public/anon/authenticated saat fungsi dibuat/di-replace).
--   - Idempoten & aman dijalankan ulang.
-- ============================================================================

begin;

-- ---------------------------------------------------------------------------
-- FIX 1: settings — anon read cuma boleh key info publik
-- ---------------------------------------------------------------------------
-- Tetap publik  : app_links, biz_info, qris_url (info bisnis halaman publik).
-- Ditutup anon  : ai_providers (API key OpenRouter!), agent_config, agents,
--                 bank_info, referral_config, runner_heartbeat.
-- app publik yang butuh key baru → tambah eksplisit ke whitelist ini.
drop policy if exists "settings anon read" on public.settings;
create policy "settings anon read public keys"
  on public.settings
  for select
  to anon
  using (key in ('app_links', 'biz_info', 'qris_url'));

-- ---------------------------------------------------------------------------
-- FIX 2: partner_claim_referral — body fase2 + guard rate limit
-- ---------------------------------------------------------------------------
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
  v_rl_wa   integer;
  v_rl_all  integer;
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

  -- [AUDIT FIX] Rate limit: per-WA maks 3 klaim baru/jam + global maks 120/jam.
  -- Basisnya baris code_redemptions 1 jam terakhir. Klaim idempoten sudah
  -- return di atas, jadi nggak kena limit.
  select count(*) into v_rl_wa
  from public.code_redemptions
  where referee_phone = v_wa
    and created_at > now() - interval '1 hour';
  if v_rl_wa >= 3 then
    return jsonb_build_object('ok', false, 'code', 'rate_limited',
      'reason', 'coba lagi nanti (maks 3 klaim per jam)');
  end if;

  select count(*) into v_rl_all
  from public.code_redemptions
  where created_at > now() - interval '1 hour';
  if v_rl_all >= 120 then
    return jsonb_build_object('ok', false, 'code', 'rate_limited',
      'reason', 'server lagi sibuk, coba lagi nanti');
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

  -- Voucher diskon buat refereenya
  v_voucher := 'DSK-' || upper(substr(encode(extensions.gen_random_bytes(4), 'hex'), 1, 6));
  insert into public.license_codes (
    code, kind, app_type, owner_partner_id, created_by, status, expires_at,
    discount_type, discount_value, min_purchase, notes
  )
  values (
    v_voucher, 'voucher', 'kaki5', v_partner.id, 'referral', 'aktif',
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

-- ---------------------------------------------------------------------------
-- Privileges: Postgres auto-grant EXECUTE ke public/anon/authenticated saat
-- fungsi dibuat/di-replace → cabut semua, grant eksplisit.
-- Fungsi ini memang untuk publik (dipanggil anon dari portal) →
-- grant: anon + authenticated.
-- ---------------------------------------------------------------------------
revoke all on function
  public.partner_claim_referral(text, text, text, text, text)
  from public, anon, authenticated;
grant execute on function
  public.partner_claim_referral(text, text, text, text, text)
  to anon, authenticated;

commit;
