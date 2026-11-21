-- ============================================================================
-- FOTO PROFIL AKUN KASOL — bucket storage + kolom + RPC
-- ----------------------------------------------------------------------------
-- Satu foto profil per akun (WA + PIN universal), dipakai lintas aplikasi:
--   · app mitra  → field "Foto Profil" di kartu Data Diri (/akun)
--   · adm-masjid → tombol akun di header (foto bulat)
--
-- PENYIMPANAN
--   · Bucket storage `avatars` (public read via URL, folder = auth uid).
--     Public bucket supaya URL foto bisa dipakai <img src> di app manapun
--     tanpa signed URL yang kedaluwarsa. Folder memakai uid acak → URL tidak
--     bisa ditebak, jadi isi bucket tidak bisa di-list oleh anon.
--   · Sumber kebenaran: kolom `global_identities.avatar_url`.
--   · RPC `account_update_avatar` (authenticated) — menulis URL foto.
--   · RPC `account_my_avatar` (authenticated) — membaca URL foto (dipakai
--     adm-masjid yang PWA single-file, tanpa supabase-js).
--   · `account_my_profile` — ditambah key `avatar_url` (dipakai app mitra).
--
-- Upload file dilakukan dari browser (kompres dulu di sisi klien → JPEG
-- maks 512px), lalu URL publiknya dikirim ke RPC di atas.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) KOLOM avatar_url DI global_identities
-- ----------------------------------------------------------------------------
alter table public.global_identities
  add column if not exists avatar_url text;

comment on column public.global_identities.avatar_url is
  'URL publik foto profil akun (bucket storage avatars).';

-- ----------------------------------------------------------------------------
-- 2) BUCKET STORAGE `avatars`
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Folder pertama = uid auth → hanya akun sendiri yang boleh manage fotonya.
drop policy if exists "avatar akun own select" on storage.objects;
create policy "avatar akun own select" on storage.objects
  for select to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "avatar akun own insert" on storage.objects;
create policy "avatar akun own insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "avatar akun own update" on storage.objects;
create policy "avatar akun own update" on storage.objects
  for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "avatar akun own delete" on storage.objects;
create policy "avatar akun own delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- ----------------------------------------------------------------------------
-- 3) RPC account_update_avatar — simpan URL foto profil
--    p_url = null → hapus foto (balikin ke avatar default)
-- ----------------------------------------------------------------------------
create or replace function public.account_update_avatar(p_url text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_gid  text := public.current_global_identity_id();
  v_uid  uuid := auth.uid();
  v_base text := coalesce(
                 nullif(regexp_replace(coalesce(auth.jwt() ->> 'iss', ''), '/auth/v1/?$', ''), ''),
                 'https://hhywrvedlwljawgxzpkq.supabase.co'  -- fallback project ini
               );
  v_ok   boolean := false;
begin
  if v_gid is null or v_uid is null then
    return jsonb_build_object('ok', false, 'code', 'not_signed_in',
      'reason', 'masuk ke akun dulu ya');
  end if;

  if p_url is not null then
    -- Hanya URL bucket `avatars` milik akun ini yang boleh disimpan (anti
    -- penyusupan URL asing / URL javascript:).
    if p_url like v_base || '/storage/v1/object/public/avatars/' || v_uid::text || '/%' then
      v_ok := true;
    end if;
    if not v_ok then
      return jsonb_build_object('ok', false, 'code', 'invalid_url',
        'reason', 'alamat foto tidak valid');
    end if;
  end if;

  update public.global_identities
     set avatar_url = p_url,
         updated_at  = now()
   where id = v_gid;

  return jsonb_build_object('ok', true, 'avatar_url', p_url);
end;
$$;

revoke all on function public.account_update_avatar(text) from public, anon;
grant execute on function public.account_update_avatar(text) to authenticated, service_role;

comment on function public.account_update_avatar(text) is
  'Simpan URL foto profil akun (bucket avatars). p_url null = hapus.';

-- ----------------------------------------------------------------------------
-- 4) RPC account_my_avatar — baca URL foto profil
-- ----------------------------------------------------------------------------
create or replace function public.account_my_avatar()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_gid text := public.current_global_identity_id();
  v_url text;
begin
  if v_gid is null then
    return jsonb_build_object('ok', false, 'code', 'not_signed_in');
  end if;

  select avatar_url into v_url from public.global_identities where id = v_gid;

  return jsonb_build_object('ok', true, 'avatar_url', v_url);
end;
$$;

revoke all on function public.account_my_avatar() from public, anon;
grant execute on function public.account_my_avatar() to authenticated, service_role;

comment on function public.account_my_avatar() is
  'Baca URL foto profil akun sendiri (null = belum ada foto).';

-- ----------------------------------------------------------------------------
-- 5) account_my_profile — tambahkan key avatar_url
--    (body mengikuti versi live: profile + mitra + clients)
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
  v_c   public.clients%rowtype;
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

  select * into v_c
    from public.clients
   where global_identity_id = v_gid
   order by last_seen desc nulls last, created_at desc
   limit 1;

  select count(*)::int into v_lic
    from public.licenses where global_identity_id = v_gid;

  return jsonb_build_object(
    'ok', true,
    'gid', v_gi.id,
    'nama', v_gi.display_name,
    'wa', v_gi.phone_e164,
    'avatar_url', v_gi.avatar_url,
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
    ) end,
    'client', case when v_c.id is null then null else jsonb_build_object(
      'unit_id', v_c.unit_id,
      'app_type', v_c.app_type,
      'nama_usaha', v_c.nama_usaha,
      'nama_pemilik', v_c.nama_pemilik,
      'kabkota', v_c.kabkota,
      'provinsi', v_c.provinsi,
      'kecamatan', v_c.kecamatan,
      'desa', v_c.desa,
      'alamat_detail', v_c.alamat_detail
    ) end
  );
end;
$$;

revoke all on function public.account_my_profile() from public, anon;
grant execute on function public.account_my_profile() to authenticated, service_role;
