-- =============================================================================
-- P1 — SINKRON DATA MASJID KE CLOUD (offline-first, per record)
-- =============================================================================
-- TUJUAN: semua data operasional adm-masjid (kas, jamaah, kegiatan, inventaris,
--   pinjam, pinjamKas, salurZakat, fitrah, cashflow, shiftLog, opnameLog,
--   pengaturan masjid) ikut tersimpan di cloud & bisa dipakai lintas perangkat,
--   TANPA menghilangkan mode offline. Perangkat tetap menyimpan semuanya di
--   localStorage dan tetap jalan penuh saat tidak ada sinyal.
--
-- MODEL: bukan "kirim seluruh DB tiap save" (boros + rawan saling menimpa),
--   melainkan SINKRON PER RECORD dengan kursor urut dari server.
--   - Tabel `masjid_records`: satu baris = satu record (kas/kegiatan/…).
--   - `seq` = nomor urut perubahan yang naik TERUS tiap kali baris ditulis
--     (diambil dari sequence). Dipakai sebagai kursor tarik: "kirim yang seq-nya
--     lebih besar dari N". Jadi perubahan record mana pun selalu terkirim,
--     tidak seperti memakai primary key biasa yang tidak berubah saat update.
--   - `client_mt` = jam-perubahan milik perangkat (ms). Saat bentrok, yang
--     `client_mt`-nya LEBIH BARU menang. Sisi aplikasi memakai "jam logis"
--     (selalu > mt terbesar yang pernah dilihat) supaya jam perangkat yang
--     meleset tidak membuat perubahannya selalu kalah.
--   - `deleted` = penanda hapus (tombstone). Baris tidak dibuang, supaya
--     penghapusan ikut terkirim ke perangkat lain.
--
-- KEAMANAN: RLS aktif tanpa policy sama sekali → anon & authenticated tidak
--   punya akses langsung. Akses hanya lewat 2 RPC SECURITY DEFINER di bawah,
--   yang memeriksa peran pemanggil pada situs (`masjid_site_role`): hanya
--   owner (dan nanti manajer/kasir) yang boleh.
--
-- OFFLINE: kalau RPC gagal (tanpa sinyal / belum masuk), perubahan tetap
--   menumpuk di antrean perangkat dan dikirim lagi otomatis. Tidak ada data
--   yang hilang kalau internet putus.
--
-- ROLLBACK:
--   drop function public.masjid_sync_push(text, jsonb);
--   drop function public.masjid_sync_pull(text, bigint, integer);
--   drop table public.masjid_records;
--   drop sequence public.masjid_records_seq;
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Nomor urut perubahan (kursor)
-- ---------------------------------------------------------------------------
create sequence if not exists public.masjid_records_seq;

-- ---------------------------------------------------------------------------
-- 2. Tabel record
-- ---------------------------------------------------------------------------
create table if not exists public.masjid_records (
  site_slug  text        not null,
  coll       text        not null,
  rec_id     text        not null,
  data       jsonb,
  deleted    boolean     not null default false,
  client_mt  bigint      not null default 0,
  server_at  timestamptz not null default now(),
  seq        bigint      not null default nextval('public.masjid_records_seq'),
  constraint masjid_records_pkey primary key (site_slug, coll, rec_id)
);

-- Indeks untuk tarik berbasis kursor
create index if not exists masjid_records_pull_idx
  on public.masjid_records (site_slug, seq);

alter table public.masjid_records enable row level security;
-- Tanpa policy apa pun → default deny. Akses hanya lewat RPC di bawah.
revoke all on table public.masjid_records from public, anon, authenticated;
grant select, insert, update, delete on table public.masjid_records to service_role;
revoke all on sequence public.masjid_records_seq from public, anon, authenticated;
grant usage, select on sequence public.masjid_records_seq to service_role;
grant usage, select on sequence public.masjid_records_seq to postgres;

-- ---------------------------------------------------------------------------
-- 3. Daftar koleksi yang boleh disinkron (tameng dari nama koleksi sembarang)
-- ---------------------------------------------------------------------------
create or replace function public.masjid_sync_colls()
 returns text[]
 language sql
 immutable
as $function$
  select array[
    'settings',                       -- satu record, rec_id = 'main'
    'kas', 'jamaah', 'kegiatan', 'inventaris',
    'pinjam', 'pinjamKas', 'salurZakat', 'fitrah',
    'cashflow', 'shiftLog', 'opnameLog',
    'platformSettings'                -- satu record, rec_id = 'main'
  ]::text[];
$function$;

revoke all on function public.masjid_sync_colls() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. RPC KIRIM (push) — p_ops = [{coll,id,data,deleted,mt}, ...]
-- ---------------------------------------------------------------------------
create or replace function public.masjid_sync_push(p_slug text, p_ops jsonb)
 returns jsonb
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  v_gid   text := public.current_global_identity_id();
  v_site  public.masjid_sites%rowtype;
  v_role  text;
  v_op    jsonb;
  v_coll  text;
  v_id    text;
  v_mt    bigint;
  v_hapus boolean;
  v_n     integer := 0;
  v_skip  integer := 0;
  v_hit   integer;
  v_colls text[] := public.masjid_sync_colls();
begin
  if v_gid is null then
    return jsonb_build_object('ok', false, 'code', 'not_signed_in');
  end if;
  if p_slug is null or length(btrim(p_slug)) = 0 then
    return jsonb_build_object('ok', false, 'code', 'invalid_slug');
  end if;
  if p_ops is null or jsonb_typeof(p_ops) <> 'array' then
    return jsonb_build_object('ok', false, 'code', 'invalid_ops');
  end if;
  if jsonb_array_length(p_ops) > 400 then
    return jsonb_build_object('ok', false, 'code', 'too_many_ops',
                              'jumlah', jsonb_array_length(p_ops));
  end if;

  select * into v_site
    from public.masjid_sites s
   where s.slug = btrim(p_slug)
   limit 1;
  if v_site.id is null then
    return jsonb_build_object('ok', false, 'code', 'site_not_found');
  end if;

  v_role := public.masjid_site_role(v_site.id);
  if v_role is null or v_role not in ('owner', 'manajer', 'kasir') then
    return jsonb_build_object('ok', false, 'code', 'forbidden', 'role', v_role);
  end if;

  for v_op in select value from jsonb_array_elements(p_ops) loop
    v_coll := v_op->>'coll';
    v_id   := v_op->>'id';

    if v_coll is null or v_id is null or btrim(v_id) = ''
       or length(v_id) > 200 or not (v_coll = any (v_colls)) then
      v_skip := v_skip + 1;
      continue;
    end if;

    v_hapus := coalesce((v_op->>'deleted')::boolean, false);
    v_mt    := coalesce((v_op->>'mt')::bigint, 0);
    if v_mt < 0 then v_mt := 0; end if;

    insert into public.masjid_records as t
      (site_slug, coll, rec_id, data, deleted, client_mt, server_at)
    values
      (v_site.slug, v_coll, btrim(v_id),
       case when v_hapus then null else coalesce(v_op->'data', '{}'::jsonb) end,
       v_hapus, v_mt, now())
    on conflict (site_slug, coll, rec_id) do update
       set data      = excluded.data,
           deleted   = excluded.deleted,
           client_mt = excluded.client_mt,
           server_at = now(),
           seq       = nextval('public.masjid_records_seq')
     where excluded.client_mt > t.client_mt
    returning 1 into v_hit;

    if v_hit is null then
      v_skip := v_skip + 1;   -- kalah baru: server sudah punya versi lebih baru
    else
      v_n := v_n + 1;
    end if;
    v_hit := null;
  end loop;

  return jsonb_build_object('ok', true, 'diterima', v_n, 'dilewati', v_skip);
end;
$function$;

revoke all on function public.masjid_sync_push(text, jsonb) from public, anon;
grant execute on function public.masjid_sync_push(text, jsonb) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 5. RPC TARIK (pull) — ambil perubahan setelah kursor p_since
-- ---------------------------------------------------------------------------
create or replace function public.masjid_sync_pull(p_slug text, p_since bigint default 0, p_limit integer default 300)
 returns jsonb
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  v_gid  text := public.current_global_identity_id();
  v_site public.masjid_sites%rowtype;
  v_role text;
  v_ops  jsonb;
  v_cur  bigint;
  v_more boolean;
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
  if v_role is null or v_role not in ('owner', 'manajer', 'kasir') then
    return jsonb_build_object('ok', false, 'code', 'forbidden', 'role', v_role);
  end if;

  with batch as (
    select r.seq, r.coll, r.rec_id, r.data, r.deleted, r.client_mt
      from public.masjid_records r
     where r.site_slug = v_site.slug
       and r.seq > greatest(coalesce(p_since, 0), 0)
     order by r.seq
     limit greatest(1, least(coalesce(p_limit, 300), 1000))
  )
  select coalesce(jsonb_agg(jsonb_build_object(
             'coll',    b.coll,
             'id',      b.rec_id,
             'data',    b.data,
             'deleted', b.deleted,
             'mt',      b.client_mt,
             'seq',     b.seq) order by b.seq), '[]'::jsonb),
         coalesce(max(b.seq), greatest(coalesce(p_since, 0), 0))
    into v_ops, v_cur
    from batch b;

  select exists(
    select 1 from public.masjid_records r
     where r.site_slug = v_site.slug and r.seq > v_cur
  ) into v_more;

  return jsonb_build_object(
    'ok', true,
    'slug', v_site.slug,
    'ops', v_ops,
    'jumlah', jsonb_array_length(v_ops),
    'cursor', v_cur,
    'ada_lagi', v_more);
end;
$function$;

revoke all on function public.masjid_sync_pull(text, bigint, integer) from public, anon;
grant execute on function public.masjid_sync_pull(text, bigint, integer) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 6. Verifikasi inline — gagal = transaksi dibatalkan
-- ---------------------------------------------------------------------------
do $$
begin
  if has_table_privilege('anon', 'public.masjid_records', 'SELECT')
     or has_table_privilege('anon', 'public.masjid_records', 'INSERT')
     or has_table_privilege('anon', 'public.masjid_records', 'UPDATE')
     or has_table_privilege('anon', 'public.masjid_records', 'DELETE') then
    raise exception 'GAGAL — anon masih punya hak di masjid_records';
  end if;

  if has_function_privilege('anon', 'public.masjid_sync_push(text, jsonb)', 'EXECUTE')
     or has_function_privilege('anon', 'public.masjid_sync_pull(text, bigint, integer)', 'EXECUTE') then
    raise exception 'GAGAL — RPC sinkron masih bisa dipanggil anon';
  end if;
end $$;
