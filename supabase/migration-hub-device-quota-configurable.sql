-- HUB — KUOTA PERANGKAT PER LISENSI = DAPAT DIATUR DARI CONTROL
-- =============================================================================
-- MASALAH (temuan 2026-11-04):
--   `hub_redeem_activation_code` dan `license_activate_device` memakai batas
--   `>= 2` HARDCODE. Akibatnya kolom `licenses.max_devices` — yang dipakai
--   Control untuk menampilkan jatah (control/js/clients.js:802 `deviceQuota`) dan
--   yang diatur admin — DIABAIKAN sepenuhnya:
--     · lisensi max_devices=1 tetap bisa 2 perangkat (terlalu longgar)
--     · lisensi max_devices=3 tetap mentok 2 perangkat (terlalu ketat)
--
-- SESUDAH INI:
--   Sumber kebenaran kuota = `products.max_devices` yang DIATUR DI KATALOG
--   (lihat migration-hub-device-quota-global.sql, keputusan 2026-11-05: satu
--   angka per aplikasi, semua akun merujuk ke sana, perubahan otomatis berlaku).
--   `licenses.max_devices` sekarang mirror yang dijaga trigger. Fallback 2
--   dipakai HANYA bila produk belum punya angka/NULL/0.
--
-- CATATAN KEBIJAKAN: perangkat yang SUDAH aktif tidak digusur — kuota hanya
-- menahan aktivasi BARU (perilaku lama dipertahankan).
--
-- Rollback: jalankan lagi supabase/migration-hub-device-limit-2.sql (kembali ke
--   hardcode 2) + migration-hub-device-activation-fase1.sql untuk fungsi kode.

begin;

-- ── 1) Aktivasi via kode (jalur HUB) ────────────────────────────────────────
create or replace function public.hub_redeem_activation_code(
  p_code text,
  p_device_code text,
  p_device_label text default null,
  p_install_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_code public.hub_activation_codes%rowtype;
  v_license public.licenses%rowtype;
  v_device public.license_devices%rowtype;
  v_hash text;
  v_active integer;
  v_max integer;
  v_serial text;
begin
  if nullif(btrim(coalesce(p_code, '')), '') is null
     or nullif(btrim(coalesce(p_device_code, '')), '') is null then
    return jsonb_build_object('ok', false, 'code', 'invalid_input', 'reason', 'kode dan perangkat wajib diisi');
  end if;

  v_hash := encode(extensions.digest(upper(btrim(p_code)), 'sha256'), 'hex');
  select * into v_code from public.hub_activation_codes
   where code_hash = v_hash for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'invalid_code', 'reason', 'kode aktivasi tidak valid');
  end if;
  if v_code.redeemed_at is not null then
    return jsonb_build_object('ok', false, 'code', 'already_used', 'reason', 'kode aktivasi sudah dipakai');
  end if;
  if v_code.expires_at <= now() then
    return jsonb_build_object('ok', false, 'code', 'expired_code', 'reason', 'kode aktivasi sudah kedaluwarsa');
  end if;

  select * into v_license from public.licenses where id = v_code.license_id for update;
  if not found or v_license.status <> 'active' then
    return jsonb_build_object('ok', false, 'code', 'license_unavailable', 'reason', 'lisensi tidak aktif');
  end if;
  if v_license.expires_at is not null and v_license.expires_at <= now() then
    return jsonb_build_object('ok', false, 'code', 'license_expired', 'reason', 'lisensi sudah kedaluwarsa');
  end if;

  -- KUOTA = products.max_devices (Katalog, berlaku semua akun) — bukan lagi
  -- licenses.max_devices dan bukan hardcode. Lihat
  -- migration-hub-device-quota-global.sql.
  v_max := public.product_device_quota(v_license.product_id);

  select * into v_device from public.license_devices
   where license_id = v_license.id and device_code = btrim(p_device_code)
   limit 1;
  if found and v_device.status = 'active' then
    update public.license_devices set last_seen = now(), device_label = coalesce(nullif(btrim(p_device_label), ''), device_label)
     where id = v_device.id;
    update public.hub_activation_codes set redeemed_at = now(), redeemed_device = btrim(p_device_code) where id = v_code.id;
    return jsonb_build_object('ok', true, 'reason', 'already-active', 'license_id', v_license.id,
      'app_type', v_license.app_type, 'max_devices', v_max,
      'active_devices', (select count(*)::int from public.license_devices where license_id = v_license.id and status = 'active'));
  end if;

  select count(*)::int into v_active from public.license_devices
   where license_id = v_license.id and status = 'active';
  if v_active >= v_max then
    return jsonb_build_object('ok', false, 'code', 'device_limit',
      'reason', 'Lisensi ini sudah aktif di ' || v_max || ' perangkat. Hapus/nonaktifkan salah satu perangkat dulu.',
      'active_devices', v_active, 'max_devices', v_max);
  end if;

  -- Serial lama bersifat device-bound; aktivasi baru mendapat serial ringkas
  -- yang dikonsumsi oleh sinkronisasi cloud. Klien menyimpan status dari HUB.
  v_serial := coalesce(v_license.current_serial, upper(v_license.app_type) || '-HUB-' || substr(replace(v_license.id::text, '-', ''), 1, 12));
  insert into public.license_devices (license_id, device_code, device_label, serial, status, activated_at, last_seen)
  values (v_license.id, btrim(p_device_code), nullif(btrim(p_device_label), ''), v_serial, 'active', now(), now());

  update public.hub_activation_codes set redeemed_at = now(), redeemed_device = btrim(p_device_code) where id = v_code.id;
  update public.licenses set current_serial = v_serial, updated_at = now() where id = v_license.id;

  return jsonb_build_object('ok', true, 'reason', 'activated', 'license_id', v_license.id,
    'app_type', v_license.app_type, 'serial', v_serial, 'max_devices', v_max,
    'active_devices', (select count(*)::int from public.license_devices where license_id = v_license.id and status = 'active'));
exception when unique_violation then
  return jsonb_build_object('ok', false, 'code', 'device_conflict', 'reason', 'Perangkat sudah terdaftar pada lisensi ini');
end;
$$;

revoke all on function public.hub_redeem_activation_code(text, text, text, text) from public, anon, authenticated;
grant execute on function public.hub_redeem_activation_code(text, text, text, text) to anon, authenticated, service_role;

-- ── 2) Aktivasi device (jalur admin/legacy, service_role) ───────────────────
create or replace function public.license_activate_device(
  p_license_id    uuid,
  p_device_code   text,
  p_device_label  text default null,
  p_serial        text default null,
  p_exp_code      text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_lic        public.licenses%rowtype;
  v_active     integer;
  v_max        integer;
  v_old_id     uuid;
  v_old_status text;
  v_gid        text;
begin
  if nullif(btrim(coalesce(p_device_code, '')), '') is null then
    return jsonb_build_object('ok', false, 'reason', 'missing-device-code');
  end if;

  select * into v_lic from public.licenses where id = p_license_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'license-not-found');
  end if;
  if v_lic.status <> 'active' then
    return jsonb_build_object('ok', false, 'reason', 'license-' || v_lic.status);
  end if;
  if v_lic.expires_at is not null and v_lic.expires_at <= now() then
    return jsonb_build_object('ok', false, 'reason', 'license-expired');
  end if;

  v_gid := public.current_global_identity_id();
  if auth.role() <> 'service_role'
     and v_gid is not null
     and v_lic.global_identity_id is distinct from v_gid then
    return jsonb_build_object('ok', false, 'reason', 'not-owner');
  end if;

  -- KUOTA = products.max_devices (Katalog, berlaku semua akun).
  v_max := public.product_device_quota(v_lic.product_id);

  select id, status into v_old_id, v_old_status
    from public.license_devices
   where license_id = p_license_id
     and device_code = btrim(p_device_code)
   limit 1;

  if v_old_id is not null and v_old_status = 'active' then
    update public.license_devices
       set last_seen = now(),
           device_label = coalesce(nullif(btrim(p_device_label), ''), device_label),
           serial = coalesce(nullif(btrim(p_serial), ''), serial)
     where id = v_old_id;
    return jsonb_build_object(
      'ok', true, 'reason', 'already-active', 'license_id', p_license_id,
      'device_code', p_device_code, 'max_devices', v_max,
      'active_devices', (select count(*)::int from public.license_devices where license_id = p_license_id and status = 'active')
    );
  end if;

  select count(*)::int into v_active
    from public.license_devices
   where license_id = p_license_id and status = 'active';

  if v_active >= v_max then
    return jsonb_build_object(
      'ok', false, 'reason', 'device-limit',
      'message', 'Lisensi ini sudah aktif di ' || v_max || ' perangkat. Nonaktifkan salah satu perangkat dari HUB terlebih dahulu.',
      'active_devices', v_active, 'max_devices', v_max
    );
  end if;

  insert into public.license_devices
    (license_id, device_code, device_label, serial, status, activated_at, last_seen)
  values
    (p_license_id, btrim(p_device_code), nullif(btrim(p_device_label), ''), nullif(btrim(p_serial), ''), 'active', now(), now())
  on conflict (license_id, device_code) do update
    set status = 'active',
        device_label = coalesce(excluded.device_label, public.license_devices.device_label),
        serial = coalesce(excluded.serial, public.license_devices.serial),
        last_seen = now(),
        superseded_at = null;

  return jsonb_build_object(
    'ok', true, 'reason', 'activated', 'license_id', p_license_id,
    'device_code', p_device_code, 'max_devices', v_max,
    'active_devices', (select count(*)::int from public.license_devices where license_id = p_license_id and status = 'active')
  );
exception when unique_violation then
  return jsonb_build_object('ok', false, 'reason', 'device-conflict');
end;
$$;

revoke all on function public.license_activate_device(uuid, text, text, text, text) from public, anon, authenticated;
grant execute on function public.license_activate_device(uuid, text, text, text, text) to service_role;

commit;
