-- =============================================================================
-- HARDENING P2 — Cabut grant anon pada tabel yang memang TIDAK punya akses anon
-- =============================================================================
-- Tanggal : 20 November 2026
-- Project : hhywrvedlwljawgxzpkq
-- Sesi    : audit koneksi data 4 app kasol (lanjutan P0/P1)
--
-- LATAR
--   Audit menemukan 40+ tabel `public` masih memberi grant 7 privilege ke `anon`.
--   Hampir semuanya tidak berbahaya karena RLS aktif, TAPI separuh di antaranya
--   adalah grant "mati": tabelnya punya RLS aktif tanpa satu pun policy untuk
--   `anon`/`public`, jadi anon memang selalu ditolak RLS — grant-nya hanya
--   menambah permukaan serangan (mis. kalau suatu hari RLS dimatikan karena
--   keperluan migrasi, tabel langsung terbuka).
--
--   Grant mati itu yang dicabut di sini. Tabel yang PUNYA policy anon (mis.
--   `masjid_website` untuk website publik, `clients`/`products`/`settings` untuk
--   app klien versi lama yang memakai anon key langsung) TIDAK disentuh.
--
-- CARA KERJA
--   DO-block: untuk setiap tabel `public` yang RLS-nya aktif, punya 0 policy
--   untuk role anon/public, dan masih memberi privilege apa pun ke `anon`
--   → `revoke all on table ... from anon`. `authenticated` dan `service_role`
--   tidak diubah. Idempoten (aman dijalankan ulang).
--
--   Tambahan eksplisit (punya policy anon, tapi datanya bagian marketing dan
--   TIDAK pernah dibaca app klien mana pun — hanya `agent/*.mjs` & script
--   Control yang memakai service_role):
--     - wa_prospects
--     - wa_broadcast_log
--   Grant-nya dicabut dari anon; policy-nya dibiarkan (tidak merusak apa pun,
--   service_role tidak terpengaruh RLS).
--
--   SENGAJA DIBIARKAN (jangan dicabut tanpa mengubah app-nya dulu):
--     - masjid_website            → dibaca web-masjid dengan anon key
--     - clients, settings, sync_errors, site_content → app klien versi lama
--       memakai anon key langsung ke tabel.
--     - products → tidak disentuh oleh blok dinamis karena ada policy anon;
--       SELECT hanya diberikan per kolom (tanpa `salt`) sejak hardening 2026-09-14.
--     - RPC `code_apply_discount` → direncanakan dipanggil app klien saat kode
--       diskon dipasang (Fase 3); guard-nya sudah aman. Tetap anon.
--
-- ROLLBACK (kalau ada yang ternyata butuh anon):
--   grant select, insert, update, delete on table public.<nama> to anon;
--   (grant per privilege lebih baik daripada ALL jika hanya SELECT yang perlu)
--
-- VERIFIKASI (jalankan setelah apply):
--   select c.relname,
--          has_table_privilege('anon', c.oid, 'SELECT') as anon_sel,
--          (select count(*) from pg_policy p, unnest(p.polroles) r
--            where p.polrelid = c.oid
--              and (r = 0 or pg_get_userbyid(r) in ('anon','public'))) as policy_anon
--     from pg_class c join pg_namespace n on n.oid = c.relnamespace
--    where n.nspname = 'public' and c.relkind = 'r'
--    order by anon_sel desc, policy_anon desc, 1;
--   → tidak boleh ada baris dengan anon_sel = true DAN policy_anon = 0
-- =============================================================================

begin;

do $do$
declare
  t       record;
  n_cabut integer := 0;
  daftar  text;
begin
  for t in
    select c.oid, c.relname
      from pg_class c
      join pg_namespace ns on ns.oid = c.relnamespace
     where ns.nspname = 'public'
       and c.relkind = 'r'
       and c.relrowsecurity                       -- RLS aktif
       and not exists (                            -- dan tidak ada policy anon/public
             select 1
               from pg_policy p
               cross join lateral unnest(p.polroles) as r(role_oid)
              where p.polrelid = c.oid
                and (r.role_oid = 0 or pg_get_userbyid(r.role_oid) in ('anon', 'public'))
           )
       and (   has_table_privilege('anon', c.oid, 'SELECT')
            or has_table_privilege('anon', c.oid, 'INSERT')
            or has_table_privilege('anon', c.oid, 'UPDATE')
            or has_table_privilege('anon', c.oid, 'DELETE')
            or has_table_privilege('anon', c.oid, 'TRUNCATE')
            or has_table_privilege('anon', c.oid, 'REFERENCES')
            or has_table_privilege('anon', c.oid, 'TRIGGER'))
     order by c.relname
  loop
    execute format('revoke all on table public.%I from anon', t.relname);
    n_cabut := n_cabut + 1;
    daftar := coalesce(daftar || ', ', '') || t.relname;
  end loop;

  -- dua tabel marketing ini punya policy anon tapi tidak pernah dibaca client
  execute 'revoke all on table public.wa_prospects      from anon';
  execute 'revoke all on table public.wa_broadcast_log  from anon';

  raise notice 'Grant anon dicabut di % tabel: %', n_cabut, daftar;
  raise notice 'Tambahan: wa_prospects, wa_broadcast_log';
end
$do$;

-- ---------------------------------------------------------------------------
-- Verifikasi inline (gagal = rollback otomatis)
-- ---------------------------------------------------------------------------
do $verif$
declare
  sisa integer;
  web_ok boolean;
  fn_ok boolean;
begin
  -- 1. Tidak boleh ada lagi tabel RLS tanpa policy anon yang masih memberi akses anon.
  select count(*) into sisa
    from pg_class c
    join pg_namespace ns on ns.oid = c.relnamespace
   where ns.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity
     and not exists (
           select 1 from pg_policy p
           cross join lateral unnest(p.polroles) as r(role_oid)
            where p.polrelid = c.oid
              and (r.role_oid = 0 or pg_get_userbyid(r.role_oid) in ('anon', 'public'))
         )
     and (   has_table_privilege('anon', c.oid, 'SELECT')
          or has_table_privilege('anon', c.oid, 'INSERT')
          or has_table_privilege('anon', c.oid, 'UPDATE')
          or has_table_privilege('anon', c.oid, 'DELETE')
          or has_table_privilege('anon', c.oid, 'TRUNCATE')
          or has_table_privilege('anon', c.oid, 'REFERENCES')
          or has_table_privilege('anon', c.oid, 'TRIGGER'));
  if sisa > 0 then
    raise exception 'Masih ada % tabel dengan grant anon tanpa policy', sisa;
  end if;

  -- 2. Website publik WAJIB tetap bisa dibaca anon (kalau tidak, website masjid mati).
  select has_table_privilege('anon', 'public.masjid_website', 'SELECT') into web_ok;
  if not web_ok then
    raise exception 'masjid_website kehilangan SELECT anon — website masjid akan mati';
  end if;
  if has_table_privilege('anon', 'public.wa_prospects', 'SELECT') then
    raise exception 'wa_prospects masih bisa dibaca anon';
  end if;

  -- 3. App klien lama tetap bisa baca tabel intinya.
  if not has_table_privilege('anon', 'public.clients', 'SELECT') then
    raise exception 'clients kehilangan SELECT anon — app klien lama akan rusak';
  end if;
  -- products memakai SELECT per-kolom: izin yang dipakai klien lama tetap ada,
  -- sedangkan salt sengaja tidak boleh dibaca browser sejak hardening 2026-09-14.
  if not has_column_privilege('anon', 'public.products', 'tx_quota', 'SELECT') then
    raise exception 'products.tx_quota kehilangan SELECT anon';
  end if;
  if has_column_privilege('anon', 'public.products', 'salt', 'SELECT') then
    raise exception 'products.salt terbuka untuk anon';
  end if;
  if not has_table_privilege('anon', 'public.settings', 'SELECT') then
    raise exception 'settings kehilangan SELECT anon — konfigurasi QRIS/bank app lama rusak';
  end if;
  if not has_table_privilege('anon', 'public.sync_errors', 'INSERT') then
    raise exception 'sync_errors kehilangan INSERT anon — pelaporan error app lama rusak';
  end if;

  -- 4. Sinkron masjid (v1.5.7) tetap tidak bisa disentuh anon.
  if has_table_privilege('anon', 'public.masjid_records', 'SELECT')
     or has_table_privilege('anon', 'public.masjid_website_drafts', 'SELECT') then
    raise exception 'Tabel sinkron masjid terbuka untuk anon';
  end if;

  raise notice 'Verifikasi grant anon: LULUS';
end
$verif$;

commit;