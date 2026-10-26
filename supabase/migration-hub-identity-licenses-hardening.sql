-- ============================================================================
-- KASOL — HUB: HARDENING GRANT (Bagian 2 dari migration-hub-identity-licenses)
-- ============================================================================
-- Tanggal : 2026-10-20
-- Target  : project hhywrvedlwljawgxzpkq (minimarket / identity-hub)
-- Relasi  : migration-hub-identity-licenses.sql (Phase 0, sudah di-apply)
--
-- TEMUAN AUDIT SETELAH PHASE 0:
--   1. Tabel baru (licenses, license_devices, global_identities,
--      app_memberships) DIBUAT oleh postgres → mewarisi default privileges
--      Supabase: grant FULL (insert/update/delete/truncate) untuk anon &
--      authenticated. RLS tetap menahan (tidak ada policy INSERT/UPDATE/
--      DELETE), tapi defense-in-depth mensyaratkan cabut hak tulis di level
--      tabel — pola yang sama dipakai hardening clients 2026-10-01.
--
--   2. CELAH NYATA: tabel global_identities mendapat policy
--      "global_identities own update" (id = current_global_identity_id()).
--      Policy itu=on-row, BUKAN per-kolom → user bisa mengubah kolom
--      APAPUN pada barisnya sendiri, termasuk:
--        • phone_e164    → ganti nomor ke milik orang lain (duplikasi/hijack)
--        • status        → self-promote 'pending' → 'active' tanpa verifikasi
--        • auth_user_id  → tautkan auth user lain
--      Perbaikan: REVOKE UPDATE level tabel dulu (pelajaran PG 2026-09-14:
--      REVOKE kolom = no-op selama grant tabel masih ada), lalu GRANT UPDATE
--      hanya untuk display_name. Ditambah trigger penjaga (belt & braces).
--
--   3. clients.global_identity_id: TIDAK termasuk daftar grant per-kolom
--      dari hardening 2026-10-01 (kolom itu belum ada waktu itu) → klien
--      tidak bisa menautkan/melepas tautan akunnya sendiri. Trigger
--      clients_guard_admin_columns (diperluas di Phase 0) jadi lapisan kedua.
--
-- Pola grant mengikuti docs/supabase-hardening-clients-2026-10-01.sql.
-- Dijalankan via Management API. IDEMPOTENT.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1) Cabut hak tulis di level TABEL untuk tabel lisensi & membership
-- ----------------------------------------------------------------------------
-- RLS tetap ada (defense lapis 1); ini defense lapis 2.
-- SELECT tetap ada untuk authenticated; anon tidak perlu akses ke data akun.
revoke insert, update, delete, truncate
  on public.licenses
  from anon, authenticated;

revoke insert, update, delete, truncate
  on public.license_devices
  from anon, authenticated;

revoke insert, update, delete, truncate
  on public.app_memberships
  from anon, authenticated;

-- anon tidak punya sesi akun (claim gid tidak pernah ada) → tidak perlu baca.
revoke select
  on public.global_identities, public.licenses,
     public.license_devices, public.app_memberships
  from anon;


-- ----------------------------------------------------------------------------
-- 2) global_identities — hak ubah HANYA display_name
-- ----------------------------------------------------------------------------
revoke insert, update, delete, truncate
  on public.global_identities
  from anon, authenticated;

grant update (display_name)
  on public.global_identities
  to authenticated;

-- app_memberships: user boleh MENYUSUN membership-nya sendiri? Tidak.
-- Undangan/penambahan staf harus lewat server (admin/owner) → server pakai
-- service_role, jadi revoke total untuk role klien di tabel ini.
revoke insert, update, delete
  on public.app_memberships
  from anon, authenticated;


-- ----------------------------------------------------------------------------
-- 3) Trigger penjaga global_identities (belt & braces)
-- ----------------------------------------------------------------------------
-- Kolom berikut HANYA boleh diubah server (service_role / postgres / RPC
-- DEFINER): phone_e164, status, phone_verified_at, auth_user_id, id.
create or replace function public.global_identities_guard_admin_columns()
returns trigger
language plpgsql
as $$
begin
  -- service/admin lolos: Control, edge function, SQL editor, RPC DEFINER
  if current_user in ('service_role', 'postgres', 'supabase_admin') then
    return new;
  end if;
  if new.id                is distinct from old.id
     or new.phone_e164    is distinct from old.phone_e164
     or new.status        is distinct from old.status
     or new.phone_verified_at is distinct from old.phone_verified_at
     or new.auth_user_id  is distinct from old.auth_user_id then
    raise exception 'global_identities: kolom ini hanya boleh diubah server (permintaan dari %)', current_user;
  end if;
  return new;
end;
$$;

drop trigger if exists global_identities_guard_admin_update on public.global_identities;
create trigger global_identities_guard_admin_update
  before update on public.global_identities
  for each row execute function public.global_identities_guard_admin_columns();


-- ----------------------------------------------------------------------------
-- 4) grants fungsi
-- ----------------------------------------------------------------------------
-- Fungsi baca untuk app klien tetap boleh; RPC tulis tetap server-only.
grant execute on function public.current_global_identity_id() to anon, authenticated;
grant execute on function public.current_app_key() to anon, authenticated;
grant execute on function public.hub_my_licenses() to authenticated, service_role;

revoke all on function public.license_activate_device(uuid, text, text, text, text) from public;
grant execute on function public.license_activate_device(uuid, text, text, text, text) to service_role;

revoke all on function public.license_claim_identity(uuid, text, jsonb) from public;
grant execute on function public.license_claim_identity(uuid, text, jsonb) to service_role;


-- ----------------------------------------------------------------------------
-- 5) VERIFIKASI (setelah apply)
-- ----------------------------------------------------------------------------
-- select has_column_privilege('authenticated','public.global_identities','phone_e164','UPDATE') as upd_phone;
--   → HARUS false
-- select has_column_privilege('authenticated','public.global_identities','display_name','UPDATE') as upd_name;
--   → HARUS true
-- select has_table_privilege('authenticated','public.licenses','UPDATE') as lic_upd;
--   → HARUS false
-- select has_column_privilege('anon','public.clients','global_identity_id','UPDATE') as client_gid;
--   → HARUS false
