-- =============================================================================
-- P1 — ISOLASI DRAFT WEBSITE MASJID dari jalur publik (web-masjid)
-- =============================================================================
-- MASALAH (audit koneksi data 2026-11-20):
--   `masjid_website` punya policy "publik boleh baca website" → USING (true)
--   untuk anon. Kolom `draft` (editorial belum tayang) ikut terbaca siapa pun
--   yang punya anon key publik. Terbukti live:
--     GET /rest/v1/masjid_website?slug=eq.masjid&select=draft  → HTTP 200,
--     mengembalikan draft lengkap (nama masjid, WA, pemasukan/pengeluaran,
--     kegiatan, pengumuman, sambutan) TANPA login.
--   `web-masjid/index.html` juga minta kolom itu, dan `?preview=1` merender
--   draft tanpa otentikasi.
--
-- SOLUSI (bukan revoke kolom):
--   Kolom `draft` DIKOSONGKAN lalu DIKUNCI tidak boleh terisi lagi. Draft
--   dipindah ke tabel terpisah `masjid_website_drafts` yang tidak punya akses
--   anon sama sekali. Kolom `draft` sengaja DIPERTAHANKAN (selalu null) supaya
--   klien web-masjid versi lama yang masih `select=data,draft,published_at`
--   tidak error → ini yang mencegah regresi ke data demo `data-website.json`.
--
--   Preview di sisi admin TIDAK lagi lewat cloud: `adm-masjid` (di /adm/) dan
--   `web-masjid` (di /<slug>) satu origin, jadi admin menitipkan draft preview
--   ke localStorage perangkatnya; web-masjid membacanya hanya saat ?preview=1.
--   Owner tetap bisa menarik draft dari cloud di perangkat lain lewat RPC
--   `masjid_my_draft` (dipakai adm-masjid saat draft lokal masih kosong).
--
-- ROLLBACK (kalau perlu kembali ke model lama):
--   alter table public.masjid_website drop constraint masjid_website_draft_harus_kosong;
--   update public.masjid_website w set draft = d.data
--     from public.masjid_website_drafts d where d.slug = w.slug;
--   drop table public.masjid_website_drafts;
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Tabel draft khusus — RLS aktif, TANPA policy, TANPA grant anon.
-- ---------------------------------------------------------------------------
create table if not exists public.masjid_website_drafts (
  slug       text primary key,
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.masjid_website_drafts enable row level security;
-- Sengaja tidak ada policy sama sekali → anon & authenticated ditolak total
-- (RLS tanpa policy = default deny). Akses hanya lewat RPC SECURITY DEFINER.
revoke all on table public.masjid_website_drafts from public, anon, authenticated;
grant select, insert, update, delete on table public.masjid_website_drafts to service_role;

-- ---------------------------------------------------------------------------
-- 2. Pindahkan isi draft yang sudah ada (idempotent)
-- ---------------------------------------------------------------------------
insert into public.masjid_website_drafts (slug, data, updated_at)
select w.slug, w.draft, coalesce(w.updated_at, now())
  from public.masjid_website w
 where w.draft is not null
   and w.draft <> '{}'::jsonb
on conflict (slug) do update
  set data = excluded.data,
      updated_at = excluded.updated_at;

-- ---------------------------------------------------------------------------
-- 3. Kosongkan kolom draft lama (kolom tetap ada, nilainya selalu null)
-- ---------------------------------------------------------------------------
update public.masjid_website
   set draft = null
 where draft is not null;

-- ---------------------------------------------------------------------------
-- 4. Kunci: kolom draft tidak boleh terisi lagi dari jalur mana pun.
--    Fungsi lama masjid_draft()/jalur token yang masih menulis ke kolom ini
--    akan GAGAL (fail closed), bukan diam-diam membocorkan draft lagi.
-- ---------------------------------------------------------------------------
alter table public.masjid_website drop constraint if exists masjid_website_draft_harus_kosong;
alter table public.masjid_website
  add constraint masjid_website_draft_harus_kosong check (draft is null);

-- ---------------------------------------------------------------------------
-- 5. RPC simpan draft → sekarang menulis ke tabel baru.
--    Tanda tangan, cek peran, dan bentuk balikan SAMA seperti sebelumnya,
--    jadi adm-masjid tidak perlu diubah untuk fungsi ini.
-- ---------------------------------------------------------------------------
create or replace function public.masjid_draft_by_account(p_slug text, p_data jsonb)
 returns jsonb
 language plpgsql
 security definer
 set search_path to ''
as $function$
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

  insert into public.masjid_website_drafts (slug, data, updated_at)
  values (v_site.slug, coalesce(p_data, '{}'::jsonb), now())
  on conflict (slug) do update
    set data = excluded.data,
        updated_at = now();

  return jsonb_build_object('ok', true, 'slug', v_site.slug, 'draft_at', now());
end;
$function$;

revoke all on function public.masjid_draft_by_account(text, jsonb) from public, anon;
grant execute on function public.masjid_draft_by_account(text, jsonb) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 6. RPC baca draft milik sendiri (owner situs) — pengganti aman dari kolom
--    `draft` yang dulu bisa dibaca publik. Dipakai adm-masjid untuk menarik
--    draft dari cloud di perangkat yang belum punya draft lokal.
-- ---------------------------------------------------------------------------
create or replace function public.masjid_my_draft(p_slug text)
 returns jsonb
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  v_gid  text := public.current_global_identity_id();
  v_site public.masjid_sites%rowtype;
  v_role text;
  v_row  public.masjid_website_drafts%rowtype;
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

  select * into v_row
    from public.masjid_website_drafts d
   where d.slug = v_site.slug;

  return jsonb_build_object(
    'ok', true,
    'slug', v_site.slug,
    'data', coalesce(v_row.data, '{}'::jsonb),
    'updated_at', v_row.updated_at,
    'ada', v_row.slug is not null);
end;
$function$;

revoke all on function public.masjid_my_draft(text) from public, anon;
grant execute on function public.masjid_my_draft(text) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 7. Verifikasi inline — gagal = transaksi dibatalkan.
-- ---------------------------------------------------------------------------
do $$
declare
  v_n integer;
  v_leak integer;
begin
  -- (a) tidak boleh ada sisa draft di tabel yang bisa dibaca publik
  select count(*) into v_leak from public.masjid_website where draft is not null;
  if v_leak > 0 then
    raise exception 'GAGAL — masih ada % baris masjid_website dengan draft terisi', v_leak;
  end if;

  -- (b) anon tidak boleh punya hak apa pun di tabel draft
  if has_table_privilege('anon', 'public.masjid_website_drafts', 'SELECT')
     or has_table_privilege('anon', 'public.masjid_website_drafts', 'INSERT')
     or has_table_privilege('anon', 'public.masjid_website_drafts', 'UPDATE')
     or has_table_privilege('anon', 'public.masjid_website_drafts', 'DELETE') then
    raise exception 'GAGAL — anon masih punya hak di masjid_website_drafts';
  end if;

  -- (c) RPC baru tidak boleh bisa dipanggil anon
  if has_function_privilege('anon', 'public.masjid_my_draft(text)', 'EXECUTE')
     or has_function_privilege('anon', 'public.masjid_draft_by_account(text, jsonb)', 'EXECUTE') then
    raise exception 'GAGAL — RPC draft masih bisa dipanggil anon';
  end if;
end $$;
