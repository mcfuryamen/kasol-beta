-- ============================================================================
-- AKUN KASOL — FASE A3: kode referal otomatis untuk setiap akun
-- ============================================================================
-- Keputusan pemilik (2026-11-03):
--   "Kode referal jangan dibuat opsional. Saat user daftar, otomatis punya
--    kode referal. Mau dipakai atau tidak, terserah user."
--
-- Pendekatan: tetap memakai model `referral_partners` (bukan kolom baru), supaya
-- dompet poin, pencairan, dan pelacakan referral yang sudah live TIDAK berubah.
-- Setiap akun mendapat:
--   · baris referral_partners  (registered_via='akun', status='aktif', tier bronze)
--   · dompet referral_wallets
--   · kode referral universal (kind='referral', app_type='*')
--
-- Idempoten:
--   · akun sudah punya partner + kode → tidak membuat apa pun
--   · partner ada tapi kode hilang     → kode dibuat ulang
--   · nomor WA sudah dipakai partner lain → jangan buat duplikat, pakai yang ada
--
-- Opt-in "Jadi Mitra" tidak lagi membuat kode; ia hanya MELENGKAPI profil
-- (kota/provinsi) karena kode sudah ada sejak daftar.
--
-- ROLLBACK:
--   drop function if exists public.account_ensure_referral();
--   drop function if exists public.account_ensure_referral_for_gid(text);
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- 1) account_ensure_referral_for_gid — inti (service_role / dipanggil wrapper)
-- ----------------------------------------------------------------------------
create or replace function public.account_ensure_referral_for_gid(p_gid text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_gi   public.global_identities%rowtype;
  v_p    public.referral_partners%rowtype;
  v_code text;
  v_nama text;
  v_cfg  jsonb := '{}'::jsonb;
  v_discount    numeric := 50000;
  v_min_purchase numeric := 100000;
  v_expire_days integer := 30;
  v_new_count   integer := 0;
begin
  if p_gid is null then
    return jsonb_build_object('ok', false, 'code', 'invalid_input');
  end if;

  select * into v_gi from public.global_identities where id = p_gid;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'identity_not_found');
  end if;
  if v_gi.phone_e164 like 'unverified:%' then
    return jsonb_build_object('ok', false, 'code', 'no_phone',
      'reason', 'akun belum punya nomor WhatsApp');
  end if;

  v_p := public.account_partner_for_gid(p_gid);

  -- Belum punya baris mitra → buat (ini yang membuat kode jadi otomatis).
  if v_p.id is null then
    select count(*)::int into v_new_count
      from public.referral_partners
     where created_at > now() - interval '1 hour';
    if v_new_count >= 200 then
      return jsonb_build_object('ok', false, 'code', 'rate_limited');
    end if;

    v_nama := coalesce(
      nullif(btrim(coalesce(v_gi.display_name, '')), ''),
      'Akun ' || right(v_gi.phone_e164, 4)
    );

    insert into public.referral_partners (
      code, nama, no_whatsapp, status, tier, registered_via,
      approved_at, approved_by, global_identity_id
    )
    values (
      public.partner_gen_code(), v_nama, v_gi.phone_e164,
      'aktif', 'bronze', 'akun', now(), 'auto', p_gid
    )
    returning * into v_p;
  end if;

  -- Pastikan tautan gid terisi (data lama bisa null).
  if v_p.global_identity_id is null then
    update public.referral_partners
       set global_identity_id = p_gid, updated_at = now()
     where id = v_p.id;
    v_p.global_identity_id := p_gid;
  end if;

  -- Dompet (kalau belum ada).
  insert into public.referral_wallets (partner_id, app_type)
  values (v_p.id, 'kaki5')
  on conflict (partner_id) do nothing;

  -- Kode referral universal.
  select code into v_code
    from public.license_codes
   where owner_partner_id = v_p.id
     and kind = 'referral'
   order by created_at asc
   limit 1;

  if v_code is null then
    select coalesce(value, '{}'::jsonb) into v_cfg
      from public.settings where key = 'referral_config';
    v_discount     := coalesce((v_cfg->>'discount_referral')::numeric, 50000);
    v_min_purchase := coalesce((v_cfg->>'min_purchase_for_discount')::numeric, 100000);
    v_expire_days  := coalesce((v_cfg->>'referral_expire_days')::int, 30);

    v_code := v_p.code;

    insert into public.license_codes (
      code, kind, app_type, owner_partner_id, created_by, status, expires_at,
      discount_type, discount_value, min_purchase, notes
    )
    values (
      v_code, 'referral', '*', v_p.id, 'mitra', 'aktif',
      now() + (v_expire_days || ' days')::interval,
      'fixed', v_discount, v_min_purchase, 'Kode referral akun (universal)'
    )
    on conflict (code) do update
      set owner_partner_id = v_p.id,
          app_type = '*',
          status = 'aktif',
          updated_at = now();
  else
    -- Kode ada tapi mungkin kedaluwarsa/nonaktif → segarkan masa berlaku.
    update public.license_codes
       set status = 'aktif',
           expires_at = greatest(coalesce(expires_at, now()), now() + interval '30 days'),
           updated_at = now()
     where code = v_code
       and (status <> 'aktif' or expires_at <= now());
  end if;

  return jsonb_build_object(
    'ok', true,
    'code', v_code,
    'partner_id', v_p.id,
    'status', v_p.status,
    'kota', v_p.kota,
    'provinsi', v_p.provinsi,
    'tier', v_p.tier
  );
end;
$$;

-- ----------------------------------------------------------------------------
-- 2) Wrapper sesi — dipakai dashboard (idempoten, aman dipanggil tiap load)
-- ----------------------------------------------------------------------------
create or replace function public.account_ensure_referral()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_gid text := public.current_global_identity_id();
begin
  if v_gid is null then
    return jsonb_build_object('ok', false, 'code', 'not_signed_in');
  end if;
  return public.account_ensure_referral_for_gid(v_gid);
end;
$$;

-- ----------------------------------------------------------------------------
-- 3) account_my_profile — sertakan kode referal + status mitra
-- ----------------------------------------------------------------------------
-- Tidak perlu RPC baru: profil sudah mengembalikan blok `mitra` (code, status,
-- kota, tier). Kolom `registered_via` ikut dikirim agar UI bisa membedakan
-- "mitra" (daftar lewat form) vs "akun" (kode otomatis).
create or replace function public.account_my_profile()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_gid text := public.current_global_identity_id();
  v_gi  public.global_identities%rowtype;
  v_p   public.referral_partners%rowtype;
  v_lic integer := 0;
  v_dev integer := 0;
begin
  if v_gid is null then
    return jsonb_build_object('ok', false, 'code', 'not_signed_in');
  end if;

  select * into v_gi from public.global_identities where id = v_gid;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'identity_not_found');
  end if;

  v_p := public.account_partner_for_gid(v_gid);

  select count(*)::int into v_lic
    from public.licenses where global_identity_id = v_gid and status = 'active';

  select count(*)::int into v_dev
    from public.license_devices d
    join public.licenses l on l.id = d.license_id
   where l.global_identity_id = v_gid and d.status = 'active';

  return jsonb_build_object(
    'ok', true,
    'gid', v_gi.id,
    'nama', v_gi.display_name,
    'wa', v_gi.phone_e164,
    'status', v_gi.status,
    'phone_verified', (v_gi.phone_verified_at is not null),
    'created_at', v_gi.created_at,
    'license_count', v_lic,
    'device_count', v_dev,
    'mitra', case when v_p.id is null then null else jsonb_build_object(
      'partner_id', v_p.id,
      'status', v_p.status,
      'code', v_p.code,
      'kota', v_p.kota,
      'provinsi', v_p.provinsi,
      'tier', v_p.tier,
      'registered_via', v_p.registered_via
    ) end
  );
end;
$$;

-- ----------------------------------------------------------------------------
-- 4) account_become_partner — kini hanya MELENGKAPI profil (kode sudah ada)
-- ----------------------------------------------------------------------------
create or replace function public.account_become_partner(
  p_kota     text default null,
  p_provinsi text default null,
  p_catatan  text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_gid text := public.current_global_identity_id();
  v_ens jsonb;
  v_p   public.referral_partners%rowtype;
begin
  if v_gid is null then
    return jsonb_build_object('ok', false, 'code', 'not_signed_in',
      'reason', 'masuk ke akun dulu ya');
  end if;

  -- Pastikan partner + kode sudah ada (idempoten).
  v_ens := public.account_ensure_referral_for_gid(v_gid);
  if not coalesce((v_ens->>'ok')::boolean, false) then
    return v_ens;
  end if;

  v_p := public.account_partner_for_gid(v_gid);

  update public.referral_partners
     set kota = coalesce(nullif(btrim(coalesce(p_kota, '')), ''), kota),
         provinsi = coalesce(nullif(btrim(coalesce(p_provinsi, '')), ''), provinsi),
         catatan = coalesce(nullif(btrim(coalesce(p_catatan, '')), ''), catatan),
         status = case when status = 'ditolak' then 'aktif' else status end,
         updated_at = now()
   where id = v_p.id
  returning * into v_p;

  return jsonb_build_object(
    'ok', true,
    'already', true,
    'partner_id', v_p.id,
    'code', (select code from public.license_codes
              where owner_partner_id = v_p.id and kind = 'referral'
              order by created_at asc limit 1),
    'status', v_p.status,
    'kota', v_p.kota,
    'provinsi', v_p.provinsi
  );
end;
$$;

-- ----------------------------------------------------------------------------
-- 5) GRANTS
-- ----------------------------------------------------------------------------
revoke all on function public.account_ensure_referral_for_gid(text) from public, anon, authenticated;
revoke all on function public.account_ensure_referral()             from public, anon;

grant execute on function public.account_ensure_referral_for_gid(text) to service_role;
grant execute on function public.account_ensure_referral()             to authenticated, service_role;

commit;

-- ============================================================================
-- VERIFIKASI
-- ============================================================================
-- select g.phone_e164, p.code, lc.code as kode_referral, lc.status, lc.expires_at
--   from public.global_identities g
--   left join public.referral_partners p on p.global_identity_id = g.id
--   left join public.license_codes lc on lc.owner_partner_id = p.id and lc.kind='referral'
--  order by g.created_at desc limit 10;
-- ============================================================================