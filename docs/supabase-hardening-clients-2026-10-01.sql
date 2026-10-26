-- ============================================================================
-- SUPABASE HARDENING — CLIENTS & RPC IDENTITAS PERANGKAT (2026-10-01)
-- ============================================================================
-- Sumber: audit modul identifikasi perangkat (laundry/kaki5/rosok) 2026-09-30,
-- dieksekusi 2026-10-01 via Supabase migrations:
--   1. hardening_clients_grants_trigger_20261001
--   2. harden_device_rpc_20261001
-- Temuan yang ditutup:
--   P1  anon/authenticated punya INSERT/UPDATE di SELURUH kolom `clients`
--       (termasuk license_status/license_serial/license_expires_at/tx_adjust)
--       + policy RLS hybrid mengizinkan tulis baris sendiri → klien bisa
--       self-grant lisensi & kuota (persistCloudLicense mengadopsi 'aktif'
--       tanpa validasi HMAC — by design fix chip-zombie).
--   P2  device_known memindahkan kepemilikan (user_id = auth.uid()) ke siapa
--       pun yang tahu/menebak unit_id ATAU device_code (fallback tanpa filter
--       app_type, tanpa bukti kepemilikan) + menulis unit_id sembarang.
--   P2  device_assign bisa menulis unit_id tanpa validasi format.
--   P2  (fix di kode app, bukan SQL) updateUser() tidak me-refresh access
--       token → klaim JWT basi membuat jalur ADOPSI reanchorUnitId gagal
--       (baris kanonik tak terlihat → 23505 → salah tercatat 'collision-race').
--       Fix: refreshSession() setelah updateUser di license.sync.js ketiga app.

-- ============================================================================
-- MIGRASI 1 — hardening_clients_grants_trigger_20261001
-- ============================================================================

-- 1) cabut grant tabel-level dulu (pelajaran PG 2026-09-14: REVOKE kolom =
--    no-op selama grant tabel masih ada)
REVOKE INSERT, UPDATE ON public.clients FROM anon, authenticated;

-- 2) grant per-kolom: daftar = kolom yang memang ditulis app klien
--    (laundry index.html ensureSyncedProfile/purchase/license.sync;
--     kaki5 js/sync.js buildPayload + purchase; rosok js/license.sync.js)
GRANT INSERT (
  unit_id, app_type, device_code, install_id, user_id,
  nama_usaha, nama_pemilik, no_whatsapp, alamat_detail,
  provinsi, provinsi_id, kabkota, kabkota_id, kecamatan, kecamatan_id, desa, desa_id,
  status, source, bukti_url,
  tx_month, tx_used, tx_updated_at, tx_adjust,
  last_seen, first_seen, browser, os, device_type, user_agent, updated_at
) ON public.clients TO anon, authenticated;

GRANT UPDATE (
  unit_id, app_type, device_code, install_id, user_id,
  nama_usaha, nama_pemilik, no_whatsapp, alamat_detail,
  provinsi, provinsi_id, kabkota, kabkota_id, kecamatan, kecamatan_id, desa, desa_id,
  status, source, bukti_url,
  tx_month, tx_used, tx_updated_at,
  last_seen, first_seen, browser, os, device_type, user_agent, updated_at
) ON public.clients TO anon, authenticated;

-- Kolom yang TIDAK diberikan ke role klien (admin-only, tulisnya via
-- service_role dari Control/edge function):
--   id, created_at,
--   license_status, license_serial, license_expires_at,
--   activated_at, verified_at, restored_at, revoked_at,
--   tx_adjust (UPDATE; INSERT dibolehkan tapi dipaksa 0 oleh trigger di bawah
--   karena rosok meng-insert tx_adjust:0), notes, email, lead_source.

-- 3) trigger penjaga (belt & braces + aturan kepemilikan user_id)
CREATE OR REPLACE FUNCTION public.clients_guard_admin_columns()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER AS $fn$
BEGIN
  -- service/admin lolos: Control, edge function, SQL editor, RPC DEFINER
  IF current_user IN ('service_role','postgres','supabase_admin') THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT' THEN
    -- nilai tx_adjust dari klien selalu dinetralkan (rosok insert 0 = tetap 0)
    IF NEW.tx_adjust IS DISTINCT FROM 0 THEN
      NEW.tx_adjust := 0;
    END IF;
    RETURN NEW;
  END IF;
  -- UPDATE: kolom lisensi/kuota = milik admin
  IF NEW.license_status     IS DISTINCT FROM OLD.license_status
  OR NEW.license_serial     IS DISTINCT FROM OLD.license_serial
  OR NEW.license_expires_at IS DISTINCT FROM OLD.license_expires_at
  OR NEW.activated_at       IS DISTINCT FROM OLD.activated_at
  OR NEW.verified_at        IS DISTINCT FROM OLD.verified_at
  OR NEW.restored_at        IS DISTINCT FROM OLD.restored_at
  OR NEW.revoked_at         IS DISTINCT FROM OLD.revoked_at
  OR NEW.tx_adjust          IS DISTINCT FROM OLD.tx_adjust THEN
    RAISE EXCEPTION 'clients: kolom lisensi/kuota hanya boleh diubah admin (permintaan dari %)', current_user;
  END IF;
  -- user_id hanya boleh NULL atau sesi sendiri
  IF NEW.user_id IS DISTINCT FROM OLD.user_id AND NEW.user_id IS NOT NULL
     AND (auth.uid() IS NULL OR NEW.user_id <> auth.uid()) THEN
    RAISE EXCEPTION 'clients: user_id hanya boleh diset ke sesi sendiri';
  END IF;
  RETURN NEW;
END; $fn$;

DROP TRIGGER IF EXISTS clients_guard_admin_insert ON public.clients;
CREATE TRIGGER clients_guard_admin_insert BEFORE INSERT ON public.clients
FOR EACH ROW EXECUTE FUNCTION public.clients_guard_admin_columns();

DROP TRIGGER IF EXISTS clients_guard_admin_update ON public.clients;
CREATE TRIGGER clients_guard_admin_update BEFORE UPDATE ON public.clients
FOR EACH ROW EXECUTE FUNCTION public.clients_guard_admin_columns();

-- ============================================================================
-- MIGRASI 2 — harden_device_rpc_20261001
-- ============================================================================

-- device_known:
--   (1) format identifier divalidasi (unit 'XXX-XXXX-XXXX', device 'XXXX-XXXX')
--       — anti probing / tulis nilai sembarangan;
--   (2) lookup difilter app_type (anti lintas-app; baris app_type NULL masih
--       bisa diadopsi utk migrasi legacy);
--   (3) fallback device_code HANYA utk baris TANPA pemilik (anti klaim paksa);
--   (4) baris milik user lain dikembalikan true TANPA disentuh sama sekali;
--   (5) unit_id hanya ditulis saat adopsi baris tak-berpemilik; app_type hanya
--       diisi bila kosong; user_id hanya diisi bila belum ada pemilik.
CREATE OR REPLACE FUNCTION public.device_known(
  p_unit_id text,
  p_device_code text DEFAULT NULL::text,
  p_app_type text DEFAULT NULL::text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
declare
  v_found_id uuid;
  v_owned_by uuid;
  v_exists   boolean;
begin
  if p_unit_id is null or p_unit_id !~ '^[A-Z0-9]{2,6}-[A-Z0-9]{4}-[A-Z0-9]{4}$' then
    return false;
  end if;
  if p_device_code is not null and p_device_code !~ '^[A-Z0-9]{4}-[A-Z0-9]{4}$' then
    p_device_code := null;
  end if;

  select id, user_id into v_found_id, v_owned_by
    from public.clients
   where unit_id = p_unit_id
     and (p_app_type is null or app_type = p_app_type or app_type is null)
   limit 1;

  if v_found_id is null and p_device_code is not null then
    select id, user_id into v_found_id, v_owned_by
      from public.clients
     where device_code = p_device_code
       and user_id is null
       and (p_app_type is null or app_type = p_app_type or app_type is null)
     limit 1;
  end if;

  v_exists := v_found_id is not null;

  if v_exists and (v_owned_by is null or v_owned_by = auth.uid()) then
    update public.clients
       set user_id     = coalesce(v_owned_by, auth.uid()),
           unit_id     = case when v_owned_by is null then coalesce(p_unit_id, unit_id) else unit_id end,
           device_code = coalesce(p_device_code, device_code),
           app_type    = coalesce(app_type, p_app_type),
           last_seen   = now()
     where id = v_found_id;
  end if;

  return v_exists;
end;
$function$;

-- device_assign: tambah validasi format unit_id baru (serial = gerbang kuat;
-- sisanya identik dengan definisi produksi sebelumnya).
CREATE OR REPLACE FUNCTION public.device_assign(
  p_serial text,
  p_profile jsonb,
  p_new_unit_id text DEFAULT NULL::text,
  p_new_device_code text DEFAULT NULL::text,
  p_new_install_id text DEFAULT NULL::text,
  p_app_type text DEFAULT NULL::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
declare
  v_row          record;
  v_cloud_usaha  text;
  v_cloud_wa     text;
  v_serial_usaha text;
  v_serial_wa    text;
  v_match_usaha  boolean;
  v_match_wa     boolean;
  v_conflict     boolean;
begin
  select id, unit_id, device_code, install_id, license_status,
         nama_usaha, nama_pemilik, no_whatsapp
    into v_row
    from public.clients
   where license_serial = upper(btrim(coalesce(p_serial, '')))
   limit 1;

  if v_row is null then
    return jsonb_build_object('ok', false, 'reason', 'serial-not-found',
                              'unit_id', null, 'license_status', null);
  end if;

  v_cloud_usaha := lower(btrim(coalesce(v_row.nama_usaha, '')));
  v_cloud_wa    := lower(btrim(coalesce(v_row.no_whatsapp, '')));

  v_serial_usaha := lower(btrim(coalesce(p_profile->>'nama_usaha', '')));
  v_serial_wa    := lower(btrim(coalesce(p_profile->>'no_whatsapp', '')));

  v_match_usaha := v_serial_usaha <> '' and v_serial_usaha = v_cloud_usaha;
  v_match_wa    := v_serial_wa <> ''     and v_serial_wa     = v_cloud_wa;

  if not (v_match_usaha or v_match_wa) then
    return jsonb_build_object('ok', false, 'reason', 'profile-mismatch',
                              'unit_id', v_row.unit_id,
                              'license_status', v_row.license_status);
  end if;

  if p_new_unit_id is not null then
    if p_new_unit_id !~ '^[A-Z0-9]{2,6}-[A-Z0-9]{4}-[A-Z0-9]{4}$' then
      return jsonb_build_object('ok', false, 'reason', 'invalid-unit-format',
                                'unit_id', v_row.unit_id,
                                'license_status', v_row.license_status);
    end if;
    select exists(
      select 1 from public.clients
       where unit_id = p_new_unit_id
                and id is distinct from v_row.id
    ) into v_conflict;
    if v_conflict then
      return jsonb_build_object('ok', false, 'reason', 'unit-conflict',
                                'unit_id', v_row.unit_id,
                                'license_status', v_row.license_status);
    end if;
  end if;

  update public.clients
     set unit_id     = coalesce(p_new_unit_id, unit_id),
         device_code = coalesce(p_new_device_code, device_code),
         install_id  = coalesce(p_new_install_id, install_id),
         app_type    = coalesce(p_app_type, app_type),
         last_seen   = now()
   where id = v_row.id;

  return jsonb_build_object('ok', true, 'reason', 'assigned',
                            'unit_id', coalesce(p_new_unit_id, v_row.unit_id),
                            'license_status', v_row.license_status);
end;
$function$;

-- ============================================================================
-- VERIFIKASI (dieksekusi 2026-10-01, probe REST nyata + sesi anon uji yang
-- dibersihkan habis setelahnya):
--   Tahap 1 (grants+trigger): 10/10 — INSERT kolom sah lolos & tx_adjust 777
--     dipaksa 0; PATCH license_status / tx_adjust / user_id-orang-lain DITOLAK;
--     PATCH profil (jalur sah) lolos; license_status tak ternoda.
--   Tahap 2 (RPC): 10/10 — klaim sah; adopsi legacy + konvergensi unit;
--     baris milik orang lain TIDAK dipindahkan & lisensinya utuh; lintas-app
--     ditolak; format invalid ditolak; serial-not-found utuh.
--   Regresi app: cloud E2E laundry 27/27 (insert clients anon, sinkron profil,
--     aktivasi admin, tx_adjust 50→150, revoked, T12, pending, bukti upload,
--     verifikasi admin → aktif); harness modul laundry 28/28.
-- ============================================================================
