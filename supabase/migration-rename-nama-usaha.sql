-- ============================================================================
-- KASOL — RENAME "nama warung" → "nama usaha" (lebih generik)
-- Jalankan SEKALI via Management API / Supabase SQL Editor.
-- Mengubah:  clients.nama_warung → clients.nama_usaha
--            device_assign      → baca kolom & p_profile 'nama_usaha'
-- Semua aplikasi klien sudah menggunakan format baru bersamaan dengan migrasi ini.
-- ============================================================================

-- 1) Rename kolom pada tabel clients (data lama ikut pindah).
alter table public.clients rename column nama_warung to nama_usaha;

-- 2) Perbarui fungsi device_assign agar baca kolom & p_profile 'nama_usaha'.
create or replace function public.device_assign(
  p_serial          text,
  p_profile         jsonb,        -- { nama_usaha?, nama_pemilik?, no_whatsapp? }
  p_new_unit_id     text,
  p_new_device_code text default null,
  p_new_install_id  text default null,
  p_app_type        text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
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
  -- 1) Temukan baris klien by serial lisensi.
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

  -- 2. Normalisasi profil untuk perbandingan (trim + lower).
  v_cloud_usaha := lower(btrim(coalesce(v_row.nama_usaha, '')));
  v_cloud_wa    := lower(btrim(coalesce(v_row.no_whatsapp, '')));

  v_serial_usaha := lower(btrim(coalesce(p_profile->>'nama_usaha', '')));
  v_serial_wa    := lower(btrim(coalesce(p_profile->>'no_whatsapp', '')));

  v_match_usaha := v_serial_usaha <> '' and v_serial_usaha = v_cloud_usaha;
  v_match_wa    := v_serial_wa <> ''     and v_serial_wa     = v_cloud_wa;

  -- 3) Kalau profil tidak cocok (tidak ada satu sinyal pun yang cocok) → tolak.
  if not (v_match_usaha or v_match_wa) then
    return jsonb_build_object('ok', false, 'reason', 'profile-mismatch',
                              'unit_id', v_row.unit_id,
                              'license_status', v_row.license_status);
  end if;

  -- 4) Hindari konflik unique unit_id: unit_id baru tidak boleh dipakai baris lain.
  if p_new_unit_id is not null then
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

  -- 5) Reassign unit_id ke perangkat baru.
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
$$;

-- Amankan: cabut publik, beri anon & authenticated (dipanggil dari klien).
revoke all on function public.device_assign(text, jsonb, text, text, text, text) from public;
grant execute on function public.device_assign(text, jsonb, text, text, text, text) to anon, authenticated;