-- ============================================================
-- Rollback CRM FASE 1 — hapus view crm_contacts
-- Repo: kasol | Project: hhywrvedlwljawgxzpkq | 2026-10-28
-- Membatalkan supabase/migration-crm-contacts-fase1.sql
-- Aman: view read-only, tidak ada tabel/RPC eksisting yang tersentuh.
-- ============================================================

revoke all on crm_contacts from public, anon, authenticated, service_role;
drop view if exists crm_contacts;
