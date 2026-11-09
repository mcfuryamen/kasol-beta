-- ============================================================================
-- AKUN KASOL — FASE A1 (MITRA): daftar/login akun universal (WA + PIN)
-- ============================================================================
-- Tujuan produk (keputusan pemilik 2026-11-03):
--   Satu akun Kasol (mirip akun Google) untuk seluruh ekosistem:
--   aktivasi kemitraan + beli/aktivasi lisensi app apa pun.
--   Daftar bisa dari mitra MAUPUN dari app (app = fase A2, belum di file ini).
--
-- Hubungan dengan dokumen lama:
--   · docs/HUB-DESIGN-DECISIONS.md (Phase 0) = fondasi tabel yang dipakai di sini.
--   · CONTEXT.md menyebut HUB "FREEZE" (2026-10-21), TETAPI migrasi
--     2026-10-28/29 (migration-hub-fase1-jembatan-akun.sql) mengangkat HUB
--     jadi pintu SEMUA user. File ini mengikuti keputusan terbaru dan memakai
--     istilah "Akun Kasol" agar tidak mewarisi spec HUB-lama.
--
-- Yang dikerjakan:
--   1. current_global_identity_id() — HARDENING + fallback sesi Auth.
--      Urutan: app_metadata.gid → global_identities.auth_user_id = auth.uid().
--      Jalur `user_metadata.gid` DIHAPUS: user_metadata bisa diubah sendiri
--      oleh pemilik sesi (updateUser) → kalau dipakai untuk otorisasi, siapa
--      pun bisa mengaku gid orang lain dan membaca lisensinya lewat RLS.
--      app_metadata HANYA bisa diubah service_role.
--   2. account_prepare_identity(wa, nama)        — service_role: buat/lookup akun.
--   3. account_bind_auth_user(gid, auth_user_id) — service_role: tautkan sesi.
--   4. account_attach_existing_licenses(gid)     — service_role: tarik lisensi
--      perangkat lama yang WA-nya sama → langsung tampil di dashboard akun.
--   5. account_my_profile()                      — authenticated: profil + status mitra.
--   6. account_become_partner(kota, provinsi, catatan) — authenticated: opt-in
--      mitra TANPA token (sumber identitas = sesi, bukan parameter WA).
--
-- TIDAK diubah: skema tabel, RLS yang sudah ada, alur token portal mitra,
-- RPC partner_register/partner_session (tetap jalan apa adanya).
--
-- ROLLBACK (bersih):
--   -- pulihkan resolver lama (tanpa fallback auth_user_id):
--   create or replace function public.current_global_identity_id()
--   returns text language sql stable security definer set search_path = ''
--   as $$ select coalesce(nullif(auth.jwt() ->> 'gid',''),
--                         nullif(auth.jwt() -> 'user_metadata' ->> 'gid','')) $$;
--   drop function if exists public.account_prepare_identity(text, text);
--   drop function if exists public.account_bind_auth_user(text, uuid);
--   drop function if exists public.account_attach_existing_licenses(text);
--   drop function if exists public.account_my_profile();
--   drop function if exists public.account_become_partner(text, text, text);
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- 1) RESOLVER: sesi Auth → gid (aman untuk RLS)
-- ----------------------------------------------------------------------------
create or replace function public.current_global_identity_id()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    -- 1. Jalur utama setelah akun tertaut: app_metadata.gid (server-only).
    nullif(auth.jwt() -> 'app_metadata' ->> 'gid', ''),
    -- 2. Fallback aman: peta tetap auth user → akun (butuh sesi login).
    (
      select g.id
        from public.global_identities g
       where g.auth_user_id = auth.uid()
       limit 1
    )
    -- 3. SENGAJA tidak membaca user_metadata.gid (bisa diubah user sendiri).
  )
$$;

comment on function public.current_global_identity_id() is
  'gid pemanggil: app_metadata.gid → global_identities.auth_user_id = auth.uid(). TIDAK memakai user_metadata (bisa dipalsukan user).';

-- ----------------------------------------------------------------------------
-- 2) account_prepare_identity — buat/lookup akun by WA (service_role)
-- ----------------------------------------------------------------------------
-- Idempoten:
--   · WA belum ada           → buat akun baru (status pending, belum terverifikasi)
--   · WA sudah ada, belum tertaut auth user → kembalikan gid untuk ditautkan
--   · WA sudah ada & tertaut → already_registered (Edge Function balas 409)
create or replace function public.account_prepare_identity(
  p_wa   text,
  p_nama text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_wa   text;
  v_nama text;
  v_gi   public.global_identities%rowtype;
begin
  v_wa := public.partner_norm_wa(p_wa);
  if v_wa is null or length(v_wa) < 9 or length(v_wa) > 15 then
    return jsonb_build_object('ok', false, 'code', 'invalid_wa',
      'reason', 'nomor WhatsApp nggak valid');
  end if;

  v_nama := nullif(btrim(coalesce(p_nama, '')), '');

  select * into v_gi
    from public.global_identities
   where phone_e164 = v_wa
   limit 1;

  if found then
    if v_gi.auth_user_id is not null then
      return jsonb_build_object('ok', false, 'code', 'already_registered',
        'reason', 'nomor ini sudah punya akun. Coba masuk ya.',
        'gid', v_gi.id);
    end if;
    -- Akun sudah tercipta lewat jalur lain (mitra/perangkat) → tinggal tautkan.
    if v_nama is not null then
      update public.global_identities
         set display_name = coalesce(nullif(display_name, ''), v_nama),
             updated_at = now()
       where id = v_gi.id and (display_name is null or btrim(display_name) = '');
    end if;
    return jsonb_build_object(
      'ok', true, 'gid', v_gi.id, 'wa', v_wa,
      'existing', true,
      'nama', coalesce(nullif(v_gi.display_name, ''), v_nama)
    );
  end if;

  insert into public.global_identities (id, phone_e164, display_name, status)
  values (gen_random_uuid()::text, v_wa, v_nama, 'pending')
  on conflict (phone_e164) do update
    set updated_at = now()
  returning * into v_gi;

  return jsonb_build_object(
    'ok', true, 'gid', v_gi.id, 'wa', v_wa,
    'existing', false,
    'nama', coalesce(nullif(v_gi.display_name, ''), v_nama)
  );
end;
$$;

-- ----------------------------------------------------------------------------
-- 3) account_bind_auth_user — tautkan sesi Auth ke akun (service_role)
-- ----------------------------------------------------------------------------
create or replace function public.account_bind_auth_user(
  p_gid          text,
  p_auth_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_gi public.global_identities%rowtype;
begin
  if p_gid is null or p_auth_user_id is null then
    return jsonb_build_object('ok', false, 'code', 'invalid_input');
  end if;

  select * into v_gi from public.global_identities where id = p_gid for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'identity_not_found');
  end if;
  if v_gi.auth_user_id is not null and v_gi.auth_user_id <> p_auth_user_id then
    return jsonb_build_object('ok', false, 'code', 'already_bound',
      'reason', 'akun ini sudah tertaut ke sesi lain');
  end if;

  -- Satu sesi Auth hanya boleh memegang satu akun.
  if exists (
    select 1 from public.global_identities
     where auth_user_id = p_auth_user_id
       and id <> p_gid
  ) then
    return jsonb_build_object('ok', false, 'code', 'auth_user_taken',
      'reason', 'sesi ini sudah tertaut ke akun lain');
  end if;

  update public.global_identities
     set auth_user_id = p_auth_user_id,
         status = case when status = 'pending' then 'active' else status end,
         updated_at = now()
   where id = p_gid;

  return jsonb_build_object('ok', true, 'gid', p_gid);
end;
$$;

-- ----------------------------------------------------------------------------
-- 4) account_attach_existing_licenses — lisensi perangkat lama ikut akun
-- ----------------------------------------------------------------------------
-- Semua baris clients dengan WA yang sama (registri app klien) diarahkan ke
-- akun ini; lisensi aktifnya dipastikan tercatat di tabel HUB `licenses`
-- sehingga langsung muncul di dashboard akun (hub_my_licenses).
-- Catatan: trigger trg_hub_clients_bridge tidak ikut terpicu saat UPDATE
-- global_identity_id (kolom itu sengaja tidak ada di daftar UPDATE OF) —
-- karena itu sinkronisasi lisensi dikerjakan eksplisit di sini.
create or replace function public.account_attach_existing_licenses(
  p_gid text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_wa     text;
  v_linked integer := 0;
  v_lic    integer := 0;
  r        record;
  v_pid    uuid;
begin
  select phone_e164 into v_wa from public.global_identities where id = p_gid;
  if v_wa is null or v_wa like 'unverified:%' then
    return jsonb_build_object('ok', false, 'code', 'identity_not_ready');
  end if;

  for r in
    select id, app_type, unit_id, license_status, license_serial, tx_month, tx_used, global_identity_id
      from public.clients
     where public.partner_norm_wa(no_whatsapp) = v_wa
  loop
    -- Bila klien masih menempel ke akun lain (mis. placeholder unv-), biarkan:
    -- nomor WA sama tapi sudah punya akun berbeda = konflik data, jangan dipaksa.
    if r.global_identity_id is not null
       and r.global_identity_id <> p_gid
       and r.global_identity_id not like 'unv-%' then
      continue;
    end if;

    update public.clients
       set global_identity_id = p_gid
     where id = r.id
       and global_identity_id is distinct from p_gid;
    v_linked := v_linked + 1;

    if r.license_status = 'aktif'
       and nullif(btrim(coalesce(r.license_serial, '')), '') is not null then
      select id into v_pid
        from public.products
       where app_type = r.app_type
       order by (status = 'live') desc, id
       limit 1;

      if v_pid is not null then
        insert into public.licenses
          (global_identity_id, product_id, app_type, source_client_id, outlet_ref,
           plan, max_devices, status, current_serial, tx_month, tx_used)
        select p_gid, v_pid, r.app_type, r.id, r.unit_id,
               'single', 1, 'active', r.license_serial, r.tx_month,
               coalesce(r.tx_used, 0)
         where not exists (
               select 1 from public.licenses where source_client_id = r.id);

        update public.licenses l
           set global_identity_id = coalesce(l.global_identity_id, p_gid),
               current_serial     = r.license_serial,
               status             = 'active',
               updated_at         = now()
         where l.source_client_id = r.id;

        v_lic := v_lic + 1;
      end if;
    end if;
  end loop;

  return jsonb_build_object('ok', true, 'gid', p_gid,
    'clients_linked', v_linked, 'licenses_attached', v_lic);
end;
$$;

-- ----------------------------------------------------------------------------
-- 5) account_my_profile — profil akun untuk sesi login (authenticated)
-- ----------------------------------------------------------------------------
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
begin
  if v_gid is null then
    return jsonb_build_object('ok', false, 'code', 'not_signed_in');
  end if;

  select * into v_gi from public.global_identities where id = v_gid;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'identity_not_found');
  end if;

  select * into v_p
    from public.referral_partners
   where global_identity_id = v_gid
      or public.partner_norm_wa(no_whatsapp) = v_gi.phone_e164
   order by (global_identity_id = v_gid) desc, created_at asc
   limit 1;

  select count(*)::int into v_lic
    from public.licenses where global_identity_id = v_gid;

  return jsonb_build_object(
    'ok', true,
    'gid', v_gi.id,
    'nama', v_gi.display_name,
    'wa', v_gi.phone_e164,
    'status', v_gi.status,
    'phone_verified', (v_gi.phone_verified_at is not null),
    'created_at', v_gi.created_at,
    'license_count', v_lic,
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
-- 6) account_become_partner — opt-in mitra dari sesi (authenticated)
-- ----------------------------------------------------------------------------
-- Logika = partner_register (migration-identity-global-fase-a1.sql:96-257),
-- tetapi identitas diambil dari SESI (gid), bukan parameter WA bebas.
-- Token portal TIDAK dikembalikan: akun login tidak need token (token = jalur
-- lama). Kalau mitra mau token (mis. buka portal dari HP lain), admin tetap
-- bisa menerbitkan lewat Control (partnerIssueToken).
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
  v_gid     text := public.current_global_identity_id();
  v_gi      public.global_identities%rowtype;
  v_nama    text;
  v_wa      text;
  v_code    text;
  v_partner public.referral_partners%rowtype;
  v_new_count integer := 0;
  v_cfg     jsonb := '{}'::jsonb;
  v_discount    numeric := 50000;
  v_min_purchase numeric := 100000;
  v_expire_days integer := 30;
begin
  if v_gid is null then
    return jsonb_build_object('ok', false, 'code', 'not_signed_in',
      'reason', 'masuk ke akun dulu ya');
  end if;

  select * into v_gi from public.global_identities where id = v_gid;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'identity_not_found');
  end if;

  v_wa := v_gi.phone_e164;
  if v_wa like 'unverified:%' then
    return jsonb_build_object('ok', false, 'code', 'no_phone',
      'reason', 'lengkapi nomor WhatsApp dulu');
  end if;

  v_nama := coalesce(nullif(btrim(coalesce(v_gi.display_name, '')), ''), 'Mitra Kasol');

  select coalesce(value, '{}'::jsonb) into v_cfg
  from public.settings where key = 'referral_config';
  v_discount     := coalesce((v_cfg->>'discount_referral')::numeric, 50000);
  v_min_purchase := coalesce((v_cfg->>'min_purchase_for_discount')::numeric, 100000);
  v_expire_days  := coalesce((v_cfg->>'referral_expire_days')::int, 30);

  -- Cari mitra yang sudah ada: lewat gid dulu, lalu nomor WA (data lama).
  select * into v_partner
    from public.referral_partners
   where global_identity_id = v_gid
      or public.partner_norm_wa(no_whatsapp) = v_wa
   order by (global_identity_id = v_gid) desc, created_at asc
   limit 1;

  if found then
    -- Idempoten: sudah aktif → kembalikan data yang ada (tanpa token).
    if v_partner.status = 'aktif' then
      return jsonb_build_object('ok', true, 'already', true,
        'partner_id', v_partner.id, 'code', v_partner.code,
        'status', v_partner.status,
        'kota', v_partner.kota, 'provinsi', v_partner.provinsi);
    end if;
    update public.referral_partners
       set nama = v_nama,
           kota = coalesce(nullif(btrim(coalesce(p_kota, '')), ''), kota),
           provinsi = coalesce(nullif(btrim(coalesce(p_provinsi, '')), ''), provinsi),
           catatan = coalesce(nullif(btrim(coalesce(p_catatan, '')), ''), catatan),
           status = 'aktif',
           approved_at = now(),
           approved_by = 'auto',
           global_identity_id = v_gid,
           updated_at = now()
     where id = v_partner.id
    returning * into v_partner;
    v_code := v_partner.code;
  else
    -- Anti-spam berlaku sama seperti form publik.
    select count(*)::int into v_new_count
      from public.referral_partners
     where created_at > now() - interval '1 hour';
    if v_new_count >= 20 then
      return jsonb_build_object('ok', false, 'code', 'rate_limited',
        'reason', 'ramai banget nih, coba lagi nanti ya');
    end if;

    v_code := public.partner_gen_code();

    insert into public.referral_partners (
      code, nama, no_whatsapp, kota, provinsi,
      catatan, status, tier, registered_via,
      approved_at, approved_by, global_identity_id
    )
    values (
      v_code, v_nama, v_wa,
      nullif(btrim(coalesce(p_kota, '')), ''),
      nullif(btrim(coalesce(p_provinsi, '')), ''),
      nullif(btrim(coalesce(p_catatan, '')), ''),
      'aktif', 'bronze', 'akun', now(), 'auto', v_gid
    )
    returning * into v_partner;
  end if;

  -- Dompet mitra
  insert into public.referral_wallets (partner_id, app_type)
  values (v_partner.id, 'kaki5')
  on conflict (partner_id) do nothing;

  -- Kode referal universal (sama seperti pendaftaran mitra biasa).
  insert into public.license_codes (
    code, kind, app_type, owner_partner_id, created_by, status, expires_at,
    discount_type, discount_value, min_purchase, notes
  )
  values (
    v_code, 'referral', '*', v_partner.id, 'mitra', 'aktif',
    now() + (v_expire_days || ' days')::interval,
    'fixed', v_discount, v_min_purchase, 'Kode referral mitra (universal)'
  )
  on conflict (code) do update
    set owner_partner_id = v_partner.id,
        app_type = '*',
        status = 'aktif',
        updated_at = now();

  return jsonb_build_object(
    'ok', true,
    'already', false,
    'partner_id', v_partner.id,
    'code', v_partner.code,
    'status', 'aktif',
    'kota', v_partner.kota,
    'provinsi', v_partner.provinsi
  );
end;
$$;

-- ----------------------------------------------------------------------------
-- 7) GRANTS — pola revoke eksplisit (Supabase auto-grant ke anon/authenticated)
-- ----------------------------------------------------------------------------
revoke all on function public.account_prepare_identity(text, text)  from public, anon, authenticated;
revoke all on function public.account_bind_auth_user(text, uuid)    from public, anon, authenticated;
revoke all on function public.account_attach_existing_licenses(text) from public, anon, authenticated;
revoke all on function public.account_my_profile()                  from public, anon;
revoke all on function public.account_become_partner(text, text, text) from public, anon;

grant execute on function public.account_prepare_identity(text, text)   to service_role;
grant execute on function public.account_bind_auth_user(text, uuid)     to service_role;
grant execute on function public.account_attach_existing_licenses(text) to service_role;
grant execute on function public.account_my_profile()                   to authenticated, service_role;
grant execute on function public.account_become_partner(text, text, text) to authenticated, service_role;

-- Resolver dipakai RLS: tetap boleh dieksekusi anon/authenticated.
grant execute on function public.current_global_identity_id() to anon, authenticated, service_role;

commit;

-- ============================================================================
-- VERIFIKASI (jalankan manual setelah apply)
-- ============================================================================
-- 1) Fungsi ada + grant benar:
--    select p.proname, pg_get_function_identity_arguments(p.oid) as args,
--           coalesce(array_to_string(p.proacl, ' | '), 'default') as acl
--      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--     where n.nspname = 'public'
--       and p.proname in ('current_global_identity_id','account_prepare_identity',
--                         'account_bind_auth_user','account_attach_existing_licenses',
--                         'account_my_profile','account_become_partner')
--     order by 1;
-- 2) Resolver tidak lagi membaca user_metadata:
--    select pg_get_functiondef('public.current_global_identity_id()'::regprocedure);
-- 3) RLS tetap utuh (akun hanya lihat lisensinya):
--    select l.app_type, l.status, count(*) from public.licenses l
--     where l.global_identity_id = public.current_global_identity_id() group by 1,2;
-- ============================================================================