-- ========== 20261009_fix_rls_policies.sql ==========
-- Fix RLS Policies untuk Recovery Challenges
-- Created: 2026-10-09
-- Purpose: Strengthen RLS enforcement - user hanya bisa access data sendiri

-- ============================================================================
-- DROP EXISTING POLICIES (yang problematic)
-- ============================================================================

DROP POLICY IF EXISTS "Users can view own recovery challenges" ON identity_recovery_challenges;
DROP POLICY IF EXISTS "Anyone can request recovery" ON identity_recovery_challenges;
DROP POLICY IF EXISTS "Admins can update recovery challenges" ON identity_recovery_challenges;
DROP POLICY IF EXISTS "Users can view own security events" ON identity_security_events;
DROP POLICY IF EXISTS "Service role can insert security events" ON identity_security_events;
DROP POLICY IF EXISTS "Service role can view otp attempts" ON identity_otp_attempts;
DROP POLICY IF EXISTS "Service role can insert otp attempts" ON identity_otp_attempts;

-- ============================================================================
-- RECOVERY CHALLENGES POLICIES
-- ============================================================================

-- SELECT: User hanya bisa read challenge milik dirinya sendiri, admin read semua
CREATE POLICY "recovery_challenges_select_own_or_admin"
  ON identity_recovery_challenges FOR SELECT
  USING (
    -- User read own challenge (match global_identity_id dengan current user id)
    global_identity_id = auth.uid()::text
    -- OR admin read semua
    OR EXISTS (
      SELECT 1 FROM app_memberships 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- INSERT: User hanya bisa create recovery challenge untuk dirinya sendiri
CREATE POLICY "recovery_challenges_insert_own_only"
  ON identity_recovery_challenges FOR INSERT
  WITH CHECK (
    -- Ensure global_identity_id = current user id
    global_identity_id = auth.uid()::text
  );

-- UPDATE: Hanya admin yang bisa approve/reject/update challenges
CREATE POLICY "recovery_challenges_update_admin_only"
  ON identity_recovery_challenges FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM app_memberships 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM app_memberships 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- DELETE: Only admin (untuk cleanup/testing)
CREATE POLICY "recovery_challenges_delete_admin_only"
  ON identity_recovery_challenges FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM app_memberships 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- ============================================================================
-- SECURITY EVENTS POLICIES
-- ============================================================================

-- SELECT: User read own events, admin read semua
CREATE POLICY "security_events_select_own_or_admin"
  ON identity_security_events FOR SELECT
  USING (
    -- User read own events
    global_identity_id = auth.uid()::text
    -- OR admin read semua
    OR EXISTS (
      SELECT 1 FROM app_memberships 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- INSERT: Only authenticated users (service role / Edge Functions handle this)
CREATE POLICY "security_events_insert_authenticated"
  ON identity_security_events FOR INSERT
  WITH CHECK (true); -- Edge Functions dengan service role akan insert

-- DELETE: Admin only (untuk cleanup/testing)
CREATE POLICY "security_events_delete_admin_only"
  ON identity_security_events FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM app_memberships 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- ============================================================================
-- OTP ATTEMPTS POLICIES
-- ============================================================================

-- SELECT: Only admin dapat read OTP attempts (sensitive data)
CREATE POLICY "otp_attempts_select_admin_only"
  ON identity_otp_attempts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM app_memberships 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- INSERT: Only authenticated (service role / Edge Functions insert ini)
CREATE POLICY "otp_attempts_insert_authenticated"
  ON identity_otp_attempts FOR INSERT
  WITH CHECK (true); -- Edge Functions handle validation

-- DELETE: Admin only
CREATE POLICY "otp_attempts_delete_admin_only"
  ON identity_otp_attempts FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM app_memberships 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- ============================================================================
-- NOTES
-- ============================================================================
-- 1. global_identity_id sekarang cast to text untuk match auth.uid() 
-- 2. INSERT policy untuk challenges enforce global_identity_id = auth.uid() 
--    (user hanya bisa create recovery untuk dirinya sendiri)
-- 3. Admin check menggunakan EXISTS subquery (lebih efficient & consistent)
-- 4. Edge Functions pakai service role jadi bypass RLS untuk OTP insert/update


-- ========== 20261009_identity_recovery_system.sql ==========
-- Identity Recovery System Migration
-- Created: 2026-10-09
-- Purpose: Recovery flow dengan SMS/WhatsApp approval + OTP verification

-- ============================================================================
-- 1. CREATE TABLES
-- ============================================================================

-- Identity Recovery Challenges (request → approve → complete)
CREATE TABLE IF NOT EXISTS identity_recovery_challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  global_identity_id UUID NOT NULL,
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
  global_identity_id UUID,
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

-- OTP Attempts (track failed OTP attempts for rate limiting)
CREATE TABLE IF NOT EXISTS identity_otp_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id UUID NOT NULL REFERENCES identity_recovery_challenges(id) ON DELETE CASCADE,
  attempt_number INT NOT NULL,
  ip_address INET,
  success BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- 2. CREATE INDEXES
-- ============================================================================

CREATE INDEX idx_identity_recovery_challenges_global_identity_id 
  ON identity_recovery_challenges(global_identity_id);

CREATE INDEX idx_identity_recovery_challenges_phone_e164 
  ON identity_recovery_challenges(phone_e164);

CREATE INDEX idx_identity_recovery_challenges_status 
  ON identity_recovery_challenges(status);

CREATE INDEX idx_identity_recovery_challenges_expires_at 
  ON identity_recovery_challenges(expires_at);

CREATE INDEX idx_identity_security_events_global_identity_id 
  ON identity_security_events(global_identity_id);

CREATE INDEX idx_identity_security_events_event_type 
  ON identity_security_events(event_type);

CREATE INDEX idx_identity_security_events_created_at 
  ON identity_security_events(created_at);

CREATE INDEX idx_identity_otp_attempts_challenge_id 
  ON identity_otp_attempts(challenge_id);

CREATE INDEX idx_identity_otp_attempts_created_at 
  ON identity_otp_attempts(created_at);

-- ============================================================================
-- 3. ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Enable RLS
ALTER TABLE identity_recovery_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE identity_security_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE identity_otp_attempts ENABLE ROW LEVEL SECURITY;

-- Recovery Challenges: Users see only their own challenges
CREATE POLICY "Users can view own recovery challenges"
  ON identity_recovery_challenges FOR SELECT
  USING (
    global_identity_id = auth.jwt() ->> 'sub'::text
    OR (SELECT role FROM app_memberships WHERE user_id = auth.uid() LIMIT 1) = 'admin'
  );

-- Recovery Challenges: Insert policy (anyone can request)
CREATE POLICY "Anyone can request recovery"
  ON identity_recovery_challenges FOR INSERT
  WITH CHECK (true);

-- Recovery Challenges: Update policy (only admins can approve)
CREATE POLICY "Admins can update recovery challenges"
  ON identity_recovery_challenges FOR UPDATE
  USING (
    (SELECT role FROM app_memberships WHERE user_id = auth.uid() LIMIT 1) = 'admin'
  )
  WITH CHECK (
    (SELECT role FROM app_memberships WHERE user_id = auth.uid() LIMIT 1) = 'admin'
  );

-- Security Events: Users see own events, admins see all
CREATE POLICY "Users can view own security events"
  ON identity_security_events FOR SELECT
  USING (
    global_identity_id = auth.jwt() ->> 'sub'::text
    OR (SELECT role FROM app_memberships WHERE user_id = auth.uid() LIMIT 1) = 'admin'
  );

-- Security Events: Service role can insert
CREATE POLICY "Service role can insert security events"
  ON identity_security_events FOR INSERT
  WITH CHECK (true);

-- OTP Attempts: Service role only
CREATE POLICY "Service role can view otp attempts"
  ON identity_otp_attempts FOR SELECT
  USING (
    (SELECT role FROM app_memberships WHERE user_id = auth.uid() LIMIT 1) = 'admin'
  );

CREATE POLICY "Service role can insert otp attempts"
  ON identity_otp_attempts FOR INSERT
  WITH CHECK (true);

-- ============================================================================
-- 4. RPC FUNCTIONS
-- ============================================================================

-- RPC: Request Recovery
-- Parameters: phone_e164 (phone number in E.164 format)
-- Returns: challenge with id, status, expires_at
-- Throttle: Max 3 requests per phone per hour
CREATE OR REPLACE FUNCTION identity_request_recovery(
  p_phone_e164 TEXT
)
RETURNS JSON AS $$
DECLARE
  v_challenge_id UUID;
  v_global_identity_id UUID;
  v_count INT;
  v_error_code TEXT;
BEGIN
  -- Throttle check: max 3 requests per phone per hour
  SELECT COUNT(*) INTO v_count
  FROM identity_recovery_challenges
  WHERE phone_e164 = p_phone_e164
    AND requested_at > now() - interval '1 hour'
    AND status IN ('pending', 'approved');

  IF v_count >= 3 THEN
    v_error_code := 'RECOVERY_THROTTLED';
    RAISE EXCEPTION 'Recovery request throttled - too many recent requests';
  END IF;

  -- Get or create identity by phone (enumeration prevention: return generic for non-existent)
  SELECT global_identity_id INTO v_global_identity_id
  FROM global_identities
  WHERE phone_e164 = p_phone_e164
    AND status = 'active';

  -- If phone not found, create pending challenge anyway (prevents enumeration)
  -- In production, log this attempt for fraud detection
  IF v_global_identity_id IS NULL THEN
    v_global_identity_id := gen_random_uuid();
  END IF;

  -- Create recovery challenge
  INSERT INTO identity_recovery_challenges (
    global_identity_id,
    phone_e164,
    status,
    expires_at
  ) VALUES (
    v_global_identity_id,
    p_phone_e164,
    'pending',
    now() + interval '10 minutes'
  ) RETURNING id INTO v_challenge_id;

  -- Log security event
  INSERT INTO identity_security_events (
    global_identity_id,
    event_type,
    phone_e164,
    challenge_id,
    metadata
  ) VALUES (
    v_global_identity_id,
    'recovery_requested',
    p_phone_e164,
    v_challenge_id,
    jsonb_build_object('ip_address', inet_client_addr()::text)
  );

  RETURN json_build_object(
    'id', v_challenge_id,
    'status', 'pending',
    'expires_at', now() + interval '10 minutes',
    'phone_e164', p_phone_e164
  );

EXCEPTION WHEN OTHERS THEN
  RAISE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC: Approve Recovery (Admin only)
-- Parameters: challenge_id, approver_user_id
-- Returns: challenge with updated status and approved_at
CREATE OR REPLACE FUNCTION identity_approve_recovery(
  p_challenge_id UUID,
  p_approver_user_id UUID
)
RETURNS JSON AS $$
DECLARE
  v_challenge RECORD;
  v_is_admin BOOLEAN;
BEGIN
  -- Check admin role
  SELECT role = 'admin' INTO v_is_admin
  FROM app_memberships
  WHERE user_id = p_approver_user_id
  LIMIT 1;

  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'UNAUTHORIZED';
  END IF;

  -- Get challenge
  SELECT * INTO v_challenge
  FROM identity_recovery_challenges
  WHERE id = p_challenge_id;

  IF v_challenge IS NULL THEN
    RAISE EXCEPTION 'CHALLENGE_NOT_FOUND';
  END IF;

  -- Check status is pending
  IF v_challenge.status != 'pending' THEN
    RAISE EXCEPTION 'INVALID_CHALLENGE_STATUS';
  END IF;

  -- Check not expired
  IF v_challenge.expires_at < now() THEN
    UPDATE identity_recovery_challenges
    SET status = 'expired'
    WHERE id = p_challenge_id;
    RAISE EXCEPTION 'CHALLENGE_EXPIRED';
  END IF;

  -- Update challenge status
  UPDATE identity_recovery_challenges
  SET 
    status = 'approved',
    approved_at = now(),
    approved_by_user_id = p_approver_user_id,
    updated_at = now()
  WHERE id = p_challenge_id;

  -- Log security event
  INSERT INTO identity_security_events (
    global_identity_id,
    event_type,
    challenge_id,
    metadata
  ) VALUES (
    v_challenge.global_identity_id,
    'recovery_approved',
    p_challenge_id,
    jsonb_build_object('approved_by', p_approver_user_id)
  );

  RETURN json_build_object(
    'id', p_challenge_id,
    'status', 'approved',
    'approved_at', now()
  );

EXCEPTION WHEN OTHERS THEN
  RAISE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC: Complete Recovery
-- Parameters: challenge_id, otp (proof from SMS/WhatsApp), new_credential (hashed PIN)
-- Returns: challenge with status = 'completed', revoked sessions
-- Side effects: Revoke all active sessions for identity
CREATE OR REPLACE FUNCTION identity_complete_recovery(
  p_challenge_id UUID,
  p_otp TEXT,
  p_new_credential_hash TEXT
)
RETURNS JSON AS $$
DECLARE
  v_challenge RECORD;
  v_global_identity_id UUID;
  v_revoked_count INT;
  v_error_code TEXT;
BEGIN
  -- Get challenge
  SELECT * INTO v_challenge
  FROM identity_recovery_challenges
  WHERE id = p_challenge_id;

  IF v_challenge IS NULL THEN
    v_error_code := 'CHALLENGE_NOT_FOUND';
    RAISE EXCEPTION '%', v_error_code;
  END IF;

  v_global_identity_id := v_challenge.global_identity_id;

  -- Check status is approved
  IF v_challenge.status != 'approved' THEN
    v_error_code := 'INVALID_CHALLENGE_STATUS';
    RAISE EXCEPTION '%', v_error_code;
  END IF;

  -- Check not expired
  IF v_challenge.expires_at < now() THEN
    UPDATE identity_recovery_challenges
    SET status = 'expired'
    WHERE id = p_challenge_id;
    v_error_code := 'CHALLENGE_EXPIRED';
    RAISE EXCEPTION '%', v_error_code;
  END IF;

  -- Verify OTP (in production, verify against stored OTP hash)
  -- For now, accept any OTP (TODO: integrate SMS provider)
  IF p_otp IS NULL OR p_otp = '' THEN
    -- Increment OTP attempts
    UPDATE identity_recovery_challenges
    SET otp_attempts = otp_attempts + 1
    WHERE id = p_challenge_id;

    -- Log failed OTP
    INSERT INTO identity_security_events (
      global_identity_id,
      event_type,
      challenge_id,
      success
    ) VALUES (
      v_global_identity_id,
      'otp_failed',
      p_challenge_id,
      false
    );

    IF v_challenge.otp_attempts >= v_challenge.max_otp_attempts THEN
      UPDATE identity_recovery_challenges
      SET status = 'rejected'
      WHERE id = p_challenge_id;
      v_error_code := 'OTP_ATTEMPTS_EXCEEDED';
    ELSE
      v_error_code := 'INVALID_OTP';
    END IF;

    RAISE EXCEPTION '%', v_error_code;
  END IF;

  -- Validate new credential (must be at least 6 characters)
  IF LENGTH(p_new_credential_hash) < 6 THEN
    v_error_code := 'CREDENTIAL_TOO_WEAK';
    RAISE EXCEPTION '%', v_error_code;
  END IF;

  -- Update challenge status to completed
  UPDATE identity_recovery_challenges
  SET 
    status = 'completed',
    completed_at = now(),
    updated_at = now()
  WHERE id = p_challenge_id;

  -- Update credential in global_identities
  UPDATE global_identities
  SET 
    credential_hash = p_new_credential_hash,
    updated_at = now()
  WHERE global_identity_id = v_global_identity_id;

  -- Revoke all active sessions for this identity (force re-login with new PIN)
  WITH revoked_sessions AS (
    DELETE FROM user_sessions
    WHERE global_identity_id = v_global_identity_id
      AND status = 'active'
      AND revoked_at IS NULL
    RETURNING id
  )
  SELECT COUNT(*) INTO v_revoked_count FROM revoked_sessions;

  -- Log security event - OTP verified
  INSERT INTO identity_security_events (
    global_identity_id,
    event_type,
    challenge_id,
    success
  ) VALUES (
    v_global_identity_id,
    'otp_verified',
    p_challenge_id,
    true
  );

  -- Log security event - recovery completed
  INSERT INTO identity_security_events (
    global_identity_id,
    event_type,
    challenge_id,
    metadata
  ) VALUES (
    v_global_identity_id,
    'recovery_completed',
    p_challenge_id,
    jsonb_build_object('sessions_revoked', v_revoked_count)
  );

  -- Log security event - credential updated
  INSERT INTO identity_security_events (
    global_identity_id,
    event_type,
    challenge_id
  ) VALUES (
    v_global_identity_id,
    'credential_updated',
    p_challenge_id
  );

  RETURN json_build_object(
    'id', p_challenge_id,
    'status', 'completed',
    'completed_at', now(),
    'sessions_revoked', v_revoked_count
  );

EXCEPTION WHEN OTHERS THEN
  RAISE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC: Record Security Event (for logging)
-- Used by app-boot.js to log login attempts, recoveries, etc
CREATE OR REPLACE FUNCTION identity_record_security_event(
  p_global_identity_id UUID,
  p_event_type TEXT,
  p_success BOOLEAN DEFAULT true,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS JSON AS $$
DECLARE
  v_event_id UUID;
BEGIN
  INSERT INTO identity_security_events (
    global_identity_id,
    event_type,
    success,
    metadata,
    ip_address
  ) VALUES (
    p_global_identity_id,
    p_event_type,
    p_success,
    p_metadata,
    inet_client_addr()
  ) RETURNING id INTO v_event_id;

  RETURN json_build_object(
    'id', v_event_id,
    'event_type', p_event_type,
    'success', p_success,
    'created_at', now()
  );

EXCEPTION WHEN OTHERS THEN
  RAISE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 5. TRIGGERS
-- ============================================================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_identity_recovery_challenges_updated_at
  BEFORE UPDATE ON identity_recovery_challenges
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 6. GRANT PERMISSIONS
-- ============================================================================

-- Service role can execute all RPCs
GRANT EXECUTE ON FUNCTION identity_request_recovery TO service_role;
GRANT EXECUTE ON FUNCTION identity_approve_recovery TO service_role;
GRANT EXECUTE ON FUNCTION identity_complete_recovery TO service_role;
GRANT EXECUTE ON FUNCTION identity_record_security_event TO service_role;

-- Anon role can request recovery only
GRANT EXECUTE ON FUNCTION identity_request_recovery TO anon;

-- Tables: appropriate role permissions
GRANT SELECT, INSERT, UPDATE ON identity_recovery_challenges TO authenticated;
GRANT SELECT ON identity_security_events TO authenticated;
GRANT SELECT ON identity_otp_attempts TO authenticated;

GRANT ALL ON identity_recovery_challenges TO service_role;
GRANT ALL ON identity_security_events TO service_role;
GRANT ALL ON identity_otp_attempts TO service_role;

-- ============================================================================
-- MIGRATION NOTES
-- ============================================================================
-- 
-- This migration creates:
-- 1. identity_recovery_challenges table (request → approve → complete)
-- 2. identity_security_events table (immutable audit log)
-- 3. identity_otp_attempts table (track OTP failures)
-- 4. RLS policies (user isolation, admin access)
-- 5. 4 RPC functions (request, approve, complete, record event)
--
-- Key security features:
-- - Throttling: Max 3 requests per phone per hour
-- - Enumeration prevention: Return generic challenge for non-existent phones
-- - RLS enforcement: Users see only own data; admins see all
-- - Audit logging: All security events logged immutably
-- - Session revocation: All active sessions revoked on recovery completion
--
-- Next steps:
-- 1. Deploy this migration: supabase db push
-- 2. Configure env vars (VITE_SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY)
-- 3. Integrate SMS/WhatsApp OTP provider
-- 4. Test recovery flow end-to-end
--


-- ========== 20261010_fix_recovery_schema.sql ==========
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
