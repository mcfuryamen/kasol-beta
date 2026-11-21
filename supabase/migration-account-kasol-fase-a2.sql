-- ============================================================================
-- AKUN KASOL — FASE A2: dashboard akun berbasis SESI
-- ============================================================================
-- Fase A1 (migration-account-kasol-fase-a1.sql) menyiapkan daftar/login.
-- Fase A2 melengkapi dashboard: fitur yang sebelumnya HANYA bisa diakses lewat
-- portal token (partner_*_ ) sekarang tersedia untuk akun yang login.
--
-- Tambahan RPC (semua `authenticated`, sumber identitas = SESI, bukan token):
--   1. account_my_summary()              — ringkasan lisensi/perangkat/kemitraan/saldo
--   2. account_my_referrals(p_limit)     — riwayat referral mitra
--   3. account_my_payouts()              — riwayat pencairan
--   4. account_request_payout(...)       — ajukan pencairan (validasi identik payout_request)
--   5. account_create_activation_code(l) — kode aktivasi perangkat baru (10 menit)
--
-- Kenapa fungsi BARU, bukan mengubah yang token-based:
--   portal mitra live memakai token; mengubah parameternya berisiko memutus
--   alur yang sedang dipakai. Kedua jalur hidup berdampingan, logika disalin
--   agar hasilnya sama.
--
-- ROLLBACK:
--   drop function if exists public.account_my_summary();
--   drop function if exists public.account_my_referrals(integer);
--   drop function if exists public.account_my_payouts();
--   drop function if exists public.account_request_payout(integer, numeric, text);
--   drop function if exists public.account_create_activation_code(uuid);
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- 0) Helper internal: baris mitra milik gid (by gid dulu, fallback nomor WA)
-- ----------------------------------------------------------------------------
create or replace function public.account_partner_for_gid(p_gid text)
returns public.referral_partners
language sql
stable
security definer
set search_path = ''
as $$
  select p.*
    from public.referral_partners p
   where p.global_identity_id = p_gid
      or public.partner_norm_wa(p.no_whatsapp) = (
           select g.phone_e164 from public.global_identities g where g.id = p_gid
         )
   order by (p.global_identity_id = p_gid) desc, p.created_at asc
   limit 1
$$;

revoke all on function public.account_partner_for_gid(text) from public, anon, authenticated;
grant execute on function public.account_partner_for_gid(text) to service_role;

-- ----------------------------------------------------------------------------
-- 1) account_my_summary — kartu ringkasan dashboard
-- ----------------------------------------------------------------------------
create or replace function public.account_my_summary()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_gid  text := public.current_global_identity_id();
  v_gi   public.global_identities%rowtype;
  v_p    public.referral_partners%rowtype;
  v_lic  integer := 0;
  v_dev  integer := 0;
  v_ref  integer := 0;
  v_ready numeric := 0;
  v_pending numeric := 0;
  v_rupiah numeric := 0;
begin
  if v_gid is null then
    return jsonb_build_object('ok', false, 'code', 'not_signed_in');
  end if;

  select * into v_gi from public.global_identities where id = v_gid;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'identity_not_found');
  end if;

  select count(*)::int into v_lic
    from public.licenses
   where global_identity_id = v_gid and status = 'active';

  select count(*)::int into v_dev
    from public.license_devices d
    join public.licenses l on l.id = d.license_id
   where l.global_identity_id = v_gid and d.status = 'active';

  v_p := public.account_partner_for_gid(v_gid);

  if v_p.id is not null then
    select coalesce(sum(w.points_balance), 0),
           coalesce(sum(w.points_pending), 0),
           coalesce(sum(w.rupiah_balance), 0)
      into v_ready, v_pending, v_rupiah
      from public.referral_wallets w
     where w.partner_id = v_p.id;

    select count(*)::int into v_ref
      from public.code_redemptions cr
     where cr.referrer_partner_id = v_p.id
       and cr.status = 'berhasil';
  end if;

  return jsonb_build_object(
    'ok', true,
    'gid', v_gid,
    'nama', v_gi.display_name,
    'wa', v_gi.phone_e164,
    'phone_verified', (v_gi.phone_verified_at is not null),
    'licenses', v_lic,
    'devices', v_dev,
    'mitra', case when v_p.id is null then null else jsonb_build_object(
      'partner_id', v_p.id,
      'code', v_p.code,
      'status', v_p.status,
      'tier', v_p.tier,
      'kota', v_p.kota,
      'provinsi', v_p.provinsi
    ) end,
    'saldo', jsonb_build_object(
      'points_ready', v_ready,
      'points_pending', v_pending,
      'rupiah_balance', v_rupiah
    ),
    'referrals', v_ref
  );
end;
$$;

-- ----------------------------------------------------------------------------
-- 2) account_my_referrals — riwayat referral mitra (mirror partner_referrals)
-- ----------------------------------------------------------------------------
create or replace function public.account_my_referrals(p_limit integer default 10)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_gid  text := public.current_global_identity_id();
  v_p    public.referral_partners%rowtype;
  v_cfg  jsonb := '{}'::jsonb;
  v_paid integer := 50;
  v_lim  integer := least(greatest(coalesce(p_limit, 10), 1), 50);
begin
  if v_gid is null then return '[]'::jsonb; end if;
  v_p := public.account_partner_for_gid(v_gid);
  if v_p.id is null or v_p.status <> 'aktif' then return '[]'::jsonb; end if;

  select coalesce(value, '{}'::jsonb) into v_cfg
    from public.settings where key = 'referral_config';
  v_paid := coalesce((v_cfg->>'points_per_paid_referral')::int, 50);

  return coalesce((
    select jsonb_agg(row_obj order by created_at desc)
    from (
      select
        jsonb_build_object(
          'name', coalesce(cr.referee_name, c.nama_usaha, c.nama_pemilik, 'Pelanggan'),
          'city', coalesce(cr.referee_city, c.kabkota, ''),
          'product', cr.app_type,
          'status', case
                      when cr.status <> 'berhasil' then 'pending'
                      when coalesce(cr.points_awarded, 0) >= v_paid then 'paid'
                      when coalesce(cr.points_awarded, 0) > 0 then 'free'
                      else 'pending'
                    end,
          'points', coalesce(cr.points_awarded, 0),
          'date', to_char(cr.created_at, 'YYYY-MM-DD')
        ) as row_obj,
        cr.created_at
      from public.code_redemptions cr
      left join public.clients c on c.id = cr.client_id
      where cr.referrer_partner_id = v_p.id
      order by cr.created_at desc
      limit v_lim
    ) t
  ), '[]'::jsonb);
end;
$$;

-- ----------------------------------------------------------------------------
-- 3) account_my_payouts — riwayat pencairan (mirror partner_payouts)
-- ----------------------------------------------------------------------------
create or replace function public.account_my_payouts()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_gid text := public.current_global_identity_id();
  v_p   public.referral_partners%rowtype;
begin
  if v_gid is null then return '[]'::jsonb; end if;
  v_p := public.account_partner_for_gid(v_gid);
  if v_p.id is null then return '[]'::jsonb; end if;

  return coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'id', 'PO-' || upper(left(replace(pr.id::text, '-', ''), 8)),
        'date', to_char(pr.created_at, 'YYYY-MM-DD'),
        'points', coalesce(pr.points_used, 0),
        'amount', pr.amount_rupiah,
        'status', case pr.status
                    when 'dibayar' then 'selesai'
                    when 'ditolak' then 'ditolak'
                    else 'diproses'
                  end,
        'note', coalesce(pr.admin_note, pr.bank_info, '')
      ) order by pr.created_at desc
    )
    from public.payout_requests pr
    where pr.partner_id = v_p.id
  ), '[]'::jsonb);
end;
$$;

-- ----------------------------------------------------------------------------
-- 4) account_request_payout — ajukan pencairan dari akun (validasi = payout_request)
-- ----------------------------------------------------------------------------
create or replace function public.account_request_payout(
  p_points    integer,
  p_amount    numeric,
  p_bank_info text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_gid    text := public.current_global_identity_id();
  v_p      public.referral_partners%rowtype;
  v_wallet public.referral_wallets%rowtype;
  v_cfg    jsonb := '{}'::jsonb;
  v_rate   integer := 1000;
  v_min    numeric := 50000;
  v_max    numeric := 500000;
  v_cycle  integer := 30;
  v_req_id uuid;
  v_has_license boolean := false;
begin
  if v_gid is null then
    return jsonb_build_object('ok', false, 'code', 'not_signed_in',
      'reason', 'masuk ke akun dulu ya');
  end if;

  v_p := public.account_partner_for_gid(v_gid);
  if v_p.id is null then
    return jsonb_build_object('ok', false, 'code', 'not_partner',
      'reason', 'akun ini belum terdaftar sebagai mitra');
  end if;
  if v_p.status <> 'aktif' then
    return jsonb_build_object('ok', false, 'code', 'not_active',
      'value', v_p.status, 'reason', 'status mitra: ' || v_p.status);
  end if;

  select coalesce(value, '{}'::jsonb) into v_cfg
    from public.settings where key = 'referral_config';
  v_rate := coalesce((v_cfg->>'points_to_rupiah')::int, 1000);
  v_min  := coalesce((v_cfg->>'min_payout_rupiah')::numeric, 50000);
  v_max  := coalesce((v_cfg->>'max_payout_per_request')::numeric, 500000);

  if p_points is null or p_points <= 0 then
    return jsonb_build_object('ok', false, 'code', 'invalid_points',
      'reason', 'jumlah poin harus lebih dari 0');
  end if;
  if p_amount is null or p_amount < v_min then
    return jsonb_build_object('ok', false, 'code', 'min_payout', 'value', v_min,
      'reason', 'minimal pencairan Rp ' || v_min::text);
  end if;
  if p_amount > v_max then
    return jsonb_build_object('ok', false, 'code', 'max_payout', 'value', v_max,
      'reason', 'maksimal per request Rp ' || v_max::text);
  end if;
  if p_amount <> p_points * v_rate then
    return jsonb_build_object('ok', false, 'code', 'amount_mismatch',
      'reason', 'nominal harus sama dengan poin x ' || v_rate::text);
  end if;
  if nullif(btrim(coalesce(p_bank_info, '')), '') is null then
    return jsonb_build_object('ok', false, 'code', 'no_bank',
      'reason', 'isi rekening tujuan dulu');
  end if;

  -- Siklus payout berbasis STATUS MITRA (K3b): punya lisensi = 7 hari,
  -- referral-only = 30 hari. Di jalur akun, lisensi dicek dari gid.
  select exists (
    select 1 from public.licenses l
     where l.global_identity_id = v_gid and l.status = 'active'
       and (l.expires_at is null or l.expires_at > now())
  ) into v_has_license;

  v_cycle := case when v_has_license
                  then coalesce((v_cfg->>'payout_cycle_days_licensed')::int, 7)
                  else coalesce((v_cfg->>'payout_cycle_days_referral_only')::int, 30)
             end;

  if exists (
    select 1 from public.payout_requests pr
     where pr.partner_id = v_p.id
       and pr.status in ('pending','disetujui','dibayar')
       and pr.created_at > now() - (v_cycle || ' days')::interval
  ) then
    return jsonb_build_object('ok', false, 'code', 'cycle', 'value', v_cycle,
      'reason', 'sudah ada request pencairan di siklus ini (1x per ' || v_cycle::text || ' hari)');
  end if;

  select * into v_wallet
    from public.referral_wallets
   where partner_id = v_p.id
   order by created_at asc
   limit 1
   for update;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'no_wallet',
      'reason', 'saldo belum diinisialisasi');
  end if;
  if v_wallet.points_balance < p_points then
    return jsonb_build_object('ok', false, 'code', 'insufficient',
      'value', v_wallet.points_balance,
      'reason', 'saldo poin belum cukup (tersedia ' || v_wallet.points_balance::text || ')');
  end if;

  update public.referral_wallets
     set points_balance = points_balance - p_points,
         rupiah_balance = rupiah_balance - p_amount,
         withdrawable   = withdrawable + p_amount,
         updated_at     = now()
   where id = v_wallet.id;

  insert into public.payout_requests (
    wallet_id, partner_id, client_id, unit_id,
    amount_rupiah, points_used, payout_type, bank_info, status
  )
  values (
    v_wallet.id, v_p.id, v_p.client_id, v_wallet.unit_id,
    p_amount, p_points, 'withdraw', btrim(p_bank_info), 'pending'
  )
  returning id into v_req_id;

  return jsonb_build_object(
    'ok', true, 'id', v_req_id, 'amount', p_amount, 'points', p_points,
    'status', 'pending',
    'message', 'Request tercatat. Ditunggu transfer manual dari tim kami.'
  );
end;
$$;

-- ----------------------------------------------------------------------------
-- 5) account_create_activation_code — kode aktivasi perangkat (10 menit)
-- ----------------------------------------------------------------------------
-- Hanya pemilik lisensi (gid) yang bisa menerbitkan. Satu kode aktif per
-- lisensi: kode lama yang belum dipakai langsung di-expire.
create or replace function public.account_create_activation_code(
  p_license_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_gid  text := public.current_global_identity_id();
  v_lic  public.licenses%rowtype;
  v_code text;
  v_hash text;
begin
  if v_gid is null then
    return jsonb_build_object('ok', false, 'code', 'not_signed_in');
  end if;
  if p_license_id is null then
    return jsonb_build_object('ok', false, 'code', 'invalid_input');
  end if;

  select * into v_lic from public.licenses where id = p_license_id;
  if not found or v_lic.status <> 'active' then
    return jsonb_build_object('ok', false, 'code', 'license_unavailable',
      'reason', 'lisensi tidak tersedia');
  end if;
  if v_lic.global_identity_id is distinct from v_gid then
    return jsonb_build_object('ok', false, 'code', 'not_owner',
      'reason', 'lisensi bukan milik akun ini');
  end if;
  if v_lic.expires_at is not null and v_lic.expires_at <= now() then
    return jsonb_build_object('ok', false, 'code', 'license_expired',
      'reason', 'lisensi sudah kedaluwarsa');
  end if;

  update public.hub_activation_codes
     set expires_at = now()
   where license_id = p_license_id
     and redeemed_at is null
     and expires_at > now();

  v_code := 'HUB-' || upper(substr(encode(extensions.gen_random_bytes(8), 'hex'), 1, 12));
  v_hash := encode(extensions.digest(v_code, 'sha256'), 'hex');

  insert into public.hub_activation_codes (license_id, code_hash, created_by_gid)
  values (p_license_id, v_hash, v_gid);

  return jsonb_build_object(
    'ok', true,
    'code', v_code,
    'expires_at', now() + interval '10 minutes',
    'app_type', v_lic.app_type,
    'license_id', v_lic.id,
    'max_devices', v_lic.max_devices
  );
end;
$$;

-- ----------------------------------------------------------------------------
-- 6) GRANTS — hanya sesi login (anon tidak boleh)
-- ----------------------------------------------------------------------------
revoke all on function public.account_my_summary()          from public, anon;
revoke all on function public.account_my_referrals(integer) from public, anon;
revoke all on function public.account_my_payouts()          from public, anon;
revoke all on function public.account_request_payout(integer, numeric, text) from public, anon;
revoke all on function public.account_create_activation_code(uuid) from public, anon;

grant execute on function public.account_my_summary()          to authenticated, service_role;
grant execute on function public.account_my_referrals(integer) to authenticated, service_role;
grant execute on function public.account_my_payouts()          to authenticated, service_role;
grant execute on function public.account_request_payout(integer, numeric, text) to authenticated, service_role;
grant execute on function public.account_create_activation_code(uuid) to authenticated, service_role;

commit;

-- ============================================================================
-- VERIFIKASI
-- ============================================================================
-- select p.proname, pg_get_function_identity_arguments(p.oid) args,
--        coalesce(array_to_string(p.proacl,' | '),'default') acl
--   from pg_proc p join pg_namespace n on n.oid=p.pronamespace
--  where n.nspname='public' and p.proname like 'account_%'
--  order by 1;
-- ============================================================================