-- =============================================================================
-- MIGRASI — MITRA PORTAL FASE 1 (lapisan data portal mitra)
-- =============================================================================
-- Project : hhywrvedlwljawgxzpkq  ("mcfury's Project" — platform/minimarket)
-- Sumber  : docs/ADR-VOUCHER-REFERRAL.md §4 (skema), §5 (RPC), §7.2 (config),
--           §12.4 (tabel referral_partners), §14.2 (mitra ≠ clients)
-- App     : mitra/  (Astro, domain mitra.kasirsolo.com, port dev 13132)
--
-- LINGKUNG SCOPE (Fase 1 = data portal, BUKAN pencatatan kode app):
--   - 5 tabel : referral_partners, referral_wallets, payout_requests,
--               license_codes, code_redemptions
--   - 5 kolom baru di clients (purchase_code, purchase_discount, price_paid,
--               voucher_id, referred_by_code)
--   - settings.referral_config (default ADR §7.2)
--   - 7 RPC   : partner_session, partner_my_balance, partner_referrals,
--               partner_payouts, payout_request  (dipakai browser dgn anon key)
--               referral_resolve_pending, partner_issue_token (khusus admin)
--
-- YANG BELUM (Fase 2/3 — butuh perintah terpisah):
--   - RPC code_redeem_license (pencetakan lisensi + serial HMAC)
--   - RPC code_apply_discount (diskon pendatang + award poin)
--   - RPC partner_register / partner_approve (form daftar → DB, tab Control)
--   - penulisan code_redemptions (sumber data "Riwayat Referral" ikut kosong
--     sampai alur kode di kaki5 hidup)
--
-- KEAMANAN:
--   - Semua RPC portal mengecek token di dalam fungsi (SECURITY DEFINER).
--     Token TIDAK pernah jadi parameter bebas — caller tidak bisa menebak
--     partner_id milik orang lain.
--   - Token disimpan sebagai SHA-256 hash (portal_token_hash). Isi DB bocor
--     ≠ token portal bocor.
--   - Tabel baru: RLS ON, tanpa policy untuk anon/authenticated → data hanya
--     bisa dibaca lewat RPC. Admin (Control Center) lewat service_role.
--   - referral_resolve_pending + partner_issue_token: HANYA service_role.
-- =============================================================================

begin;

-- Fail fast kalau lock `clients` (dipakai FK) belum free — jangan nahan
-- writer app kaki5/rosok/laundry lebih dari 5 detik. Retry di sisi pemanggil.
set local lock_timeout = '5s';

-- -----------------------------------------------------------------------------
-- 1. referral_partners — identitas mitra (BUKAN clients)
-- -----------------------------------------------------------------------------
-- Mitra = orang yang MENJUAL aplikasi (afiliator/reseller). Satu WA boleh
-- jadi mitra sekaligus pengguna app → kolom client_id sebagai jembatan
-- (NULL = afiliator murni) — ADR §14.2.
create table if not exists public.referral_partners (
  id                    uuid primary key default gen_random_uuid(),
  code                  text unique not null,        -- kode referal mitra, mis. 'TOKO-8F2K'
  app_type              text not null default 'kaki5',
  app_key               text not null default 'kaki5',

  -- identitas
  user_id               uuid,                          -- auth user (opsional)
  global_identity_id    text,                          -- reuse HUB Fase-0 (beku)
  client_id             uuid references public.clients(id) on delete set null,
  nama                  text not null,
  no_whatsapp           text not null,
  email                 text,
  nik                   text,
  kota                  text,
  provinsi              text,
  alamat                text,

  -- pencairan
  bank_name             text,
  bank_account          text,
  account_name          text,

  -- status & tier
  status                text not null default 'pending',
                        -- pending | aktif | ditolak | nonaktif | suspend
  tier                  text not null default 'bronze',  -- bronze | silver | gold
  notes                 text,
  approved_by           text,
  approved_at           timestamptz,
  verified_at           timestamptz,

  -- akses portal (D3: token via WA, bukan password)
  portal_token_hash     text,                           -- sha256 hex token
  portal_token_created_at timestamptz,
  portal_token_expires_at timestamptz,

  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),

  constraint referral_partners_status_chk
    check (status in ('pending','aktif','ditolak','nonaktif','suspend')),
  constraint referral_partners_tier_chk
    check (tier in ('bronze','silver','gold'))
);

-- Anti-fraud: 1 WA = 1 mitra aktif (ADR §8). Mitra nonaktif/ditolak boleh
-- daftar ulang → unique hanya untuk status pending/aktif.
create unique index if not exists uq_referral_partners_wa_aktif
  on public.referral_partners (lower(btrim(no_whatsapp)))
  where status in ('pending','aktif');

create index if not exists idx_referral_partners_status
  on public.referral_partners (status, created_at desc);

-- -----------------------------------------------------------------------------
-- 2. referral_wallets — saldo poin & rupiah per mitra
-- -----------------------------------------------------------------------------
-- points_balance = poin SIAP dicairkan (otoritatif)
-- rupiah_balance = cermin rupiah dari poin siap dicairkan (1 poin = Rp 1.000)
-- withdrawable   = rupiah yang sudah "ditahan" untuk request payout aktif
create table if not exists public.referral_wallets (
  id                uuid primary key default gen_random_uuid(),
  partner_id        uuid unique references public.referral_partners(id) on delete cascade,
  client_id         uuid unique references public.clients(id) on delete cascade,
  unit_id           text,
  app_type          text not null default 'kaki5',
  points_balance    integer not null default 0,
  points_pending    integer not null default 0,
  points_earned     integer not null default 0,
  rupiah_balance    numeric not null default 0,
  withdrawable      numeric not null default 0,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint referral_wallets_owner_chk
    check (partner_id is not null or client_id is not null)
);

-- -----------------------------------------------------------------------------
-- 3. payout_requests — request pencairan manual (K3c)
-- -----------------------------------------------------------------------------
-- Diproses manual admin (owner transfer bank sendiri). RPC payout_request
-- hanya MENCATAT request + memotong saldo — tidak pernah memindahkan uang.
create table if not exists public.payout_requests (
  id                uuid primary key default gen_random_uuid(),
  wallet_id         uuid references public.referral_wallets(id) on delete set null,
  partner_id        uuid references public.referral_partners(id) on delete set null,
  client_id         uuid,
  unit_id           text,
  amount_rupiah     numeric not null,
  points_used       integer not null default 0,
  payout_type       text not null default 'withdraw',  -- withdraw | bayar_lisensi
  bank_info         text,                              -- isi persis dari form
  bank_name         text,
  bank_account      text,
  account_name      text,
  status            text not null default 'pending',  -- pending|disetujui|dibayar|ditolak
  admin_note        text,
  processed_by      text,
  processed_at      timestamptz,
  paid_at           timestamptz,
  evidence_url      text,
  created_at        timestamptz not null default now(),
  constraint payout_requests_type_chk
    check (payout_type in ('withdraw','bayar_lisensi')),
  constraint payout_requests_status_chk
    check (status in ('pending','disetujui','dibayar','ditolak'))
);

create index if not exists idx_payout_requests_partner
  on public.payout_requests (partner_id, created_at desc);

-- -----------------------------------------------------------------------------
-- 4. license_codes — SATU sistem kode (voucher admin + referral mitra)
-- -----------------------------------------------------------------------------
-- ADR §4.1 + owner_partner_id (ADR §12.4: pemilik kode = mitra, bukan client).
create table if not exists public.license_codes (
  id                      uuid primary key default gen_random_uuid(),
  code                    text unique not null,
  kind                    text not null,               -- 'voucher' | 'referral'
  app_type                text not null default 'kaki5',
  owner_client_id         uuid references public.clients(id) on delete set null,
  owner_partner_id        uuid references public.referral_partners(id) on delete set null,
  owner_unit_id           text,
  global_identity_id      text,
  batch_id                uuid,
  created_by              text,                         -- 'admin' | 'user'
  discount_type           text not null default 'fixed',
  discount_value          numeric not null default 0,
  max_discount            numeric,
  min_purchase            numeric not null default 0,
  discount_max_uses       integer,                      -- null = tak terbatas
  discount_used_count     integer not null default 0,
  discount_used_by        uuid[],
  discount_used_at        timestamptz,
  grant_plan              text default 'single',
  grant_max_devices       integer default 1,
  grant_tx_quota          integer,
  grant_exp_code          text default '99',
  redeem_max_uses         integer default 1,
  redeem_used_count       integer not null default 0,
  redeemed_by_client_id   uuid,
  redeemed_by_unit_id     text,
  redeemed_by_device_code text,
  license_id              uuid,
  serial_issued           text,
  status                  text not null default 'aktif',
                          -- aktif|terpakai|kadaluwarsa|dibatalkan
  expires_at              timestamptz not null,         -- masa berlaku KODE
  price_paid              numeric not null default 0,
  notes                   text,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  constraint license_codes_kind_chk
    check (kind in ('voucher','referral')),
  constraint license_codes_status_chk
    check (status in ('aktif','terpakai','kadaluwarsa','dibatalkan'))
);

create index if not exists idx_license_codes_owner_partner
  on public.license_codes (owner_partner_id);

-- -----------------------------------------------------------------------------
-- 5. code_redemptions — ledger per-reward (WAJIB, ADR §4.2)
-- -----------------------------------------------------------------------------
-- points_pending di wallet cuma agregat → ledger per-baris yang pegang
-- hold_until + points_released_at. Tanpa ini, referral_resolve_pending()
-- nggak bisa nentuin reward mana yang sudah lewat 1 siklus payout.
create table if not exists public.code_redemptions (
  id                  uuid primary key default gen_random_uuid(),
  code_id             uuid not null references public.license_codes(id) on delete cascade,
  code                text not null,                  -- denormalisasi untuk audit
  channel             text not null,                  -- 'diskon' | 'lisensi'
  client_id           uuid references public.clients(id) on delete set null,
  unit_id             text,
  app_type            text not null default 'kaki5',
  discount_value      numeric default 0,
  points_awarded      integer default 0,
  hold_until          timestamptz,                    -- reward boleh dicairkan setelah 1 siklus
  points_released_at  timestamptz,                    -- NULL = masih nunggu siklus
  referrer_client_id  uuid,
  referrer_partner_id uuid references public.referral_partners(id) on delete set null,
  -- Snapshot identitas referee. WAJIB: referee bisa datang dari form website
  -- (bukan cuma pengguna app) → client_id bisa NULL. Riwayat referral harus
  -- tetap terbaca walau baris clients berubah / dihapus.
  referee_name        text,
  referee_city        text,
  referee_phone       text,
  status              text not null default 'berhasil',
  reason              text,
  created_at          timestamptz not null default now()
);

create index if not exists idx_code_redemptions_partner
  on public.code_redemptions (referrer_partner_id, created_at desc);

create index if not exists idx_code_redemptions_hold
  on public.code_redemptions (hold_until)
  where points_released_at is null;

-- Idempotensi: kalau tabel ini sudah ada dari versi migrasi sebelumnya,
-- `create table if not exists` nggak nambah kolom baru → lengkapi eksplisit.
alter table public.code_redemptions
  add column if not exists referee_name  text,
  add column if not exists referee_city  text,
  add column if not exists referee_phone text;

-- -----------------------------------------------------------------------------
-- 6. Kolom baru di clients (ADR §4.5) — nullable, non-destructive
-- -----------------------------------------------------------------------------
-- DILAKUKAN DI FILE TERPISAH: supabase/migration-mitra-portal-fase1-clients-columns.sql
--
-- Alasan: ALTER TABLE clients butuh AccessExclusiveLock, sedangkan app kaki5/
-- rosok/laundry nulis ke tabel itu secara rutin. Kalau digabung dalam satu
-- transaksi panjang → deadlock (40P01) + write app ikut terblokir.
-- Versi terpisah pakai lock_timeout pendek + retry, jadi lock-nya nggak
-- ngaret lama.

-- -----------------------------------------------------------------------------
-- 7. settings.referral_config — default ADR §7.2 (config-driven, tanpa deploy)
-- -----------------------------------------------------------------------------
-- on conflict DO NOTHING: kalau admin sudah mengubah angka lewat Control,
-- migrasi ulang TIDAK menimpanya.
insert into public.settings (key, value, updated_at)
values (
  'referral_config',
  '{
    "points_to_rupiah": 1000,
    "points_per_paid_referral": 50,
    "points_per_free_referral": 5,
    "payout_cycle_days_licensed": 7,
    "payout_cycle_days_referral_only": 30,
    "discount_referral": 50000,
    "discount_type": "fixed",
    "min_purchase_for_discount": 100000,
    "min_payout_rupiah": 50000,
    "max_payout_per_request": 500000,
    "max_balance_rupiah": 1000000,
    "referral_expire_days": 30
  }'::jsonb,
  now()
)
on conflict (key) do nothing;

-- =============================================================================
-- 8. RPC — PORTAL MITRA (dipanggil browser app mitra/ dengan anon key)
-- =============================================================================
-- Kontrak v2 (revisi 2026-10-26): semua RPC portal memakai TOKEN, bukan
-- partner_id/client_id. Alasan: parameter bebas = siapa pun bisa menunjuk
-- partner orang lain. Token dicek di dalam fungsi.
--   partner_session(p_token text)
--   partner_my_balance(p_token text)
--   partner_referrals(p_token text)
--   partner_payouts(p_token text)
--   payout_request(p_token text, p_points int, p_amount numeric, p_type text, p_bank_info text)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 8.1 partner_session — validasi token → profil mitra + siklus payout
-- -----------------------------------------------------------------------------
create or replace function public.partner_session(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_partner public.referral_partners%rowtype;
  v_cfg      jsonb := '{}'::jsonb;
  v_cycle    integer := 30;
  v_next     date;
  v_last     date;
  v_has_license boolean := false;
begin
  if p_token is null or btrim(p_token) = '' then
    return jsonb_build_object('ok', false, 'reason', 'token kosong');
  end if;

  select * into v_partner
  from public.referral_partners
  where portal_token_hash = encode(extensions.digest(btrim(p_token), 'sha256'), 'hex')
    and (portal_token_expires_at is null or portal_token_expires_at > now())
  limit 1;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'token tidak valid atau kedaluwarsa');
  end if;

  if v_partner.status <> 'aktif' then
    return jsonb_build_object(
      'ok', false,
      'reason', 'status mitra: ' || v_partner.status,
      'status', v_partner.status);
  end if;

  select coalesce(value, '{}'::jsonb) into v_cfg
  from public.settings where key = 'referral_config';
  v_cfg := coalesce(v_cfg, '{}'::jsonb);

  -- SIKLUS PAYOUT = STATUS MITRA (bukan status referee) — K3b.
  -- Punya lisensi (client_id + clients.license_status='aktif') → 7 hari.
  -- Fokus referensi doank → 30 hari.
  v_has_license := exists (
    select 1 from public.clients c
    where c.id = v_partner.client_id and c.license_status = 'aktif'
  );
  if v_has_license then
    v_cycle := coalesce((v_cfg->>'payout_cycle_days_licensed')::int, 7);
  else
    v_cycle := coalesce((v_cfg->>'payout_cycle_days_referral_only')::int, 30);
  end if;

  -- Tanggal payout berikutnya = request terakhir + 1 siklus.
  select max(created_at)::date into v_last
  from public.payout_requests
  where partner_id = v_partner.id
    and status in ('pending','disetujui','dibayar');
  v_last := coalesce(v_last, v_partner.created_at::date);
  -- Kalau siklusnya sudah lewat (mitra telat request) → tampilkan hari ini
  -- (= "sudah bisa request"), bukan tanggal lampau.
  v_next := greatest(v_last + (v_cycle || ' days')::interval, now())::date;

  return jsonb_build_object(
    'ok', true,
    'partner_id', v_partner.id,
    'client_id', v_partner.client_id,
    'code', v_partner.code,
    'status', v_partner.status,
    'tier', v_partner.tier,
    'has_license', v_has_license,
    'nama', v_partner.nama,
    'kota', v_partner.kota,
    'payout_cycle_days', v_cycle,
    'next_payout_date', to_char(v_next, 'YYYY-MM-DD')
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- 8.2 partner_my_balance — saldo mitra
-- -----------------------------------------------------------------------------
create or replace function public.partner_my_balance(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_partner public.referral_partners%rowtype;
  v_wallet  public.referral_wallets%rowtype;
begin
  select * into v_partner
  from public.referral_partners
  where portal_token_hash = encode(extensions.digest(btrim(p_token), 'sha256'), 'hex')
    and (portal_token_expires_at is null or portal_token_expires_at > now())
  limit 1;

  if not found or v_partner.status <> 'aktif' then
    return jsonb_build_object(
      'points_ready', 0, 'points_pending', 0,
      'points_total', 0, 'rupiah_balance', 0);
  end if;

  select * into v_wallet
  from public.referral_wallets
  where partner_id = v_partner.id
  limit 1;

  if not found then
    return jsonb_build_object(
      'points_ready', 0, 'points_pending', 0,
      'points_total', 0, 'rupiah_balance', 0);
  end if;

  return jsonb_build_object(
    'points_ready', v_wallet.points_balance,
    'points_pending', v_wallet.points_pending,
    'points_total', v_wallet.points_earned,
    'rupiah_balance', v_wallet.rupiah_balance,
    'withdrawable', v_wallet.withdrawable
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- 8.3 partner_referrals — riwayat referral mitra
-- -----------------------------------------------------------------------------
-- status: 'paid' (referee beli lisensi → poin penuh), 'free' (nggak beli),
--         'pending' (redemption belum berhasil).
create or replace function public.partner_referrals(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_partner public.referral_partners%rowtype;
  v_cfg     jsonb := '{}'::jsonb;
  v_paid    integer := 50;
begin
  select * into v_partner
  from public.referral_partners
  where portal_token_hash = encode(extensions.digest(btrim(p_token), 'sha256'), 'hex')
    and (portal_token_expires_at is null or portal_token_expires_at > now())
  limit 1;

  if not found or v_partner.status <> 'aktif' then
    return '[]'::jsonb;
  end if;

  select coalesce(value, '{}'::jsonb) into v_cfg
  from public.settings where key = 'referral_config';
  v_paid := coalesce((v_cfg->>'points_per_paid_referral')::int, 50);

  return coalesce(
    (
      select jsonb_agg(
        jsonb_build_object(
          'name', coalesce(cr.referee_name, c.nama_usaha, c.nama_pemilik, 'Pelanggan'),
          'city', coalesce(cr.referee_city, c.kabkota, ''),
          'product', cr.app_type,
          'status', case
                      when cr.status <> 'berhasil' then 'pending'
                      when coalesce(cr.points_awarded, 0) >= v_paid then 'paid'
                      when coalesce(cr.points_awarded, 0) > 0 then 'free'
                      else 'pending'
                    end,
          'points', coalesce(cr.points_awarded, 0),
          'date', to_char(cr.created_at, 'YYYY-MM-DD')
        )
        order by cr.created_at desc
      )
      from public.code_redemptions cr
      left join public.clients c on c.id = cr.client_id
      where cr.referrer_partner_id = v_partner.id
    ),
    '[]'::jsonb
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- 8.4 partner_payouts — riwayat pencairan mitra
-- -----------------------------------------------------------------------------
create or replace function public.partner_payouts(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_partner public.referral_partners%rowtype;
begin
  select * into v_partner
  from public.referral_partners
  where portal_token_hash = encode(extensions.digest(btrim(p_token), 'sha256'), 'hex')
    and (portal_token_expires_at is null or portal_token_expires_at > now())
  limit 1;

  if not found or v_partner.status <> 'aktif' then
    return '[]'::jsonb;
  end if;

  return coalesce(
    (
      select jsonb_agg(
        jsonb_build_object(
          'id', 'PO-' || upper(left(replace(pr.id::text, '-', ''), 8)),
          'date', to_char(pr.created_at, 'YYYY-MM-DD'),
          'points', coalesce(pr.points_used, 0),
          'amount', pr.amount_rupiah,
          'status', case pr.status
                      when 'dibayar' then 'selesai'
                      when 'ditolak' then 'ditolak'
                      else 'diproses'
                    end,
          'note', coalesce(pr.admin_note, pr.bank_info, '')
        )
        order by pr.created_at desc
      )
      from public.payout_requests pr
      where pr.partner_id = v_partner.id
    ),
    '[]'::jsonb
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- 8.5 payout_request — request pencairan (K3c, diproses manual admin)
-- -----------------------------------------------------------------------------
-- Guard:
--   1) token valid + mitra aktif
--   2) amount >= min_payout_rupiah (default 50.000)
--   3) amount <= max_payout_per_request (default 500.000)
--   4) amount = points × points_to_rupiah (1 poin = Rp 1.000)
--   5) saldo poin cukup
--   6) maks 1 request per siklus payout (7 / 30 hari, basis status mitra)
-- TIDAK memindahkan uang — cuma mencatat request + memotong saldo.
create or replace function public.payout_request(
  p_token     text,
  p_points    integer,
  p_amount    numeric,
  p_type      text,
  p_bank_info text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_partner public.referral_partners%rowtype;
  v_wallet  public.referral_wallets%rowtype;
  v_cfg     jsonb := '{}'::jsonb;
  v_rate    integer := 1000;
  v_min     numeric := 50000;
  v_max     numeric := 500000;
  v_cycle   integer := 30;
  v_req_id  uuid;
begin
  if p_token is null or btrim(p_token) = '' then
    return jsonb_build_object('ok', false, 'code', 'invalid_token',
      'reason', 'token kosong');
  end if;

  select * into v_partner
  from public.referral_partners
  where portal_token_hash = encode(extensions.digest(btrim(p_token), 'sha256'), 'hex')
    and (portal_token_expires_at is null or portal_token_expires_at > now())
  limit 1;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'invalid_token',
      'reason', 'token tidak valid atau kedaluwarsa');
  end if;
  if v_partner.status <> 'aktif' then
    return jsonb_build_object('ok', false, 'code', 'not_active',
      'value', v_partner.status,
      'reason', 'status mitra: ' || v_partner.status);
  end if;

  select coalesce(value, '{}'::jsonb) into v_cfg
  from public.settings where key = 'referral_config';
  v_rate  := coalesce((v_cfg->>'points_to_rupiah')::int, 1000);
  v_min   := coalesce((v_cfg->>'min_payout_rupiah')::numeric, 50000);
  v_max   := coalesce((v_cfg->>'max_payout_per_request')::numeric, 500000);

  if p_points is null or p_points <= 0 then
    return jsonb_build_object('ok', false, 'code', 'invalid_points',
      'reason', 'jumlah poin harus lebih dari 0');
  end if;
  if p_amount is null or p_amount < v_min then
    return jsonb_build_object('ok', false, 'code', 'min_payout',
      'value', v_min,
      'reason', 'minimal pencairan Rp ' || v_min::text);
  end if;
  if p_amount > v_max then
    return jsonb_build_object('ok', false, 'code', 'max_payout',
      'value', v_max,
      'reason', 'maksimal per request Rp ' || v_max::text);
  end if;
  if p_amount <> p_points * v_rate then
    return jsonb_build_object('ok', false, 'code', 'amount_mismatch',
      'reason', 'nominal harus sama dengan poin x ' || v_rate::text);
  end if;

  -- siklus payout (basis status mitra)
  if exists (
    select 1 from public.clients c
    where c.id = v_partner.client_id and c.license_status = 'aktif'
  ) then
    v_cycle := coalesce((v_cfg->>'payout_cycle_days_licensed')::int, 7);
  else
    v_cycle := coalesce((v_cfg->>'payout_cycle_days_referral_only')::int, 30);
  end if;

  -- maks 1 request per siklus payout
  if exists (
    select 1 from public.payout_requests pr
    where pr.partner_id = v_partner.id
      and pr.status in ('pending','disetujui','dibayar')
      and pr.created_at > now() - (v_cycle || ' days')::interval
  ) then
    return jsonb_build_object('ok', false, 'code', 'cycle',
      'value', v_cycle,
      'reason', 'sudah ada request pencairan di siklus ini (1x per ' || v_cycle::text || ' hari)');
  end if;

  -- wallet + potong saldo (row lock)
  select * into v_wallet
  from public.referral_wallets
  where partner_id = v_partner.id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'no_wallet',
      'reason', 'saldo belum diinisialisasi');
  end if;
  if v_wallet.points_balance < p_points then
    return jsonb_build_object('ok', false, 'code', 'insufficient',
      'value', v_wallet.points_balance,
      'reason', 'saldo poin belum cukup (tersedia ' || v_wallet.points_balance::text || ')');
  end if;

  update public.referral_wallets
     set points_balance = points_balance - p_points,
         rupiah_balance = rupiah_balance - p_amount,
         withdrawable   = withdrawable + p_amount,
         updated_at     = now()
   where partner_id = v_partner.id;

  insert into public.payout_requests (
    wallet_id, partner_id, client_id, unit_id,
    amount_rupiah, points_used, payout_type, bank_info, status
  )
  values (
    v_wallet.id, v_partner.id, v_partner.client_id, v_wallet.unit_id,
    p_amount, p_points, coalesce(nullif(p_type, ''), 'withdraw'), p_bank_info, 'pending'
  )
  returning id into v_req_id;

  return jsonb_build_object(
    'ok', true,
    'id', v_req_id,
    'amount', p_amount,
    'points', p_points,
    'status', 'pending',
    'message', 'Request tercatat. Ditunggu transfer manual dari tim kami.'
  );
end;
$$;

-- =============================================================================
-- 9. RPC — KHUSUS ADMIN (hanya service_role: Control Center / cron)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 9.1 partner_issue_token — terbitkan token akses portal (D3)
-- -----------------------------------------------------------------------------
-- Token dikembalikan SEKALI (mentah). Yang tersimpan di DB = hash-nya.
create or replace function public.partner_issue_token(
  p_partner_id uuid,
  p_days       integer default 30
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_partner public.referral_partners%rowtype;
  v_token   text;
begin
  select * into v_partner
  from public.referral_partners
  where id = p_partner_id;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'mitra tidak ditemukan');
  end if;
  if v_partner.status <> 'aktif' then
    return jsonb_build_object('ok', false,
      'reason', 'status mitra: ' || v_partner.status);
  end if;

  v_token := encode(extensions.gen_random_bytes(24), 'hex');

  update public.referral_partners
     set portal_token_hash = encode(extensions.digest(v_token, 'sha256'), 'hex'),
         portal_token_created_at = now(),
         portal_token_expires_at = now() + (coalesce(p_days, 30) || ' days')::interval,
         updated_at = now()
   where id = p_partner_id;

  return jsonb_build_object(
    'ok', true,
    'partner_id', v_partner.id,
    'code', v_partner.code,
    'token', v_token,
    'expires_at', to_char(
      now() + (coalesce(p_days, 30) || ' days')::interval, 'YYYY-MM-DD')
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- 9.2 referral_resolve_pending — lepas reward yang lewat 1 siklus payout
-- -----------------------------------------------------------------------------
-- Dipanggil dari Control Center (service_role) atau cron. Idempoten:
-- baris yang sudah points_released_at tidak dihitung lagi.
create or replace function public.referral_resolve_pending()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  r           record;
  v_released  integer := 0;
  v_points    integer := 0;
  v_rate      integer := 1000;
  v_cfg       jsonb := '{}'::jsonb;
begin
  select coalesce(value, '{}'::jsonb) into v_cfg
  from public.settings where key = 'referral_config';
  v_rate := coalesce((v_cfg->>'points_to_rupiah')::int, 1000);

  for r in
    select cr.id, cr.referrer_partner_id, cr.points_awarded
    from public.code_redemptions cr
    where cr.points_released_at is null
      and cr.hold_until is not null
      and cr.hold_until <= now()
      and coalesce(cr.points_awarded, 0) > 0
      and cr.referrer_partner_id is not null
    for update
  loop
    update public.referral_wallets w
       set points_balance = w.points_balance + r.points_awarded,
           points_earned  = w.points_earned + r.points_awarded,
           points_pending = greatest(w.points_pending - r.points_awarded, 0),
           rupiah_balance = w.rupiah_balance + (r.points_awarded * v_rate),
           updated_at     = now()
     where w.partner_id = r.referrer_partner_id;

    update public.code_redemptions
       set points_released_at = now()
     where id = r.id;

    v_released := v_released + 1;
    v_points   := v_points + r.points_awarded;
  end loop;

  return jsonb_build_object(
    'ok', true,
    'released_rows', v_released,
    'points_released', v_points
  );
end;
$$;

-- =============================================================================
-- 10. RLS + GRANT
-- =============================================================================

-- 10.1 RLS ON tanpa policy → anon/authenticated tidak bisa langsung baca/ tulis.
alter table public.referral_partners  enable row level security;
alter table public.referral_wallets   enable row level security;
alter table public.payout_requests    enable row level security;
alter table public.license_codes      enable row level security;
alter table public.code_redemptions   enable row level security;

revoke all on public.referral_partners, public.referral_wallets,
              public.payout_requests, public.license_codes,
              public.code_redemptions
  from anon, authenticated;

grant select, insert, update, delete on
  public.referral_partners, public.referral_wallets, public.payout_requests,
  public.license_codes, public.code_redemptions
  to service_role;

-- 10.2 RPC portal: boleh anon (dipakai browser app mitra/ dgn anon key).
revoke all on function public.partner_session(text) from public;
grant execute on function public.partner_session(text) to anon, authenticated, service_role;

revoke all on function public.partner_my_balance(text) from public;
grant execute on function public.partner_my_balance(text) to anon, authenticated, service_role;

revoke all on function public.partner_referrals(text) from public;
grant execute on function public.partner_referrals(text) to anon, authenticated, service_role;

revoke all on function public.partner_payouts(text) from public;
grant execute on function public.partner_payouts(text) to anon, authenticated, service_role;

revoke all on function public.payout_request(text, integer, numeric, text, text) from public;
grant execute on function public.payout_request(text, integer, numeric, text, text)
  to anon, authenticated, service_role;

-- 10.3 RPC admin: HANYA service_role.
-- PENTING: Supabase pasang ALTER DEFAULT PRIVILEGES di schema public yang
-- memberi EXECUTE ke anon + authenticated OTOMATIS saat fungsi dibuat.
-- Jadi `revoke ... from public` aja TIDAK cukup — anon & authenticated harus
-- dicabut eksplisit (lihat juga migration-mitra-portal-fase1-grants-fix.sql).
revoke all on function public.referral_resolve_pending() from public, anon, authenticated;
grant execute on function public.referral_resolve_pending() to service_role;

revoke all on function public.partner_issue_token(uuid, integer) from public, anon, authenticated;
grant execute on function public.partner_issue_token(uuid, integer) to service_role;

commit;
