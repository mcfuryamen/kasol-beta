-- ============================================================================
-- AKUN KASOL — FASE A4: LOGIN APP KLIEN + MULTI-ROLE (kaki5 & lainnya)
-- ============================================================================
-- Tujuan (permintaan pemilik 2026-11-04):
--   kaki5 (dan app klien lain) bisa LOGIN memakai Akun Kasol (WA + PIN) yang
--   sama dengan mitra/HUB, lalu mendapat ROLE per-aplikasi (owner/manajer/kasir).
--
-- Prinsip yang dijaga (docs/HUB-DESIGN-DECISIONS.md §11):
--   · Role = role APLIKASI (bukan global). Membership app lain tidak berlaku.
--   · Lisensi tetap per aplikasi; login TIDAK mengubah validitas lisensi.
--   · App klien tetap standalone/offline-first — login = lapisan expedite.
--   · Identitas diambil dari SESI (current_global_identity_id()), bukan param.
--   · Hak tulis hanya lewat RPC SECURITY DEFINER; klien tidak dapat INSERT/UPDATE.
--
-- RPC baru:
--   app_my_access(p_app_key)               — authenticated: role sesi + daftar app.
--   app_list_members(p_app_key)            — owner-only: daftar pegawai.
--   app_add_member(p_app_key, p_wa, p_role, p_nama) — owner-only: tambah/ubah pegawai.
--   app_set_member_role(p_member_id, p_role)        — owner-only.
--   app_remove_member(p_member_id)                  — owner-only.
--
-- CATATAN: `app_add_member` boleh membuat baris global_identities `pending` bila
-- nomor WA pegawai belum punya akun. Saat pegawai mendaftar lewat /akun,
-- account_prepare_identity() menemukan baris itu (auth_user_id null) dan
-- menautkan sesinya — membership langsung aktif.
--
-- ROLLBACK:
--   drop function if exists public.app_my_access(text);
--   drop function if exists public.app_list_members(text);
--   drop function if exists public.app_add_member(text, text, text, text);
--   drop function if exists public.app_set_member_role(uuid, text);
--   drop function if exists public.app_remove_member(uuid);
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- 1) app_my_access — role milik SESI untuk satu aplikasi (+ auto-provision owner)
-- ----------------------------------------------------------------------------
create or replace function public.app_my_access(p_app_key text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_gid     text := public.current_global_identity_id();
  v_app     text := nullif(btrim(coalesce(p_app_key, '')), '');
  v_member  public.app_memberships%rowtype;
  v_has_lic boolean := false;
  v_nama    text;
  v_wa      text;
  v_apps    jsonb := '[]'::jsonb;
begin
  if v_gid is null then
    return jsonb_build_object('ok', false, 'code', 'not_signed_in');
  end if;
  if v_app is null then
    return jsonb_build_object('ok', false, 'code', 'invalid_app');
  end if;

  select * into v_member
    from public.app_memberships m
   where m.global_identity_id = v_gid
     and m.app_key = v_app
   order by (m.status = 'active') desc, m.created_at asc
   limit 1;

  -- Auto-provision: belum ada membership tapi sesi ini memegang lisensi app tsb
  -- → jadikan owner (pemilik lisensi = pemilik aplikasi).
  if not found then
    select exists (
      select 1 from public.licenses l
       where l.global_identity_id = v_gid and l.app_type = v_app
    ) into v_has_lic;

    if v_has_lic then
      insert into public.app_memberships
        (global_identity_id, app_key, role, outlet_ref, status)
      values (v_gid, v_app, 'owner', null, 'active')
      on conflict (global_identity_id, app_key, coalesce(outlet_ref, ''))
      do update set status = 'active', updated_at = now()
      returning * into v_member;
    end if;
  end if;

  select g.display_name, g.phone_e164 into v_nama, v_wa
    from public.global_identities g where g.id = v_gid;

  select coalesce(jsonb_agg(
           jsonb_build_object('app_key', m.app_key, 'role', m.role, 'status', m.status)
           order by m.app_key), '[]'::jsonb)
    into v_apps
    from public.app_memberships m
   where m.global_identity_id = v_gid;

  if v_member.id is null then
    return jsonb_build_object(
      'ok', true, 'gid', v_gid, 'nama', v_nama, 'wa', v_wa,
      'role', null, 'status', null, 'member_id', null,
      'has_access', false, 'apps', v_apps);
  end if;

  return jsonb_build_object(
    'ok', true, 'gid', v_gid, 'nama', v_nama, 'wa', v_wa,
    'role', v_member.role, 'status', v_member.status, 'member_id', v_member.id,
    'outlet_ref', v_member.outlet_ref,
    'has_access', (v_member.status = 'active'), 'apps', v_apps);
end;
$$;

-- ----------------------------------------------------------------------------
-- 2) app_list_members — daftar pegawai (owner-only, scope outlet yang sama)
-- ----------------------------------------------------------------------------
create or replace function public.app_list_members(p_app_key text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_gid    text := public.current_global_identity_id();
  v_app    text := nullif(btrim(coalesce(p_app_key, '')), '');
  v_role   text;
  v_outlet text;
  v_rows   jsonb := '[]'::jsonb;
begin
  if v_gid is null then
    return jsonb_build_object('ok', false, 'code', 'not_signed_in');
  end if;
  if v_app is null then
    return jsonb_build_object('ok', false, 'code', 'invalid_app');
  end if;

  select m.role, m.outlet_ref into v_role, v_outlet
    from public.app_memberships m
   where m.global_identity_id = v_gid and m.app_key = v_app and m.status = 'active'
   limit 1;
  if v_role is distinct from 'owner' then
    return jsonb_build_object('ok', false, 'code', 'forbidden');
  end if;

  select coalesce(jsonb_agg(
           jsonb_build_object(
             'member_id', m.id,
             'nama', g.display_name,
             'wa', g.phone_e164,
             'role', m.role,
             'status', m.status,
             'is_self', (m.global_identity_id = v_gid)
           ) order by (m.role = 'owner') desc, m.created_at asc), '[]'::jsonb)
    into v_rows
    from public.app_memberships m
    join public.global_identities g on g.id = m.global_identity_id
   where m.app_key = v_app
     and (m.outlet_ref is not distinct from v_outlet);

  return jsonb_build_object('ok', true, 'role', v_role, 'members', v_rows);
end;
$$;

-- ----------------------------------------------------------------------------
-- 3) app_add_member — tambah/ubah pegawai by WA (owner-only)
-- ----------------------------------------------------------------------------
create or replace function public.app_add_member(
  p_app_key text,
  p_wa      text,
  p_role    text,
  p_nama    text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_gid     text := public.current_global_identity_id();
  v_app     text := nullif(btrim(coalesce(p_app_key, '')), '');
  v_my_role text;
  v_outlet  text;
  v_wa      text;
  v_nama    text;
  v_tgt     text;
  v_m       public.app_memberships%rowtype;
begin
  if v_gid is null then
    return jsonb_build_object('ok', false, 'code', 'not_signed_in');
  end if;
  if v_app is null then
    return jsonb_build_object('ok', false, 'code', 'invalid_app');
  end if;
  if p_role is null or p_role not in ('owner', 'manajer', 'kasir') then
    return jsonb_build_object('ok', false, 'code', 'invalid_role',
      'reason', 'role harus owner, manajer, atau kasir');
  end if;

  select m.role, m.outlet_ref into v_my_role, v_outlet
    from public.app_memberships m
   where m.global_identity_id = v_gid and m.app_key = v_app and m.status = 'active'
   limit 1;
  if v_my_role is distinct from 'owner' then
    return jsonb_build_object('ok', false, 'code', 'forbidden');
  end if;

  v_wa := public.partner_norm_wa(p_wa);
  if v_wa is null or length(v_wa) < 9 or length(v_wa) > 15 then
    return jsonb_build_object('ok', false, 'code', 'invalid_wa',
      'reason', 'nomor WhatsApp tidak valid');
  end if;
  v_nama := nullif(btrim(coalesce(p_nama, '')), '');

  select id into v_tgt from public.global_identities where phone_e164 = v_wa limit 1;
  if v_tgt is null then
    insert into public.global_identities (id, phone_e164, display_name, status)
    values (gen_random_uuid()::text, v_wa, v_nama, 'pending')
    returning id into v_tgt;
  end if;

  if v_tgt = v_gid then
    return jsonb_build_object('ok', false, 'code', 'self',
      'reason', 'nomor sendiri sudah jadi pemilik');
  end if;

  insert into public.app_memberships
    (global_identity_id, app_key, role, outlet_ref, status)
  values (v_tgt, v_app, p_role, v_outlet, 'active')
  on conflict (global_identity_id, app_key, coalesce(outlet_ref, ''))
  do update set role = excluded.role, status = 'active', updated_at = now()
  returning * into v_m;

  return jsonb_build_object('ok', true, 'member_id', v_m.id, 'wa', v_wa,
    'nama', v_nama, 'role', v_m.role);
end;
$$;

-- ----------------------------------------------------------------------------
-- 4) app_set_member_role — ubah role pegawai (owner-only, cegah owner terakhir)
-- ----------------------------------------------------------------------------
create or replace function public.app_set_member_role(
  p_member_id uuid,
  p_role      text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_gid     text := public.current_global_identity_id();
  v_tgt     public.app_memberships%rowtype;
  v_my_role text;
  v_owners  integer;
begin
  if v_gid is null then
    return jsonb_build_object('ok', false, 'code', 'not_signed_in');
  end if;
  if p_role is null or p_role not in ('owner', 'manajer', 'kasir') then
    return jsonb_build_object('ok', false, 'code', 'invalid_role');
  end if;

  select * into v_tgt from public.app_memberships where id = p_member_id;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;

  select m.role into v_my_role
    from public.app_memberships m
   where m.global_identity_id = v_gid and m.app_key = v_tgt.app_key
     and (m.outlet_ref is not distinct from v_tgt.outlet_ref) and m.status = 'active'
   limit 1;
  if v_my_role is distinct from 'owner' then
    return jsonb_build_object('ok', false, 'code', 'forbidden');
  end if;

  if v_tgt.role = 'owner' and p_role <> 'owner' then
    select count(*)::int into v_owners
      from public.app_memberships
     where app_key = v_tgt.app_key
       and (outlet_ref is not distinct from v_tgt.outlet_ref)
       and role = 'owner' and status = 'active';
    if v_owners <= 1 then
      return jsonb_build_object('ok', false, 'code', 'last_owner',
        'reason', 'minimal harus ada satu pemilik aktif');
    end if;
  end if;

  update public.app_memberships set role = p_role, updated_at = now()
   where id = p_member_id;

  return jsonb_build_object('ok', true, 'member_id', p_member_id, 'role', p_role);
end;
$$;

-- ----------------------------------------------------------------------------
-- 5) app_remove_member — hapus pegawai (owner-only, cegah owner terakhir)
-- ----------------------------------------------------------------------------
create or replace function public.app_remove_member(p_member_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_gid     text := public.current_global_identity_id();
  v_tgt     public.app_memberships%rowtype;
  v_my_role text;
  v_owners  integer;
begin
  if v_gid is null then
    return jsonb_build_object('ok', false, 'code', 'not_signed_in');
  end if;

  select * into v_tgt from public.app_memberships where id = p_member_id;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;

  select m.role into v_my_role
    from public.app_memberships m
   where m.global_identity_id = v_gid and m.app_key = v_tgt.app_key
     and (m.outlet_ref is not distinct from v_tgt.outlet_ref) and m.status = 'active'
   limit 1;
  if v_my_role is distinct from 'owner' then
    return jsonb_build_object('ok', false, 'code', 'forbidden');
  end if;

  if v_tgt.role = 'owner' then
    select count(*)::int into v_owners
      from public.app_memberships
     where app_key = v_tgt.app_key
       and (outlet_ref is not distinct from v_tgt.outlet_ref)
       and role = 'owner' and status = 'active';
    if v_owners <= 1 then
      return jsonb_build_object('ok', false, 'code', 'last_owner',
        'reason', 'minimal harus ada satu pemilik aktif');
    end if;
  end if;

  delete from public.app_memberships where id = p_member_id;

  return jsonb_build_object('ok', true, 'member_id', p_member_id);
end;
$$;

-- ----------------------------------------------------------------------------
-- 6) GRANTS — hanya sesi login (authenticated). anon tidak boleh.
-- ----------------------------------------------------------------------------
revoke all on function public.app_my_access(text) from public, anon;
revoke all on function public.app_list_members(text) from public, anon;
revoke all on function public.app_add_member(text, text, text, text) from public, anon;
revoke all on function public.app_set_member_role(uuid, text) from public, anon;
revoke all on function public.app_remove_member(uuid) from public, anon;

grant execute on function public.app_my_access(text) to authenticated, service_role;
grant execute on function public.app_list_members(text) to authenticated, service_role;
grant execute on function public.app_add_member(text, text, text, text) to authenticated, service_role;
grant execute on function public.app_set_member_role(uuid, text) to authenticated, service_role;
grant execute on function public.app_remove_member(uuid) to authenticated, service_role;

commit;