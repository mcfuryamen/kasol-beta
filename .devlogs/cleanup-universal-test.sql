-- Cleanup data uji "kode universal" (26/10/2026) — scratch, bukan bagian repo.
-- Hanya menyentuh mitra uji (628990000001 / 628990000002).
-- Mitra demo MKS-8F2K (628800000000) TIDAK ikut tersentuh.
begin;

delete from public.code_redemptions
 where referee_phone in ('628990000001', '628990000002');

delete from public.payout_requests
 where partner_id in (
   select id from public.referral_partners
    where no_whatsapp in ('628990000001', '628990000002')
 );

delete from public.license_codes
 where owner_partner_id in (
   select id from public.referral_partners
    where no_whatsapp in ('628990000001', '628990000002')
 );

delete from public.referral_wallets
 where partner_id in (
   select id from public.referral_partners
    where no_whatsapp in ('628990000001', '628990000002')
 );

delete from public.referral_partners
 where no_whatsapp in ('628990000001', '628990000002');

commit;
