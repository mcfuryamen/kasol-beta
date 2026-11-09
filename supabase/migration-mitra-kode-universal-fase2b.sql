-- =============================================================================
-- FASE 2b — KODE REFERRAL MITRA UNIVERSAL (app_type = '*')
-- =============================================================================
-- Tanggal : 26/10/2026
-- Alasan  : Keputusan owner — satu kode referral mitra berlaku untuk SELURUH
--           produk Kasir Solo (ADR §14.2 item 3: "satu kode, satu link untuk
--           di-share"). App sudah memperlakukan kode mitra sebagai universal
--           (`mitra/src/data/site.ts` — "Kode referal bersifat universal
--           (app_type='*')"), tapi DB masih menandai kode referral mitra
--           dengan app_type='kaki5'.
--
-- Yang diubah:
--   1. partner_register
--      · kode referral BARU  → app_type = '*'  (was 'kaki5')
--      · produk_interest     → default '*'      (was null kalau form kosong)
--   2. Data yang sudah ada
--      · license_codes (kind='referral', punya mitra) → app_type = '*'
--      · referral_partners.produk_interest null/kosong → '*'
--
-- AMAN:
--   · partner_claim_referral TIDAK PERNAH memfilter app_type kode, jadi alur
--     klaim yang sudah live tidak berubah perilaku sama sekali.
--   · Tidak ada ALTER TABLE pada tabel yang sedang ditulis app klien
--     (tidak ada risiko deadlock 40P01 seperti di Fase 1).
--   · code_redemptions.app_type TIDAK diubah — itu atribusi produk yang
--     sebenarnya dibeli referee (kaki5/rosok/laundry/...), bukan cakupan kode.
--
-- Verifikasi setelah apply:
--   node supabase/audit-schema.js --ref=<ref> --only=mitra_rows,mitra_acl
--   → semua ref_app_type = '*', partner_register tetap executable oleh anon.
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- 1. Fungsi partner_register — kode universal
-- -----------------------------------------------------------------------------
-- Body sama persis dengan migration-mitra-registration-fase2.sql, kecuali:
--   · app_type kode referral: 'kaki5' → '*'
--   · produk_interest: default '*' kalau p_produk kosong
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
    'portal_token', v_token,
    'status', 'aktif'
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- 2. Data lama → universal
-- -----------------------------------------------------------------------------
-- Kode referral milik mitra: satu kode buat semua produk.
update public.license_codes
   set app_type = '*',
       updated_at = now()
 where kind = 'referral'
   and owner_partner_id is not null
   and app_type is distinct from '*';

-- Mitra lama yang produk_interest-nya kosong → '*' (kode universal).
update public.referral_partners
   set produk_interest = '*',
       updated_at = now()
 where (produk_interest is null or btrim(produk_interest) = '')
   and status = 'aktif';

-- -----------------------------------------------------------------------------
-- 3. GRANT (sama seperti Fase 2 — CREATE OR REPLACE sudah mempertahankan ACL,
--    tapi ditulis ulang biar file ini self-contained)
-- -----------------------------------------------------------------------------
revoke all on function public.partner_register(text, text, text, text, text, text, text) from public;
grant execute on function public.partner_register(text, text, text, text, text, text, text)
  to anon, authenticated, service_role;

commit;
