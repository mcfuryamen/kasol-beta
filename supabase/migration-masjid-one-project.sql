-- ============================================================
-- Migration: model 1-project Vercel untuk modul masjid
-- File: supabase/migration-masjid-one-project.sql
-- Project Supabase: hhywrvedlwljawgxzpkq
--
-- Konteks: satu project Vercel (root directory = masjid/),
--   /adm/     = admin PWA (adm-masjid)
--   /<slug>   = website klien (web-masjid)
-- Saat klien punya domain TLD aktif, /<slug> di host platform
-- harus redirect ke TLD tersebut. Website publik perlu tahu
-- "apakah slug ini punya domain TLD aktif, dan apa domainnya"
-- → RPC baru: masjid_domain_for_slug(p_slug) (dipanggil anon).
--
-- CARA JALANKAN:
--   node supabase/apply-migration.js --ref=hhywrvedlwljawgxzpkq --file=supabase/migration-masjid-one-project.sql --dry-run
--   node supabase/apply-migration.js --ref=hhywrvedlwljawgxzpkq --file=supabase/migration-masjid-one-project.sql --apply
--
-- ROLLBACK (hapus fungsi):
--   drop function if exists public.masjid_domain_for_slug(text);
-- ============================================================

-- ------------------------------------------------------------------
-- RPC: slug -> domain TLD aktif (dipakai web-masjid untuk redirect)
-- ------------------------------------------------------------------
create or replace function public.masjid_domain_for_slug(p_slug text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_slug text;
  v_row record;
begin
  v_slug := lower(btrim(coalesce(p_slug, '')));

  if v_slug = '' or v_slug !~ '^[a-z0-9][a-z0-9-]*$' then
    return jsonb_build_object('ok', false, 'code', 'invalid_slug');
  end if;

  select d.domain, s.slug, s.nama, s.id as site_id
    into v_row
    from public.masjid_website_domains d
    join public.masjid_sites s on s.id = d.site_id
   where s.slug = v_slug
     and d.status = 'active'
   order by d.verified_at desc nulls last, d.domain
   limit 1;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'no_active_domain', 'slug', v_slug);
  end if;

  return jsonb_build_object(
    'ok', true,
    'slug', v_row.slug,
    'domain', v_row.domain,
    'nama', v_row.nama,
    'site_id', v_row.site_id
  );
end;
$$;

-- F3: default privileges sudah di-hardening (fungsi baru tidak otomatis
-- bisa dipanggil anon) → grant eksplisit WAJIB karena fungsi ini memang
-- untuk halaman publik (anon key di web-masjid).
revoke all on function public.masjid_domain_for_slug(text) from public;
grant execute on function public.masjid_domain_for_slug(text) to anon, authenticated, service_role;
