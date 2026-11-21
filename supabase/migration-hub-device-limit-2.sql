-- HUB — enforce maksimal 2 perangkat per lisensi
-- Perubahan policy: perangkat ke-3 ditolak, perangkat lama tidak digusur.

begin;

-- Semua lisensi HUB yang sudah ada ikut aturan akun: maksimal 2 perangkat.
update public.licenses
   set max_devices = 2,
       plan = case when plan = 'single' then 'multi' else plan end,
       updated_at = now()
 where max_devices <> 2;

-- Handoff baru sudah menegakkan kuota. RPC legacy ini juga diperketat agar
-- jalur lama tidak dapat menggusur device tertua.
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
  v_lic       public.licenses%rowtype;
  v_active    integer;
  v_old_id    uuid;
  v_old_status text;
  v_gid       text;
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
      'ok', true,
      'reason', 'already-active',
      'license_id', p_license_id,
      'device_code', p_device_code,
      'active_devices', (select count(*)::int from public.license_devices where license_id = p_license_id and status = 'active')
    );
  end if;

  select count(*)::int into v_active
    from public.license_devices
   where license_id = p_license_id and status = 'active';

  if v_active >= 2 then
    return jsonb_build_object(
      'ok', false,
      'reason', 'device-limit',
      'message', 'Lisensi ini sudah aktif di 2 perangkat. Nonaktifkan salah satu perangkat dari HUB terlebih dahulu.',
      'active_devices', v_active,
      'max_devices', 2
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
    'ok', true,
    'reason', 'activated',
    'license_id', p_license_id,
    'device_code', p_device_code,
    'active_devices', (select count(*)::int from public.license_devices where license_id = p_license_id and status = 'active'),
    'max_devices', 2
  );
exception when unique_violation then
  return jsonb_build_object('ok', false, 'reason', 'device-conflict');
end;
$$;

revoke all on function public.license_activate_device(uuid, text, text, text, text) from public, anon, authenticated;
grant execute on function public.license_activate_device(uuid, text, text, text, text) to service_role;

commit;
