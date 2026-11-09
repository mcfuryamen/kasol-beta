-- =============================================================================
-- HUB Fase 1 — Jembatan klien → akun HUB (identitas global + lisensi)
-- =============================================================================
-- Keputusan owner (28-29/10/2026):
--   * HUB diangkat: global_identities/licenses jadi sumber kebenaran akun &
--     lisensi; modul mitra jadi UI-nya. HUB = pintu SEMUA user (pembeli +
--     afiliator), bukan cuma afiliator.
--   * Klien dengan WA kosong/invalid TIDAK dilewati → tetap dapat akun dengan
--     status 'pending' ("belum terverifikasi"), phone placeholder
--     'unverified:<unit_id>' (deterministik, unik, jelas bukan nomor asli).
--     Begitu WA diisi app → akun dipromosikan: phone_e164 = nomor asli,
--     status 'active'.
--
-- Yang dikerjakan file ini:
--   1. hub_link_client_identity(uuid) — helper idempoten: klien → akun HUB.
--      - WA valid (normalisasi 08xx/62xx via partner_norm_wa, ≥9 digit)
--        → identity_upsert_by_phone (1 nomor = 1 akun, lintas app/unit).
--      - WA kosong → akun pending 'unv-<unit tanpa strip>' (display_name dari
--        nama usaha/pemilik).
--      - Klien pending yang WA-nya belakangan terisi → akun dipromosikan
--        (kalau nomornya belum dipakai akun lain; kalau sudah → gabung ke
--        akun nomor itu).
--   2. Trigger dual-write di clients (INSERT + UPDATE kolom tertentu):
--      akun selalu jadi + lisensi 'aktif' berserial tercatat di licenses.
--      Kolom global_identity_id SENGAJA tidak ada di daftar UPDATE OF agar
--      update oleh helper tidak memicu trigger lagi (anti rekursi).
--   3. Backfill 23 klien existing + sinkron 4 baris licenses existing.
--   4. Grants: pola revoke-eksplisit dulu (Supabase auto-grant anon/
--      authenticated saat CREATE FUNCTION).
--
-- Tidak mengubah: skema clients (kolom global_identity_id sudah ada), RLS
-- tabel HUB, dan perilaku app lama (clients tetap sumber tulisan app).
--
-- ROLLBACK (bersih):
--   drop trigger if exists trg_hub_clients_bridge on public.clients;
--   drop function if exists public.hub_clients_bridge_trg();
--   drop function if exists public.hub_link_client_identity(uuid);
--   update public.clients set global_identity_id = null;
--   update public.licenses set global_identity_id = null;
--   delete from public.global_identities g
--     where g.id in (select global_identity_id from public.clients)
--        or g.phone_e164 like 'unverified:%';
-- =============================================================================

begin;

set local lock_timeout = '5s';

-- -----------------------------------------------------------------------------
-- 1. Helper: klien → akun HUB (idempoten)
-- -----------------------------------------------------------------------------
create or replace function public.hub_link_client_identity(p_client_id uuid)
returns text
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_row  public.clients%rowtype;
  v_wa   text;
  v_nama text;
  v_gid  text;
begin
  select * into v_row from public.clients where id = p_client_id;
  if not found then
    return null;
  end if;

  -- Sudah punya akun & akunnya sudah "asli" (bukan pending unv-) → beres.
  v_gid := v_row.global_identity_id;
  if v_gid is not null and v_gid not like 'unv-%' then
    return v_gid;
  end if;

  v_nama := coalesce(
    nullif(btrim(coalesce(v_row.nama_usaha, '')), ''),
    nullif(btrim(coalesce(v_row.nama_pemilik, '')), ''),
    'Unit ' || v_row.unit_id);
  v_wa := public.partner_norm_wa(v_row.no_whatsapp);

  -- Kasus khusus: akun pending ("belum terverifikasi") yang WA-nya baru
  -- terisi di app → promosikan.
  if v_gid is not null and v_wa is not null and length(v_wa) >= 9 then
    if exists (select 1 from public.global_identities
                where phone_e164 = v_wa and id <> v_gid) then
      -- Nomor sudah jadi akun lain → gabungkan klien ke akun nomor itu.
      v_gid := public.identity_upsert_by_phone(v_wa, v_nama);
      update public.clients set global_identity_id = v_gid where id = p_client_id;
    else
      update public.global_identities
         set phone_e164  = v_wa,
             status      = 'active',
             display_name = coalesce(nullif(display_name, ''), v_nama),
             updated_at  = now()
       where id = v_gid;
    end if;
    return v_gid;
  end if;

  if v_gid is not null then
    return v_gid; -- pending & WA masih kosong → tidak ada yang berubah
  end if;

  if v_wa is not null and length(v_wa) >= 9 then
    v_gid := public.identity_upsert_by_phone(v_wa, v_nama);
  else
    -- Kebijakan owner: WA kosong/invalid TIDAK dilewati → akun "belum
    -- terverifikasi" (status pending), phone placeholder deterministik.
    v_gid := 'unv-' || replace(v_row.unit_id, '-', '');
    insert into public.global_identities (id, phone_e164, display_name, status)
    values (v_gid, 'unverified:' || v_row.unit_id, v_nama, 'pending')
    on conflict (id) do update
      set display_name = coalesce(nullif(public.global_identities.display_name, ''),
                                 excluded.display_name),
          updated_at   = now();
  end if;

  update public.clients
     set global_identity_id = v_gid
   where id = p_client_id;

  return v_gid;
end;
$$;

-- -----------------------------------------------------------------------------
-- 2. Trigger dual-write: setiap klien masuk/berubah → akun + lisensi HUB
-- -----------------------------------------------------------------------------
create or replace function public.hub_clients_bridge_trg()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_gid text;
  v_pid uuid;
begin
  v_gid := public.hub_link_client_identity(NEW.id);

  if NEW.license_status = 'aktif'
     and nullif(btrim(coalesce(NEW.license_serial, '')), '') is not null then

    select id into v_pid
      from public.products
     where app_type = NEW.app_type
     order by (status = 'live') desc, id
     limit 1;

    if v_pid is not null then
      -- Belum ada lisensi untuk klien ini → catat ke HUB.
      insert into public.licenses
        (global_identity_id, product_id, app_type, source_client_id, outlet_ref,
         plan, max_devices, status, current_serial, tx_month, tx_used)
      select v_gid, v_pid, NEW.app_type, NEW.id, NEW.unit_id,
             'single', 1, 'active', NEW.license_serial, NEW.tx_month,
             coalesce(NEW.tx_used, 0)
       where not exists (
             select 1 from public.licenses
              where source_client_id = NEW.id);

      -- Sudah ada → sinkron identitas/serial/status/kuota (dual-write).
      update public.licenses l
         set global_identity_id = coalesce(l.global_identity_id, v_gid),
             current_serial     = NEW.license_serial,
             status             = 'active',
             tx_month           = NEW.tx_month,
             tx_used            = coalesce(NEW.tx_used, 0),
             updated_at         = now()
       where l.source_client_id = NEW.id;
    end if;
  end if;

  return NEW;
end;
$$;

drop trigger if exists trg_hub_clients_bridge on public.clients;

create trigger trg_hub_clients_bridge
after insert or update of no_whatsapp, license_status, license_serial,
                          nama_usaha, nama_pemilik, tx_month, tx_used
on public.clients
for each row execute function public.hub_clients_bridge_trg();

-- -----------------------------------------------------------------------------
-- 3. Backfill klien existing (23 baris): WA valid → akun aktif,
--    WA kosong → akun pending "belum terverifikasi"
-- -----------------------------------------------------------------------------
do $$
declare
  r record;
begin
  for r in select id from public.clients order by created_at loop
    perform public.hub_link_client_identity(r.id);
  end loop;
end;
$$;

-- -----------------------------------------------------------------------------
-- 4. Sinkron 4 baris licenses existing (global_identity_id masih null)
-- -----------------------------------------------------------------------------
update public.licenses l
   set global_identity_id = c.global_identity_id,
       updated_at         = now()
  from public.clients c
 where l.source_client_id = c.id
   and l.global_identity_id is null
   and c.global_identity_id is not null;

-- -----------------------------------------------------------------------------
-- 5. Grants — revoke eksplisit dulu (Supabase auto-grant EXECUTE ke
--    anon + authenticated saat fungsi dibuat; revoke ke public saja
--    TIDAK cukup).
-- -----------------------------------------------------------------------------
revoke all on function public.hub_link_client_identity(uuid) from public, anon, authenticated;
revoke all on function public.hub_clients_bridge_trg()      from public, anon, authenticated;

-- Fungsi trigger harus EXECUTE-able oleh role yang menulis clients
-- (app kaki5/rosok/laundry via anon key); helper dipanggil di dalamnya
-- sebagai owner (security definer) dan manual lewat service_role.
grant execute on function public.hub_clients_bridge_trg() to anon, authenticated, service_role;
grant execute on function public.hub_link_client_identity(uuid) to service_role;

commit;

-- =============================================================================
-- VERIFY (jalankan lewat audit-schema.js):
--   --only=clients_stats,hub_f1_wa_quality,hub_f1_licenses_state
-- Harapan:
--   * clients_stats.punya_akun = total per app (23/23)
--   * hub_f1_wa_quality.sudah_punya_akun = 23
--   * hub_f1_licenses_state: 4 baris punya global_identity_id terisi
--   * global_identities: ±17 akun WA + 6 akun pending 'unv-…'
--     (12 WA unik - 2 share antar "format sama" = bisa kurang; cek angka asli)
-- =============================================================================
