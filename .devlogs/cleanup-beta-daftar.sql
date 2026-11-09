-- Cleanup data uji "daftar via beta" (26/10/2026) — scratch, bukan bagian repo.
-- Hanya menyentuh mitra uji (628990000009). Mitra demo MKS-8F2K TIDAK tersentuh.
begin;

delete from public.code_redemptions
 where referee_phone = '628990000009';

delete from public.payout_requests
 where partner_id in (
   select id from public.referral_partners where no_whatsapp = '628990000009'
 );

delete from public.license_codes
 where owner_partner_id in (
   select id from public.referral_partners where no_whatsapp = '628990000009'
 );

delete from public.referral_wallets
 where partner_id in (
   select id from public.referral_partners where no_whatsapp = '628990000009'
 );

delete from public.referral_partners
 where no_whatsapp = '628990000009';

commit;
