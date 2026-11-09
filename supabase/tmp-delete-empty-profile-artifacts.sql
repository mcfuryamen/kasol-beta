begin;

-- Delete only the seven audited automatic-profile artifacts.
-- Guard: abort unless all seven still match the audited empty/unconfirmed shape.
do $$
declare
  n integer;
begin
  select count(*) into n
  from public.clients c
  where c.id in (
    '35bb6556-696b-4b4e-ae7d-7eaa9a956cf1',
    'c5f8579b-7fd2-422d-b42e-ab2e6b414808',
    '20744e8a-2c52-4d0b-81f8-f47b37774b57',
    'b94fa555-89e3-4c7c-9fc4-74bb1abaea1a',
    '6b123c08-d87d-4c39-8d93-e589fa2870fe',
    'd9f726c2-03a4-4453-bbbe-fce44baa7f6c',
    'a47dfa50-e132-4990-9a7a-18d1929a87b7'
  )
  and (
    (c.app_type = 'rosok' and coalesce(nullif(btrim(c.nama_usaha), ''), '') = '')
    or (c.app_type = 'laundry' and btrim(coalesce(c.nama_usaha, '')) = 'Laundry Saya')
  )
  and coalesce(nullif(btrim(c.nama_pemilik), ''), '') = ''
  and coalesce(nullif(btrim(c.no_whatsapp), ''), '') = ''
  and coalesce(nullif(btrim(c.provinsi), ''), '') = ''
  and coalesce(nullif(btrim(c.kabkota), ''), '') = ''
  and coalesce(nullif(btrim(c.kecamatan), ''), '') = ''
  and coalesce(nullif(btrim(c.desa), ''), '') = ''
  and coalesce(nullif(btrim(c.alamat_detail), ''), '') = ''
  and coalesce(c.license_status, 'belum') = 'belum'
  and c.license_serial is null;

  if n <> 7 then
    raise exception 'Guard gagal: target profil/kelayakan berubah (%). Tidak ada penghapusan.', n;
  end if;

  -- Jangan pernah menghapus atau menyisakan riwayat perangkat/lisensi.
  if exists (
    select 1
    from public.clients c
    join public.licenses l on l.source_client_id = c.id
    where c.id in (
      '35bb6556-696b-4b4e-ae7d-7eaa9a956cf1', 'c5f8579b-7fd2-422d-b42e-ab2e6b414808',
      '20744e8a-2c52-4d0b-81f8-f47b37774b57', 'b94fa555-89e3-4c7c-9fc4-74bb1abaea1a',
      '6b123c08-d87d-4c39-8d93-e589fa2870fe', 'd9f726c2-03a4-4453-bbbe-fce44baa7f6c',
      'a47dfa50-e132-4990-9a7a-18d1929a87b7'
    )
  ) or exists (
    select 1
    from public.clients c
    join public.license_devices d on d.device_code = c.device_code
    where c.id in (
      '35bb6556-696b-4b4e-ae7d-7eaa9a956cf1', 'c5f8579b-7fd2-422d-b42e-ab2e6b414808',
      '20744e8a-2c52-4d0b-81f8-f47b37774b57', 'b94fa555-89e3-4c7c-9fc4-74bb1abaea1a',
      '6b123c08-d87d-4c39-8d93-e589fa2870fe', 'd9f726c2-03a4-4453-bbbe-fce44baa7f6c',
      'a47dfa50-e132-4990-9a7a-18d1929a87b7'
    )
  ) then
    raise exception 'Guard gagal: ditemukan riwayat license/device (termasuk revoked). Tidak ada penghapusan.';
  end if;
end $$;

-- Remove client rows first; dependent references are SET NULL/CASCADE as audited.
delete from public.clients
where id in (
  '35bb6556-696b-4b4e-ae7d-7eaa9a956cf1',
  'c5f8579b-7fd2-422d-b42e-ab2e6b414808',
  '20744e8a-2c52-4d0b-81f8-f47b37774b57',
  'b94fa555-89e3-4c7c-9fc4-74bb1abaea1a',
  '6b123c08-d87d-4c39-8d93-e589fa2870fe',
  'd9f726c2-03a4-4453-bbbe-fce44baa7f6c',
  'a47dfa50-e132-4990-9a7a-18d1929a87b7'
);

-- Remove only their anonymous identities when no remaining client/license references them.
delete from public.global_identities g
where g.id in (
  'unv-KSR00O15RD4', 'unv-KSR00E8M2QO', 'unv-KSR00I4OXSX',
  'unv-KSR01HUNPXQ', 'unv-KSR01NLDCWV', 'unv-KSR00OJK15J',
  'unv-KSL003XW9VL'
)
and not exists (select 1 from public.clients c where c.global_identity_id = g.id)
and not exists (select 1 from public.licenses l where l.global_identity_id = g.id)
and not exists (select 1 from public.license_devices d join public.licenses l on l.id = d.license_id where l.global_identity_id = g.id)
and not exists (select 1 from public.app_memberships m where m.global_identity_id = g.id)
and not exists (select 1 from public.profiles p where p.global_identity_id = g.id);

commit;
