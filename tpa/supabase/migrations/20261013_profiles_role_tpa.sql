-- 20261013_profiles_role_tpa.sql
-- profiles.role sebelumnya hanya menerima role domain kasir
-- (owner/manager/cashier/stock). Jalur login aktif TPA (Supabase Auth,
-- IDENTITY-CONTRACT.md 2026-10-12) memvalidasi session dengan pemetaan
-- profiles.role -> role TPA di db/init.js verifySession():
--   owner/manager/admin -> admin, stock/teacher/ustadz -> ustadz,
--   wali/guardian -> wali.
-- Tidak ada role kasir yang memetakan ke 'wali', sehingga akun wali TPA
-- tidak mungkin lolos verifySession. Tambahkan sinonim role TPA.
ALTER TABLE public.profiles DROP CONSTRAINT profiles_role_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check
  CHECK (role = ANY (ARRAY[
    'owner'::text, 'manager'::text, 'cashier'::text, 'stock'::text,
    'admin'::text, 'ustadz'::text, 'wali'::text
  ]));
