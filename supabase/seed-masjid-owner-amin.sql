-- ============================================================
-- Seed: Owner modul Masjid pertama — akun 'amin' (62823251033366)
-- Tanggal: 2026-11-14
--
-- Keputusan owner (2026-11-14): akun amin (…333366) = owner modul masjid pertama.
--
-- Yang dibuat:
--   1. outlet  app_outlets  : 1 masjid = 1 outlet
--   2. lisensi licenses      : produk MASJID, ikut akun (global_identity_id)
--   3. membership            : app_key 'masjid', role 'owner'
--   4. situs  masjid_sites   : slug 'masjid'
--   5. token publish         : di-bind ke situs + akun, dan DIROTASI
--      (token lama ada di file migrasi repo -> dicabut, ini perbaikan kebocoran)
--
-- Idempotent: dijalankan berulang tidak menduplikasi.
-- Jalankan SESUDAH supabase/migration-masjid-hub-site.sql.
--
--   node supabase/apply-migration.js --ref=hhywrvedlwljawgxzpkq --file=supabase/seed-masjid-owner-amin.sql --dry-run
--   node supabase/apply-migration.js --ref=hhywrvedlwljawgxzpkq --file=supabase/seed-masjid-owner-amin.sql --apply
-- ============================================================

do $$
declare
  v_gid    text := '05d7b964-e2c7-4748-bfa8-ac5f78351239'; -- amin / 62823251033366
  v_slug   text := 'masjid';
  v_outlet text;
  v_site   uuid;
  v_prod   uuid;
  v_token  text;
begin
  -- 1. Outlet masjid
  select o.id::text into v_outlet
    from public.app_outlets o
   where o.owner_gid = v_gid and o.nama = 'Masjid'
   limit 1;
  if v_outlet is null then
    insert into public.app_outlets (nama, owner_gid, status)
    values ('Masjid', v_gid, 'active')
    returning id::text into v_outlet;
  end if;

  -- 2. Lisensi MASJID milik akun
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
      values (
        v_gid, v_prod, 'masjid', v_outlet, 'single',
        (select p.max_devices from public.products p where p.id = v_prod),
        'active'
      );
    end if;
  else
    update public.licenses l
       set outlet_ref = v_outlet
     where l.global_identity_id = v_gid
       and l.app_type = 'masjid'
       and (l.outlet_ref is null or l.outlet_ref = '');
  end if;

  -- 3. Membership owner untuk app 'masjid'
  insert into public.app_memberships (global_identity_id, app_key, role, outlet_ref, status)
  values (v_gid, 'masjid', 'owner', v_outlet, 'active')
  on conflict (global_identity_id, app_key, coalesce(outlet_ref, ''))
  do update set status = 'active', updated_at = now();

  -- 4. Situs
  select s.id into v_site
    from public.masjid_sites s
   where s.slug = v_slug
   limit 1;
  if v_site is null then
    insert into public.masjid_sites (outlet_ref, slug, nama, global_identity_id, status)
    values (v_outlet, v_slug, 'Masjid', v_gid, 'active')
    returning id into v_site;
  else
    update public.masjid_sites s
       set outlet_ref = v_outlet,
           global_identity_id = v_gid,
           updated_at = now()
     where s.id = v_site;
  end if;

  -- 5. Token publish: bind ke situs + akun. Rotasi HANYA kalau belum ter-bind
  --    (token lama dari file migrasi repo dicabut sekali saja).
  if exists (
    select 1 from public.masjid_publish_tokens t
     where t.slug = v_slug
       and (t.global_identity_id is distinct from v_gid or t.site_id is distinct from v_site)
  ) then
    v_token := 'ksm_' || md5(random()::text || clock_timestamp()::text || v_gid);
    update public.masjid_publish_tokens t
       set publish_token = v_token,
           site_id = v_site,
           global_identity_id = v_gid,
           revoked_at = null,
           updated_at = now()
     where t.slug = v_slug;
  elsif not exists (
    select 1 from public.masjid_publish_tokens t where t.slug = v_slug
  ) then
    v_token := 'ksm_' || md5(random()::text || clock_timestamp()::text || v_gid);
    insert into public.masjid_publish_tokens (slug, publish_token, site_id, global_identity_id)
    values (v_slug, v_token, v_site, v_gid);
  else
    update public.masjid_publish_tokens t
       set site_id = v_site,
           global_identity_id = v_gid,
           revoked_at = null,
           updated_at = now()
     where t.slug = v_slug;
  end if;
end;
$$;
