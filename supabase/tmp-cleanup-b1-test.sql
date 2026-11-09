-- CLEANUP test fase B1 (jejak: AUDIT B1 TEST, WA 6281100000003,
-- voucher DSK-21B4A0, wallet MKS-68166A kembali 0/0).
begin;
delete from public.code_redemptions
  where referee_phone = '6281100000003' and referee_name = 'AUDIT B1 TEST';
delete from public.license_codes
  where code = 'DSK-21B4A0' and kind = 'voucher' and created_by = 'referral';
update public.referral_wallets
  set points_pending = 0, points_earned = 0, updated_at = now()
  where partner_id = '52cb8533-9f7c-479c-90a5-1aa5c383f8f6'
    and points_pending = 5 and points_earned = 5;
commit;
