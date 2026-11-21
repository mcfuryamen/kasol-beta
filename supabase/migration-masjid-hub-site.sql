-- ============================================================
-- Migration: MASJID HUB — Site per Masjid + Domain TLD + Publish via Sesi
-- Tanggal: 2026-11-14
--
-- Keputusan owner (2026-11-14):
--   1. Token publikasi TIDAK lagi ada di perangkat. Publish dicek server-side
--      lewat sesi akun (gid + role 'owner' pada outlet situs).
--   2. 1 masjid = 1 outlet (app_outlets) = 1 masjid_sites (slug).
--   3. Custom domain TLD: host -> slug dipetakan lewat masjid_website_domains;
--      web-masjid resolve lewat RPC masjid_resolve_domain, fallback /m/<slug>.
--
-- Isi:
--   1. Tabel public.masjid_sites            (situs per masjid)
--   2. Tabel public.masjid_website_domains  (domain -> situs, pending/active)
--   3. Kolom binding token di public.masjid_publish_tokens
--   4. RPC:
--      masjid_slugify, masjid_site_role, masjid_my_sites, masjid_ensure_site,
--      masjid_publish_by_account, masjid_draft_by_account,
--      masjid_claim_domain, masjid_verify_domain, masjid_resolve_domain
--
-- Semua fungsi pakai SECURITY DEFINER + set search_path = '' (aturan repo:
-- hak tulis di DB = server saja; nama objek selalu Fully Qualified).
--
-- Terapkan dengan:
--   node supabase/apply-migration.js --ref=hhywrvedlwljawgxzpkq --file=supabase/migration-masjid-hub-site.sql --dry-run
--   node supabase/apply-migration.js --ref=hhywrvedlwljawgxzpkq --file=supabase/migration-masjid-hub-site.sql --apply
--   node supabase/apply-migration.js --ref=hhywrvedlwljawgxzpkq --file=supabase/migration-masjid-hub-site.sql --verify
-- ============================================================

-- ------------------------------------------------------------------
-- 1. Tabel situs (1 masjid = 1 outlet = 1 slug)
-- ------------------------------------------------------------------
create table if not exists public.masjid_sites (
  id                 uuid primary key default gen_random_uuid(),
  outlet_ref         text,
  slug               text not null unique,
  nama               text not null default 'Masjid',
  global_identity_id text,
  status             text not null default 'active',
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint masjid_sites_slug_fmt_ck check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  constraint masjid_sites_status_ck  check (status in ('active','paused'))
);

create index if not exists masjid_sites_outlet_idx on public.masjid_sites (outlet_ref);
create index if not exists masjid_sites_gid_idx    on public.masjid_sites (global_identity_id);

alter table public.masjid_sites enable row level security;
-- Tanpa policy: tabel hanya boleh diakses lewat fungsi SECURITY DEFINER.

-- ------------------------------------------------------------------
-- 2. Tabel domain (custom domain TLD -> situs)
-- ------------------------------------------------------------------
create table if not exists public.masjid_website_domains (
  domain             text primary key,
  site_id            uuid not null references public.masjid_sites(id) on delete cascade,
  status             text not null default 'pending',
  verification_token text not null,
  cname_target       text not null default 'cname.vercel-dns.com',
  verified_at        timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint masjid_dom_status_ck check (status in ('pending','active')),
  constraint masjid_dom_fmt_ck    check (domain ~ '^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$')
);

create index if not exists masjid_domains_site_idx on public.masjid_website_domains (site_id);

alter table public.masjid_website_domains enable row level security;

-- ------------------------------------------------------------------
-- 3. Token publikasi: bind ke situs + akun owner (rotasi/log)
-- ------------------------------------------------------------------
alter table public.masjid_publish_tokens add column if not exists site_id uuid references public.masjid_sites(id) on delete set null;
alter table public.masjid_publish_tokens add column if not exists global_identity_id text;
alter table public.masjid_publish_tokens add column if not exists created_at   timestamptz not null default now();
alter table public.masjid_publish_tokens add column if not exists updated_at   timestamptz not null default now();
alter table public.masjid_publish_tokens add column if not exists last_used_at timestamptz;
alter table public.masjid_publish_tokens add column if not exists revoked_at   timestamptz;

-- ------------------------------------------------------------------
-- 4. Helper: slug aman untuk URL
-- ------------------------------------------------------------------
create or replace function public.masjid_slugify(p_text text)
returns text
language plpgsql
immutable
as $$
declare
  s text;
begin
  s := lower(regexp_replace(coalesce(p_text, ''), '[^a-z0-9]+', '-', 'g'));
  s := trim(both '-' from s);
  if s = '' then
    s := 'masjid';
  end if;
  if length(s) > 48 then
    s := trim(both '-' from left(s, 48));
  end if;
  return s;
end;
$$;

revoke all on function public.masjid_slugify(text) from public;
grant execute on function public.masjid_slugify(text) to anon, authenticated, service_role;

-- ------------------------------------------------------------------
-- 5. Role sesi pada sebuah situs
--    owner  = punya membership role 'owner' di outlet situs, ATAU pembuat situs
--    selain itu = role dari membership (mis. manajer/kasir)
-- ------------------------------------------------------------------
create or replace function public.masjid_site_role(p_site_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_gid  text := public.current_global_identity_id();
  v_role text;
begin
  if v_gid is null then
    return null;
  end if;
  select coalesce(m.role, case when s.global_identity_id = v_gid then 'owner' end)
    into v_role
    from public.masjid_sites s
    left join public.app_memberships m
      on m.app_key = 'masjid'
     and m.status = 'active'
     and m.global_identity_id = v_gid
     and m.outlet_ref = s.outlet_ref
   where s.id = p_site_id
   limit 1;
  return v_role;
end;
$$;

revoke all on function public.masjid_site_role(uuid) from public;
grant execute on function public.masjid_site_role(uuid) to authenticated, service_role;

-- ------------------------------------------------------------------
-- 6. Daftar situs milik sesi (dipakai kartu "Akun & Peran")
-- ------------------------------------------------------------------
create or replace function public.masjid_my_sites()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_gid  text := public.current_global_identity_id();
  v_rows jsonb;
begin
  if v_gid is null then
    return jsonb_build_object('ok', false, 'code', 'not_signed_in');
  end if;

  select coalesce(jsonb_agg(x order by x.created_at), '[]'::jsonb)
    into v_rows
    from (
      select s.id         as site_id,
             s.slug       as slug,
             s.nama       as nama,
             s.status     as status,
             s.outlet_ref as outlet_id,
             s.created_at as created_at,
             coalesce(m.role, case when s.global_identity_id = v_gid then 'owner' end) as role,
             (s.global_identity_id = v_gid) as is_owner,
             (select o.nama from public.app_outlets o where o.id::text = s.outlet_ref) as outlet_nama,
             coalesce((
               select jsonb_agg(jsonb_build_object('domain', d.domain, 'status', d.status) order by d.domain)
                 from public.masjid_website_domains d
                where d.site_id = s.id
             ), '[]'::jsonb) as domains,
             exists (
               select 1 from public.masjid_publish_tokens t
                where t.site_id = s.id and t.revoked_at is null
             ) as has_token
        from public.masjid_sites s
        left join public.app_memberships m
          on m.app_key = 'masjid'
         and m.status = 'active'
         and m.global_identity_id = v_gid
         and m.outlet_ref = s.outlet_ref
       where s.global_identity_id = v_gid
          or m.id is not null
    ) x;

  return jsonb_build_object('ok', true, 'gid', v_gid, 'sites', v_rows);
end;
$$;

revoke all on function public.masjid_my_sites() from public;
grant execute on function public.masjid_my_sites() to authenticated, service_role;

-- ------------------------------------------------------------------
-- 7. Auto-provision situs: outlet + lisensi + membership + site + token
--    Dipanggil klien saat owner membuka modul Website.
--    Idempotent —aman dipanggil berulang.
-- ------------------------------------------------------------------
create or replace function public.masjid_ensure_site(
  p_slug text default null,
  p_nama text default null,
  p_outlet_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_gid         text := public.current_global_identity_id();
  v_outlet      text;
  v_outlet_nama text;
  v_role        text;
  v_site        public.masjid_sites%rowtype;
  v_base        text;
  v_slug        text;
  v_nama        text;
  v_prod        uuid;
  v_cnt         integer := 0;
  v_members     jsonb;
begin
  if v_gid is null then
    return jsonb_build_object('ok', false, 'code', 'not_signed_in');
  end if;

  v_nama := nullif(btrim(coalesce(p_nama, '')), '');

  -- 7.1 Tentukan outlet
  if p_outlet_id is not null then
    select m.outlet_ref, m.role into v_outlet, v_role
      from public.app_memberships m
     where m.global_identity_id = v_gid
       and m.app_key = 'masjid'
       and m.status = 'active'
       and m.outlet_ref = p_outlet_id::text
     limit 1;
    if v_outlet is null then
      return jsonb_build_object('ok', false, 'code', 'invalid_outlet');
    end if;
  else
    select count(*),
           coalesce(jsonb_agg(jsonb_build_object('outlet_id', m.outlet_ref, 'role', m.role)
                              order by m.created_at), '[]'::jsonb)
      into v_cnt, v_members
      from public.app_memberships m
     where m.global_identity_id = v_gid
       and m.app_key = 'masjid'
       and m.status = 'active';
    if v_cnt = 1 then
      select m.outlet_ref, m.role into v_outlet, v_role
        from public.app_memberships m
       where m.global_identity_id = v_gid
         and m.app_key = 'masjid'
         and m.status = 'active'
       limit 1;
    elsif v_cnt > 1 then
      return jsonb_build_object('ok', false, 'code', 'outlet_required', 'outlets', v_members);
    end if;
  end if;

  -- 7.2 Tanpa membership: pakai lisensi akun, atau buat outlet + lisensi baru
  if v_outlet is null then
    select l.outlet_ref into v_outlet
      from public.licenses l
     where l.global_identity_id = v_gid
       and l.app_type = 'masjid'
       and l.outlet_ref is not null
       and l.outlet_ref <> ''
     order by l.created_at
     limit 1;
    if v_outlet is null then
      v_outlet_nama := coalesce(v_nama, 'Masjid Saya');
      insert into public.app_outlets (nama, owner_gid, status)
      values (v_outlet_nama, v_gid, 'active')
      returning id::text into v_outlet;
    end if;
  end if;

  select o.nama into v_outlet_nama
    from public.app_outlets o where o.id::text = v_outlet;

  -- 7.3 Membership owner (kalau belum ada; role existing tidak ditimpa)
  insert into public.app_memberships (global_identity_id, app_key, role, outlet_ref, status)
  values (v_gid, 'masjid', 'owner', v_outlet, 'active')
  on conflict (global_identity_id, app_key, coalesce(outlet_ref, '')) do nothing;

  select m.role into v_role
    from public.app_memberships m
   where m.global_identity_id = v_gid
     and m.app_key = 'masjid'
     and m.status = 'active'
     and m.outlet_ref = v_outlet
   limit 1;

  if v_role is null then
    v_role := 'owner';
  end if;
  if v_role <> 'owner' then
    return jsonb_build_object('ok', false, 'code', 'forbidden', 'role', v_role);
  end if;

  -- 7.4 Lisensi (bila belum ada) supaya kuota & app_my_license tetap berlaku
  if not exists (
    select 1 from public.licenses l
     where l.global_identity_id = v_gid and l.app_type = 'masjid'
  ) then
    select p.id into v_prod
      from public.products p
     where p.app_type = 'masjid' and p.active
     order by p.created_at
     limit 1;
    if v_prod is not null then
      insert into public.licenses
        (global_identity_id, product_id, app_type, outlet_ref, plan, max_devices, status)
      values
        (v_gid, v_prod, 'masjid', v_outlet, 'single',
         (select p.max_devices from public.products p where p.id = v_prod), 'active');
    end if;
  else
    update public.licenses l
       set outlet_ref = v_outlet
     where l.global_identity_id = v_gid
       and l.app_type = 'masjid'
       and (l.outlet_ref is null or l.outlet_ref = '');
  end if;

  -- 7.5 Site
  select * into v_site
    from public.masjid_sites s
   where s.outlet_ref = v_outlet
   limit 1;

  if v_site.id is null then
    v_base := public.masjid_slugify(coalesce(nullif(btrim(coalesce(p_slug, '')), ''), v_outlet_nama));
    v_slug := v_base;
    if exists (select 1 from public.masjid_sites s where s.slug = v_slug) then
      v_slug := v_base || '-' || substr(md5(random()::text || v_gid), 1, 4);
    end if;
    insert into public.masjid_sites (outlet_ref, slug, nama, global_identity_id, status)
    values (v_outlet, v_slug, coalesce(v_nama, v_outlet_nama, 'Masjid'), v_gid, 'active')
    returning * into v_site;
  elsif v_nama is not null and v_nama <> v_site.nama then
    update public.masjid_sites s
       set nama = v_nama, updated_at = now()
     where s.id = v_site.id
    returning * into v_site;
  end if;

  -- 7.6 Token publish situs (dipakai RPC lama & fallback); dibuat otomatis
  insert into public.masjid_publish_tokens (slug, publish_token, site_id, global_identity_id)
  values (
    v_site.slug,
    'ksm_' || md5(random()::text || clock_timestamp()::text || v_gid),
    v_site.id,
    v_gid
  )
  on conflict (slug) do update
    set site_id = excluded.site_id,
        global_identity_id = excluded.global_identity_id,
        revoked_at = null,
        updated_at = now();

  return jsonb_build_object(
    'ok', true,
    'site_id', v_site.id,
    'slug', v_site.slug,
    'nama', v_site.nama,
    'outlet_id', v_outlet,
    'outlet_nama', v_outlet_nama,
    'role', v_role,
    'token_ready', true
  );
end;
$$;

revoke all on function public.masjid_ensure_site(text, text, uuid) from public;
grant execute on function public.masjid_ensure_site(text, text, uuid) to authenticated, service_role;

-- ------------------------------------------------------------------
-- 8. Publish lewat SESI (tanpa token di perangkat)
-- ------------------------------------------------------------------
create or replace function public.masjid_publish_by_account(p_slug text, p_data jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_gid  text := public.current_global_identity_id();
  v_site public.masjid_sites%rowtype;
  v_role text;
  v_tok  text;
begin
  if v_gid is null then
    return jsonb_build_object('ok', false, 'code', 'not_signed_in');
  end if;
  if p_slug is null or length(btrim(p_slug)) = 0 then
    return jsonb_build_object('ok', false, 'code', 'invalid_slug');
  end if;

  select * into v_site
    from public.masjid_sites s
   where s.slug = btrim(p_slug)
   limit 1;
  if v_site.id is null then
    return jsonb_build_object('ok', false, 'code', 'site_not_found');
  end if;

  v_role := public.masjid_site_role(v_site.id);
  if v_role is distinct from 'owner' then
    return jsonb_build_object('ok', false, 'code', 'forbidden', 'role', v_role);
  end if;

  select t.publish_token into v_tok
    from public.masjid_publish_tokens t
   where t.slug = v_site.slug and t.revoked_at is null
   limit 1;
  if v_tok is null then
    v_tok := 'ksm_' || md5(random()::text || clock_timestamp()::text || v_gid);
    insert into public.masjid_publish_tokens (slug, publish_token, site_id, global_identity_id)
    values (v_site.slug, v_tok, v_site.id, v_gid)
    on conflict (slug) do update
      set site_id = excluded.site_id,
          global_identity_id = excluded.global_identity_id,
          revoked_at = null,
          updated_at = now();
  end if;

  insert into public.masjid_website (slug, data, published_at, updated_at)
  values (v_site.slug, coalesce(p_data, '{}'::jsonb), now(), now())
  on conflict (slug) do update
    set data = excluded.data,
        published_at = now(),
        updated_at = now();

  update public.masjid_publish_tokens t
     set last_used_at = now(),
         updated_at = now()
   where t.slug = v_site.slug;

  return jsonb_build_object('ok', true, 'slug', v_site.slug, 'published_at', now());
end;
$$;

revoke all on function public.masjid_publish_by_account(text, jsonb) from public;
grant execute on function public.masjid_publish_by_account(text, jsonb) to authenticated, service_role;

-- ------------------------------------------------------------------
-- 9. Draft lewat SESI (menyimpan draf, live tidak berubah)
-- ------------------------------------------------------------------
create or replace function public.masjid_draft_by_account(p_slug text, p_data jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_gid  text := public.current_global_identity_id();
  v_site public.masjid_sites%rowtype;
  v_role text;
begin
  if v_gid is null then
    return jsonb_build_object('ok', false, 'code', 'not_signed_in');
  end if;
  if p_slug is null or length(btrim(p_slug)) = 0 then
    return jsonb_build_object('ok', false, 'code', 'invalid_slug');
  end if;

  select * into v_site
    from public.masjid_sites s
   where s.slug = btrim(p_slug)
   limit 1;
  if v_site.id is null then
    return jsonb_build_object('ok', false, 'code', 'site_not_found');
  end if;

  v_role := public.masjid_site_role(v_site.id);
  if v_role is distinct from 'owner' then
    return jsonb_build_object('ok', false, 'code', 'forbidden', 'role', v_role);
  end if;

  insert into public.masjid_website (slug, data, draft, updated_at)
  values (v_site.slug, '{}'::jsonb, coalesce(p_data, '{}'::jsonb), now())
  on conflict (slug) do update
    set draft = excluded.draft,
        updated_at = now();

  return jsonb_build_object('ok', true, 'slug', v_site.slug, 'draft_at', now());
end;
$$;

revoke all on function public.masjid_draft_by_account(text, jsonb) from public;
grant execute on function public.masjid_draft_by_account(text, jsonb) to authenticated, service_role;

-- ------------------------------------------------------------------
-- 10. Klaim custom domain (owner-only) + token verifikasi DNS
-- ------------------------------------------------------------------
create or replace function public.masjid_claim_domain(p_domain text, p_site_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_gid   text := public.current_global_identity_id();
  v_dom   text;
  v_site  public.masjid_sites%rowtype;
  v_role  text;
  v_tok   text;
  v_other uuid;
  v_cname text;
begin
  if v_gid is null then
    return jsonb_build_object('ok', false, 'code', 'not_signed_in');
  end if;

  v_dom := lower(btrim(coalesce(p_domain, '')));
  v_dom := regexp_replace(v_dom, '^https?://', '', 'i');
  v_dom := split_part(v_dom, '/', 1);
  v_dom := regexp_replace(v_dom, ':[0-9]+$', '');
  v_dom := trim(both '.' from v_dom);

  if v_dom = '' or v_dom !~ '^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$' then
    return jsonb_build_object('ok', false, 'code', 'invalid_domain');
  end if;

  if p_site_id is not null then
    select * into v_site from public.masjid_sites s where s.id = p_site_id limit 1;
  else
    select * into v_site
      from public.masjid_sites s
     where s.global_identity_id = v_gid
     order by s.created_at
     limit 1;
    if v_site.id is null then
      select s.* into v_site
        from public.masjid_sites s
        join public.app_memberships m
          on m.outlet_ref = s.outlet_ref
         and m.app_key = 'masjid'
         and m.status = 'active'
       where m.global_identity_id = v_gid
       limit 1;
    end if;
  end if;
  if v_site.id is null then
    return jsonb_build_object('ok', false, 'code', 'site_not_found');
  end if;

  v_role := public.masjid_site_role(v_site.id);
  if v_role is distinct from 'owner' then
    return jsonb_build_object('ok', false, 'code', 'forbidden', 'role', v_role);
  end if;

  select d.site_id into v_other
    from public.masjid_website_domains d
   where d.domain = v_dom;
  if v_other is not null and v_other <> v_site.id then
    return jsonb_build_object('ok', false, 'code', 'domain_taken');
  end if;

  v_tok := md5(random()::text || clock_timestamp()::text || v_gid);
  insert into public.masjid_website_domains (domain, site_id, status, verification_token)
  values (v_dom, v_site.id, 'pending', v_tok)
  on conflict (domain) do update
    set site_id = excluded.site_id,
        status = 'pending',
        verification_token = excluded.verification_token,
        verified_at = null,
        updated_at = now();

  select d.cname_target into v_cname
    from public.masjid_website_domains d
   where d.domain = v_dom;

  return jsonb_build_object(
    'ok', true,
    'domain', v_dom,
    'site_id', v_site.id,
    'slug', v_site.slug,
    'status', 'pending',
    'verification_token', v_tok,
    'dns', jsonb_build_object(
      'cname_target', v_cname,
      'txt_name', '_vercel',
      'txt_value', 'vc-domain-verify=' || v_tok,
      'a_record', '76.76.21.21',
      'catatan', 'Di registrar: CNAME @ -> ' || v_cname
                 || ' dan TXT @ -> vc-domain-verify=' || v_tok
                 || ' (atau A @ -> 76.76.21.21). Lalu tekan "Cek Verifikasi".'
    )
  );
end;
$$;

revoke all on function public.masjid_claim_domain(text, uuid) from public;
grant execute on function public.masjid_claim_domain(text, uuid) to authenticated, service_role;

-- ------------------------------------------------------------------
-- 11. Verifikasi domain (owner-only) -> status active
-- ------------------------------------------------------------------
create or replace function public.masjid_verify_domain(p_domain text, p_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_gid   text := public.current_global_identity_id();
  v_dom   text;
  v_site  public.masjid_sites%rowtype;
  v_role  text;
  v_tok   text;
begin
  if v_gid is null then
    return jsonb_build_object('ok', false, 'code', 'not_signed_in');
  end if;

  v_dom := lower(btrim(coalesce(p_domain, '')));
  v_dom := regexp_replace(v_dom, '^https?://', '', 'i');
  v_dom := split_part(v_dom, '/', 1);
  v_dom := regexp_replace(v_dom, ':[0-9]+$', '');
  v_dom := trim(both '.' from v_dom);

  select d.site_id, d.verification_token into v_site.id, v_tok
    from public.masjid_website_domains d
   where d.domain = v_dom;
  if v_site.id is null then
    return jsonb_build_object('ok', false, 'code', 'domain_not_found');
  end if;
  if v_tok is distinct from btrim(coalesce(p_token, '')) then
    return jsonb_build_object('ok', false, 'code', 'invalid_token');
  end if;

  select * into v_site from public.masjid_sites s where s.id = v_site.id limit 1;
  v_role := public.masjid_site_role(v_site.id);
  if v_role is distinct from 'owner' then
    return jsonb_build_object('ok', false, 'code', 'forbidden', 'role', v_role);
  end if;

  update public.masjid_website_domains d
     set status = 'active', verified_at = now(), updated_at = now()
   where d.domain = v_dom;

  return jsonb_build_object('ok', true, 'domain', v_dom, 'status', 'active', 'slug', v_site.slug);
end;
$$;

revoke all on function public.masjid_verify_domain(text, text) from public;
grant execute on function public.masjid_verify_domain(text, text) to authenticated, service_role;

-- ------------------------------------------------------------------
-- 12. Resolusi host -> slug (dipakai web-masjid, boleh anon)
-- ------------------------------------------------------------------
create or replace function public.masjid_resolve_domain(p_domain text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_dom text;
  v_row record;
begin
  v_dom := lower(btrim(coalesce(p_domain, '')));
  v_dom := regexp_replace(v_dom, '^https?://', '', 'i');
  v_dom := regexp_replace(v_dom, '/.*$', '');
  v_dom := regexp_replace(v_dom, ':[0-9]+$', '');
  v_dom := trim(both '.' from v_dom);

  select d.domain, d.status, s.slug, s.nama, s.id as site_id
    into v_row
    from public.masjid_website_domains d
    join public.masjid_sites s on s.id = d.site_id
   where d.domain = v_dom
     and d.status = 'active';

  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;

  return jsonb_build_object(
    'ok', true,
    'domain', v_row.domain,
    'slug', v_row.slug,
    'nama', v_row.nama,
    'site_id', v_row.site_id
  );
end;
$$;

revoke all on function public.masjid_resolve_domain(text) from public;
grant execute on function public.masjid_resolve_domain(text) to anon, authenticated, service_role;
