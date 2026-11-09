-- STAGE 6 REVIEW-ONLY PROPOSAL — Kaki5 private Storage policy
-- DO NOT RUN against production or an unapproved Supabase project.
-- Verify bucket/schema names, clients ownership columns, and auth role first.
-- This file is a policy contract and requires staging smoke-test evidence.

-- Required bucket state (must be private):
--   storage.buckets.id IN ('bukti', 'backups')
--   storage.buckets.public = false
-- No public/anon read policy is permitted for either bucket.

-- Expected ownership predicate for authenticated sessions:
--   EXISTS (
--     SELECT 1 FROM public.clients c
--     WHERE c.unit_id = (storage.objects.name split_part '/')[1]
--       AND c.user_id = auth.uid()
--   )
-- The exact SQL syntax and available columns MUST be checked in staging first.

-- Policy contract (apply only after schema review):
--   bukti/backups SELECT: authenticated owner prefix only
--   bukti/backups INSERT: authenticated owner prefix only
--   bukti/backups UPDATE: authenticated owner prefix only
--   bukti/backups DELETE: authenticated owner prefix only
--   anon: deny all operations
--   service_role: admin/proxy signed URL path; do not expose service_role to browser

-- Required path contracts:
--   bukti  = <unit_id>/<timestamp>-<random>.jpg
--   backups = <unit_id>/<opaque-backup-name>
-- Every operation must reject cross-unit prefixes, '..', '\\', absolute URLs,
-- and unit IDs not owned by auth.uid().

-- Required staging evidence before production:
--   SELECT id, public FROM storage.buckets WHERE id IN ('bukti','backups');
--   SELECT policyname, schemaname, tablename, roles, cmd
--     FROM pg_policies WHERE schemaname='storage' AND tablename='objects';
--   Authenticated owner A: own list/read/insert/update/delete = allowed.
--   Authenticated owner A: unit B list/read/insert/update/delete = denied.
--   Anonymous: all list/read/insert/update/delete = denied.
--   Admin proxy: signed URL expires at configured short lifetime.
--   Record object IDs and cleanup results; empty-table checks are insufficient.
