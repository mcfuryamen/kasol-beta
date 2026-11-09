-- ============================================================================
-- Akun Kasol — edit identitas versi 3: tambah alamat detail + kecamatan + desa
-- (konsep sama kayak form aplikasi klien kaki5: alamat bebas + wilayah rantai)
-- ============================================================================
-- `account_update_profile(p_nama, p_kota, p_provinsi, p_alamat_detail,
--   p_kecamatan, p_desa)` — authenticated.
--
-- Sinkron ke:
--   · referral_partners (kota/provinsi + nama)
--   · semua baris `clients` tertaut (nama_pemilik, kabkota, provinsi,
--     alamat_detail, kecamatan, desa)
-- Semua opsional & parsial.
-- ============================================================================

create or replace function public.account_update_profile(
  p_nama         text default null,
  p_kota         text default null,
  p_provinsi     text default null,
  p_alamat_detail text default null,
  p_kecamatan    text default null,
  p_desa         text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_gid text := public.current_global_identity_id();
  v_clients integer := 0;
begin
  if v_gid is null then
    return jsonb_build_object('ok', false, 'code', 'not_signed_in',
      'reason', 'masuk ke akun dulu ya');
  end if;

  if nullif(btrim(coalesce(p_nama,'')),'') is null
     and nullif(btrim(coalesce(p_kota,'')),'') is null
     and nullif(btrim(coalesce(p_provinsi,'')),'') is null
     and nullif(btrim(coalesce(p_alamat_detail,'')),'') is null
     and nullif(btrim(coalesce(p_kecamatan,'')),'') is null
     and nullif(btrim(coalesce(p_desa,'')),'') is null then
    return jsonb_build_object('ok', false, 'code', 'nothing_to_update',
      'reason', 'tidak ada perubahan yang dikirim');
  end if;

  -- validasi panjang
  if p_nama   is not null and length(p_nama) > 60  then
    return jsonb_build_object('ok', false, 'code', 'invalid_nama', 'reason', 'nama maksimal 60 karakter');
  end if;
  if p_kota   is not null and length(p_kota) > 60  then return jsonb_build_object('ok', false, 'code', 'invalid_kota', 'reason', 'kota maksimal 60 karakter'); end if;
  if p_provinsi is not null and length(p_provinsi) > 60 then return jsonb_build_object('ok', false, 'code', 'invalid_provinsi', 'reason', 'provinsi maksimal 60 karakter'); end if;
  if p_alamat_detail is not null and length(p_alamat_detail) > 200 then return jsonb_build_object('ok', false, 'code', 'invalid_alamat', 'reason', 'alamat maksimal 200 karakter'); end if;
  if p_kecamatan is not null and length(p_kecamatan) > 60 then return jsonb_build_object('ok', false, 'code', 'invalid_kecamatan', 'reason', 'kecamatan maksimal 60 karakter'); end if;
  if p_desa is not null and length(p_desa) > 60 then return jsonb_build_object('ok', false, 'code', 'invalid_desa', 'reason', 'desa maksimal 60 karakter'); end if;

  -- nama → global_identities.display_name + referral_partners.nama
  if p_nama is not null then
    update public.global_identities set display_name = p_nama, updated_at = now() where id = v_gid;
    update public.referral_partners set nama = p_nama, updated_at = now() where global_identity_id = v_gid;
  end if;

  -- wilayah provinsi/kabkota → referral_partners + clients
  update public.referral_partners
     set kota      = coalesce(nullif(btrim(coalesce(p_kota,'')),''), kota),
         provinsi  = coalesce(nullif(btrim(coalesce(p_provinsi,'')),''), provinsi),
         updated_at = now()
   where global_identity_id = v_gid;

  -- clients (registri app klien / repo control): wilayah + alamat detail
  update public.clients
     set nama_pemilik = coalesce(nullif(btrim(coalesce(p_nama,'')),''), nama_pemilik),
         kabkota      = coalesce(nullif(btrim(coalesce(p_kota,'')),''), kabkota),
         provinsi     = coalesce(nullif(btrim(coalesce(p_provinsi,'')),''), provinsi),
         alamat_detail= coalesce(nullif(btrim(coalesce(p_alamat_detail,'')),''), alamat_detail),
         kecamatan    = coalesce(nullif(btrim(coalesce(p_kecamatan,'')),''), kecamatan),
         desa         = coalesce(nullif(btrim(coalesce(p_desa,'')),''), desa),
         updated_at   = now()
   where global_identity_id = v_gid;

  select count(*) into v_clients
    from public.clients where global_identity_id = v_gid;

  return jsonb_build_object('ok', true,
    'nama', p_nama, 'kota', p_kota, 'provinsi', p_provinsi,
    'alamat_detail', p_alamat_detail, 'kecamatan', p_kecamatan, 'desa', p_desa,
    'clients_updated', v_clients);
end;
$$;

revoke all on function public.account_update_profile(text,text,text,text,text,text) from public, anon;
grant execute on function public.account_update_profile(text,text,text,text,text,text) to authenticated;

comment on function public.account_update_profile(text,text,text,text,text,text) is
  'Edit identitas akun: nama + wilayah + alamat detail. Sinkron ke referral_partners + clients. Parsial & opsional.';
