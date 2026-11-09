-- ============================================================================
-- KASOL — HUB: AKUN UTAMA + LISENSI BERBASI AKUN (Phase 0)
-- ============================================================================
-- Keputusan desain pemilik (2026-10-20):
--   "Lisensi mengacu pada identitas profil akun. Klien mau pindah perangkat
--    terserah dia. Jatahnya tetap satu perangkat per aplikasi, kecuali pilih
--    opsi multi perangkat."
--
-- Prinsip: SATU AKUN (Gmail-like) untuk login ke banyak app, TAPI lisensi
-- tetap terpisah per aplikasi. Tiga sumbu independen:
--   WHO  → global_identities   (akun utama, kunci = nomor WhatsApp E.164)
--   APA  → app_memberships     (hak akses per app, role per-aplikasi)
--   MAYA → licenses            (entitas komersial per app × outlet)
--
-- Serial TIDAK berubah sama sekali:
--   serial = HMAC(salt_produk, deviceCode + expCode)  → tetap device-bound.
--   Yang berubah adalah ARTIFAK AKTIVASI per perangkat (license_devices),
--   bukan kryptografinya. Server tinggal mint serial baru saat perangkat
--   pindah. Tidak ada versioning format, tidak ada salt baru.
--
-- TUJUAN MIGRASI INI: schema + RLS + RPC + backfill. BELUM ada UI.
--
-- ============================================================================
-- KETENTUAN LIVE (hasil audit 2026-10-20, project hhywrvedlwljawgxzpkq):
--   • clients : 23 baris, 1 baris per (device × app). unit_id UNIQUE global.
--               Kolom lisensi/kuota dijaga trigger clients_guard_admin_columns.
--               RLS: "clients hybrid select/insert/update" (auth.uid() = user_id
--               ATAU jwt claim unit_id cocok).
--   • products: 10 produk, 5 punya salt (kaki5/rosok/minimarket/laundry/retail).
--   • profiles: 22 baris, SUDAH PUNYA kolom phone_e164 → inicedent kunci akun.
--   • outlet_memberships (minimarket): user_id × outlet_id × role → pola
--               membership SUDAH ada di domain minimarket; app_memberships
--               mengikuti pola yang sama tapi lintas-app.
--   • identity_recovery_challenges / identity_security_events: kolom
--               global_identity_id bertipe TEXT (bukan uuid) → global_identities
--               memakai id TEXT agar dua tabel itu bisa di-FK-kan tanpa
--               migrasi tipe di kemudian hari.
--   • clients yang punya serial: hanya 4 dari 23 → backfill kecil & aman.
--
-- JEBakan yang sudah ditangani di file ini:
--   1. KUOTA DOBEL-SPEND — counter tx_* dipindah ke level lisensi, bukan
--      level baris client. Satu lisensi = satu kuota, berapa pun jumlah
--      perangkatnya. (Bug sejenis sudah pernah terjadi: 3 device duplikat di live.)
--   2. SERIAL BUKAN UNIK GLOBAL — license_devices TIDAK punya UNIQUE(serial),
--      karena serial = f(produk, device, expiry) sehingga device yang sama
--      yang aktivasi ulang menghasilkan serial identik.
--   3. ANTI-SHARING — transfer dicatat (transfer_count, last_transfer_at) dan
--      bisa dibatasi server-side;evice_label bikin pemilik bisa lihat siapa
--      yang aktif.
--
-- Dijalankan via Management API:
--   POST /v1/projects/hhywrvedlwljawgxzpkq/database/query
-- File ini IDEMPOTENT — aman dijalankan ulang.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 0) HELPER: resolusi identitas pemanggil
-- ----------------------------------------------------------------------------
-- Session Hub = JWT yang Ditandatangani server dengan claim:
--   sub       = uuid (agar auth.uid() tetap berfungsi)
--   gid       = global_identity_id (kunci utama)
--   app_key   = aplikasi yang sedang diakses (kaki5|rosok|...)
--   role      = role per-aplikasi
--   membership_id, session_version, exp
-- Ini persis kontrak appSession di tpa/IDENTITY-CONTRACT.md.
--
-- Sengaja TIDAK membaca tabel apa pun → tidak ada risiko recursive RLS.
-- Fallback ke profiles dilakukan di server (service_role), bukan di policy.
create or replace function public.current_global_identity_id()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    nullif(auth.jwt() ->> 'gid', ''),
    nullif(auth.jwt() -> 'user_metadata' ->> 'gid', '')
  )
$$;

create or replace function public.current_app_key()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    nullif(auth.jwt() ->> 'app_key', ''),
    nullif(auth.jwt() -> 'user_metadata' ->> 'app_key', '')
  )
$$;


-- ----------------------------------------------------------------------------
-- 1) global_identities — AKUN UTAMA (WHO)
-- ----------------------------------------------------------------------------
-- id TEXT: nilai uuid-string. Dipakai TEXT karena tabel identity_recovery_
-- challenges & identity_security_events sudah memakai TEXT untuk
-- global_identity_id → FK ke sini bisa langsung ditambahkan nanti.
create table if not exists public.global_identities (
  id                 text primary key default gen_random_uuid()::text,
  phone_e164         text not null unique,
  display_name       text,
  phone_verified_at  timestamptz,
  status             text not null default 'pending'
                       check (status in ('pending','active','suspended')),
  -- auth_user_id: kalau akun Hub dibuat lewat Supabase Auth (WA+PIN pada
  -- email sintetis <nomor>@accounts.kasirsolo.local, pola yang sudah dipakai
  -- TPA), profile-nya ditautkan ke sini.
  auth_user_id       uuid unique references auth.users(id) on delete set null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index if not exists global_identities_status_idx
  on public.global_identities (status);
create index if not exists global_identities_auth_user_idx
  on public.global_identities (auth_user_id);

drop trigger if exists global_identities_set_updated on public.global_identities;
create trigger global_identities_set_updated
  before update on public.global_identities
  for each row execute function public.set_updated_at();


-- ----------------------------------------------------------------------------
-- 2) licenses — ENTITAS LISENSI KOMERSIAL (MAYA)
-- ----------------------------------------------------------------------------
-- Satu lisensi = satu (akun × aplikasi × outlet). Punya N perangkat sesuai
-- max_devices (1 = default / single, >1 = paket multi-perangkat).
--
-- Serial TIDAK disimpan sebagai kolom "lisensi" tunggal; yang disimpan adalah
-- daftar device di license_devices. Kolom current_serial hanya ringkasan
-- perangkat yang terakhir aktif — bukan sumber kebenaran.
create table if not exists public.licenses (
  id                 uuid primary key default gen_random_uuid(),
  -- WHO: NULL = lisensi belum diklaim ke akun mana pun (klien yang belum
  -- pernah login ke Hub). Di-claim saat profil cocok saat dia masuk Hub.
  global_identity_id text references public.global_identities(id) on delete set null,
  -- APA: aplikasi mana lisensi ini berlaku.
  product_id         uuid not null references public.products(id) on delete restrict,
  app_type           text not null,
  -- Outlet: V1 memakai unit_id yang sudah ada (outlet = instalasi asal).
  -- Nanti di-upgrade ke unit stabil saat Dashboard per-unit dibangun.
  outlet_ref         text,
  source_client_id   uuid references public.clients(id) on delete set null,
  -- Paket perangkat.
  plan               text not null default 'single' check (plan in ('single','multi')),
  max_devices        integer not null default 1 check (max_devices >= 1),
  status             text not null default 'active'
                       check (status in ('active','expired','revoked')),
  expires_at         timestamptz,
  current_serial     text,
  -- Kuota transaksi: TARUH DI LEVEL LISENSI (bukan level baris client)
  -- supaya multi-perangkat tidak mendapat kuota dobel. Nilai awal disalin
  -- dari clients saat backfill; sesudah itu cloud yang jadi sumber kebenaran.
  tx_month           text,
  tx_used            integer not null default 0,
  tx_adjust          integer not null default 0,
  tx_updated_at      timestamptz,
  -- Anti-sharing: jejak transfer perangkat.
  transfer_count     integer not null default 0,
  last_transfer_at   timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

-- Satu lisensi per outlet per aplikasi.
create unique index if not exists licenses_outlet_product_key
  on public.licenses (outlet_ref, product_id) where outlet_ref is not null;

-- Satu lisensi per akun per aplikasi per outlet.
create unique index if not exists licenses_owner_product_outlet_key
  on public.licenses (global_identity_id, product_id, coalesce(outlet_ref, ''))
  where global_identity_id is not null;

create index if not exists licenses_owner_idx
  on public.licenses (global_identity_id);
create index if not exists licenses_app_type_idx
  on public.licenses (app_type);
create index if not exists licenses_status_idx
  on public.licenses (status);

drop trigger if exists licenses_set_updated on public.licenses;
create trigger licenses_set_updated
  before update on public.licenses
  for each row execute function public.set_updated_at();


-- ----------------------------------------------------------------------------
-- 3) license_devices — AKTIVASI PER PERANGKAT
-- ----------------------------------------------------------------------------
-- Serial ada di sini, BUKAN di licenses. Serial tetap device-bound (HMAC),
-- tapi sekarang "tiket"-nya milik lisensi, bukan milik device sebagai identitas.
-- Pindah perangkat = daemonisasi tiket lama + cetak tiket baru.
--
-- PENTING: TIDAK ada UNIQUE(serial) di sini. Serial = f(produk, device, expiry)
-- → device yang sama yang aktivasi ulang menghasilkan serial IDENTIK.
-- Yang dijamin unik: satu device per lisensi.
create table if not exists public.license_devices (
  id             uuid primary key default gen_random_uuid(),
  license_id     uuid not null references public.licenses(id) on delete cascade,
  device_code    text not null,
  device_label   text,
  serial         text,
  status         text not null default 'active'
                   check (status in ('active','superseded','revoked')),
  activated_at   timestamptz not null default now(),
  last_seen      timestamptz,
  superseded_at  timestamptz,
  superseded_by  uuid references public.license_devices(id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint license_devices_license_device_key unique (license_id, device_code)
);

create index if not exists license_devices_license_idx
  on public.license_devices (license_id);
create index if not exists license_devices_status_idx
  on public.license_devices (status);

drop trigger if exists license_devices_set_updated on public.license_devices;
create trigger license_devices_set_updated
  before update on public.license_devices
  for each row execute function public.set_updated_at();


-- ----------------------------------------------------------------------------
-- 4) app_memberships — HAK AKSES PER APLIKASI (APA)
-- ----------------------------------------------------------------------------
-- Role di sini adalah role APLIKASI, bukan role global (prinsip kontrak
-- identity: "Role adalah role aplikasi, bukan role global"). Membership
-- KasirSolo 'owner' TIDAK otomatis memberi akses ke TPA atau sebaliknya.
--
-- Struktur mengikuti pola minimarket yang sudah ada (outlet_memberships:
-- user_id × outlet_id × role), tapi di-lift ke level lintas-aplikasi.
create table if not exists public.app_memberships (
  id                 uuid primary key default gen_random_uuid(),
  global_identity_id text not null references public.global_identities(id) on delete cascade,
  app_key            text not null,
  role               text not null default 'owner',
  outlet_ref         text,
  status             text not null default 'active'
                       check (status in ('active','suspended','expired')),
  expires_at         timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create unique index if not exists app_memberships_key
  on public.app_memberships (global_identity_id, app_key, coalesce(outlet_ref, ''));
create index if not exists app_memberships_identity_idx
  on public.app_memberships (global_identity_id);
create index if not exists app_memberships_app_idx
  on public.app_memberships (app_key);

drop trigger if exists app_memberships_set_updated on public.app_memberships;
create trigger app_memberships_set_updated
  before update on public.app_memberships
  for each row execute function public.set_updated_at();


-- ----------------------------------------------------------------------------
-- 5) KOLOM PENUNGGU DI clients & profiles
-- ----------------------------------------------------------------------------
-- clients: baris instalasi (device × app) → ditautkan ke akun.
-- profiles: user Supabase Auth → ditautkan ke akun global.
alter table public.clients
  add column if not exists global_identity_id text
    references public.global_identities(id) on delete set null;

alter table public.profiles
  add column if not exists global_identity_id text
    references public.global_identities(id) on delete set null;

create index if not exists clients_global_identity_idx
  on public.clients (global_identity_id);
create index if not exists profiles_global_identity_idx
  on public.profiles (global_identity_id);


-- ----------------------------------------------------------------------------
-- 6) PERLUAS trigger guard admin pada clients
-- ----------------------------------------------------------------------------
-- global_identity_id adalah kolom TAUTAN yang hanya boleh diset server
-- (claim/linking). Kalau tidak diguard, klien bisa menautkan barisnya ke
-- akun orang lain (atau melepas tautannya) sendiri.
--
-- create or replace → trigger clients_guard_admin_insert/update tetap terikat
-- ke fungsi yang sama (tidak perlu drop/recreate trigger).
create or replace function public.clients_guard_admin_columns()
returns trigger
language plpgsql
as $$
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
    -- tautan akun TIDAK boleh dibuat dari sisi klien
    NEW.global_identity_id := NULL;
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
  -- tautan akun hanya boleh diset server (claim/linking)
  IF NEW.global_identity_id IS DISTINCT FROM OLD.global_identity_id THEN
    RAISE EXCEPTION 'clients: global_identity_id hanya boleh diubah server (permintaan dari %)', current_user;
  END IF;
  -- user_id hanya boleh NULL atau sesi sendiri
  IF NEW.user_id IS DISTINCT FROM OLD.user_id AND NEW.user_id IS NOT NULL
     AND (auth.uid() IS NULL OR NEW.user_id <> auth.uid()) THEN
    RAISE EXCEPTION 'clients: user_id hanya boleh diset ke sesi sendiri';
  END IF;
  RETURN NEW;
END;
$$;


-- ----------------------------------------------------------------------------
-- 7) RLS
-- ----------------------------------------------------------------------------
-- Model: session Hub = JWT ber-claim `gid` (lihat helper di bagian 0).
-- Tabel baru DIBACA pemilik lewat claim itu. Penulisan hanya lewat server
-- (service_role) atau RPC DEFINER — tidak ada policy INSERT/UPDATE untuk
-- anon/authenticated di tabel lisensi.

alter table public.global_identities enable row level security;
alter table public.licenses          enable row level security;
alter table public.license_devices   enable row level security;
alter table public.app_memberships    enable row level security;

-- global_identities: baca & ubah profil sendiri saja. INSERT hanya server
-- (pembuatan akun) → sengaja tidak ada policy insert untuk anon/authenticated.
drop policy if exists "global_identities own select" on public.global_identities;
create policy "global_identities own select" on public.global_identities
  for select using (id = public.current_global_identity_id());

drop policy if exists "global_identities own update" on public.global_identities;
create policy "global_identities own update" on public.global_identities
  for update using (id = public.current_global_identity_id())
  with check (id = public.current_global_identity_id());

-- licenses: hanya akun pemiliknya yang boleh melihat lisensinya.
drop policy if exists "licenses own select" on public.licenses;
create policy "licenses own select" on public.licenses
  for select using (global_identity_id = public.current_global_identity_id());

-- license_devices: ikut lisensi pemiliknya.
drop policy if exists "license_devices own select" on public.license_devices;
create policy "license_devices own select" on public.license_devices
  for select using (
    exists (
      select 1 from public.licenses l
      where l.id = license_id
        and l.global_identity_id = public.current_global_identity_id()
    )
  );

-- app_memberships: akun melihat membership-nya. Kalau session punya app_key,
-- membership difilter ke app itu saja; session Hub (tanpa app_key) melihat
-- semuanya (dipakai untuk layar "Aplikasi Saya").
drop policy if exists "app_memberships own select" on public.app_memberships;
create policy "app_memberships own select" on public.app_memberships
  for select using (
    global_identity_id = public.current_global_identity_id()
    and (
      public.current_app_key() is null
      or app_key = public.current_app_key()
    )
  );

-- grants minimum untuk path REST
grant usage on schema public to anon, authenticated;
grant select on public.global_identities to authenticated;
grant select on public.licenses to authenticated;
grant select on public.license_devices to authenticated;
grant select on public.app_memberships to authenticated;
grant execute on function public.current_global_identity_id() to anon, authenticated;
grant execute on function public.current_app_key() to anon, authenticated;


-- ----------------------------------------------------------------------------
-- 8) RPC: aktivasi perangkat (+ transfer otomatis) & klaim lisensi ke akun
-- ----------------------------------------------------------------------------
-- Dipanggil HANYA oleh server (control/api atau edge function) memakai
-- service_role — server yang memegang salt sehingga bisa mint serial.
-- EksECUTE dicabut untuk anon/authenticated.

-- 8a. license_activate_device
--   Memastikan perangkat tercatat pada lisensi. Kalau jatah perangkat sudah
--   penuh (max_devices), perangkat aktif YANG PALING LAMA di-supersede —
--   inilah "pindah perangkat terserah dia" dengan jatah 1 perangkat/app.
--   Return jsonb: {ok, reason, license_id, device_code, superseded, active_devices}
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
  v_lic     public.licenses%rowtype;
  v_active  integer;
  v_old_id    uuid;
  v_old_code  text;
  v_old_status text;
  v_new_id  uuid;
  v_gid     text;
begin
  if p_device_code is null or btrim(p_device_code) = '' then
    return jsonb_build_object('ok', false, 'reason', 'missing-device-code');
  end if;

  select * into v_lic from public.licenses where id = p_license_id;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'license-not-found');
  end if;
  if v_lic.status <> 'active' then
    return jsonb_build_object('ok', false, 'reason', 'license-' || v_lic.status);
  end if;
  if v_lic.expires_at is not null and v_lic.expires_at <= now() then
    return jsonb_build_object('ok', false, 'reason', 'license-expired');
  end if;

  -- Otorisasi: server (service_role) boleh apa saja; pemanggil lain hanya
  -- boleh untuk lisensi miliknya sendiri.
  v_gid := public.current_global_identity_id();
  if auth.role() <> 'service_role'
     and v_gid is not null
     and v_lic.global_identity_id is distinct from v_gid then
    return jsonb_build_object('ok', false, 'reason', 'not-owner');
  end if;

  -- Sudah aktif di perangkat ini? → refresh saja, jangan buat baris baru.
  select d.id, d.device_code, d.status into v_old_id, v_old_code, v_old_status
    from public.license_devices d
   where d.license_id = p_license_id and d.device_code = p_device_code
   limit 1;
  if v_old_id is not null and v_old_status = 'active' then
    update public.license_devices
       set last_seen    = now(),
           device_label = coalesce(p_device_label, device_label),
           serial       = coalesce(p_serial, serial)
     where id = v_old_id;
    update public.licenses
       set current_serial = coalesce(p_serial, current_serial),
           updated_at = now()
     where id = p_license_id;
    return jsonb_build_object(
      'ok', true, 'reason', 'already-active',
      'license_id', p_license_id, 'device_code', p_device_code,
      'active_devices', (
        select count(*)::int from public.license_devices
         where license_id = p_license_id and status = 'active'
      )
    );
  end if;

  select count(*)::int into v_active
    from public.license_devices
   where license_id = p_license_id and status = 'active';

  -- Jatah penuh → transfer: eject perangkat aktif TERLAMA.
  v_old_id := null;
  v_old_code := null;
  if v_active >= v_lic.max_devices then
    select d.id, d.device_code into v_old_id, v_old_code
      from public.license_devices d
     where d.license_id = p_license_id and d.status = 'active'
     order by d.activated_at asc
     limit 1;
    if v_old_id is not null then
      update public.license_devices
         set status = 'superseded', superseded_at = now(), last_seen = now()
       where id = v_old_id;
    end if;
  end if;

  insert into public.license_devices
    (license_id, device_code, device_label, serial, status, activated_at, last_seen)
  values
    (p_license_id, p_device_code, p_device_label, p_serial, 'active', now(), now())
  on conflict (license_id, device_code) do update
    set status        = 'active',
        device_label   = coalesce(excluded.device_label, public.license_devices.device_label),
        serial         = coalesce(excluded.serial, public.license_devices.serial),
        activated_at   = now(),
        last_seen      = now(),
        superseded_at  = null;

  select id into v_new_id
    from public.license_devices
   where license_id = p_license_id and device_code = p_device_code;

  update public.licenses
     set current_serial   = coalesce(p_serial, current_serial),
         transfer_count   = transfer_count + (case when v_active >= v_lic.max_devices then 1 else 0 end),
         last_transfer_at = (case when v_active >= v_lic.max_devices then now() else last_transfer_at end),
         updated_at       = now()
   where id = p_license_id;

  return jsonb_build_object(
    'ok', true,
    'reason', (case when v_active >= v_lic.max_devices then 'transferred' else 'activated' end),
    'license_id', p_license_id,
    'device_code', p_device_code,
    'superseded', (case when v_active >= v_lic.max_devices then v_old_code else null end),
    'active_devices', (
      select count(*)::int from public.license_devices
       where license_id = p_license_id and status = 'active'
    )
  );
end;
$$;

revoke all on function public.license_activate_device(uuid, text, text, text, text) from public;
grant execute on function public.license_activate_device(uuid, text, text, text, text) to service_role;

-- 8b. license_claim_identity
--   Menautkan lisensi ke akun global, dengan pembuktian profil (nama usaha /
--   no WA harus cocok) — logika yang sama seperti device_assign yang sudah
--   ada, supaya tidak ada celah "claim lisensi orang lain".
--   Sekalian membuat app_memberships role 'owner' untuk aplikasinya.
create or replace function public.license_claim_identity(
  p_license_id        uuid,
  p_global_identity_id text,
  p_profile           jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_lic      public.licenses%rowtype;
  v_src_usaha text;
  v_src_wa    text;
  v_cloud_usaha text;
  v_cloud_wa    text;
  v_claim_usaha text;
  v_claim_wa    text;
  v_match_usaha boolean;
  v_match_wa    boolean;
begin
  if p_global_identity_id is null or btrim(p_global_identity_id) = '' then
    return jsonb_build_object('ok', false, 'reason', 'missing-identity');
  end if;
  if not exists (select 1 from public.global_identities where id = p_global_identity_id) then
    return jsonb_build_object('ok', false, 'reason', 'identity-not-found');
  end if;

  select * into v_lic from public.licenses where id = p_license_id;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'license-not-found');
  end if;

  -- Sudah diklaim akun lain? tolak (tidak auto-gabung).
  if v_lic.global_identity_id is not null
     and v_lic.global_identity_id <> p_global_identity_id then
    return jsonb_build_object('ok', false, 'reason', 'already-claimed');
  end if;

  -- Bukti profil: cari baris clients asal lisensi ini.
  select c.nama_usaha, c.no_whatsapp into v_src_usaha, v_src_wa
    from public.clients c
   where c.id = v_lic.source_client_id
      or (v_lic.outlet_ref is not null and c.unit_id = v_lic.outlet_ref)
   limit 1;

  v_cloud_usaha := lower(btrim(coalesce(v_src_usaha, '')));
  v_cloud_wa    := lower(btrim(coalesce(v_src_wa, '')));
  v_claim_usaha := lower(btrim(coalesce(p_profile->>'nama_usaha', '')));
  v_claim_wa    := lower(btrim(coalesce(p_profile->>'no_whatsapp', '')));

  v_match_usaha := v_claim_usaha <> '' and v_claim_usaha = v_cloud_usaha;
  v_match_wa    := v_claim_wa    <> '' and v_claim_wa    = v_cloud_wa;

  -- Kalau baris asal tidak ada (mis. sudah dibersihkan), klaim tetap boleh
  -- kalau lisensi sudah ditautkan ke akun sebelumnya atau lewat admin.
  if v_src_usaha is null and v_src_wa is null
     and v_lic.global_identity_id is null then
    return jsonb_build_object('ok', false, 'reason', 'source-client-missing');
  end if;

  if not (v_match_usaha or v_match_wa) then
    return jsonb_build_object(
      'ok', false, 'reason', 'profile-mismatch',
      'license_id', p_license_id
    );
  end if;

  update public.licenses
     set global_identity_id = p_global_identity_id,
         updated_at = now()
   where id = p_license_id;

  -- Tautkan baris instalasi (clients) yang menunjuk unit/outlet ini.
  update public.clients
     set global_identity_id = p_global_identity_id
   where (v_lic.outlet_ref is not null and unit_id = v_lic.outlet_ref)
      or (v_lic.source_client_id is not null and id = v_lic.source_client_id);

  -- Membership per aplikasi.
  insert into public.app_memberships
    (global_identity_id, app_key, role, outlet_ref, status)
  values
    (p_global_identity_id, v_lic.app_type, 'owner', v_lic.outlet_ref, 'active')
  on conflict (global_identity_id, app_key, coalesce(outlet_ref, ''))
  do update set status = 'active', updated_at = now();

  return jsonb_build_object(
    'ok', true, 'reason', 'claimed',
    'license_id', p_license_id,
    'global_identity_id', p_global_identity_id,
    'app_type', v_lic.app_type
  );
end;
$$;

revoke all on function public.license_claim_identity(uuid, text, jsonb) from public;
grant execute on function public.license_claim_identity(uuid, text, jsonb) to service_role;


-- ----------------------------------------------------------------------------
-- 9) FUNGSI BACA UNTUK HUB (layar "Aplikasi Saya")
-- ----------------------------------------------------------------------------
-- Dipakai app Hub dengan session JWT ber-claim gid. READ-ONLY.
create or replace function public.hub_my_licenses()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (
      select jsonb_agg(
        jsonb_build_object(
          'license_id',  l.id,
          'app_type',    l.app_type,
          'kode_produk', p.kode_produk,
          'plan',        l.plan,
          'max_devices', l.max_devices,
          'status',      l.status,
          'expired',     (l.expires_at is not null and l.expires_at <= now()),
          'outlet_ref',  l.outlet_ref,
          'tx_used',     l.tx_used,
          'tx_quota',    p.tx_quota,
          'devices', coalesce((
            select jsonb_agg(
              jsonb_build_object(
                'device_code', d.device_code,
                'label',       d.device_label,
                'status',      d.status,
                'last_seen',   d.last_seen
              ) order by d.activated_at desc
            )
            from public.license_devices d
            where d.license_id = l.id
          ), '[]'::jsonb)
        ) order by l.app_type
      )
      from public.licenses l
      left join public.products p on p.id = l.product_id
      where l.global_identity_id = public.current_global_identity_id()
    ),
    '[]'::jsonb
  )
$$;

revoke all on function public.hub_my_licenses() from public;
grant execute on function public.hub_my_licenses() to authenticated, service_role;


-- ----------------------------------------------------------------------------
-- 10) BACKFILL dari data live
-- ----------------------------------------------------------------------------
-- 10a. Lisensi dari clients yang punya serial.
insert into public.licenses
  (global_identity_id, product_id, app_type, outlet_ref, source_client_id,
   plan, max_devices, status, expires_at, current_serial,
   tx_month, tx_used, tx_adjust, tx_updated_at, created_at, updated_at)
select
  null,
  p.id,
  c.app_type,
  c.unit_id,
  c.id,
  'single',
  1,
  case when c.license_status = 'aktif' then 'active' else 'revoked' end,
  c.license_expires_at,
  c.license_serial,
  c.tx_month,
  c.tx_used,
  c.tx_adjust,
  c.tx_updated_at,
  coalesce(c.created_at, now()),
  now()
from public.clients c
join public.products p on p.app_type = c.app_type
where c.license_serial is not null and btrim(c.license_serial) <> ''
on conflict (outlet_ref, product_id) where outlet_ref is not null do nothing;

-- 10b. Perangkat di bawah lisensi tersebut.
insert into public.license_devices
  (license_id, device_code, device_label, serial, status, activated_at, last_seen)
select
  l.id,
  c.device_code,
  c.device_type,
  c.license_serial,
  case when c.license_status = 'aktif' then 'active' else 'revoked' end,
  coalesce(c.created_at, now()),
  c.last_seen
from public.clients c
join public.products p on p.app_type = c.app_type
join public.licenses l
  on l.outlet_ref = c.unit_id
 and l.product_id = p.id
where c.license_serial is not null and btrim(c.license_serial) <> ''
on conflict (license_id, device_code) do nothing;


-- ----------------------------------------------------------------------------
-- 11) VERIFIKASI (jalankan setelah apply)
-- ----------------------------------------------------------------------------
-- select count(*) from public.licenses;
-- select l.app_type, l.status, count(*) from public.licenses l group by 1,2;
-- select count(*) from public.license_devices;
-- select count(*) from public.global_identities;
-- select count(*) from public.app_memberships;
-- Expect: licenses == jumlah clients ber-serial unik (outlet,product);
--          license_devices == jumlah lisensi ter-backfill;
--          global_identities == 0 (belum ada akun Hub) — isi saat user daftar.
