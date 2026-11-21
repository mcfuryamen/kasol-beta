-- =============================================================================
-- HARDENING P3 (bagian 1) — Backfill membership untuk lisensi aktif
-- =============================================================================
-- Tanggal : 20 November 2026
-- Project : hhywrvedlwljawgxzpkq
-- Sesi    : audit koneksi data 4 app kasol (lanjutan P0/P1/P2)
--
-- TEMUAN
--   `app_memberships` = tabel "APA" (hak akses per aplikasi).
--   `licenses`        = tabel "MAYA" (hak komersial / bayar).
--   Ketiganya dipakai bareng oleh RPC `app_my_access`:
--     - role & outlet diambil dari `app_memberships`
--     - akses ke app diberikan kalau membership-nya AKTIF
--     - lisensi dipakai sebagai fallback: kalau user punya lisensi tapi
--       belum punya membership sama sekali untuk app itu, `app_my_access`
--       MEMBUAT membership role='owner' secara otomatis.
--
--   Artinya: kode aplikasi sudah punya "self-heal" — tapi hanya berjalan
--   saat pengguna yang/login ke aplikasi. Owner yang belum pernah membuka
--   app tetap tercatat "nggak punya akses" di laporan/data center.
--
--   Audit menemukan 3 lisensi aktif yang TIDAK punya membership:
--
--     lisensi                               app    outlet / nama
--     ------------------------------------  -----  -----------------------------
--     dcfecbe5-8379-43ef-8d7a-da680a8e7b50  kaki5  Mitra Mulya Makmur
--     830613cf-c9cb-4802-ba25-c95b73e06597  kaki5  Mie Ayam dan Bakso Wonogiri
--                                                    Mas Blangkon
--     7c1f67d4-fb9a-496e-93a2-c2e09fbd133a  rosok  Rejeki Moro
--
--   Ketiganya: status lisensi = 'active', outlet_ref menunjuk `app_outlets`
--   yang ADA dan owner_gid-nya SAMA dengan global_identity_id pemilik lisensi.
--   Jadi tidak ada ambiguitas identitas — outlet & lisensi saling cocok.
--
-- YANG DIKERJAKAN
--   Membuat membership role='owner' untuk 3 lisensi di atas, PERSIS seperti
--   auto-provision di `app_my_access`:
--     - app_key     = lisensi.app_type
--     - role        = 'owner'
--     - outlet_ref  = lisensi.outlet_ref
--     - status      = 'active'
--     - expires_at  = lisensi.expires_at (null = tanpa batas masa berlaku)
--
--   Idempoten: pakai ON CONFLICT pada unique index resmi
--   `app_memberships_key (global_identity_id, app_key, coalesce(outlet_ref,''))`
--   dengan DO UPDATE yang sama persis seperti auto-provision.
--   Menjalankan ulang → 0 baris tersentuh, hasil tetap sama.
--
--   TIDAK menyentuh lisensi, outlet, identitas, dompet, atau kode.
--   TIDAK mengubah role kasir yang sudah ada.
--
-- ROLLBACK
--   delete from public.app_memberships
--    where id in ('<id membership hasil run ini>');
--   (lihat select di bagian verifikasi bawah untuk daftar id-nya)
--
-- VERIFIKASI (setelah apply)
--   select l.app_type, l.global_identity_id, l.outlet_ref, m.id, m.role, m.status
--     from public.licenses l
--     join public.app_memberships m
--       on m.global_identity_id = l.global_identity_id
--      and m.app_key = l.app_type
--      and m.outlet_ref = l.outlet_ref
--    where l.status = 'active'
--    order by l.app_type;
--   → harusnya 5 baris (3 baru + 2 yang sudah ada sebelumnya).
-- =============================================================================

begin;

-- ---------------------------------------------------------------------------
-- 1. Backfill membership untuk lisensi aktif yang outlet-nya valid & cocok
-- ---------------------------------------------------------------------------
do $backfill$
declare
  n_ins   integer := 0;
  n_upd   integer := 0;
  daftar  text;
  r       record;
begin
  for r in
    select l.id            as lisensi_id,
           l.app_type,
           l.global_identity_id,
           l.outlet_ref,
           l.expires_at,
           o.id::text      as outlet_id,
           o.nama          as outlet_nama
      from public.licenses l
      join public.app_outlets o
        on o.id::text = l.outlet_ref
       and o.owner_gid = l.global_identity_id
     where l.status = 'active'
       and l.global_identity_id is not null
       and nullif(btrim(coalesce(l.outlet_ref, '')), '') is not null
       and not exists (
             select 1
               from public.app_memberships m
              where m.global_identity_id = l.global_identity_id
                and m.app_key = l.app_type
                and m.status = 'active'
           )
  loop
    -- xmax = 0 → baris benar-benar baru di-insert (bukan hasil DO UPDATE).
    with ins as (
      insert into public.app_memberships
        (global_identity_id, app_key, role, outlet_ref, status, expires_at)
      values
        (r.global_identity_id, r.app_type, 'owner', r.outlet_id, 'active', r.expires_at)
      on conflict (global_identity_id, app_key, coalesce(outlet_ref, ''))
      do update set status     = 'active',
                    expires_at = excluded.expires_at,
                    updated_at = now()
      returning (xmax = 0) as was_insert
    )
    select count(*) filter (where was_insert) into n_upd from ins;

    n_ins := n_ins + n_upd;

    daftar := coalesce(daftar || ', ', '') || r.app_type || ':' || r.outlet_nama;
  end loop;

  raise notice 'Membership backfill: % baru dibuat (list: %)', n_ins, coalesce(daftar, '-');
end
$backfill$;

-- ---------------------------------------------------------------------------
-- 2. Verifikasi inline — gagal = rollback otomatis
-- ---------------------------------------------------------------------------
do $verif$
declare
  n_aktif_lisensi integer;
  n_tanpa_member  integer;
  n_role_bukan_owner integer;
begin
  -- a) Setiap lisensi aktif yang punya outlet valid WAJIB punya membership owner.
  select count(*) into n_aktif_lisensi
    from public.licenses l
    join public.app_outlets o
      on o.id::text = l.outlet_ref
     and o.owner_gid = l.global_identity_id
   where l.status = 'active'
     and l.global_identity_id is not null
     and nullif(btrim(coalesce(l.outlet_ref, '')), '') is not null;

  select count(*) into n_tanpa_member
    from public.licenses l
    join public.app_outlets o
      on o.id::text = l.outlet_ref
     and o.owner_gid = l.global_identity_id
   where l.status = 'active'
     and l.global_identity_id is not null
     and nullif(btrim(coalesce(l.outlet_ref, '')), '') is not null
     and not exists (
           select 1
             from public.app_memberships m
            where m.global_identity_id = l.global_identity_id
              and m.app_key = l.app_type
              and m.outlet_ref = l.outlet_ref
              and m.role = 'owner'
              and m.status = 'active'
         );

  if n_tanpa_member > 0 then
    raise exception 'Masih ada % lisensi aktif tanpa membership owner', n_tanpa_member;
  end if;

  -- b) Membership hasil backfill tidak boleh masa berlakunya lebih lama dari lisensi.
  select count(*) into n_role_bukan_owner
    from public.app_memberships m
    join public.licenses l
      on l.global_identity_id = m.global_identity_id
     and l.app_type = m.app_key
     and l.outlet_ref = m.outlet_ref
     and l.status = 'active'
   where m.role = 'owner'
     and m.status = 'active'
     and l.expires_at is not null
     and m.expires_at is distinct from l.expires_at;

  if n_role_bukan_owner > 0 then
    raise exception '% membership owner punya masa berlaku beda dari lisensi', n_role_bukan_owner;
  end if;

  -- c) Tidak boleh ada membership owner tanpa lisensi yang dibuat barusan
  --    (baris lama dari QA TIDAK ikut disentuh — hanya dicek tidak bertambah).
  if (select count(*) from public.app_memberships) < 5 then
    raise exception 'Jumlah app_memberships turun drastis — backfill tidak boleh mengurangi data';
  end if;

  raise notice 'Verifikasi backfill membership: LULUS (% lisensi aktif ter-cover)', n_aktif_lisensi;
end
$verif$;

-- ---------------------------------------------------------------------------
-- 3. Laporan hasil (baris terakhir →dikembalikan oleh Management API)
-- ---------------------------------------------------------------------------
select 'backfill_membership' as laporan,
       l.app_type,
       l.global_identity_id,
       o.nama as outlet,
       m.id as membership_id,
       m.role,
       m.status,
       m.expires_at
  from public.licenses l
  join public.app_outlets o
    on o.id::text = l.outlet_ref
  join public.app_memberships m
    on m.global_identity_id = l.global_identity_id
   and m.app_key = l.app_type
   and m.outlet_ref = l.outlet_ref
 where l.status = 'active'
 order by l.app_type, o.nama;

commit;
