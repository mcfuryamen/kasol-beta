-- ============================================================================
-- MIGRASI: Portal mitra fase B1 — modul "Aplikasi Lo" + voucher per-produk
--
-- 1. RPC BARU partner_my_apps(p_token)
--    → daftar aplikasi yang tercatat atas identitas global mitra
--      (clients via global_identity_id; fallback client_id lama).
--    Dipakai portal untuk badge "Lisensi aktif" per produk.
--    CATATAN DATA: clients.global_identity_id belum pernah diisi app klien
--    (0 baris per 28/10) → hasil wajar [] sekarang; badge muncul otomatis
--    begitu app klien mengisi gid.
--
-- 2. partner_claim_referral — voucher diskon ikut produk yang dipilih
--    refereenya (p_app_type). Sebelumnya voucher selalu kaki5 (hardcoded).
--    '*' / kosong → fallback kaki5 (produk utama).
--    Wallet TIDAK berubah: satu wallet per mitra (UNIQUE partner_id),
--    agregat lintas produk.
--
-- Idempoten & aman dijalankan ulang.
-- ============================================================================

begin;

-- ---------------------------------------------------------------------------
-- 1. RPC partner_my_apps — daftar lisensi milik mitra
-- ---------------------------------------------------------------------------
create or replace function public.partner_my_apps(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_partner public.referral_partners%rowtype;
begin
  if p_token is null or btrim(p_token) = '' then
    return jsonb_build_object('ok', false, 'reason', 'token kosong');
  end if;

  select * into v_partner
  from public.referral_partners
  where portal_token_hash = encode(extensions.digest(btrim(p_token), 'sha256'), 'hex')
    and (portal_token_expires_at is null or portal_token_expires_at > now())
  limit 1;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'invalid_token',
      'reason', 'token tidak valid atau kedaluwarsa');
  end if;
  if v_partner.status <> 'aktif' then
    return jsonb_build_object('ok', false, 'code', 'not_active',
      'reason', 'status mitra: ' || v_partner.status,
      'status', v_partner.status);
  end if;

  return jsonb_build_object(
    'ok', true,
    'apps', coalesce((
      select json_agg(json_build_object(
        'app_type', c.app_type,
        'license_status', c.license_status,
        'license_expires_at', to_char(c.license_expires_at, 'YYYY-MM-DD'),
        'unit_id', c.unit_id
      ) order by c.app_type)
      from public.clients c
      where (v_partner.global_identity_id is not null
              and c.global_identity_id = v_partner.global_identity_id)
         or (v_partner.global_identity_id is null
              and v_partner.client_id is not null
              and c.id = v_partner.client_id)
    ), '[]'::jsonb)
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. partner_claim_referral — voucher ikut p_app_type
--    (body = versi fix-a1: rate limit per-WA + global tetap)
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
  v_voucher_app text;
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

  -- Rate limit: per-WA maks 3 klaim baru/jam + global maks 120/jam.
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

  -- Saldo mitra: pending + earned (nanti dilepas sama referral_resolve_pending).
  -- Wallet = agregat lintas produk (UNIQUE partner_id) — label app_type
  -- tetap 'kaki5' sebagai default, isinya poin komisi dari semua produk.
  insert into public.referral_wallets (partner_id, app_type, points_pending, points_earned)
  values (v_partner.id, 'kaki5', v_points, v_points)
  on conflict (partner_id) do update
    set points_pending = public.referral_wallets.points_pending + v_points,
        points_earned  = public.referral_wallets.points_earned + v_points,
        updated_at = now();

  -- [B1] Voucher ikut produk yang dipilih refereenya. '*' (semua aplikasi)
  -- atau kosong → fallback kaki5 (produk utama).
  v_voucher_app := coalesce(nullif(btrim(coalesce(p_app_type, '')), ''), 'kaki5');
  if v_voucher_app = '*' then
    v_voucher_app := 'kaki5';
  end if;

  -- Voucher diskon buat refereenya
  v_voucher := 'DSK-' || upper(substr(encode(extensions.gen_random_bytes(4), 'hex'), 1, 6));
  insert into public.license_codes (
    code, kind, app_type, owner_partner_id, created_by, status, expires_at,
    discount_type, discount_value, min_purchase, notes
  )
  values (
    v_voucher, 'voucher', v_voucher_app, v_partner.id, 'referral', 'aktif',
    now() + (v_expire_days || ' days')::interval,
    'fixed', v_discount, v_min_purchase, 'Voucher diskon dari kode referral mitra'
  );

  return jsonb_build_object(
    'ok', true,
    'code', v_partner.code,
    'voucher_code', v_voucher,
    'voucher_app', v_voucher_app,
    'discount', v_discount,
    'min_purchase', v_min_purchase,
    'points', v_points,
    'expires_at', to_char(now() + (v_expire_days || ' days')::interval, 'YYYY-MM-DD'),
    'message', 'kode diskon lo udah jadi.'
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Privileges (Postgres auto-grant EXECUTE saat create/replace → atur eksplisit)
-- ---------------------------------------------------------------------------
revoke all on function public.partner_my_apps(text)
  from public, anon, authenticated;
grant execute on function public.partner_my_apps(text)
  to anon, authenticated;

revoke all on function
  public.partner_claim_referral(text, text, text, text, text)
  from public, anon, authenticated;
grant execute on function
  public.partner_claim_referral(text, text, text, text, text)
  to anon, authenticated;

commit;
