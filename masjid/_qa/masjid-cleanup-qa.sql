-- Cleanup sisa QA adopsi HUB masjid (2026-11-14)
-- Sasaran: HANYA data uji. Tidak menyentuh data produksi masjid (slug 'masjid').

-- 1. Domain uji hasil klaim UI Domain
delete from public.masjid_website_domains
 where domain = 'qa-masjid-test.example.com';

-- 2. Membership / lisensi yatim milik identity QA (aman bila memang ada)
delete from public.app_memberships
 where global_identity_id in (
       select id from public.global_identities
        where phone_e164 = '628990010002'
          and status = 'pending');

delete from public.licenses
 where global_identity_id in (
       select id from public.global_identities
        where phone_e164 = '628990010002'
          and status = 'pending');

-- 3. Identity QA yatim (dibuat app_add_member, sudah tidak dipakai)
delete from public.global_identities
 where phone_e164 = '628990010002'
   and status = 'pending';
