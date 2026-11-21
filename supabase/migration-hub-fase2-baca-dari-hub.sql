-- =============================================================================
-- HUB Fase 2 — Portal baca lisensi dari HUB (bukan lagi kolom clients)
-- =============================================================================
-- Lanjutan Fase 1 (jembatan klien → akun). Keputusan owner 29/10/2026:
--   * HUB = sumber kebenaran; portal mitra = UI-nya.
--   * WA aneh 62823251033366 → BIARIN: jadi 2 akun + lisensi terpisah,
--     tanpa merge manual.
--
-- Yang dikerjakan file ini:
--   1. partner_my_apps — replace: sumber = licenses (HUB) via
--      global_identity_id mitra. Output KOMPatibel dengan UI lama
--      (app_type / license_status / license_expires_at / unit_id tetap ada)
--      + field baru (license_id, serial, plan, max_devices, hub_status).
--      - license_status diterjemahkan dari HUB: active+belum expired →
--        'aktif' (nilai yang difilter UI); expired → 'kedaluwarsa';
--        revoked → 'dicabut'.
--      - unit_id = coalesce(outlet_ref, unit dari source_client).
--   2. partner_session — has_license diganti: dari `clients.client_id`
--      (hanya mitra-lawan yang kehitung) → dari licenses HUB via identitas
--      global (dual-role sejati: mitra yang beli = has_license, siklus
--      payout 7 hari). Perilaku lain partner_session TIDAK diubah (disalin
--      persis dari live 29/10/2026).
--
-- Tidak diubah: partner_register, balance/referrals/payouts, trigger Fase 1.
--
-- ROLLBACK (bersih):
--   - create or replace kedua fungsi dengan versi sebelumnya (disimpan di
--     audit hub_f2_fn_defs / git history), ATAU:
--   - partner_my_apps: sumber kembali ke clients (Fase B1);
--     partner_session: has_license kembali ke clients.client_id.
-- =============================================================================

begin;

set local lock_timeout = '5s';

-- -----------------------------------------------------------------------------
-- 1. partner_my_apps — sumber: licenses (HUB)
-- -----------------------------------------------------------------------------
create or replace function public.partner_my_apps(p_token text)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_partner public.referral_partners%rowtype;
  v_gid     text;
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
    return jsonb_build_object('ok', false, 'code', 'invalid_token',
      'reason', 'token tidak valid atau kedaluwarsa');
  end if;
  if v_partner.status <> 'aktif' then
    return jsonb_build_object('ok', false, 'code', 'not_active',
      'reason', 'status mitra: ' || v_partner.status,
      'status', v_partner.status);
  end if;

  -- Identitas global mitra; fallback jalur lama (mitra lawan tanpa gid).
  v_gid := v_partner.global_identity_id;
  if v_gid is null and v_partner.client_id is not null then
    select c.global_identity_id into v_gid
      from public.clients c
     where c.id = v_partner.client_id;
  end if;
  if v_gid is null then
    return jsonb_build_object('ok', true, 'apps', '[]'::jsonb);
  end if;

  -- Sumber kebenaran = licenses (HUB). Satu akun bisa punya banyak lisensi
  -- (multi-unit / multi-app) → baris per lisensi.
  return jsonb_build_object(
    'ok', true,
    'apps', coalesce((
      select json_agg(json_build_object(
        'license_id',         l.id,
        'app_type',           l.app_type,
        'hub_status',         l.status,
        'serial',             l.current_serial,
        'plan',               l.plan,
        'max_devices',        l.max_devices,
        'license_status',     case
            when l.status = 'active' and (l.expires_at is null or l.expires_at > now())
              then 'aktif'
            when l.status = 'revoked'
              then 'dicabut'
            when l.expires_at is not null and l.expires_at <= now()
              then 'kedaluwarsa'
            else l.status
        end,
        'license_expires_at', to_char(l.expires_at, 'YYYY-MM-DD'),
        'unit_id', coalesce(l.outlet_ref,
                     (select c.unit_id from public.clients c
                       where c.id = l.source_client_id))
      ) order by l.app_type, l.outlet_ref nulls last)
      from public.licenses l
      where l.global_identity_id = v_gid
    ), '[]'::jsonb)
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- 2. partner_session — has_license dari HUB (dual-role sejati)
--    Body disalin dari live 29/10/2026; satu-satunya perubahan = sumber
--    v_has_license.
-- -----------------------------------------------------------------------------
create or replace function public.partner_session(p_token text)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_partner public.referral_partners%rowtype;
  v_cfg      jsonb := '{}'::jsonb;
  v_cycle    integer := 30;
  v_next     date;
  v_last     date;
  v_has_license boolean := false;
  v_gid      text;
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
  -- [Fase 2] has_license = lisensi AKTIF di HUB atas identitas global mitra
  -- (dual-role: mitra yang beli lisensi = kehitung, dari jalur mana pun).
  -- Fallback jalur lama: mitra lawan tanpa gid → gid dari clients.client_id.
  v_gid := v_partner.global_identity_id;
  if v_gid is null and v_partner.client_id is not null then
    select c.global_identity_id into v_gid
      from public.clients c
     where c.id = v_partner.client_id;
  end if;

  v_has_license := v_gid is not null and exists (
    select 1 from public.licenses l
     where l.global_identity_id = v_gid
       and l.status = 'active'
       and (l.expires_at is null or l.expires_at > now())
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
-- 3. Grants — kedua RPC ini dipanggil browser portal (anon key).
--    Revoke eksplisit dulu (pola anti auto-grant Supabase), lalu grant
--    yang memang dipakai.
-- -----------------------------------------------------------------------------
revoke all on function public.partner_my_apps(text) from public, anon, authenticated;
revoke all on function public.partner_session(text)  from public, anon, authenticated;
grant execute on function public.partner_my_apps(text) to anon, authenticated, service_role;
grant execute on function public.partner_session(text)  to anon, authenticated, service_role;

commit;

-- =============================================================================
-- VERIFY (audit-schema.js):
--   --only=hub_f2_fn_defs,mitra_acl
--   * partner_my_apps / partner_session = body baru (sumber licenses)
--   * mitra_acl: anon_exec = true untuk keduanya
-- Smoke UI: lihat supabase/dev-hub-fase2-smoke.sql (partner test + token).
-- =============================================================================
