-- Artifact-only recovery contract.
-- OTP/Twilio/WhatsApp are intentionally out of scope for this phase.
BEGIN;

ALTER TABLE public.identity_recovery_challenges
  ADD COLUMN IF NOT EXISTS approval_artifact_hash TEXT,
  ADD COLUMN IF NOT EXISTS approval_artifact_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS approval_artifact_used_at TIMESTAMPTZ;

ALTER TABLE public.identity_recovery_challenges
  DROP CONSTRAINT IF EXISTS identity_recovery_challenges_status_check;
ALTER TABLE public.identity_recovery_challenges
  ADD CONSTRAINT identity_recovery_challenges_status_check
  CHECK (status IN ('pending', 'approved', 'rejected', 'completed', 'expired'));

CREATE INDEX IF NOT EXISTS idx_recovery_approval_artifact_hash
  ON public.identity_recovery_challenges (approval_artifact_hash)
  WHERE approval_artifact_hash IS NOT NULL;

-- Recovery state transitions happen only through the authenticated Edge Functions.
DROP POLICY IF EXISTS "Admins can update recovery challenges" ON public.identity_recovery_challenges;
DROP POLICY IF EXISTS "Anyone can request recovery" ON public.identity_recovery_challenges;
DROP POLICY IF EXISTS "Authenticated users can request recovery" ON public.identity_recovery_challenges;
CREATE POLICY "Authenticated users can request recovery"
  ON public.identity_recovery_challenges FOR INSERT
  TO authenticated
  WITH CHECK (true);
CREATE POLICY "Recovery challenges are not browser mutable"
  ON public.identity_recovery_challenges FOR UPDATE
  TO authenticated
  USING (false)
  WITH CHECK (false);

-- Keep legacy SQL functions present for migration compatibility, but make the
-- browser unable to call their OTP/proof-based contracts.
DO $$
DECLARE
  fn RECORD;
BEGIN
  FOR fn IN
    SELECT p.oid::regprocedure AS signature
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN ('identity_approve_recovery', 'identity_complete_recovery')
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM anon, authenticated', fn.signature);
  END LOOP;
END $$;

COMMIT;
