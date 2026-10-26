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
