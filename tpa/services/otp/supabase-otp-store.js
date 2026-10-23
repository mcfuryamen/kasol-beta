/**
 * Supabase-backed OTP Store
 * Persists OTP attempts and verification state across instances
 * Replaces in-memory storage for production use
 */

export class SupabaseOTPStore {
  constructor(supabaseClient) {
    if (!supabaseClient) {
      throw new Error('Supabase client required for OTP store');
    }
    this.supabase = supabaseClient;
  }

  /**
   * Store OTP for verification
   * @param {string} challengeId - Recovery challenge ID
   * @param {string} phoneE164 - Phone number in E.164 format
   * @param {string} otp - 6-digit OTP code
   * @param {number} expiresInSeconds - Expiration time in seconds (default 10 min)
   * @returns {Promise<{success: boolean, expiresAt: string}>}
   */
  async storeOTP(challengeId, phoneE164, otp, expiresInSeconds = 600) {
    const expiresAt = new Date(Date.now() + expiresInSeconds * 1000).toISOString();

    const { data, error } = await this.supabase
      .from('identity_recovery_challenges')
      .update({
        metadata: {
          otp,
          otp_attempts: 0,
          otp_expires_at: expiresAt,
          otp_sent_method: 'sms' // Will be set by caller
        },
        updated_at: new Date().toISOString()
      })
      .eq('id', challengeId)
      .select();

    if (error) {
      throw new Error(`Failed to store OTP: ${error.message}`);
    }

    if (!data || data.length === 0) {
      throw new Error(`Challenge ${challengeId} not found`);
    }

    return { success: true, expiresAt };
  }

  /**
   * Verify OTP code against stored value
   * @param {string} challengeId - Recovery challenge ID
   * @param {string} otpCode - User-provided OTP code
   * @returns {Promise<{valid: boolean, remaining: number, error?: string}>}
   */
  async verifyOTP(challengeId, otpCode) {
    const { data, error } = await this.supabase
      .from('identity_recovery_challenges')
      .select('metadata, status')
      .eq('id', challengeId)
      .single();

    if (error || !data) {
      return { valid: false, remaining: 0, error: 'CHALLENGE_NOT_FOUND' };
    }

    const metadata = data.metadata || {};
    const storedOtp = metadata.otp;
    const otpAttempts = metadata.otp_attempts || 0;
    const maxAttempts = 3;
    const expiresAt = metadata.otp_expires_at ? new Date(metadata.otp_expires_at) : null;

    // Check expiration
    if (!expiresAt || new Date() > expiresAt) {
      // Mark OTP as expired
      await this.supabase
        .from('identity_recovery_challenges')
        .update({
          metadata: { ...metadata, otp_expired: true },
          updated_at: new Date().toISOString()
        })
        .eq('id', challengeId);

      return { valid: false, remaining: 0, error: 'OTP_EXPIRED' };
    }

    // Check attempts
    if (otpAttempts >= maxAttempts) {
      return { valid: false, remaining: 0, error: 'OTP_ATTEMPTS_EXCEEDED' };
    }

    // Verify code
    if (otpCode === storedOtp) {
      // Record successful verification
      await this.recordOTPAttempt(challengeId, true);
      return { valid: true, remaining: 0 };
    }

    // Increment attempts
    const newAttempts = otpAttempts + 1;
    const remaining = maxAttempts - newAttempts;

    // Update attempt count
    await this.supabase
      .from('identity_recovery_challenges')
      .update({
        metadata: { ...metadata, otp_attempts: newAttempts },
        updated_at: new Date().toISOString()
      })
      .eq('id', challengeId);

    await this.recordOTPAttempt(challengeId, false);

    return { valid: false, remaining, error: 'INVALID_OTP' };
  }

  /**
   * Record OTP attempt in audit log
   * @private
   */
  async recordOTPAttempt(challengeId, success) {
    const { data: challenge } = await this.supabase
      .from('identity_recovery_challenges')
      .select('global_identity_id, phone_e164')
      .eq('id', challengeId)
      .single();

    if (challenge) {
      await this.supabase
        .from('identity_otp_attempts')
        .insert({
          challenge_id: challengeId,
          attempt_number: (challenge.metadata?.otp_attempts || 0) + 1,
          success
        });
    }
  }

  /**
   * Clear OTP after successful verification
   * @param {string} challengeId - Recovery challenge ID
   */
  async clearOTP(challengeId) {
    const { data } = await this.supabase
      .from('identity_recovery_challenges')
      .select('metadata')
      .eq('id', challengeId)
      .single();

    const metadata = data?.metadata || {};
    delete metadata.otp;
    delete metadata.otp_attempts;
    delete metadata.otp_expires_at;

    await this.supabase
      .from('identity_recovery_challenges')
      .update({
        metadata,
        updated_at: new Date().toISOString()
      })
      .eq('id', challengeId);
  }

  /**
   * Get remaining OTP attempts
   * @param {string} challengeId - Recovery challenge ID
   * @returns {Promise<number>}
   */
  async getRemainingAttempts(challengeId) {
    const { data } = await this.supabase
      .from('identity_recovery_challenges')
      .select('metadata')
      .eq('id', challengeId)
      .single();

    const metadata = data?.metadata || {};
    const attempts = metadata.otp_attempts || 0;
    return Math.max(0, 3 - attempts);
  }

  /**
   * Check if OTP exists and is valid for challenge
   * @param {string} challengeId - Recovery challenge ID
   * @returns {Promise<{exists: boolean, expired: boolean}>}
   */
  async checkOTPStatus(challengeId) {
    const { data } = await this.supabase
      .from('identity_recovery_challenges')
      .select('metadata')
      .eq('id', challengeId)
      .single();

    if (!data) {
      return { exists: false, expired: false };
    }

    const metadata = data.metadata || {};
    const expiresAt = metadata.otp_expires_at ? new Date(metadata.otp_expires_at) : null;

    return {
      exists: !!metadata.otp,
      expired: expiresAt ? new Date() > expiresAt : false
    };
  }
}

/**
 * Create OTP store from Supabase client
 * @param {SupabaseClient} supabaseClient
 * @returns {SupabaseOTPStore}
 */
export function createSupabaseOTPStore(supabaseClient) {
  return new SupabaseOTPStore(supabaseClient);
}
