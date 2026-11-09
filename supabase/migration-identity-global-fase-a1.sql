-- =============================================================================
-- migration-identity-global-fase-a1.sql
-- AKUN GLOBAL EKOSISTEM KASOL — Fase A1 (keputusan owner, 2026-10-27)
-- =============================================================================
-- KEPUTUSAN DESAIN (owner, 2026-10-27):
--   · Opsi B: akun = global_identities (HUB Fase-0, reuse APA ADANYA — tanpa
--     menyentuh kontrak HUB yang beku; docs/HUB-DESIGN-DECISIONS.md)
--   · Kunci akun: 1 nomor WhatsApp = 1 akun (global_identities.phone_e164
--     sudah UNIQUE sejak Fase-0 → upsert by phone aman)
--   · Registrasi mandiri: perluas partner_register → daftar mitra sekalian
--     membuat/menautkan akun global (backward compatible, signature tetap)
--   · Peran affiliator = baris referral_partners (global_identity_id terisi);
--     peran klien = app_memberships + licenses.global_identity_id (fase A4)
-- ID AKUN: global_identities.id = uuid-string (default gen_random_uuid()::text)
--   sesuai komentar kontrak migration-hub-identity-licenses.sql — BUKAN
--   format custom 'gi_<wa>'.
-- YANG DILAKUKAN FILE INI:
--   1. identity_upsert_by_phone  — helper upsert akun by WA (SECURITY DEFINER,
--      hanya postgres/service_role; anon & authenticated TIDAK boleh langsung)
--   2. partner_register (extend) — daftar mitra = daftar akun global
--   3. partner_session  (extend) — expose wa + global_identity_id ke portal
--   4. Backfill — semua referral_partners existing di-link ke akun global
-- YANG TIDAK DILAKUKAN:
--   · ALTER TABLE apa pun — kolom global_identity_id sudah ada di
--     referral_partners (Fase 1) dan licenses/license_codes (Fase-0)
--   · Menambah/mengubah tabel atau policy kontrak HUB
-- ROLLBACK: rollback-identity-global-fase-a1.sql
-- CATATAN GRANT: Supabase auto-grant EXECUTE ke anon+authenticated saat
-- fungsi dibuat (pelajaran 2026-10-26) → setiap fungsi di-revoke eksplisit
-- lalu di-grant ulang sesuai kebutuhan.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. identity_upsert_by_phone — cari/buat akun global by nomor WA (E.164)
-- -----------------------------------------------------------------------------
-- Dipakai: partner_register (SECURITY DEFINER chain) + backfill. TIDAK diekpos
-- ke anon/authenticated — upsert akun hanya lewat alur terkendali.
-- Status awal 'active': program mitra memang auto-approve (D2); phone_verified_
-- at dibiarkan NULL sampai verifikasi formal (OTP/manual) berjalan.
create or replace function public.identity_upsert_by_phone(
  p_wa   text,
  p_nama text default null
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_wa   text;
  v_id   text;
  v_nama text;
begin
  v_wa := public.partner_norm_wa(p_wa);
  if v_wa is null or length(v_wa) < 9 then
    return null;
  end if;

  v_nama := nullif(btrim(coalesce(p_nama, '')), '');

  select id into v_id
  from public.global_identities
  where phone_e164 = v_wa
  limit 1;

  if found then
    if v_nama is not null then
      update public.global_identities
         set display_name = coalesce(nullif(display_name, ''), v_nama),
             updated_at = now()
       where id = v_id;
    end if;
  else
    insert into public.global_identities (phone_e164, display_name, status)
    values (v_wa, v_nama, 'active')
    on conflict (phone_e164) do update
      set display_name = coalesce(
            nullif(public.global_identities.display_name, ''),
            excluded.display_name),
          updated_at = now()
    returning id into v_id;
  end if;

  return v_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- 2. partner_register (extend fase2b) — daftar mitra = daftar akun global
-- -----------------------------------------------------------------------------
-- Body SAMA PERSIS dengan migration-mitra-kode-universal-fase2b.sql, dengan
-- tambahan blok "Akun global" setelah cabang daftar-baru/reaktivasi:
--   · upsert global_identities by WA → set referral_partners.global_identity_id
--   · return menambah 'global_identity_id'
-- Perilaku duplikat-WA aktif TIDAK berubah: tetap 'already_active' TANPA token.
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
  v_gi      text;
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
           produk_interest = coalesce(nullif(btrim(coalesce(p_produk, '')), ''), '*'),
           catatan = nullif(btrim(coalesce(p_catatan, '')), ''),
           status = 'aktif',
           approved_at = now(),
           approved_by = 'auto',
           updated_at = now()
     where id = v_partner.id
    returning * into v_partner;
    v_code := v_partner.code;
  else
    -- Anti-spam: jangan sampai DB flooded dari form publik.
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
      coalesce(nullif(btrim(coalesce(p_produk, '')), ''), '*'),
      nullif(btrim(coalesce(p_catatan, '')), ''),
      'aktif', 'bronze', 'website', now(), 'auto'
    )
    returning * into v_partner;
  end if;

  -- [Fase A1] Akun global: 1 WA = 1 akun → buat/link global_identities.
  -- Gagal buat akun tidak boleh menggagalkan pendaftaran mitra (mitra sudah
  -- hidup sejak Fase 1) — cukup lewati; backfill bisa menambal nanti.
  begin
    v_gi := public.identity_upsert_by_phone(v_wa, v_nama);
    if v_gi is not null then
      update public.referral_partners
         set global_identity_id = v_gi,
             updated_at = now()
       where id = v_partner.id
         and global_identity_id is distinct from v_gi;
    end if;
  exception when others then
    v_gi := null;
  end;

  -- Dompet mitra
  insert into public.referral_wallets (partner_id, app_type)
  values (v_partner.id, 'kaki5')
  on conflict (partner_id) do nothing;

  -- Kode referal (langsung bisa dipakai & di-share).
  -- app_type '*' = universal: berlaku buat seluruh produk Kasir Solo.
  insert into public.license_codes (
    code, kind, app_type, owner_partner_id, created_by, status, expires_at,
    discount_type, discount_value, min_purchase, notes
  )
  values (
    v_code, 'referral', '*', v_partner.id, 'mitra', 'aktif',
    now() + (v_expire_days || ' days')::interval,
    'fixed', v_discount, v_min_purchase, 'Kode referral mitra (universal)'
  )
  on conflict (code) do update
    set owner_partner_id = v_partner.id,
        app_type = '*',
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
    'global_identity_id', v_gi,
    'portal_token', v_token,
    'status', 'aktif'
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- 3. partner_session (extend fase1) — expose wa + global_identity_id
-- -----------------------------------------------------------------------------
-- Body SAMA PERSIS dengan migration-mitra-portal-fase1.sql §8.1; return
-- menambah 'wa' dan 'global_identity_id' untuk identitas akun di portal (A2).
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
    'wa', v_partner.no_whatsapp,
    'global_identity_id', v_partner.global_identity_id,
    'payout_cycle_days', v_cycle,
    'next_payout_date', to_char(v_next, 'YYYY-MM-DD')
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- 4. Backfill — semua mitra existing di-link ke akun global
-- -----------------------------------------------------------------------------
-- Idempoten: hanya menyentuh baris dengan global_identity_id IS NULL.
do $$
declare
  r    record;
  v_gi text;
begin
  for r in
    select id, nama, no_whatsapp
    from public.referral_partners
    where global_identity_id is null
      and no_whatsapp is not null
  loop
    v_gi := public.identity_upsert_by_phone(r.no_whatsapp, r.nama);
    if v_gi is not null then
      update public.referral_partners
         set global_identity_id = v_gi,
             updated_at = now()
       where id = r.id;
    end if;
  end loop;
end;
$$;

-- -----------------------------------------------------------------------------
-- 5. Grants
-- -----------------------------------------------------------------------------
-- Helper akun: hanya service path (postgres/service_role). anon & authenticated
-- dicabut eksplisit (auto-grant EXECUTE Supabase).
revoke all on function public.identity_upsert_by_phone(text, text)
  from public, anon, authenticated;
grant execute on function public.identity_upsert_by_phone(text, text)
  to postgres, service_role;

-- Portal RPC: anon boleh (dipakai browser mitra/ dgn anon key) — kontrak Fase 1.
revoke all on function public.partner_register(text, text, text, text, text, text, text)
  from public;
grant execute on function public.partner_register(text, text, text, text, text, text, text)
  to anon, authenticated, service_role;

revoke all on function public.partner_session(text) from public;
grant execute on function public.partner_session(text)
  to anon, authenticated, service_role;
