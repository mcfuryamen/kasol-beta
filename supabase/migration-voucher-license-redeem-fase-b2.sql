-- KASOL — Tahap B: redeem voucher menjadi lisensi instan
-- Idempoten untuk fungsi/index/grant. Terapkan setelah migration-mitra-referral-fase3-klien.sql
-- Tidak mengaktifkan HUB login; voucher tetap dapat dipakai oleh clients yang sudah terdaftar.

create or replace function public._license_code_b32_prefix(p_bytes bytea, p_len integer default 6)
returns text
language plpgsql immutable
set search_path = ''
as $$
declare
  alphabet text := '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  out_text text := '';
  bit_count integer := 0;
  buffer bigint := 0;
  i integer;
  b integer;
  value integer;
begin
  if p_bytes is null or p_len < 1 or p_len > 32 then return ''; end if;
  for i in 0..(length(p_bytes) - 1) loop
    b := get_byte(p_bytes, i);
    buffer := ((buffer << 8) | b) & 4294967295;
    bit_count := bit_count + 8;
    while bit_count >= 5 and length(out_text) < p_len loop
      value := ((buffer >> (bit_count - 5)) & 31)::integer;
      out_text := out_text || substr(alphabet, value + 1, 1);
      bit_count := bit_count - 5;
    end loop;
    exit when length(out_text) >= p_len;
  end loop;
  while length(out_text) < p_len loop
    out_text := out_text || '2';
  end loop;
  return out_text;
end;
$$;

create or replace function public.code_redeem_license(
  p_code        text,
  p_unit_id     text,
  p_device_code text,
  p_install_id  text default null,
  p_app_type    text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_code text := upper(btrim(coalesce(p_code, '')));
  v_app text := coalesce(nullif(btrim(coalesce(p_app_type, '')), ''), 'kaki5');
  v_client public.clients%rowtype;
  v_lc public.license_codes%rowtype;
  v_product public.products%rowtype;
  v_license public.licenses%rowtype;
  v_device public.license_devices%rowtype;
  v_prefix text;
  v_exp text;
  v_serial text;
  v_sig bytea;
  v_existing uuid;
  v_points integer := 0;
  v_cycle integer := 30;
  v_cfg jsonb := '{}'::jsonb;
begin
  if v_code = '' or nullif(btrim(coalesce(p_unit_id, '')), '') is null
     or nullif(btrim(coalesce(p_device_code, '')), '') is null then
    return jsonb_build_object('ok', false, 'reason', 'Kode, unit, dan perangkat wajib diisi.');
  end if;

  select * into v_client from public.clients
   where unit_id = p_unit_id
   for update;
  if not found and p_device_code is not null then
    select * into v_client from public.clients
     where device_code = p_device_code and app_type = v_app
     for update;
  end if;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'Perangkat belum terdaftar. Buka app dulu lalu coba lagi.');
  end if;

  select * into v_lc from public.license_codes
   where upper(code) = v_code and kind = 'voucher'
   for update;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'Voucher lisensi nggak ketemu.');
  end if;
  if v_lc.status = 'dibatalkan' or v_lc.expires_at <= now() then
    return jsonb_build_object('ok', false, 'reason', 'Voucher ini sudah tidak berlaku.');
  end if;
  if v_lc.app_type is distinct from '*' and v_lc.app_type is distinct from v_app then
    return jsonb_build_object('ok', false, 'reason', 'Voucher ini bukan untuk aplikasi ini.');
  end if;
  if coalesce(v_lc.grant_exp_code, '') = '' then
    return jsonb_build_object('ok', false, 'reason', 'Voucher ini tidak memiliki hak lisensi.');
  end if;
  if v_lc.redeem_max_uses is not null and v_lc.redeem_used_count >= v_lc.redeem_max_uses then
    return jsonb_build_object('ok', false, 'reason', 'Voucher ini sudah habis dipakai.');
  end if;
  if v_lc.redeemed_by_client_id = v_client.id and v_lc.redeemed_by_device_code = p_device_code then
    return jsonb_build_object('ok', true, 'already', true, 'code', v_lc.code,
      'license_id', v_lc.license_id, 'serial', v_lc.serial_issued, 'message', 'Voucher sudah aktif di perangkat ini.');
  end if;
  if v_lc.redeemed_by_client_id is not null then
    return jsonb_build_object('ok', false, 'reason', 'Voucher ini sudah dipakai di perangkat lain.');
  end if;

  select * into v_product from public.products
   where app_type = v_app and visible = true
   order by (status = 'live') desc, id limit 1;
  if not found or nullif(btrim(coalesce(v_product.salt, '')), '') is null then
    return jsonb_build_object('ok', false, 'reason', 'Konfigurasi lisensi aplikasi belum siap.');
  end if;
  v_prefix := coalesce(nullif(btrim(v_product.kode_produk), ''), upper(v_app));
  v_exp := lpad(coalesce(v_lc.grant_exp_code, '99'), 2, '0');
  -- pgcrypto hmac(data, key, type) harus sama dengan license-core.js:
  -- key = salt, payload = salt + normalizedDevice + expiry.
  v_sig := extensions.hmac(
    upper(substr(regexp_replace(p_device_code, '[^A-Za-z0-9]', '', 'g') || 'XXXXXXXX', 1, 4))
      || upper(substr(regexp_replace(p_device_code, '[^A-Za-z0-9]', '', 'g') || 'XXXXXXXX', 5, 4))
      || v_exp,
    v_product.salt,
    'sha256'
  );
  v_serial := v_prefix || '-' || upper(substr(regexp_replace(p_device_code, '[^A-Za-z0-9]', '', 'g') || 'XXXXXXXX', 1, 4))
    || '-' || upper(substr(regexp_replace(p_device_code, '[^A-Za-z0-9]', '', 'g') || 'XXXXXXXX', 5, 4))
    || '-' || v_exp || '-' || public._license_code_b32_prefix(v_sig, 6);

  select l.id into v_existing from public.licenses l
   where l.outlet_ref = v_client.unit_id and l.product_id = v_product.id and l.status = 'active'
   limit 1;
  if found then
    return jsonb_build_object('ok', false, 'reason', 'Perangkat ini sudah memiliki lisensi aktif.');
  end if;

  insert into public.licenses (
    product_id, app_type, outlet_ref, source_client_id, plan, max_devices,
    status, expires_at, current_serial, tx_month, tx_used
  ) values (
    v_product.id, v_app, v_client.unit_id, v_client.id,
    coalesce(v_lc.grant_plan, 'single'), greatest(coalesce(v_lc.grant_max_devices, 1), 1),
    'active', case when v_exp = '99' then null else now() + (v_exp || ' months')::interval end,
    v_serial, v_client.tx_month, 0
  ) returning * into v_license;

  insert into public.license_devices (license_id, device_code, serial, status, last_seen)
  values (v_license.id, p_device_code, v_serial, 'active', now())
  returning * into v_device;

  update public.license_codes set
    redeem_used_count = redeem_used_count + 1,
    redeemed_by_client_id = v_client.id,
    redeemed_by_unit_id = v_client.unit_id,
    redeemed_by_device_code = p_device_code,
    license_id = v_license.id,
    serial_issued = v_serial,
    status = case when redeem_max_uses is not null and redeem_used_count + 1 >= redeem_max_uses then 'terpakai' else status end,
    updated_at = now()
   where id = v_lc.id;

  update public.clients set
    license_status = 'aktif', license_serial = v_serial,
    license_expires_at = v_license.expires_at, status = 'aktif',
    voucher_id = v_lc.id, purchase_code = v_lc.code,
    purchase_discount = greatest(coalesce(v_lc.discount_value, 0), 0),
    price_paid = coalesce(v_lc.price_paid, 0), referred_by_code = v_lc.code,
    activated_at = now(), verified_at = now(), restored_at = now(), updated_at = now()
   where id = v_client.id;

  insert into public.code_redemptions (
    code_id, code, channel, client_id, unit_id, app_type, discount_value,
    points_awarded, referrer_client_id, referrer_partner_id, status,
    referee_name, referee_city, referee_phone
  ) values (
    v_lc.id, v_lc.code, 'lisensi', v_client.id, v_client.unit_id, v_app,
    greatest(coalesce(v_lc.discount_value, 0), 0), 0,
    v_lc.owner_client_id, v_lc.owner_partner_id, 'berhasil',
    coalesce(v_client.nama_usaha, v_client.nama_pemilik), v_client.kabkota,
    public.partner_norm_wa(v_client.no_whatsapp)
  );

  return jsonb_build_object('ok', true, 'already', false, 'code', v_lc.code,
    'license_id', v_license.id, 'serial', v_serial,
    'expires_at', v_license.expires_at, 'app_type', v_app);
exception when unique_violation then
  return jsonb_build_object('ok', false, 'reason', 'Lisensi untuk perangkat ini baru saja dibuat. Buka ulang aplikasi.');
end;
$$;

revoke all on function public._license_code_b32_prefix(bytea, integer) from public, anon, authenticated;
revoke all on function public.code_redeem_license(text, text, text, text, text) from public;
grant execute on function public.code_redeem_license(text, text, text, text, text) to anon, authenticated, service_role;

comment on function public.code_redeem_license(text, text, text, text, text) is
  'Client-facing atomic voucher-to-license redemption; serial HMAC is generated server-side.';
