-- =============================================================================
-- MIGRASI — MODUL REGISTRASI MITRA + PENCATATAN REFERRAL (Fase 2)
-- =============================================================================
-- Project : hhywrvedlwljawgxzpkq
-- Sumber  : docs/ADR-VOUCHER-REFERRAL.md §12.5 (alur pendaftaran),
--           §14.1 (D2 auto-approve), §7.1 (poin 50/5), §7.2 (config),
--           §8 (anti-fraud)
-- App     : mitra/  (form daftar → DB, halaman /r/<kode> → klaim diskon)
--
-- KEPUTUSAN OWNER (2026-10-26):
--   1. Registrasi TANPA verifikasi WA — langsung aktif, langsung dapat kode
--      referral + link portal. (D2: nggak ada antre approve admin.)
--   2. Pencatatan referral dari kode ikut dikerjakan (tanpa sentuh app klien):
--      disentuh lewat halaman /r/<kode> di app mitra.
--
-- YANG TIDAK DISENTUH (sengaja):
--   - Aplikasi klien (kaki5/rosok/laundry) → redeem kode saat pembelian tetap
--     Fase 3 dan butuh app klien (instruksi owner: jangan sentuh app klien).
--   - Control Center (tab "🤝 Mitra") → sesi berikutnya. RPC admin-nya
--     (`partner_approve`, `partner_mark_purchase`) sudah siap dipanggil dari
--     proxy /api/rest (service_role).
--
-- RPC BARU:
--   partner_register(p_nama, p_wa, p_kota, p_provinsi, p_email, p_produk,
--                    p_catatan)                    → publik (anon)
--   partner_claim_referral(p_code, p_nama, p_wa, p_kota, p_app_type) → publik (anon)
--   partner_mark_purchase(p_partner_id, p_phone)   → admin (service_role)
--   partner_approve(p_partner_id, p_action, p_note) → admin (service_role)
-- =============================================================================

begin;

set local lock_timeout = '5s';

-- -----------------------------------------------------------------------------
-- 1. Kolom baru di referral_partners (data dari form pendaftaran)
-- -----------------------------------------------------------------------------
alter table public.referral_partners
  add column if not exists produk_interest text,
  add column if not exists catatan         text,
  add column if not exists registered_via   text default 'website';

-- -----------------------------------------------------------------------------
-- 2. Helper internal (bukan untuk dipanggil langsung browser)
-- -----------------------------------------------------------------------------
-- Normalisasi nomor WhatsApp: "0812-3456" / "+62 812" / "812" → "62812..."
create or replace function public.partner_norm_wa(p_wa text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  v text;
begin
  v := regexp_replace(coalesce(p_wa, ''), '[^0-9]', '', 'g');
  if v = '' then
    return null;
  end if;
  if left(v, 1) = '0' then
    v := '62' || substr(v, 2);
  elsif left(v, 1) = '8' then
    v := '62' || v;
  end if;
  return v;
end;
$$;

-- Kode referal mitra: "MKS-XXXXXX" (human-readable, unik, retry sampai 20x)
create or replace function public.partner_gen_code()
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_code text;
  v_tries integer := 0;
begin
  loop
    v_code := 'MKS-' || upper(substr(encode(extensions.gen_random_bytes(4), 'hex'), 1, 6));
    if not exists (select 1 from public.referral_partners where code = v_code) then
      return v_code;
    end if;
    v_tries := v_tries + 1;
    if v_tries > 20 then
      raise exception 'gagal membuat kode referral';
    end if;
  end loop;
end;
$$;

-- -----------------------------------------------------------------------------
-- 3. RPC partner_register — pendaftaran mitra (langsung aktif, tanpa verifikasi)
-- -----------------------------------------------------------------------------
-- Guard:
--   - nama minimal 2 huruf, WA harus 9-15 digit (sudah dinormalisasi)
--   - 1 WA = 1 mitra: WA yang sama → DITOLAK (nggak dikasih token!)
--   - anti-spam: maksimal 20 pendaftaran baru per jam
--   - bikin: referral_partners (aktif) + wallet + license_codes(referral)
--             + token portal (SHA-256, 1 tahun)
create or replace function public.partner_register(
  p_nama     text,
  p_wa       text,
  p_kota     text default null,
  p_provinsi text default null,
  p_email    text default null,
  p_produk   text default null,
  p_catatan  text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_nama    text;
  v_wa      text;
  v_code    text;
  v_token   text;
  v_partner public.referral_partners%rowtype;
  v_cfg     jsonb := '{}'::jsonb;
  v_discount    numeric := 50000;
  v_min_purchase numeric := 100000;
  v_expire_days integer := 30;
  v_new_count   integer := 0;
begin
  v_nama := btrim(coalesce(p_nama, ''));
  v_wa   := public.partner_norm_wa(p_wa);

  if length(v_nama) < 2 then
    return jsonb_build_object('ok', false, 'code', 'invalid_nama',
      'reason', 'nama minimal 2 huruf');
  end if;
  if v_wa is null or length(v_wa) < 9 or length(v_wa) > 15 then
    return jsonb_build_object('ok', false, 'code', 'invalid_wa',
      'reason', 'nomor WhatsApp nggak valid');
  end if;

  select coalesce(value, '{}'::jsonb) into v_cfg
  from public.settings where key = 'referral_config';
  v_discount     := coalesce((v_cfg->>'discount_referral')::numeric, 50000);
  v_min_purchase := coalesce((v_cfg->>'min_purchase_for_discount')::numeric, 100000);
  v_expire_days  := coalesce((v_cfg->>'referral_expire_days')::int, 30);

  -- Sudah pernah daftar?
  select * into v_partner
  from public.referral_partners
  where lower(btrim(no_whatsapp)) = lower(v_wa)
  limit 1;

  if found then
    if v_partner.status = 'aktif' then
      -- PENTING: jangan pernah balikin token di sini. Kalau nomor ini milik
      -- orang lain, dia bakal bisa masuk ke portal mitranya.
      return jsonb_build_object('ok', false, 'code', 'already_active',
        'reason', 'nomor ini sudah terdaftar. Cek link portal di WhatsApp lo.');
    end if;
    -- Dulu pending/ditolak → daftar ulang = aktif.
    update public.referral_partners
       set nama = v_nama,
           kota = nullif(btrim(coalesce(p_kota, '')), ''),
           provinsi = nullif(btrim(coalesce(p_provinsi, '')), ''),
           email = nullif(btrim(coalesce(p_email, '')), ''),
           produk_interest = nullif(btrim(coalesce(p_produk, '')), ''),
           catatan = nullif(btrim(coalesce(p_catatan, '')), ''),
           status = 'aktif',
           approved_at = now(),
           approved_by = 'auto',
           updated_at = now()
     where id = v_partner.id
    returning * into v_partner;
    v_code := v_partner.code;
  else
    -- Anti-spam: jangan sampai DB Flooded dari form publik.
    select count(*)::int into v_new_count
    from public.referral_partners
    where created_at > now() - interval '1 hour';

    if v_new_count >= 20 then
      return jsonb_build_object('ok', false, 'code', 'rate_limited',
        'reason', 'ramai banget nih, coba lagi nanti ya');
    end if;

    v_code := public.partner_gen_code();

    insert into public.referral_partners (
      code, nama, no_whatsapp, kota, provinsi, email,
      produk_interest, catatan, status, tier, registered_via,
      approved_at, approved_by
    )
    values (
      v_code, v_nama, v_wa,
      nullif(btrim(coalesce(p_kota, '')), ''),
      nullif(btrim(coalesce(p_provinsi, '')), ''),
      nullif(btrim(coalesce(p_email, '')), ''),
      nullif(btrim(coalesce(p_produk, '')), ''),
      nullif(btrim(coalesce(p_catatan, '')), ''),
      'aktif', 'bronze', 'website', now(), 'auto'
    )
    returning * into v_partner;
  end if;

  -- Dompet mitra
  insert into public.referral_wallets (partner_id, app_type)
  values (v_partner.id, 'kaki5')
  on conflict (partner_id) do nothing;

  -- Kode referal (langsung bisa dipakai & di-share)
  insert into public.license_codes (
    code, kind, app_type, owner_partner_id, created_by, status, expires_at,
    discount_type, discount_value, min_purchase, notes
  )
  values (
    v_code, 'referral', 'kaki5', v_partner.id, 'mitra', 'aktif',
    now() + (v_expire_days || ' days')::interval,
    'fixed', v_discount, v_min_purchase, 'Kode referral mitra'
  )
  on conflict (code) do update
    set owner_partner_id = v_partner.id,
        status = 'aktif',
        expires_at = now() + (v_expire_days || ' days')::interval,
        updated_at = now();

  -- Token portal (mentah dikembalikan sekali; DB cuma nyimpen hash-nya)
  v_token := encode(extensions.gen_random_bytes(24), 'hex');
  update public.referral_partners
     set portal_token_hash = encode(extensions.digest(v_token, 'sha256'), 'hex'),
         portal_token_created_at = now(),
         portal_token_expires_at = now() + 365 * interval '1 day',
         updated_at = now()
   where id = v_partner.id;

  return jsonb_build_object(
    'ok', true,
    'partner_id', v_partner.id,
    'code', v_partner.code,
    'nama', v_partner.nama,
    'kota', v_partner.kota,
    'portal_token', v_token,
    'status', 'aktif'
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- 4. RPC partner_claim_referral — pencatatan referral dari kode
-- -----------------------------------------------------------------------------
-- Dipanggil dari halaman /r/<kode> (pihak yang DIREKOMENDASIKAN).
-- Catat ledger reward → mitra dapat poin pending (hold 7/30 hari, basis status
-- mitra) + refereenya dapat voucher diskon.
--
-- Guard:
--   - kode referral harus ada, aktif, belum kedaluwarsa, punya mitra
--   - anti self-referral: WA refereenya ≠ WA mitra
--   - idempoten: 1 WA per kode (claim ulang = kembalikan yang lama, nggak dobel)
create or replace function public.partner_claim_referral(
  p_code     text,
  p_nama     text,
  p_wa       text,
  p_kota     text default null,
  p_app_type text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_lc      public.license_codes%rowtype;
  v_partner public.referral_partners%rowtype;
  v_existing public.code_redemptions%rowtype;
  v_nama    text;
  v_wa      text;
  v_cfg     jsonb := '{}'::jsonb;
  v_points  integer := 5;
  v_cycle   integer := 30;
  v_discount     numeric := 50000;
  v_min_purchase numeric := 100000;
  v_expire_days  integer := 30;
  v_voucher text;
  v_unit    text;
begin
  v_nama := btrim(coalesce(p_nama, ''));
  v_wa   := public.partner_norm_wa(p_wa);

  if length(v_nama) < 2 or v_wa is null then
    return jsonb_build_object('ok', false, 'code', 'invalid_input',
      'reason', 'nama dan WhatsApp wajib diisi');
  end if;

  select * into v_lc
  from public.license_codes
  where upper(code) = upper(btrim(coalesce(p_code, '')))
    and kind = 'referral'
  limit 1;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'invalid_code',
      'reason', 'kode referral nggak ketemu');
  end if;
  if v_lc.status <> 'aktif' or v_lc.expires_at <= now() then
    return jsonb_build_object('ok', false, 'code', 'code_expired',
      'reason', 'kode ini udah nggak berlaku');
  end if;
  if v_lc.owner_partner_id is null then
    return jsonb_build_object('ok', false, 'code', 'invalid_code',
      'reason', 'kode ini nggak punya mitra');
  end if;

  select * into v_partner
  from public.referral_partners
  where id = v_lc.owner_partner_id
  limit 1;

  if not found or v_partner.status <> 'aktif' then
    return jsonb_build_object('ok', false, 'code', 'partner_inactive',
      'reason', 'mitranya lagi nggak aktif');
  end if;

  -- Anti self-referral
  if lower(btrim(v_partner.no_whatsapp)) = lower(v_wa) then
    return jsonb_build_object('ok', false, 'code', 'self_referral',
      'reason', 'nggak bisa pakai kode sendiri');
  end if;

  select coalesce(value, '{}'::jsonb) into v_cfg
  from public.settings where key = 'referral_config';
  v_points       := coalesce((v_cfg->>'points_per_free_referral')::int, 5);
  v_discount     := coalesce((v_cfg->>'discount_referral')::numeric, 50000);
  v_min_purchase := coalesce((v_cfg->>'min_purchase_for_discount')::numeric, 100000);
  v_expire_days  := coalesce((v_cfg->>'referral_expire_days')::int, 30);

  -- Siklus payout = status mitra (bukan status refereenya)
  if exists (
    select 1 from public.clients c
    where c.id = v_partner.client_id and c.license_status = 'aktif'
  ) then
    v_cycle := coalesce((v_cfg->>'payout_cycle_days_licensed')::int, 7);
  else
    v_cycle := coalesce((v_cfg->>'payout_cycle_days_referral_only')::int, 30);
  end if;

  -- Sudah pernah klaim? → balikin yang lama, jangan dobel poin.
  select * into v_existing
  from public.code_redemptions
  where code_id = v_lc.id
    and referee_phone = v_wa
  order by created_at desc
  limit 1;

  if found then
    return jsonb_build_object(
      'ok', true,
      'already', true,
      'code', v_partner.code,
      'points', v_existing.points_awarded,
      'discount', v_discount,
      'message', 'kode lo udah kepake. Simpan ya.'
    );
  end if;

  -- Catat ledger reward
  v_unit := 'WEB-' || upper(substr(encode(extensions.gen_random_bytes(4), 'hex'), 1, 8));
  insert into public.code_redemptions (
    code_id, code, channel, unit_id, app_type, discount_value, points_awarded,
    hold_until, referrer_partner_id, status, referee_name, referee_city, referee_phone
  )
  values (
    v_lc.id, v_lc.code, 'diskon', v_unit,
    coalesce(nullif(btrim(coalesce(p_app_type, '')), ''), '*'),
    v_discount, v_points,
    now() + (v_cycle || ' days')::interval,
    v_partner.id, 'berhasil',
    v_nama, nullif(btrim(coalesce(p_kota, '')), ''), v_wa
  );

  -- Saldo mitra: pending + earned (nanti dilepas sama referral_resolve_pending)
  insert into public.referral_wallets (partner_id, app_type, points_pending, points_earned)
  values (v_partner.id, 'kaki5', v_points, v_points)
  on conflict (partner_id) do update
    set points_pending = public.referral_wallets.points_pending + v_points,
        points_earned  = public.referral_wallets.points_earned + v_points,
        updated_at = now();

  -- Voucher diskon buat refereenya
  v_voucher := 'DSK-' || upper(substr(encode(extensions.gen_random_bytes(4), 'hex'), 1, 6));
  insert into public.license_codes (
    code, kind, app_type, owner_partner_id, created_by, status, expires_at,
    discount_type, discount_value, min_purchase, notes
  )
  values (
    v_voucher, 'voucher', 'kaki5', v_partner.id, 'referral', 'aktif',
    now() + (v_expire_days || ' days')::interval,
    'fixed', v_discount, v_min_purchase, 'Voucher diskon dari kode referral mitra'
  );

  return jsonb_build_object(
    'ok', true,
    'code', v_partner.code,
    'voucher_code', v_voucher,
    'discount', v_discount,
    'min_purchase', v_min_purchase,
    'points', v_points,
    'expires_at', to_char(now() + (v_expire_days || ' days')::interval, 'YYYY-MM-DD'),
    'message', 'kode diskon lo udah jadi.'
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- 5. RPC partner_mark_purchase — naikkan poin referral jadi tier "paid"
-- -----------------------------------------------------------------------------
-- Dipanggil admin (Control Center / SQL) saat pembelian refereenya tercatat.
-- Poin: 5 (free) → 50 (paid). Kalau reward-nya udahreleased, selisihnya
-- langsung masuk ke saldo siap cair.
create or replace function public.partner_mark_purchase(
  p_partner_id uuid,
  p_phone      text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_red   public.code_redemptions%rowtype;
  v_cfg   jsonb := '{}'::jsonb;
  v_paid  integer := 50;
  v_delta integer := 0;
begin
  select coalesce(value, '{}'::jsonb) into v_cfg
  from public.settings where key = 'referral_config';
  v_paid := coalesce((v_cfg->>'points_per_paid_referral')::int, 50);

  select * into v_red
  from public.code_redemptions
  where referrer_partner_id = p_partner_id
    and referee_phone = public.partner_norm_wa(p_phone)
  order by created_at desc
  limit 1;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'referral-nya nggak ketemu');
  end if;
  if v_red.points_awarded >= v_paid then
    return jsonb_build_object('ok', true, 'already', true, 'points', v_red.points_awarded);
  end if;

  v_delta := v_paid - v_red.points_awarded;

  update public.code_redemptions
     set points_awarded = v_paid,
         reason = coalesce(reason || ' | ', '') || 'upgrade: pembelian tercatat'
   where id = v_red.id;

  update public.referral_wallets w
     set points_pending = greatest(w.points_pending - v_red.points_awarded + v_paid, 0),
         points_earned  = w.points_earned + v_delta,
         points_balance = case
                            when v_red.points_released_at is not null
                              then w.points_balance + v_delta
                            else w.points_balance
                          end,
         updated_at = now()
   where w.partner_id = p_partner_id;

  return jsonb_build_object(
    'ok', true,
    'points_before', v_red.points_awarded,
    'points_after', v_paid
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- 6. RPC partner_approve — kontrol admin (manual override)
-- -----------------------------------------------------------------------------
-- action: 'approve' | 'reject' | 'suspend' | 'activate'
-- approve/activate → aktif +issued token portal baru (dikembalikan sekali).
create or replace function public.partner_approve(
  p_partner_id uuid,
  p_action     text,
  p_note       text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_partner public.referral_partners%rowtype;
  v_action  text := lower(btrim(coalesce(p_action, '')));
  v_token   text;
  v_cfg     jsonb := '{}'::jsonb;
  v_expire_days integer := 30;
  v_discount     numeric := 50000;
  v_min_purchase numeric := 100000;
begin
  select * into v_partner
  from public.referral_partners
  where id = p_partner_id
  limit 1;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'mitra nggak ketemu');
  end if;

  if v_action in ('approve', 'activate') then
    select coalesce(value, '{}'::jsonb) into v_cfg
    from public.settings where key = 'referral_config';
    v_expire_days  := coalesce((v_cfg->>'referral_expire_days')::int, 30);
    v_discount     := coalesce((v_cfg->>'discount_referral')::numeric, 50000);
    v_min_purchase := coalesce((v_cfg->>'min_purchase_for_discount')::numeric, 100000);

    insert into public.referral_wallets (partner_id, app_type)
    values (v_partner.id, 'kaki5')
    on conflict (partner_id) do nothing;

    insert into public.license_codes (
      code, kind, app_type, owner_partner_id, created_by, status, expires_at,
      discount_type, discount_value, min_purchase, notes
    )
    values (
      v_partner.code, 'referral', 'kaki5', v_partner.id, 'admin', 'aktif',
      now() + (v_expire_days || ' days')::interval,
      'fixed', v_discount, v_min_purchase, 'Kode referral mitra'
    )
    on conflict (code) do update
      set owner_partner_id = v_partner.id,
          status = 'aktif',
          expires_at = now() + (v_expire_days || ' days')::interval,
          updated_at = now();

    v_token := encode(extensions.gen_random_bytes(24), 'hex');
    update public.referral_partners
       set status = 'aktif',
           approved_at = now(),
           approved_by = 'admin',
           notes = coalesce(nullif(btrim(coalesce(p_note, '')), ''), notes),
           portal_token_hash = encode(extensions.digest(v_token, 'sha256'), 'hex'),
           portal_token_created_at = now(),
           portal_token_expires_at = now() + 365 * interval '1 day',
           updated_at = now()
     where id = p_partner_id;

    return jsonb_build_object(
      'ok', true, 'status', 'aktif', 'code', v_partner.code, 'portal_token', v_token
    );
  end if;

  if v_action = 'reject' then
    update public.referral_partners
       set status = 'ditolak',
           notes = coalesce(nullif(btrim(coalesce(p_note, '')), ''), notes),
           portal_token_hash = null,
           updated_at = now()
     where id = p_partner_id;
    return jsonb_build_object('ok', true, 'status', 'ditolak');
  end if;

  if v_action = 'suspend' then
    update public.referral_partners
       set status = 'suspend',
           notes = coalesce(nullif(btrim(coalesce(p_note, '')), ''), notes),
           updated_at = now()
     where id = p_partner_id;
    update public.license_codes
       set status = 'dibatalkan', updated_at = now()
     where owner_partner_id = p_partner_id and kind = 'referral';
    return jsonb_build_object('ok', true, 'status', 'suspend');
  end if;

  return jsonb_build_object('ok', false, 'reason', 'aksi nggak dikenal');
end;
$$;

-- =============================================================================
-- 7. GRANT
-- =============================================================================
-- Helper internal: jangan bisa dipanggil browser.
revoke all on function public.partner_norm_wa(text) from public, anon, authenticated;
grant execute on function public.partner_norm_wa(text) to service_role;

revoke all on function public.partner_gen_code() from public, anon, authenticated;
grant execute on function public.partner_gen_code() to service_role;

-- RPC publik (form daftar + halaman /r/<kode>)
revoke all on function public.partner_register(text, text, text, text, text, text, text) from public;
grant execute on function public.partner_register(text, text, text, text, text, text, text)
  to anon, authenticated, service_role;

revoke all on function public.partner_claim_referral(text, text, text, text, text) from public;
grant execute on function public.partner_claim_referral(text, text, text, text, text)
  to anon, authenticated, service_role;

-- RPC admin: HANYA service_role
revoke all on function public.partner_mark_purchase(uuid, text) from public, anon, authenticated;
grant execute on function public.partner_mark_purchase(uuid, text) to service_role;

revoke all on function public.partner_approve(uuid, text, text) from public, anon, authenticated;
grant execute on function public.partner_approve(uuid, text, text) to service_role;

commit;
