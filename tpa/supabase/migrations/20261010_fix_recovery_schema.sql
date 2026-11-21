-- Fix Identity Recovery Schema Mismatch
-- Drop dan recreate tables dengan schema yang benar

-- ============================================================================
-- 1. DROP EXISTING TABLES (jika ada)
-- ============================================================================

DROP TABLE IF EXISTS identity_otp_attempts CASCADE;
DROP TABLE IF EXISTS identity_security_events CASCADE;
DROP TABLE IF EXISTS identity_recovery_challenges CASCADE;

-- ============================================================================
-- 2. RECREATE TABLES DENGAN SCHEMA YANG BENAR
-- ============================================================================

-- Identity Recovery Challenges (request → approve → complete)
CREATE TABLE IF NOT EXISTS identity_recovery_challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  identity_id UUID NOT NULL,
  phone_e164 TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'completed', 'expired')),
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  approved_at TIMESTAMPTZ,
  approved_by_user_id UUID,
  completed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '10 minutes'),
  otp_attempts INT DEFAULT 0,
  max_otp_attempts INT DEFAULT 3,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Security Events Audit Log (immutable audit trail)
CREATE TABLE IF NOT EXISTS identity_security_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  identity_id UUID,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'login_attempt',
    'login_success',
    'login_failed',
    'recovery_requested',
    'recovery_approved',
    'recovery_rejected',
    'recovery_completed',
    'session_created',
    'session_revoked',
    'credential_updated',
    'otp_verified',
    'otp_failed'
  )),
  success BOOLEAN NOT NULL DEFAULT true,
  ip_address INET,
  user_agent TEXT,
  phone_e164 TEXT,
  challenge_id UUID,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- OTP Attempts Tracking (rate limiting)
CREATE TABLE IF NOT EXISTS identity_otp_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id UUID NOT NULL REFERENCES identity_recovery_challenges(id) ON DELETE CASCADE,
  attempt_number INT NOT NULL,
  success BOOLEAN NOT NULL DEFAULT false,
  ip_address INET,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- 3. CREATE INDEXES
-- ============================================================================

CREATE INDEX idx_identity_recovery_challenges_identity_id 
  ON identity_recovery_challenges(identity_id);
CREATE INDEX idx_identity_recovery_challenges_phone_e164 
  ON identity_recovery_challenges(phone_e164);
CREATE INDEX idx_identity_recovery_challenges_status 
  ON identity_recovery_challenges(status);
CREATE INDEX idx_identity_recovery_challenges_expires_at 
  ON identity_recovery_challenges(expires_at);

CREATE INDEX idx_identity_security_events_identity_id 
  ON identity_security_events(identity_id);
CREATE INDEX idx_identity_security_events_event_type 
  ON identity_security_events(event_type);
CREATE INDEX idx_identity_security_events_created_at 
  ON identity_security_events(created_at);

CREATE INDEX idx_identity_otp_attempts_challenge_id 
  ON identity_otp_attempts(challenge_id);
CREATE INDEX idx_identity_otp_attempts_created_at 
  ON identity_otp_attempts(created_at);

-- ============================================================================
-- 4. ENABLE RLS
-- ============================================================================

ALTER TABLE identity_recovery_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE identity_security_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE identity_otp_attempts ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 5. CREATE RLS POLICIES
-- ============================================================================

-- identity_recovery_challenges: Public can create requests, authenticated can read own
CREATE POLICY "anyone_can_request_recovery" 
  ON identity_recovery_challenges FOR INSERT 
  WITH CHECK (true);

CREATE POLICY "user_can_view_own_challenges" 
  ON identity_recovery_challenges FOR SELECT 
  USING (
    -- Users can see their own challenges
    identity_id = auth.uid()
    -- Admin users can see all (via app_role)
    OR auth.jwt() ->> 'app_role' = 'admin'
  );

CREATE POLICY "admin_can_approve_recovery" 
  ON identity_recovery_challenges FOR UPDATE 
  USING (auth.jwt() ->> 'app_role' = 'admin')
  WITH CHECK (auth.jwt() ->> 'app_role' = 'admin');

-- identity_security_events: Immutable audit log
CREATE POLICY "system_can_insert_events" 
  ON identity_security_events FOR INSERT 
  WITH CHECK (auth.jwt() ->> 'app_role' IN ('admin', 'system'));

CREATE POLICY "admin_can_view_events" 
  ON identity_security_events FOR SELECT 
  USING (auth.jwt() ->> 'app_role' = 'admin');

-- identity_otp_attempts: Rate limiting tracking
CREATE POLICY "system_can_track_otp" 
  ON identity_otp_attempts FOR INSERT 
  WITH CHECK (auth.jwt() ->> 'app_role' IN ('admin', 'system'));

-- ============================================================================
-- 6. GRANT PERMISSIONS
-- ============================================================================

GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT, INSERT ON identity_recovery_challenges TO anon, authenticated;
GRANT SELECT ON identity_security_events TO authenticated;
GRANT SELECT, INSERT ON identity_otp_attempts TO authenticated;
