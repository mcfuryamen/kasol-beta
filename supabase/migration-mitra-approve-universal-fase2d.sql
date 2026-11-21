-- =============================================================================
-- FASE 2d — KODE REFERRAL DARI APPROVE ADMIN HARUS UNIVERSAL
-- =============================================================================
-- Tanggal : 27/10/2026
-- Alasan  : Companion Fase 2b/2c. `partner_approve` (RPC admin, dipanggil dari
--           tab "Mitra" di Control Center) bikin/repair kode referral mitra
--           dengan `app_type` di-HARDCODE 'kaki5' — padahal keputusan owner
--           (§14.2 item 3, ADR rev v9) = satu kode referral mitra berlaku buat
--           SELURUH produk Kasir Solo (`app_type='*'`).
--
-- DAMPAK BUGNYA: mitra yang kodenya dibuat lewat approve admin (bukan lewat
-- form daftar) dapat kode yang HANYA berlaku di kaki5 — masalah yang sama
-- dengan bug yang sudah ditutup di Fase 2b.
--
-- Yang diubah: app_type kode referral di partner_approve: 'kaki5' -> '*'
-- (termasuk di branche ON CONFLICT, supaya kode lama ikut dikoreksi).
--
-- AMAN: partner_claim_referral TIDAK memfilter app_type kode, jadi alur klaim
--        yang sudah live tidak berubah perilaku.
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- Fungsi partner_approve — kode referral universal
-- -----------------------------------------------------------------------------
-- Body sama persis dengan migration-mitra-registration-fase2.sql, kecuali:
--   · app_type kode referral: 'kaki5' -> '*'
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

    -- Kode referal (langsung bisa dipakai & di-share).
    -- app_type '*' = universal: berlaku buat seluruh produk Kasir Solo.
    insert into public.license_codes (
      code, kind, app_type, owner_partner_id, created_by, status, expires_at,
      discount_type, discount_value, min_purchase, notes
    )
    values (
      v_partner.code, 'referral', '*', v_partner.id, 'admin', 'aktif',
      now() + (v_expire_days || ' days')::interval,
      'fixed', v_discount, v_min_purchase, 'Kode referral mitra (universal)'
    )
    on conflict (code) do update
      set owner_partner_id = v_partner.id,
          app_type = '*',
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

-- -----------------------------------------------------------------------------
-- Backfill: kode referral milik mitra yang masih ditandai satu produk
-- -----------------------------------------------------------------------------
update public.license_codes
   set app_type = '*',
       updated_at = now()
 where kind = 'referral'
   and owner_partner_id is not null
   and app_type is distinct from '*';

-- -----------------------------------------------------------------------------
-- GRANT (sama seperti Fase 2 — CREATE OR REPLACE mempertahankan ACL,
-- tapi ditulis ulang biar file ini self-contained)
-- -----------------------------------------------------------------------------
revoke all on function public.partner_approve(uuid, text, text) from public, anon, authenticated;
grant execute on function public.partner_approve(uuid, text, text) to service_role;

commit;
