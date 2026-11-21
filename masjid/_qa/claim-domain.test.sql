-- ============================================================
-- QA AUDIT: klaim/verifikasi/resolve domain (masjid_website_domains)
-- RILIS: hardening F1 (denylist domain platform), F2 (guard domain
-- aktif + RPC re-klaim), F3 (grant EXECUTE anon dicabut).
--
-- SEMUA di dalam satu transaksi dan di-ROLLBACK di akhir →
-- tidak ada artefak di produksi.
-- ============================================================
begin;
create temp table qa_res(tag text, res jsonb) on commit drop;

-- fixture: identity untuk dua gid uji (FK app_memberships → global_identities)
insert into public.global_identities (id, phone_e164, display_name, status, created_at, updated_at)
values ('11111111-1111-1111-1111-111111111111', '+6281111111111', 'QA Other', 'active', now(), now()),
       ('22222222-2222-2222-2222-222222222222', '+6282222222222', 'QA Kasir', 'active', now(), now());

-- fixture: site milik gid lain (creator = owner via fallback di masjid_site_role)
insert into public.masjid_sites (outlet_ref, slug, nama, global_identity_id, status)
values ('qa-outlet-lain-0001', 'qa-situs-lain', 'QA Lain', '11111111-1111-1111-1111-111111111111', 'active');

-- fixture: membership kasir (non-owner) pada outlet amin
insert into public.app_memberships (global_identity_id, app_key, role, outlet_ref, status)
values ('22222222-2222-2222-2222-222222222222', 'masjid', 'kasir', '5baba936-56c6-4f0f-bde1-f2a1cba9e595', 'active');

-- ============================================================
-- BAGIAN 1 — Skenario dasar (regresi)
-- ============================================================

-- S1: tanpa login (tanpa claims) → harus not_signed_in
insert into qa_res select 'S1_claim_tanpa_login', public.masjid_claim_domain('qa-audit-satu.example.com', null);

-- S2: sebagai amin (owner) klaim domain valid + normalisasi huruf besar
select set_config('request.jwt.claims', '{"sub":"05d7b964-e2c7-4748-bfa8-ac5f78351239","role":"authenticated","app_metadata":{"gid":"05d7b964-e2c7-4748-bfa8-ac5f78351239"}}', true);
insert into qa_res select 'S2_claim_valid_owner', public.masjid_claim_domain('QA-Audit-Satu.Example.COM', null);

-- S3: klaim ulang domain yang sama → ok, token harus terotasi
insert into qa_res select 'S3_claim_ulang', public.masjid_claim_domain('qa-audit-satu.example.com', null);
insert into qa_res select 'S3b_token_berbeda', to_jsonb((select a.res->>'verification_token' <> b.res->>'verification_token' as token_berbeda from qa_res a, qa_res b where a.tag='S2_claim_valid_owner' and b.tag='S3_claim_ulang'));

-- S4: input tidak valid / normalisasi protocol+port+path
insert into qa_res select 'S4a_invalid_spasi', public.masjid_claim_domain('bukan domain!!', null);
insert into qa_res select 'S4b_tanpa_titik', public.masjid_claim_domain('localhost', null);
insert into qa_res select 'S4c_normalisasi', public.masjid_claim_domain('https://QA-Port.Example.COM:8443/path/x', null);

-- S6: gid lain klaim domain milik amin → harus domain_taken
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated","app_metadata":{"gid":"11111111-1111-1111-1111-111111111111"}}', true);
insert into qa_res select 'S6_domain_taken', public.masjid_claim_domain('qa-audit-satu.example.com', null);

-- S7: amin klaim dengan p_site_id milik gid lain → harus forbidden
select set_config('request.jwt.claims', '{"sub":"05d7b964-e2c7-4748-bfa8-ac5f78351239","role":"authenticated","app_metadata":{"gid":"05d7b964-e2c7-4748-bfa8-ac5f78351239"}}', true);
insert into qa_res select 'S7_site_milik_lain', public.masjid_claim_domain('qa-baru-lain.example.com', (select id from public.masjid_sites where slug='qa-situs-lain'));

-- S8: kasir (membership non-owner) klaim → harus forbidden dengan role
select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated","app_metadata":{"gid":"22222222-2222-2222-2222-222222222222"}}', true);
insert into qa_res select 'S8_kasir_forbidden', public.masjid_claim_domain('qa-mgr.example.com', null);

-- S9: verify dengan token salah → invalid_token
select set_config('request.jwt.claims', '{"sub":"05d7b964-e2c7-4748-bfa8-ac5f78351239","role":"authenticated","app_metadata":{"gid":"05d7b964-e2c7-4748-bfa8-ac5f78351239"}}', true);
insert into qa_res select 'S9_verify_token_salah', public.masjid_verify_domain('qa-audit-satu.example.com', 'token-salah');

-- S10: owner LAIN dengan token BENAR (TXT DNS itu publik) → tetap forbidden, status tidak berubah
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated","app_metadata":{"gid":"11111111-1111-1111-1111-111111111111"}}', true);
insert into qa_res select 'S10_verify_token_benar_bukan_owner', public.masjid_verify_domain('qa-audit-satu.example.com', (select verification_token from public.masjid_website_domains where domain='qa-audit-satu.example.com'));
insert into qa_res select 'S10b_status_masih', to_jsonb((select status from public.masjid_website_domains where domain='qa-audit-satu.example.com'));

-- S11: verify benar sebagai owner → active
select set_config('request.jwt.claims', '{"sub":"05d7b964-e2c7-4748-bfa8-ac5f78351239","role":"authenticated","app_metadata":{"gid":"05d7b964-e2c7-4748-bfa8-ac5f78351239"}}', true);
insert into qa_res select 'S11_verify_ok', public.masjid_verify_domain('qa-audit-satu.example.com', (select verification_token from public.masjid_website_domains where domain='qa-audit-satu.example.com'));

-- S12: resolve sebagai anon (claims kosong) — active → ok; pending → not_found; tidak ada → not_found
select set_config('request.jwt.claims', '{}', true);
insert into qa_res select 'S12_resolve_active', public.masjid_resolve_domain('qa-audit-satu.example.com');
insert into qa_res select 'S12b_resolve_pending', public.masjid_resolve_domain('qa-port.example.com');
insert into qa_res select 'S12c_resolve_tidak_ada', public.masjid_resolve_domain('tidak-ada.example.com');

-- S12d: domain produksi yang sah (tes.masjidgumiring.my.id) tetap resolve → guard tidak memotong domain biasa
insert into qa_res select 'S12d_resolve_domain_produksi', public.masjid_resolve_domain('tes.masjidgumiring.my.id');

-- ============================================================
-- BAGIAN 2 — F1: denylist domain platform
-- ============================================================

-- F1a: host platform beta kita → DITOLAK (sebelumnya berhasil → shadowing)
select set_config('request.jwt.claims', '{"sub":"05d7b964-e2c7-4748-bfa8-ac5f78351239","role":"authenticated","app_metadata":{"gid":"05d7b964-e2c7-4748-bfa8-ac5f78351239"}}', true);
insert into qa_res select 'F1a_claim_host_platform', public.masjid_claim_domain('web-masjid-beta.vercel.app', null);

-- F1b: host admin platform → DITOLAK
insert into qa_res select 'F1b_claim_host_admin', public.masjid_claim_domain('adm-masjid-beta.vercel.app', null);

-- F1c: suffix *.vercel.app sembarang → DITOLAK
insert into qa_res select 'F1c_claim_suffix_vercel_app', public.masjid_claim_domain('namun-robah.vercel.app', null);

-- F1d: root vercel.app → DITOLAK
insert into qa_res select 'F1d_claim_root_vercel_app', public.masjid_claim_domain('vercel.app', null);

-- F1e: suffix *.vercel-dns.com → DITOLAK
insert into qa_res select 'F1e_claim_suffix_vercel_dns', public.masjid_claim_domain('namun-robah.vercel-dns.com', null);

-- F1f: uppercase + protokol tetap kena denylist
insert into qa_res select 'F1f_claim_uppercase_host_platform', public.masjid_claim_domain('https://WEB-MASJID-BETA.VERCEL.APP/path', null);

-- F1g: helper penentu reserved
insert into qa_res select 'F1g_helper_platform', to_jsonb(public.masjid_domain_is_reserved('web-masjid-beta.vercel.app'));
insert into qa_res select 'F1h_helper_domain_biasa', to_jsonb(public.masjid_domain_is_reserved('masjid-contoh.my.id'));

-- F1i: tabel reserved punya seed host platform kita
insert into qa_res select 'F1i_seed_reserved', to_jsonb((select array_agg(domain order by domain) from public.masjid_reserved_domains));

-- F1j: insert langsung ke tabel domain (bypass RPC) dengan host terlarang → HARUS DITOLAK CHECK constraint
do $$
declare
  v_err text;
begin
  begin
    insert into public.masjid_website_domains (domain, site_id, status, verification_token)
    values ('bypass.vercel.app',
            (select id from public.masjid_sites where slug = 'qa-situs-lain'),
            'pending', 'tok-bypass');
    v_err := 'INSERT_BERHASIL_TIDAK_ADA_CHECK';
  exception when others then
    v_err := 'DITOLAK: ' || sqlerrm;
  end;
  insert into qa_res select 'F1j_insert_bypass_ditolak', to_jsonb(v_err);
end $$;

-- F1k: jalur denylist berbasis TABEL (host non-vercel) → claim & resolve ditolak
insert into public.masjid_reserved_domains (domain, note)
values ('shadow.test.internal', 'QA fixture: host forbidden berbasis tabel')
on conflict (domain) do update set note = excluded.note;

insert into qa_res select 'F1k_claim_host_terlarang_tabel', public.masjid_claim_domain('shadow.test.internal', null);

-- baris domain untuk host terlarang TETAP DIBUAT (melalui jalur non-RPC)
-- → resolve harus tetap not_found ⇒ shadowing mustahil walau baris ada
insert into public.masjid_website_domains (domain, site_id, status, verification_token)
values ('shadow.test.internal',
        (select id from public.masjid_sites where slug = 'qa-situs-lain'),
        'active', 'tok-shadow');

select set_config('request.jwt.claims', '{}', true);
insert into qa_res select 'F1l_resolve_host_terlarang_tabel', public.masjid_resolve_domain('shadow.test.internal');

-- F1m: verify untuk host terlarang → DITOLAK
select set_config('request.jwt.claims', '{"sub":"05d7b964-e2c7-4748-bfa8-ac5f78351239","role":"authenticated","app_metadata":{"gid":"05d7b964-e2c7-4748-bfa8-ac5f78351239"}}', true);
insert into qa_res select 'F1m_verify_host_platform', public.masjid_verify_domain('web-masjid-beta.vercel.app', 'token-apapun');
insert into qa_res select 'F1n_resolve_host_platform', public.masjid_resolve_domain('web-masjid-beta.vercel.app');

-- ============================================================
-- BAGIAN 3 — F2: klaim ulang domain yang sudah active
-- ============================================================

-- F2a: klaim ulang domain AKTIF → DITOLAK (tidak menurunkan status diam-diam)
insert into qa_res select 'F2a_claim_domain_aktif', public.masjid_claim_domain('qa-audit-satu.example.com', null);

-- F2b: status TETAP active (tidak ada rotasi token)
insert into qa_res select 'F2b_status_masih_active', to_jsonb((select status from public.masjid_website_domains where domain='qa-audit-satu.example.com'));

-- F2c: website MASIH hidup (resolve ok) karena tidak ada penurunan status
select set_config('request.jwt.claims', '{}', true);
insert into qa_res select 'F2c_resolve_masih_aktif', public.masjid_resolve_domain('qa-audit-satu.example.com');

-- F2d: token tidak berubah (claim yang ditolak tidak boleh menyentuh data)
insert into qa_res select 'F2d_token_tidak_berubah', to_jsonb((select verification_token from public.masjid_website_domains where domain='qa-audit-satu.example.com') = (select res->>'verification_token' from qa_res where tag='S3_claim_ulang'));

-- F2e: re-klaim eksplisit oleh owner → OK, status turun ke pending + token baru
select set_config('request.jwt.claims', '{"sub":"05d7b964-e2c7-4748-bfa8-ac5f78351239","role":"authenticated","app_metadata":{"gid":"05d7b964-e2c7-4748-bfa8-ac5f78351239"}}', true);
insert into qa_res select 'F2e_reclaim_oleh_owner', public.masjid_reclaim_domain('qa-audit-satu.example.com');
insert into qa_res select 'F2f_status_setelah_reclaim', to_jsonb((select status from public.masjid_website_domains where domain='qa-audit-satu.example.com'));

-- F2g: website mati sampai verifikasi ulang (memang disengaja, setelah konfirmasi owner)
select set_config('request.jwt.claims', '{}', true);
insert into qa_res select 'F2g_resolve_setelah_reclaim', public.masjid_resolve_domain('qa-audit-satu.example.com');

-- F2h: token lama tidak berlaku lagi
select set_config('request.jwt.claims', '{"sub":"05d7b964-e2c7-4748-bfa8-ac5f78351239","role":"authenticated","app_metadata":{"gid":"05d7b964-e2c7-4748-bfa8-ac5f78351239"}}', true);
insert into qa_res select 'F2h_verify_token_lama', public.masjid_verify_domain('qa-audit-satu.example.com', (select res->>'verification_token' from qa_res where tag='S3_claim_ulang'));

-- F2i: verifikasi ulang dengan token baru → active lagi
insert into qa_res select 'F2i_verify_token_baru', public.masjid_verify_domain('qa-audit-satu.example.com', (select verification_token from public.masjid_website_domains where domain='qa-audit-satu.example.com'));

-- F2j: re-klaim oleh NON-owner → forbidden
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated","app_metadata":{"gid":"11111111-1111-1111-1111-111111111111"}}', true);
insert into qa_res select 'F2j_reclaim_bukan_owner', public.masjid_reclaim_domain('qa-audit-satu.example.com');

-- F2k: re-klaim domain yang tidak terdaftar → domain_not_found
insert into qa_res select 'F2k_reclaim_tidak_ada', public.masjid_reclaim_domain('tidak-ada.example.com');

-- F2l: re-klaim host terlarang → domain_reserved
insert into qa_res select 'F2l_reclaim_host_terlarang', public.masjid_reclaim_domain('web-masjid-beta.vercel.app');

-- F2m: re-klaim tanpa login → not_signed_in
select set_config('request.jwt.claims', '{}', true);
insert into qa_res select 'F2m_reclaim_tanpa_login', public.masjid_reclaim_domain('qa-audit-satu.example.com');

-- F2n: resolve setelah verifikasi ulang → website hidup lagi
insert into qa_res select 'F2n_resolve_setelah_verify_ulang', public.masjid_resolve_domain('qa-audit-satu.example.com');

-- ============================================================
-- BAGIAN 4 — F3: grant EXECUTE untuk role anon
-- ============================================================

-- F3a: matriks privilege seluruh fungsi masjid*
insert into qa_res
select 'F3a_priv_' || p.proname,
       jsonb_build_object(
         'anon',    has_function_privilege('anon', p.oid, 'EXECUTE'),
         'auth',    has_function_privilege('authenticated', p.oid, 'EXECUTE'),
         'service', has_function_privilege('service_role', p.oid, 'EXECUTE')
       )
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public'
   and p.proname like 'masjid%'
 order by p.proname;

-- F3b: fungsi BARU setelah default privileges dibetulkan → anon TIDAK boleh exec
create function public.qa_tmp_probe_fungsi_baru() returns int language sql as $$ select 1 $$;
insert into qa_res select 'F3b_fungsi_baru_default_anon',
  to_jsonb(has_function_privilege('anon', 'public.qa_tmp_probe_fungsi_baru()'::regprocedure, 'EXECUTE'));

-- F3g: default ACL global tanpa PUBLIC + entry per-schema public dihapus
insert into qa_res select 'F3g_default_acl_global',
  to_jsonb((select d.defaclacl::text from pg_default_acl d
             where d.defaclrole = 'postgres'::regrole and d.defaclnamespace = 0 and d.defaclobjtype = 'f'));

insert into qa_res select 'F3h_default_acl_per_schema_public',
  to_jsonb((select count(*)::int from pg_default_acl d
             where d.defaclrole = 'postgres'::regrole
               and d.defaclnamespace = 'public'::regnamespace and d.defaclobjtype = 'f'));

-- F3i: fungsi baru tetap bisa dipanggil role terautentikasi (tidak ikut tertutup)
insert into qa_res select 'F3i_fungsi_baru_auth_ok',
  to_jsonb(has_function_privilege('authenticated', 'public.qa_tmp_probe_fungsi_baru()'::regprocedure, 'EXECUTE'));

-- F3c: RLS tabel reserved aktif + tanpa policy
insert into qa_res select 'F3c_rls_reserved', to_jsonb((select relrowsecurity from pg_class where oid = 'public.masjid_reserved_domains'::regclass));
insert into qa_res select 'F3d_policy_reserved', to_jsonb((select count(*)::int from pg_policies where schemaname='public' and tablename='masjid_reserved_domains'));

-- F3e: fungsi sesi TIDAK boleh dipanggil anon (cek daftar)
insert into qa_res select 'F3e_anon_tidak_boleh_claim',
  to_jsonb(has_function_privilege('anon', 'public.masjid_claim_domain(text,uuid)'::regprocedure, 'EXECUTE') = false
    and has_function_privilege('anon', 'public.masjid_verify_domain(text,text)'::regprocedure, 'EXECUTE') = false
    and has_function_privilege('anon', 'public.masjid_reclaim_domain(text)'::regprocedure, 'EXECUTE') = false);
insert into qa_res select 'F3f_anon_tetap_boleh_resolve',
  to_jsonb(has_function_privilege('anon', 'public.masjid_resolve_domain(text)'::regprocedure, 'EXECUTE') = true);

select * from qa_res order by tag;
rollback;
