-- Admin-approval-only recovery hardening.
-- No OTP/provider is enabled by this migration.
-- Keeps global_identity_id as the canonical recovery identity key.

BEGIN;

ALTER TABLE public.identity_recovery_challenges
  ADD COLUMN IF NOT EXISTS approval_artifact_hash TEXT,
  ADD COLUMN IF NOT EXISTS approval_artifact_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS approval_artifact_used_at TIMESTAMPTZ;

-- Older staging schema used identity_id. Preserve data while restoring the contract name.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'identity_recovery_challenges'
      AND column_name = 'global_identity_id'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'identity_recovery_challenges'
      AND column_name = 'identity_id'
  ) THEN
    ALTER TABLE public.identity_recovery_challenges ADD COLUMN global_identity_id UUID;
    UPDATE public.identity_recovery_challenges
      SET global_identity_id = identity_id
      WHERE global_identity_id IS NULL;
  END IF;
END $$;

ALTER TABLE public.identity_recovery_challenges
  DROP CONSTRAINT IF EXISTS identity_recovery_challenges_status_check;
ALTER TABLE public.identity_recovery_challenges
  ADD CONSTRAINT identity_recovery_challenges_status_check
  CHECK (status IN ('pending', 'approved', 'rejected', 'completed', 'expired'));

CREATE INDEX IF NOT EXISTS idx_recovery_approval_artifact_hash
  ON public.identity_recovery_challenges (approval_artifact_hash)
  WHERE approval_artifact_hash IS NOT NULL;

-- The browser must not be able to mutate approval artifacts or completion state.
DROP POLICY IF EXISTS "Anyone can request recovery" ON public.identity_recovery_challenges;
DROP POLICY IF EXISTS "Admins can update recovery challenges" ON public.identity_recovery_challenges;
CREATE POLICY "Authenticated users can request recovery"
  ON public.identity_recovery_challenges FOR INSERT
  TO authenticated
  WITH CHECK (true);
CREATE POLICY "Admins cannot mutate recovery challenges directly"
  ON public.identity_recovery_challenges FOR UPDATE
  TO authenticated
  USING (false)
  WITH CHECK (false);

-- The request RPC is finalized in the follow-up corrective migration after the
-- deployed staging column types are inspected. Keep this migration additive and
-- avoid referencing optional identity-hub tables here.

COMMIT;
