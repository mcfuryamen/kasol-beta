-- ============================================================================
-- AKUN KASOL — FASE B1: LISENSI APLIKASI BERBASIS AKUN (bukan perangkat)
-- ============================================================================
-- Permintaan pemilik (2026-11-04):
--   "karena sudah ada fitur login, ubah lisensi aplikasi menggunakan akun.
--    bukan perangkat lagi. tapi, sistem control bisa menentukan nilai maksimal
--    jumlah perangkat per akun."
--
-- SEBELUM: kaki5/js/license.sync.js membaca `clients` lewat `unit_id` +
--   serial HMAC device-bound. Perangkat = pemilik lisensi.
-- SESUDAH: saat ada SESI Akun Kasol, sumber kebenaran = `licenses` milik
--   `global_identities` (akun), lewat RPC `app_my_license`. Perangkat cuma
--   "tiket masuk" yang didaftarkan di `license_devices`, dibatasi kuota
--   `products.max_devices` yang DIATUR DI CONTROL > KATALOG (satu angka per
--   aplikasi untuk semua akun; lihat migration-hub-device-quota-global.sql).
--
-- Model tiga sumbu tetap dipakai (docs/HUB-DESIGN-DECISIONS.md §4-5):
--   WHO  → global_identities   (akun)
--   APA  → app_memberships     (role per aplikasi: owner/manajer/kasir)
--   MAYA → licenses            (entitas komersial milik akun)
--
-- KASUS PEGAWAI: kasir/manajer login dengan akun SENDIRI, tapi lisensinya
--   milik akun OWNER. Maka pemilik lisensi di-resolve lewat membership owner
--   pada scope outlet yang sama (outlet_ref IS NOT DISTINCT FROM), lalu lisensi
--   itu yang dipakai. Role sesi tetap dikembalikan apa adanya.
--
-- KEAMANAN:
--   · SECURITY DEFINER + `set search_path = ''` (semua objek fully-qualified).
--   · EXECUTE HANYA untuk `authenticated` (+ service_role). anon DITOLAK.
--   · Identitas diambil dari SESI (`current_global_identity_id()`), bukan
--     parameter bebas → klien tidak bisa mengaku akun orang lain.
--   · Kuota penuh → TOLAK (`device_limit`), TIDAK auto-eject perangkat lama.
--     Alasan: ADR §6.2 mewajibkan step-up PIN + throttle transfer sebelum
--     transfer otomatis boleh dipakai; itu belum diimplementasi (improve lagi).
--     Perangkat yang SUDAH aktif tidak pernah digusur (kebijakan Fase 1).
--   · Perangkat `superseded`/`revoked` boleh diaktifkan ulang, tapi tetap
--     dihitung terhadap kuota (tidak boleh menyelip saat kuota penuh).
--   · ANTI CROSS-TENANT: pegawai yang tidak punya lisensi sendiri hanya boleh
--     memakai lisensi owner di scope `outlet_ref` yang SAMA, dan itu pun HANYA
--     bila kandidatnya TEPAT SATU. Kalau >1 (mis. dua owner sama-sama
--     outlet_ref NULL), kembalikan `license_ambiguous` — jangan pernah menebak
--     dan memberi lisensi tenant lain. Perapian scope outlet = improve lanjutan.
--
-- KOMPATIBILITAS: jalur lama (`clients`/`unit_id`) TIDAK dihapus. Dipakai
--   sebagai fallback untuk perangkat yang memilih "Lanjut tanpa akun" atau
--   belum punya akun, supaya tidak ada perangkat berlisensi yang mati mendadak.
--
-- ROLLBACK:
--   drop function if exists public.app_my_license(text, text, text);
-- ============================================================================

begin;

create or replace function public.app_my_license(
  p_app_key       text,
  p_device_code   text,
  p_device_label  text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_gid          text := public.current_global_identity_id();
  v_app          text := nullif(btrim(coalesce(p_app_key, '')), '');
  v_dev          text := nullif(btrim(coalesce(p_device_code, '')), '');
  v_label        text := nullif(btrim(coalesce(p_device_label, '')), '');
  v_ident_status text;
  v_role         text;
  v_outlet       text;
  v_owner_gid    text;
  v_lic          public.licenses%rowtype;
  v_dev_row      public.license_devices%rowtype;
  v_has_dev      boolean := false;
  v_max          integer;
  v_active       integer;
  v_cand         integer := 0;
  v_serial       text;
  v_reason       text;
begin
  if v_gid is null then
    return jsonb_build_object('ok', false, 'code', 'not_signed_in',
      'reason', 'Masuk dengan Akun Kasol dulu.');
  end if;
  if v_app is null or v_dev is null then
    return jsonb_build_object('ok', false, 'code', 'invalid_input',
      'reason', 'Aplikasi dan kode perangkat wajib diisi.');
  end if;

  -- Status 'pending' itu NORMAL (identitas pegawai yang belum daftar, atau akun
  -- yang belum verifikasi WA). HANYA 'suspended' yang diblok.
  select g.status into v_ident_status
    from public.global_identities g where g.id = v_gid;
  if v_ident_status is null then
    return jsonb_build_object('ok', false, 'code', 'identity_missing',
      'reason', 'Identitas akun tidak ditemukan — hubungi admin.');
  end if;
  if v_ident_status = 'suspended' then
    return jsonb_build_object('ok', false, 'code', 'identity_suspended',
      'reason', 'Akun ini sedang ditangguhkan — hubungi admin.');
  end if;

  -- Membership AKTIF untuk aplikasi ini. Auto-provision owner bila akun memegang
  -- lisensi tapi belum punya membership (persis app_my_access, Fase A4).
  select m.role, m.outlet_ref into v_role, v_outlet
    from public.app_memberships m
   where m.global_identity_id = v_gid
     and m.app_key = v_app
     and m.status = 'active'
   order by (m.role = 'owner') desc, m.created_at asc
   limit 1;
  if v_role is null then
    if exists (
      select 1 from public.licenses l
       where l.global_identity_id = v_gid and l.app_type = v_app
    ) then
      insert into public.app_memberships
        (global_identity_id, app_key, role, outlet_ref, status)
      values (v_gid, v_app, 'owner', null, 'active')
      on conflict (global_identity_id, app_key, coalesce(outlet_ref, ''))
      do update set status = 'active', updated_at = now()
      returning role, outlet_ref into v_role, v_outlet;
    end if;
  end if;
  if v_role is null then
    return jsonb_build_object('ok', false, 'code', 'no_access',
      'reason', 'Akun ini belum punya akses ke aplikasi ini. Minta pemilik menambahkanmu sebagai pegawai.');
  end if;

  -- WHO yang membayar: akun sendiri bila pegang lisensi; kalau tidak (pegawai),
  -- owner membership pada scope outlet yang sama yang memiliki lisensi.
  select l.global_identity_id into v_owner_gid
    from public.licenses l
   where l.global_identity_id = v_gid and l.app_type = v_app
   limit 1;
  if v_owner_gid is null then
    -- Hitung kandidat, jangan langsung ambil satu: kalau ada >1 owner dalam
    -- scope outlet yang sama (umum terjadi saat outlet_ref masih NULL), memilih
    -- salah satu = memberi lisensi tenant lain ke pegawai ini.
    select count(*)::int, min(m.global_identity_id) into v_cand, v_owner_gid
      from public.app_memberships m
     where m.app_key = v_app
       and m.role = 'owner'
       and m.status = 'active'
       and m.outlet_ref is not distinct from v_outlet
       and exists (
         select 1 from public.licenses l
          where l.global_identity_id = m.global_identity_id
            and l.app_type = v_app
       );
    if v_cand = 0 then
      v_owner_gid := null;
    elsif v_cand > 1 then
      return jsonb_build_object('ok', false, 'code', 'license_ambiguous',
        'reason', 'Beberapa pemilik lisensi ditemukan untuk aplikasi ini — minta admin merapikan scope outlet akun.');
    end if;
  end if;
  if v_owner_gid is null then
    return jsonb_build_object('ok', false, 'code', 'no_license',
      'reason', 'Belum ada lisensi aktif untuk akun ini. Aktifkan lisensi lewat HUB / Control.');
  end if;

  -- Lisensi milik AKUN. Di-lock agar kuota tidak dobel-spend saat 2 perangkat
  -- aktivasi bersamaan (ADR §6.1).
  select * into v_lic
    from public.licenses
   where global_identity_id = v_owner_gid
     and app_type = v_app
   order by (status = 'active') desc,
            (expires_at is null) desc,
            expires_at desc nulls last,
            created_at asc
   limit 1
   for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'no_license',
      'reason', 'Belum ada lisensi aktif untuk akun ini.');
  end if;
  if v_lic.status <> 'active' then
    return jsonb_build_object('ok', false, 'code', 'license_revoked',
      'reason', 'Lisensi akun ini sudah dinonaktifkan — hubungi admin.');
  end if;
  if v_lic.expires_at is not null and v_lic.expires_at <= now() then
    return jsonb_build_object('ok', false, 'code', 'license_expired',
      'reason', 'Lisensi akun ini sudah kedaluwarsa — perpanjang lewat HUB.');
  end if;

  -- SATU-SATUNYA sumber kebenaran kuota = `products.max_devices` (diatur di
  -- Control > Katalog, berlaku untuk SEMUA akun aplikasi ini). Helper membaca
  -- lewat v_lic.product_id; fallback 2 bila produk belum punya angka.
  -- `licenses.max_devices` kini cuma mirror yang dijaga trigger — jangan dipakai
  -- sebagai sumber (lihat migration-hub-device-quota-global.sql).
  v_max := public.product_device_quota(v_lic.product_id);

  select * into v_dev_row
    from public.license_devices
   where license_id = v_lic.id and device_code = v_dev
   limit 1;
  v_has_dev := found;   -- simpan: SELECT count(*) di bawah menimpa FOUND

  v_serial := coalesce(
    nullif(v_dev_row.serial, ''),
    nullif(v_lic.current_serial, ''),
    upper(v_app) || '-HUB-' || substr(replace(v_lic.id::text, '-', ''), 1, 12)
  );

  if v_has_dev and v_dev_row.status = 'active' then
    -- Perangkat ini sudah terdaftar. Kebijakan Fase 1: TIDAK digusur walau
    -- admin menurunkan max_devices di bawah jumlah perangkat aktif.
    update public.license_devices
       set last_seen = now(),
           device_label = coalesce(v_label, device_label),
           serial = v_serial
     where id = v_dev_row.id;
    v_reason := 'already-active';
  else
    select count(*)::int into v_active
      from public.license_devices
     where license_id = v_lic.id and status = 'active';
    if v_active >= v_max then
      return jsonb_build_object(
        'ok', false, 'code', 'device_limit',
        'reason', 'Lisensi akun ini sudah aktif di ' || v_max
                  || ' perangkat. Minta admin menaikkan kuota atau menonaktifkan salah satu perangkat dulu.',
        'active_devices', v_active, 'max_devices', v_max,
        'license_id', v_lic.id);
    end if;

    if v_has_dev then
      update public.license_devices
         set status = 'active',
             serial = v_serial,
             device_label = coalesce(v_label, device_label),
             activated_at = now(),
             last_seen = now(),
             superseded_at = null
       where id = v_dev_row.id;
      v_reason := 'reactivated';
    else
      insert into public.license_devices
        (license_id, device_code, device_label, serial, status, activated_at, last_seen)
      values
        (v_lic.id, v_dev, v_label, v_serial, 'active', now(), now());
      v_reason := 'activated';
    end if;
    update public.licenses
       set current_serial = v_serial, updated_at = now()
     where id = v_lic.id;
  end if;

  select count(*)::int into v_active
    from public.license_devices
   where license_id = v_lic.id and status = 'active';

  -- Bentuk respons sengaja MIRIP baris `clients` (license_status/license_serial/
  -- license_expires_at) supaya lapisan lisensi klien yang sudah ada mudah
  -- mengonsumsinya tanpa mengubah validateSerial/getLicenseStatus.
  return jsonb_build_object(
    'ok', true, 'source', 'account', 'code', v_reason,
    'license_id', v_lic.id, 'app_type', v_app,
    'status', 'active', 'license_status', 'aktif',
    'license_serial', v_serial,
    'license_expires_at', v_lic.expires_at,
    'max_devices', v_max, 'active_devices', v_active,
    'role', v_role, 'gid', v_gid, 'owner_gid', v_owner_gid,
    'tx_month', v_lic.tx_month, 'tx_used', v_lic.tx_used, 'tx_adjust', v_lic.tx_adjust
  );
exception
  when unique_violation then
    return jsonb_build_object('ok', false, 'code', 'device_conflict',
      'reason', 'Perangkat sudah terdaftar pada lisensi ini — coba lagi.');
end;
$$;

revoke all on function public.app_my_license(text, text, text) from public, anon, authenticated;
grant execute on function public.app_my_license(text, text, text) to authenticated, service_role;

comment on function public.app_my_license(text, text, text) is
  'Fase B1: status+aktivasi lisensi BERBASIS AKUN. Kuota perangkat dari products.max_devices (diatur di Control > Katalog, berlaku semua akun).';

commit;
