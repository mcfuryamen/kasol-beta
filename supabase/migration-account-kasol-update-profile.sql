-- ============================================================================
-- Akun Kasol — edit identitas dari dashboard /akun (tab Profil)
-- ============================================================================
-- RPC `account_update_profile(p_nama, p_kota, p_provinsi)` — authenticated:
--   · nama  → global_identities.display_name + referral_partners.nama
--   · kota/provinsi → referral_partners + SEMUA baris clients (registri app
--     kaki5/rosok/… di repo control) yang menempel ke gid ini — supaya data
--     identitas di Control & di dashboard akun selalu sinkron.
-- Semua opsional & parsial: yang dikirim null/kosong tidak diubah.
-- Catatan: TIDAK menyentuh no_whatsapp (identitas login) maupun status partner.
-- Kolom *_id wilayah di clients dibiarkan — hanya teks yang disinkronkan.
--
-- Rollback:
--   drop function if exists public.account_update_profile(text, text, text);
-- ============================================================================

create or replace function public.account_update_profile(
  p_nama     text default null,
  p_kota     text default null,
  p_provinsi text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_gid      text := public.current_global_identity_id();
  v_nama     text;
  v_kota     text;
  v_provinsi text;
  v_clients  integer := 0;
begin
  if v_gid is null then
    return jsonb_build_object('ok', false, 'code', 'not_signed_in',
      'reason', 'masuk ke akun dulu ya');
  end if;

  v_nama     := nullif(btrim(coalesce(p_nama, '')), '');
  v_kota     := nullif(btrim(coalesce(p_kota, '')), '');
  v_provinsi := nullif(btrim(coalesce(p_provinsi, '')), '');

  if v_nama is null and v_kota is null and v_provinsi is null then
    return jsonb_build_object('ok', false, 'code', 'nothing_to_update',
      'reason', 'tidak ada perubahan yang dikirim');
  end if;

  if v_nama is not null and (length(v_nama) < 2 or length(v_nama) > 60) then
    return jsonb_build_object('ok', false, 'code', 'invalid_nama',
      'reason', 'nama minimal 2 huruf, maksimal 60 karakter');
  end if;
  if v_kota is not null and length(v_kota) > 60 then
    return jsonb_build_object('ok', false, 'code', 'invalid_kota',
      'reason', 'nama kota terlalu panjang');
  end if;
  if v_provinsi is not null and length(v_provinsi) > 60 then
    return jsonb_build_object('ok', false, 'code', 'invalid_provinsi',
      'reason', 'nama provinsi terlalu panjang');
  end if;

  if v_nama is not null then
    update public.global_identities
       set display_name = v_nama, updated_at = now()
     where id = v_gid;
    update public.referral_partners
       set nama = v_nama, updated_at = now()
     where global_identity_id = v_gid;
  end if;

  update public.referral_partners
     set kota      = coalesce(v_kota, kota),
         provinsi  = coalesce(v_provinsi, provinsi),
         updated_at = now()
   where global_identity_id = v_gid;

  -- Sinkron ke registri app klien (terlihat di Control → Klien).
  if v_nama is not null or v_kota is not null or v_provinsi is not null then
    with updated as (
      update public.clients
         set nama_pemilik = coalesce(v_nama, nama_pemilik),
             kabkota      = coalesce(v_kota, kabkota),
             provinsi     = coalesce(v_provinsi, provinsi),
             updated_at   = now()
       where global_identity_id = v_gid
      returning 1
    )
    select count(*) into v_clients from updated;
  end if;

  return jsonb_build_object('ok', true,
    'nama', coalesce(v_nama, (select display_name from public.global_identities where id = v_gid)),
    'kota', v_kota, 'provinsi', v_provinsi,
    'clients_updated', v_clients);
end;
$$;

revoke all on function public.account_update_profile(text, text, text)
  from public, anon;
grant execute on function public.account_update_profile(text, text, text)
  to authenticated;

comment on function public.account_update_profile(text, text, text) is
  'Edit identitas akun dari sesi: nama (global_identities + referral_partners) + kota/provinsi (referral_partners + clients). Parsial & opsional.';

-- ----------------------------------------------------------------------------
-- account_my_profile (v2) — bawa juga ringkasan baris clients yang menempel ke
-- akun (registri app di repo control) supaya form Data Diri bisa prefill dari
-- data klien yang lebih lengkap (nama usaha, kabkota, provinsi).
-- ----------------------------------------------------------------------------
create or replace function public.account_my_profile()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_gid text := public.current_global_identity_id();
  v_gi  public.global_identities%rowtype;
  v_p   public.referral_partners%rowtype;
  v_c   public.clients%rowtype;
  v_lic integer := 0;
begin
  if v_gid is null then
    return jsonb_build_object('ok', false, 'code', 'not_signed_in');
  end if;

  select * into v_gi from public.global_identities where id = v_gid;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'identity_not_found');
  end if;

  select * into v_p
    from public.referral_partners
   where global_identity_id = v_gid
      or public.partner_norm_wa(no_whatsapp) = v_gi.phone_e164
   order by (global_identity_id = v_gid) desc, created_at asc
   limit 1;

  -- Registri app klien paling terakhir aktif yang menempel ke akun ini.
  select * into v_c
    from public.clients
   where global_identity_id = v_gid
   order by last_seen desc nulls last, created_at desc
   limit 1;

  select count(*)::int into v_lic
    from public.licenses where global_identity_id = v_gid;

  return jsonb_build_object(
    'ok', true,
    'gid', v_gi.id,
    'nama', v_gi.display_name,
    'wa', v_gi.phone_e164,
    'status', v_gi.status,
    'phone_verified', (v_gi.phone_verified_at is not null),
    'created_at', v_gi.created_at,
    'license_count', v_lic,
    'mitra', case when v_p.id is null then null else jsonb_build_object(
      'partner_id', v_p.id,
      'status', v_p.status,
      'code', v_p.code,
      'kota', v_p.kota,
      'provinsi', v_p.provinsi,
      'tier', v_p.tier,
      'registered_via', v_p.registered_via
    ) end,
    'client', case when v_c.id is null then null else jsonb_build_object(
      'unit_id', v_c.unit_id,
      'app_type', v_c.app_type,
      'nama_usaha', v_c.nama_usaha,
      'nama_pemilik', v_c.nama_pemilik,
      'kabkota', v_c.kabkota,
      'provinsi', v_c.provinsi
    ) end
  );
end;
$$;

comment on function public.account_my_profile() is
  'Profil akun + status mitra + ringkasan clients terhubung (untuk prefill Data Diri).';
