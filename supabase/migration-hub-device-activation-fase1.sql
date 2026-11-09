-- =============================================================================
-- HUB — Aktivasi lisensi berbasis akun, maksimal 2 perangkat
-- =============================================================================
-- Portal/akun membuat kode sekali pakai; perangkat menukar kode tersebut.
-- Kode disimpan sebagai hash, bukan plaintext. Kode berlaku singkat.
-- Lisensi tetap satu per akun x aplikasi x outlet; device hanya artefak aktivasi.

begin;

create table if not exists public.hub_activation_codes (
  id                 uuid primary key default gen_random_uuid(),
  license_id         uuid not null references public.licenses(id) on delete cascade,
  code_hash          text not null unique,
  created_by_gid     text references public.global_identities(id) on delete set null,
  expires_at         timestamptz not null default (now() + interval '10 minutes'),
  redeemed_at        timestamptz,
  redeemed_device    text,
  created_at         timestamptz not null default now()
);

create index if not exists hub_activation_codes_license_idx
  on public.hub_activation_codes(license_id, created_at desc);
create index if not exists hub_activation_codes_expiry_idx
  on public.hub_activation_codes(expires_at);

alter table public.hub_activation_codes enable row level security;

-- Portal token → buat kode untuk lisensi miliknya.
create or replace function public.partner_create_activation_code(
  p_token text,
  p_license_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_partner public.referral_partners%rowtype;
  v_license public.licenses%rowtype;
  v_gid text;
  v_code text;
  v_hash text;
begin
  if nullif(btrim(coalesce(p_token, '')), '') is null or p_license_id is null then
    return jsonb_build_object('ok', false, 'code', 'invalid_input', 'reason', 'token dan lisensi wajib diisi');
  end if;

  select * into v_partner
    from public.referral_partners
   where portal_token_hash = encode(extensions.digest(btrim(p_token), 'sha256'), 'hex')
     and (portal_token_expires_at is null or portal_token_expires_at > now())
   limit 1;
  if not found or v_partner.status <> 'aktif' then
    return jsonb_build_object('ok', false, 'code', 'invalid_token', 'reason', 'token tidak valid atau kedaluwarsa');
  end if;

  v_gid := v_partner.global_identity_id;
  select * into v_license from public.licenses where id = p_license_id;
  if not found or v_license.status <> 'active' then
    return jsonb_build_object('ok', false, 'code', 'license_unavailable', 'reason', 'lisensi tidak tersedia');
  end if;
  if v_gid is null or v_license.global_identity_id is distinct from v_gid then
    return jsonb_build_object('ok', false, 'code', 'not_owner', 'reason', 'lisensi bukan milik akun ini');
  end if;
  if v_license.expires_at is not null and v_license.expires_at <= now() then
    return jsonb_build_object('ok', false, 'code', 'license_expired', 'reason', 'lisensi sudah kedaluwarsa');
  end if;

  -- Hanya satu kode aktif per lisensi pada satu waktu.
  update public.hub_activation_codes
     set expires_at = now()
   where license_id = p_license_id
     and redeemed_at is null
     and expires_at > now();

  v_code := 'HUB-' || upper(substr(encode(extensions.gen_random_bytes(8), 'hex'), 1, 12));
  v_hash := encode(extensions.digest(v_code, 'sha256'), 'hex');
  insert into public.hub_activation_codes (license_id, code_hash, created_by_gid)
  values (p_license_id, v_hash, v_gid);

  return jsonb_build_object(
    'ok', true,
    'code', v_code,
    'expires_at', now() + interval '10 minutes',
    'app_type', v_license.app_type,
    'license_id', v_license.id
  );
end;
$$;

-- Perangkat menukar kode. Tidak memakai unit_id sebagai pemilik lisensi.
-- Maksimal 2 device aktif; perangkat ke-3 ditolak, tidak menendang device lama.
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

  select * into v_device from public.license_devices
   where license_id = v_license.id and device_code = btrim(p_device_code)
   limit 1;
  if found and v_device.status = 'active' then
    update public.license_devices set last_seen = now(), device_label = coalesce(nullif(btrim(p_device_label), ''), device_label)
     where id = v_device.id;
    update public.hub_activation_codes set redeemed_at = now(), redeemed_device = btrim(p_device_code) where id = v_code.id;
    return jsonb_build_object('ok', true, 'reason', 'already-active', 'license_id', v_license.id,
      'app_type', v_license.app_type, 'active_devices', (select count(*)::int from public.license_devices where license_id = v_license.id and status = 'active'));
  end if;

  select count(*)::int into v_active from public.license_devices
   where license_id = v_license.id and status = 'active';
  if v_active >= 2 then
    return jsonb_build_object('ok', false, 'code', 'device_limit', 'reason', 'Lisensi ini sudah aktif di 2 perangkat. Hapus/nonaktifkan salah satu perangkat dulu.', 'active_devices', v_active);
  end if;

  -- Serial lama bersifat device-bound; aktivasi baru mendapat serial ringkas
  -- yang dikonsumsi oleh sinkronisasi cloud. Klien menyimpan status dari HUB.
  v_serial := coalesce(v_license.current_serial, upper(v_license.app_type) || '-HUB-' || substr(replace(v_license.id::text, '-', ''), 1, 12));
  insert into public.license_devices (license_id, device_code, device_label, serial, status, activated_at, last_seen)
  values (v_license.id, btrim(p_device_code), nullif(btrim(p_device_label), ''), v_serial, 'active', now(), now());

  update public.hub_activation_codes set redeemed_at = now(), redeemed_device = btrim(p_device_code) where id = v_code.id;
  update public.licenses set current_serial = v_serial, updated_at = now() where id = v_license.id;

  return jsonb_build_object('ok', true, 'reason', 'activated', 'license_id', v_license.id,
    'app_type', v_license.app_type, 'serial', v_serial,
    'active_devices', (select count(*)::int from public.license_devices where license_id = v_license.id and status = 'active'));
exception when unique_violation then
  return jsonb_build_object('ok', false, 'code', 'device_conflict', 'reason', 'Perangkat sudah terdaftar pada lisensi ini');
end;
$$;

revoke all on function public.partner_create_activation_code(text, uuid) from public, anon, authenticated;
grant execute on function public.partner_create_activation_code(text, uuid) to anon, authenticated, service_role;
revoke all on function public.hub_redeem_activation_code(text, text, text, text) from public, anon, authenticated;
grant execute on function public.hub_redeem_activation_code(text, text, text, text) to anon, authenticated, service_role;

drop policy if exists "hub activation codes no direct access" on public.hub_activation_codes;
create policy "hub activation codes no direct access"
  on public.hub_activation_codes for all to anon, authenticated using (false) with check (false);

commit;
