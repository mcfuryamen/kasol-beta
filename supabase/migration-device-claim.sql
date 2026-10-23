-- ============================================================================
-- KASOL — DEVICE CLAIM (onboarding once-per-device + ownership lintas-browser)
-- SUDAH DITERAPKAN via Supabase Management API (POST /v1/projects/hhywrvedlwljawgxzpkq/database/query) pada proyek mcfury's Project. File disimpan sebagai referensi (idempotent: create or replace).
--
-- Latar: RLS `clients own select` = auth.uid() = user_id. Perangkat fisik yang
-- sama tetapi ganti browser mendapat anonymous user BARU, sehingga SELECT/UPDATE
-- baris `clients` lama ditolak RLS → app tidak bisa:
--   (1) mendeteksi bahwa perangkat sudah pernah dipakai (onboarding muncul lagi)
--   (2) unlock lisensi cloud (fetchLicenseStatusFromCloud) lintas browser
--
-- Solusi: fungsi `device_known()` dengan SECURITY DEFINER (melewati RLS) yang:
--   1) memeriksa apakah perangkat sudah terdaftar di `clients`, dicocokkan
--      dengan unit_id ATAU device_code. device_code = fingerprint hardware
--      stabil & deterministik per perangkat, jadi andal walau unit_id berubah
--      antar-versi (lihat bug: unit_id lama 'K5-01UP-IC0L' vs baru 'K5-00HC-IS07'
--      untuk device yang sama -> device_known false & onboarding muncul lagi).
--   2) jika YA → pindahkan kepemilikan baris ke anonymous user pemanggil
--      (auth.uid()), lalu perbarui unit_id (bentuk kanonikal K5-<deviceCode>),
--      device_code, app_type, last_seen.
--      Setelah ini, anon pemanggil jadi OWNER → SELECT/UPDATE RLS normal jalan,
--      dan lisensi cloud bisa dibaca & di-unlock lintas browser.
--   3) return true (perangkat sudah dikenal) / false (baris baru / belum ada).
--
-- Keamanan: device_code / unit_id (K5-XXXX-XXXX, 8 karakter base36) sulit
-- ditebak. Fungsi hanya mengembalikan boolean (tanpa data baris). GRANT EXECUTE
-- dibatasi ke role anon & authenticated.
-- ============================================================================

create or replace function public.device_known(
  p_unit_id     text,
  p_device_code text default null,
  p_app_type    text default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_found_id   uuid;
  v_exists     boolean;
begin
  -- Match by unit_id KANONIKAL dulu (unit_id = K5-<deviceCode> adalah bentuk
    -- paling deterministik & diclaim oleh row Sate Bocil). Fallback device_code
    -- HANYA bila unit_id tidak ketemu. Ini mencegah memilih row yang device_code-nya
    -- sama tapi unit_id beda, lalu update unit_id -> duplicate key violation.
    select id into v_found_id
      from public.clients
     where unit_id = p_unit_id
     limit 1;

    if v_found_id is null and p_device_code is not null then
      select id into v_found_id
        from public.clients
       where device_code = p_device_code
       limit 1;
    end if;

  v_exists := v_found_id is not null;

  if v_exists then
    update public.clients
       set user_id     = auth.uid(),
           unit_id     = coalesce(p_unit_id, unit_id),
           device_code = coalesce(p_device_code, device_code),
           app_type    = coalesce(p_app_type, app_type),
           last_seen   = now()
     where id = v_found_id;
  end if;

  return v_exists;
end;
$$;

-- Amankan: cabut EXECUTE publik, beri hanya anon & authenticated.
revoke all on function public.device_known(text, text, text) from public;
grant execute on function public.device_known(text, text, text) to anon, authenticated;

-- Sanity check cepat (harus mengembalikan satu baris dengan device_known = false
-- untuk unit_id yang tidak pernah terdaftar):
-- select public.device_known('K5-TEST-NONE', null, 'kaki5');
