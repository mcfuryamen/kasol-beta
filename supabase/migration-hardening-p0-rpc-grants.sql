-- =============================================================================
-- HARDENING P0 — Cabut EXECUTE anon/authenticated pada RPC mati & berbahaya
-- =============================================================================
-- Konteks (audit koneksi data 4 app kasol, 2026-11-20):
--
--   A. partner_register(...) — SECURITY DEFINER, masih terbuka untuk `anon`.
--      Siapa pun yang memegang anon key publik (ada di source app) bisa
--      POST /rest/v1/rpc/partner_register dan langsung:
--        - membuat baris referral_partners berstatus AKTIF (auto-approve),
--        - membuat referral_wallets + license_codes,
--        - menerima `portal_token` MENTAH yang berlaku 365 hari.
--      Terbukti live: request anon → HTTP 200.
--      UI-nya sudah dihapus dari app mitra (mitra/src/lib/api.ts) sejak
--      2026-11-04; registrasi mitra sekarang 100% lewat /akun (sesi akun).
--
--   B. Jalur PORTAL TOKEN mitra — partner_session / partner_my_balance /
--      partner_referrals / partner_payouts / partner_my_apps /
--      partner_create_activation_code. Semuanya menerima token mentah sebagai
--      parameter dan membuka data mitra. Sudah tidak dipakai UI (portal.astro +
--      FormDaftar.astro dihapus). Penggantinya jalur sesi akun:
--      account_my_referrals / account_my_payouts / hub_my_licenses.
--
--   C. masjid_publish / masjid_draft versi TOKEN (p_slug, p_token, p_data) —
--      backward-compat admin masjid v1.3.x. Admin v1.4.0+ memakai
--      masjid_publish_by_account / masjid_draft_by_account (sesi JWT + cek role
--      owner), jadi jalur token ini tidak lagi dipanggil kode mana pun.
--      Sifatnya "tulis tanpa login asal token benar" → permukaan serang yang
--      tidak perlu dipertahankan.
--
-- TIDAK disentuh (sengaja, terverifikasi masih dipakai / by design):
--   - partner_claim_referral  → dipakai mitra/src/pages/r.astro (anon, publik).
--   - partner_approve, partner_issue_token, referral_resolve_pending
--       → dipakai Control lewat proxy service_role (bukan anon).
--   - partner_claim_referral / app_feature_gate / hub_redeem_activation_code
--       → memang publik by design.
--
-- Aman karena: tidak ada satu pun caller di repo untuk fungsi yang dicabut
-- (diverifikasi dengan pencarian menyeluruh), dan fungsi TIDAK dihapus —
-- hanya hak aksesnya dicabut, sehingga pemanggilan dari service_role tetap
-- bekerja dan tidak ada error "function does not exist".
-- =============================================================================

-- A. Pendaftaran mitra mandiri (auto-approve + token portal mentah)
revoke all on function public.partner_register(text, text, text, text, text, text, text)
  from public, anon, authenticated;

-- B. Jalur portal token mitra (mati, digantikan jalur sesi akun)
revoke all on function public.partner_session(text)                   from public, anon, authenticated;
revoke all on function public.partner_my_balance(text)                from public, anon, authenticated;
revoke all on function public.partner_referrals(text)                 from public, anon, authenticated;
revoke all on function public.partner_payouts(text)                   from public, anon, authenticated;
revoke all on function public.partner_my_apps(text)                   from public, anon, authenticated;
revoke all on function public.partner_create_activation_code(text, uuid)
  from public, anon, authenticated;

-- C. Jalur publikasi/draft website masjid versi token (legacy v1.3.x)
revoke all on function public.masjid_publish(text, text, jsonb)       from public, anon, authenticated;
revoke all on function public.masjid_draft(text, text, jsonb)         from public, anon, authenticated;

-- Pastikan tetap bisa dipanggil server (service_role) — untuk jalur admin
-- internal / pemulihan manual.
grant execute on function public.partner_session(text)                to service_role;
grant execute on function public.partner_my_balance(text)             to service_role;
grant execute on function public.partner_referrals(text)              to service_role;
grant execute on function public.partner_payouts(text)                to service_role;
grant execute on function public.partner_my_apps(text)                to service_role;
grant execute on function public.partner_create_activation_code(text, uuid) to service_role;
grant execute on function public.masjid_publish(text, text, jsonb)    to service_role;
grant execute on function public.masjid_draft(text, text, jsonb)      to service_role;

-- Catatan: partner_register tetap bisa dipanggil `service_role` (grant lamanya
-- tidak dicabut) — itu jalur server-only, aman. Yang ditutup adalah jalur
-- publik (anon/authenticated). Pembuatan mitra resmi sekarang = sesi akun
-- (account_become_partner) atau persetujuan manual di Control (partner_approve).

-- Verifikasi inline: kalau masih ada yang true, transaksi ini akan gagal.
do $$
declare
  v_bad text;
begin
  select string_agg(x.proname || '(' || pg_get_function_identity_arguments(x.oid) || ')', ', ')
    into v_bad
    from pg_proc x
    join pg_namespace n on n.oid = x.pronamespace
   where n.nspname = 'public'
     and x.proname in ('partner_register','partner_session','partner_my_balance',
                       'partner_referrals','partner_payouts','partner_my_apps',
                       'partner_create_activation_code','masjid_publish','masjid_draft')
     and (has_function_privilege('anon', x.oid, 'EXECUTE')
       or has_function_privilege('authenticated', x.oid, 'EXECUTE'));

  if v_bad is not null then
    raise exception 'HARDENING GAGAL — masih bisa dipanggil anon/authenticated: %', v_bad;
  end if;
end $$;
