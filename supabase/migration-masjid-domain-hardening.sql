-- ============================================================
-- HARDENING KLAIM DOMAIN MASJID (F1, F2, F3)
-- ============================================================
-- Tanggal : 15 November 2026
-- Target  : project Supabase hhywrvedlwljawgxzpkq
-- Dasar   : audit fungsi Claim Domain (14 skenario tes live)
--
-- F1 — DENYLIST DOMAIN PLATFORM
--   Sebelumnya domain apa pun bisa diklaim owner, termasuk host
--   platform kita sendiri (*.vercel.app). Setelah diverifikasi,
--   masjid_resolve_domain() mengembalikan slug pelapor untuk host
--   beta kita → website publik bisa di-shadow masjid lain.
--   Perbaikan: tabel masjid_reserved_domains + helper
--   masjid_domain_is_reserved(); dicek di claim/verify/resolve
--   + CHECK constraint di tabel domain (suffix vercel).
--
-- F2 — KLAIM ULANG DOMAIN YANG SUDAH AKTIF
--   Sebelumnya klaim ulang otomatis menurunkan status 'active'
--   → 'pending' + rotasi token, sehingga website pada domain itu
--   langsung berhenti resolve sampai owner menekan "Cek Verifikasi"
--   lagi (dunia lokal: tidak ada pemulihan otomatis).
--   Perbaikan: claim_domain() menolak dengan kode 'domain_already_active'
--   (tidak mengubah data), dan ada RPC baru masjid_reclaim_domain()
--   yang dipakai klien SETELAH owner mengonfirmasi.
--
-- F3 — GRANT EXECUTE ROLE anon
--   Akar masalah: default privileges Supabase untuk fungsi yang dibuat
--   role 'postgres' memberi EXECUTE ke anon + authenticated + service_role.
--   `revoke ... from public` TIDAK menghapus grant eksplisit ke anon.
--   Akibatnya masjid_claim_domain / verify_domain / site_role bisa
--   dipanggil anon (aman karena cek gid null, tapi tidak perlu).
--   Perbaikan: revoke eksplisit per fungsi (public + anon); default
--   privileges dibetulkan (global, tanpa PUBLIC) agar fungsi baru tidak
--   otomatis terbuka ke anon — WAJIB grant eksplisit bila memang perlu.
--
--   YANG SENGAJA TETAP anon:
--     - masjid_resolve_domain  → dipakai website publik (anon key)
--     - masjid_publish / masjid_draft (token) → backward-compat untuk
--       build admin lama (v1.3.x) yang masih publish via token+anon key
--
-- CARA JALANKAN:
--   node supabase/apply-migration.js --ref=hhywrvedlwljawgxzpkq \
--        --file=supabase/migration-masjid-domain-hardening.sql --dry-run
--   node supabase/apply-migration.js --ref=hhywrvedlwljawgxzpkq \
--        --file=supabase/migration-masjid-domain-hardening.sql --apply
--
-- ROLLBACK (bersih):
--   drop function if exists public.masjid_reclaim_domain(text);
--   drop function if exists public.masjid_domain_is_reserved(text);
--   drop table if exists public.masjid_reserved_domains;
--   alter table public.masjid_website_domains
--     drop constraint if exists masjid_dom_reserved_suffix_ck;
--   alter default privileges for role postgres in schema public
--     grant execute on functions to anon;
--   alter default privileges for role postgres
--     grant execute on functions to public, anon, authenticated, service_role;
--   (fungsi claim/verify/resolve tetap perlu di-restore dari
--    migration-masjid-hub-site.sql — versi lama ada di git history)
-- ============================================================

-- ------------------------------------------------------------------
-- 1) Tabel host terlarang (exact host, mudah ditambah operasional)
-- ------------------------------------------------------------------
create table if not exists public.masjid_reserved_domains (
  domain     text primary key,
  note       text,
  created_at timestamptz not null default now(),
  constraint masjid_reserved_fmt_ck
    check (domain ~ '^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$')
);

alter table public.masjid_reserved_domains enable row level security;
-- Tanpa policy: hanya bisa diakses lewat fungsi SECURITY DEFINER.

insert into public.masjid_reserved_domains (domain, note) values
  ('web-masjid-beta.vercel.app', 'Host platform website (Vercel)'),
  ('adm-masjid-beta.vercel.app', 'Host platform admin (Vercel)'),
  ('vercel.app',                'Milik Vercel'),
  ('vercel-dns.com',            'Milik Vercel (target CNAME)')
on conflict (domain) do update set note = excluded.note;

-- ------------------------------------------------------------------
-- 2) Helper: apakah domain termasuk terlarang?
--    - suffix .vercel.app / .vercel-dns.com
--    - ada di tabel masjid_reserved_domains
-- ------------------------------------------------------------------
create or replace function public.masjid_domain_is_reserved(p_domain text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
       lower(btrim(coalesce(p_domain, ''))) = 'vercel.app'
    or lower(btrim(coalesce(p_domain, ''))) like '%.vercel.app'
    or lower(btrim(coalesce(p_domain, ''))) = 'vercel-dns.com'
    or lower(btrim(coalesce(p_domain, ''))) like '%.vercel-dns.com'
    or exists (
         select 1
           from public.masjid_reserved_domains r
          where r.domain = lower(btrim(coalesce(p_domain, '')))
       );
$$;

revoke all on function public.masjid_domain_is_reserved(text) from public, anon, authenticated;
grant execute on function public.masjid_domain_is_reserved(text) to service_role;

-- ------------------------------------------------------------------
-- 3) CHECK constraint: domain terlarang suffix tidak boleh masuk tabel
--    (menutup jalur insert di luar RPC)
-- ------------------------------------------------------------------
alter table public.masjid_website_domains
  drop constraint if exists masjid_dom_reserved_suffix_ck;

alter table public.masjid_website_domains
  add constraint masjid_dom_reserved_suffix_ck
  check (domain !~ '(^|\.)vercel\.app$' and domain !~ '(^|\.)vercel-dns\.com$');

-- ------------------------------------------------------------------
-- 4) Klaim domain — F1 (reserved) + F2 (guard domain aktif)
-- ------------------------------------------------------------------
create or replace function public.masjid_claim_domain(p_domain text, p_site_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_gid    text := public.current_global_identity_id();
  v_dom    text;
  v_site   public.masjid_sites%rowtype;
  v_role   text;
  v_tok    text;
  v_other  uuid;
  v_status text;
  v_cname  text;
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

  -- F1: host platform/terlarang tidak boleh diklaim.
  if public.masjid_domain_is_reserved(v_dom) then
    return jsonb_build_object('ok', false, 'code', 'domain_reserved', 'domain', v_dom);
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

  select d.site_id, d.status into v_other, v_status
    from public.masjid_website_domains d
   where d.domain = v_dom;
  if v_other is not null and v_other <> v_site.id then
    return jsonb_build_object('ok', false, 'code', 'domain_taken');
  end if;

  -- F2: domain milik masjid ini yang SUDAH AKTIF → jangan diturunkan diam-diam.
  -- Minta konfirmasi eksplisit lewat RPC masjid_reclaim_domain().
  if v_other is not null and v_other = v_site.id and v_status = 'active' then
    return jsonb_build_object(
      'ok', false, 'code', 'domain_already_active',
      'domain', v_dom, 'site_id', v_site.id, 'slug', v_site.slug,
      'message', 'Domain ini sudah aktif. Klaim ulang akan membatalkan status aktif dan meminta verifikasi ulang.'
    );
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

revoke all on function public.masjid_claim_domain(text, uuid) from public, anon;
grant execute on function public.masjid_claim_domain(text, uuid) to authenticated, service_role;

-- ------------------------------------------------------------------
-- 5) Re-klaim domain AKTIF (dipanggil setelah owner mengonfirmasi)
--    Set status kembali 'pending' + token baru, lalu owner verifikasi ulang.
-- ------------------------------------------------------------------
create or replace function public.masjid_reclaim_domain(p_domain text)
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

  if public.masjid_domain_is_reserved(v_dom) then
    return jsonb_build_object('ok', false, 'code', 'domain_reserved', 'domain', v_dom);
  end if;

  select d.site_id, d.cname_target into v_site.id, v_cname
    from public.masjid_website_domains d
   where d.domain = v_dom;
  if v_site.id is null then
    return jsonb_build_object('ok', false, 'code', 'domain_not_found');
  end if;

  select * into v_site from public.masjid_sites s where s.id = v_site.id limit 1;

  v_role := public.masjid_site_role(v_site.id);
  if v_role is distinct from 'owner' then
    return jsonb_build_object('ok', false, 'code', 'forbidden', 'role', v_role);
  end if;

  v_tok := md5(random()::text || clock_timestamp()::text || v_gid);

  update public.masjid_website_domains d
     set status = 'pending',
         verification_token = v_tok,
         verified_at = null,
         updated_at = now()
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
      'catatan', 'Domain diklaim ulang. Status aktif dibatalkan sampai verifikasi ulang selesai. Di registrar: CNAME @ -> ' || v_cname
                 || ' dan TXT @ -> vc-domain-verify=' || v_tok
                 || ' (atau A @ -> 76.76.21.21). Lalu tekan "Cek Verifikasi".'
    )
  );
end;
$$;

revoke all on function public.masjid_reclaim_domain(text) from public, anon;
grant execute on function public.masjid_reclaim_domain(text) to authenticated, service_role;

-- ------------------------------------------------------------------
-- 6) Verifikasi domain — F1 (tolak domain terlarang)
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

  if public.masjid_domain_is_reserved(v_dom) then
    return jsonb_build_object('ok', false, 'code', 'domain_reserved', 'domain', v_dom);
  end if;

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

revoke all on function public.masjid_verify_domain(text, text) from public, anon;
grant execute on function public.masjid_verify_domain(text, text) to authenticated, service_role;

-- ------------------------------------------------------------------
-- 7) Resolve host -> slug — F1: host terlarang tidak pernah di-resolve
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

  if public.masjid_domain_is_reserved(v_dom) then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;

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

-- ------------------------------------------------------------------
-- 8) F3 — rapikan grant EXECUTE untuk fungsi HUB masjid
--    (default privileges Supabase membuka EXECUTE ke anon untuk
--     setiap fungsi baru yang dibuat role postgres)
-- ------------------------------------------------------------------
revoke all on function public.masjid_claim_domain(text, uuid) from anon;
revoke all on function public.masjid_verify_domain(text, text) from anon;
revoke all on function public.masjid_reclaim_domain(text) from anon;
revoke all on function public.masjid_site_role(uuid) from anon;
revoke all on function public.masjid_my_sites() from anon;
revoke all on function public.masjid_ensure_site(text, text, uuid) from anon;
revoke all on function public.masjid_publish_by_account(text, jsonb) from anon;
revoke all on function public.masjid_draft_by_account(text, jsonb) from anon;
revoke all on function public.masjid_slugify(text) from anon;
revoke all on function public.masjid_domain_is_reserved(text) from anon;

-- Fungsi sesi (butuh JWT) → hanya authenticated + service_role
grant execute on function public.masjid_claim_domain(text, uuid) to authenticated, service_role;
grant execute on function public.masjid_verify_domain(text, text) to authenticated, service_role;
grant execute on function public.masjid_reclaim_domain(text) to authenticated, service_role;
grant execute on function public.masjid_site_role(uuid) to authenticated, service_role;
grant execute on function public.masjid_my_sites() to authenticated, service_role;
grant execute on function public.masjid_ensure_site(text, text, uuid) to authenticated, service_role;
grant execute on function public.masjid_publish_by_account(text, jsonb) to authenticated, service_role;
grant execute on function public.masjid_draft_by_account(text, jsonb) to authenticated, service_role;
grant execute on function public.masjid_slugify(text) to authenticated, service_role;

-- Halaman publik & backward-compat tetap boleh anon:
grant execute on function public.masjid_resolve_domain(text) to anon, authenticated, service_role;
grant execute on function public.masjid_publish(text, text, jsonb) to anon, authenticated, service_role;
grant execute on function public.masjid_draft(text, text, jsonb) to anon, authenticated, service_role;

-- Betulkan default privileges: fungsi BARU tidak lagi otomatis terbuka ke anon.
--
-- CATATAN PENTING (hasil uji 15 Nov 2026):
--   PostgreSQL memberi EXECUTE implisit ke role PUBLIC untuk setiap fungsi baru.
--   Entry default ACL per-schema yang dibuat Supabase TIDAK bisa mencabut
--   warisan PUBLIC itu → `revoke ... from anon` saja tidak cukup, fungsi baru
--   tetap bisa dipanggil anon lewat PUBLIC.
--   Yang bekerja: set default GLOBAL (tanpa IN SCHEMA) tanpa PUBLIC, lalu
--   hapus entry per-schema public agar ikut default global.
--
--   Efek samping yang disengaja: fungsi baru di seluruh schema butuh grant
--   eksplisit ke anon bila memang harus bisa dipanggil tanpa login.
--   Konvensi repo: setiap migrasi sudah grant eksplisit per fungsi.
--
--   Entry default milik role 'supabase_admin' tidak bisa diubah dari sini
--   (permission denied) — tidak berpengaruh karena semua migrasi repo ini
--   membuat fungsi sebagai role 'postgres'.
alter default privileges for role postgres
  revoke execute on functions from public;

alter default privileges for role postgres
  grant execute on functions to postgres, authenticated, service_role;

-- hapus entry default per-schema public (jadi ikut default global di atas)
alter default privileges for role postgres in schema public
  revoke execute on functions from postgres, anon, authenticated, service_role;

-- ------------------------------------------------------------------
-- 9) Sanity check: GRANT anon untuk fungsi sesi harus SUDAH tertutup
--    (dicek ulang dari QA eksternal: masjid/_qa/claim-domain.test.sql)
-- ------------------------------------------------------------------
