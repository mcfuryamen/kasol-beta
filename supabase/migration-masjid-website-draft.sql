-- ============================================================
-- Migration: Mini-CMS Website Masjid (draft + published_at)
-- Tanggal: 2026-11-07
--
-- Menambah:
--   1. Kolom draft jsonb  : konten draf (belum tayang) untuk mode preview
--   2. Kolom published_at : waktu publikasi terakhir
--   3. RPC masjid_draft   : simpan draft tanpa mempublikasi (validasi token)
--   4. masjid_publish     : kini juga mencatat published_at = now()
--
-- Terapkan dengan:
--   node supabase/apply-migration.js --ref=hhywrvedlwljawgxzpkq --file=supabase/migration-masjid-website-draft.sql --dry-run
--   node supabase/apply-migration.js --ref=hhywrvedlwljawgxzpkq --file=supabase/migration-masjid-website-draft.sql --apply
--   node supabase/apply-migration.js --ref=hhywrvedlwljawgxzpkq --file=supabase/migration-masjid-website-draft.sql --verify
-- ============================================================

-- 1. Kolom baru
alter table public.masjid_website add column if not exists draft jsonb;
alter table public.masjid_website add column if not exists published_at timestamptz;

-- 2. RPC simpan draft (tidak mengubah data live)
create or replace function public.masjid_draft(
  p_slug text,
  p_token text,
  p_data jsonb
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_slug is null or length(trim(p_slug)) = 0 then
    return false;
  end if;
  if p_token is null or length(trim(p_token)) = 0 then
    return false;
  end if;

  if not exists (
    select 1 from public.masjid_publish_tokens
    where slug = trim(p_slug) and publish_token = trim(p_token)
  ) then
    return false;
  end if;

  insert into public.masjid_website (slug, data, draft, updated_at)
  values (trim(p_slug), '{}'::jsonb, p_data, now())
  on conflict (slug) do update
    set draft = excluded.draft,
        updated_at = now();

  return true;
end;
$$;

revoke all on function public.masjid_draft(text, text, jsonb) from public;
grant execute on function public.masjid_draft(text, text, jsonb) to anon, authenticated;

-- 3. masjid_publish: catat waktu publikasi
create or replace function public.masjid_publish(
  p_slug text,
  p_token text,
  p_data jsonb
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_slug is null or length(trim(p_slug)) = 0 then
    return false;
  end if;
  if p_token is null or length(trim(p_token)) = 0 then
    return false;
  end if;

  if not exists (
    select 1 from public.masjid_publish_tokens
    where slug = trim(p_slug) and publish_token = trim(p_token)
  ) then
    return false;
  end if;

  insert into public.masjid_website (slug, data, published_at, updated_at)
  values (trim(p_slug), p_data, now(), now())
  on conflict (slug) do update
    set data = excluded.data,
        published_at = now(),
        updated_at = now();

  return true;
end;
$$;

revoke all on function public.masjid_publish(text, text, jsonb) from public;
grant execute on function public.masjid_publish(text, text, jsonb) to anon, authenticated;
