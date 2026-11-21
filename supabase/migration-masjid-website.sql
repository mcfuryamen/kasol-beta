-- ============================================================
-- Migration: Website Masjid (publikasi dari admin adm-masjid)
-- Tanggal: 2026-11-06
--
-- Alur:
--   Admin (adm-masjid) -> RPC masjid_publish(slug, token, data)
--   Website (web-masjid) -> SELECT masjid_website WHERE slug = 'masjid'
--
-- Terapkan dengan:
--   node supabase/apply-migration.js --ref=hhywrvedlwljawgxzpkq --file=supabase/migration-masjid-website.sql --dry-run
--   node supabase/apply-migration.js --ref=hhywrvedlwljawgxzpkq --file=supabase/migration-masjid-website.sql --apply
--   node supabase/apply-migration.js --ref=hhywrvedlwljawgxzpkq --file=supabase/migration-masjid-website.sql --verify
-- ============================================================

-- 1. Tabel data website (dibaca publik)
create table if not exists public.masjid_website (
  slug text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.masjid_website enable row level security;

drop policy if exists "publik boleh baca website" on public.masjid_website;
create policy "publik boleh baca website"
  on public.masjid_website
  for select
  to anon, authenticated
  using (true);

-- 2. Tabel token publikasi (tidak bisa dibaca publik)
-- Tanpa FK ke masjid_website: token didaftarkan lebih dulu,
-- row website baru dibuat otomatis oleh RPC saat publish pertama.
create table if not exists public.masjid_publish_tokens (
  slug text primary key,
  publish_token text not null
);

alter table public.masjid_publish_tokens enable row level security;
-- Sengaja tanpa policy: anon/authenticated tidak bisa SELECT/INSERT/UPDATE/DELETE.
-- Hanya fungsi SECURITY DEFINER di bawah yang mengakses tabel ini.

-- 3. Fungsi publikasi (dipanggil admin dengan token)
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

  insert into public.masjid_website (slug, data, updated_at)
  values (trim(p_slug), p_data, now())
  on conflict (slug) do update
    set data = excluded.data,
        updated_at = now();

  return true;
end;
$$;

revoke all on function public.masjid_publish(text, text, jsonb) from public;
grant execute on function public.masjid_publish(text, text, jsonb) to anon, authenticated;

-- 4. Token default untuk slug 'masjid' (GANTI ksm_c563e3eec7b4a86466f8c429b6c77edd sebelum apply)
insert into public.masjid_publish_tokens (slug, publish_token)
values ('masjid', 'ksm_c563e3eec7b4a86466f8c429b6c77edd')
on conflict (slug) do nothing;
