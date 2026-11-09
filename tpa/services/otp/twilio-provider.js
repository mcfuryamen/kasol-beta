/**
 * Enhanced Twilio OTP Provider with Supabase Persistence
 * Sends OTP codes via SMS and WhatsApp, stores state persistently
 */

import twilio from 'twilio';
import { createSupabaseOTPStore } from './supabase-otp-store.js';

export class TwilioOTPProvider {
  constructor(config = {}) {
    this.accountSid = config.accountSid || process.env.TWILIO_ACCOUNT_SID;
    this.authToken = config.authToken || process.env.TWILIO_AUTH_TOKEN;
    this.fromPhoneNumber = config.fromPhoneNumber || process.env.TWILIO_PHONE_NUMBER;
    this.whatsappNumber = config.whatsappNumber || process.env.TWILIO_WHATSAPP_NUMBER;
    this.supabaseClient = config.supabaseClient;

    if (!this.accountSid || !this.authToken) {
      throw new Error('Twilio credentials not configured');
    }

    this.client = twilio(this.accountSid, this.authToken);
    
    // Use Supabase store if available, otherwise fall back to in-memory (for testing)
    this.otpStore = this.supabaseClient 
      ? createSupabaseOTPStore(this.supabaseClient)
      : new InMemoryOTPStore();
  }

  /**
   * Generate a random 6-digit OTP
   */
  generateOTP() {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  /**
   * Send OTP via SMS or WhatsApp after admin approval
   * @param {string} challengeId - Recovery challenge ID
   * @param {string} phoneE164 - Phone number in E.164 format
   * @param {string} method - 'sms' or 'whatsapp'
   * @param {number} expiresInSeconds - OTP validity period (default 10 minutes)
   * @returns {Promise<{otp: string, expiresAt: string, method: string}>}
   */
  async sendOTP(challengeId, phoneE164, method = 'sms', expiresInSeconds = 600) {
    if (!phoneE164 || !phoneE164.startsWith('+')) {
      throw new Error('Invalid phone number format');
    }

    if (!['sms', 'whatsapp'].includes(method)) {
      throw new Error('Method must be sms or whatsapp');
    }

    const otp = this.generateOTP();
    const expiresAt = new Date(Date.now() + expiresInSeconds * 1000).toISOString();

    try {
      // Send via Twilio
      if (method === 'whatsapp') {
        await this.sendWhatsAppOTP(phoneE164, otp);
      } else {
        await this.sendSMSOTP(phoneE164, otp);
      }

      // Store OTP persistently
      await this.storeOTP(challengeId, phoneE164, otp, method, expiresInSeconds);

      return { otp: '***', expiresAt, method };
    } catch (error) {
      console.error(`Failed to send ${method} OTP to ${phoneE164}:`, error);
      throw new Error(`Failed to send OTP via ${method}: ${error.message}`);
    }
  }

  /**
   * Send SMS OTP
   * @private
   */
  async sendSMSOTP(phoneE164, otp) {
    const message = await this.client.messages.create({
      body: `Your TPA recovery code is: ${otp}. Valid for 10 minutes.`,
      from: this.fromPhoneNumber,
      to: phoneE164
    });
    return message.sid;
  }

  /**
   * Send WhatsApp OTP
   * @private
   */
  async sendWhatsAppOTP(phoneE164, otp) {
    const message = await this.client.messages.create({
      body: `Your TPA recovery code is: ${otp}. Valid for 10 minutes.`,
      from: `whatsapp:${this.whatsappNumber}`,
      to: `whatsapp:${phoneE164}`
    });
    return message.sid;
  }

  /**
   * Store OTP for later verification
   * @private
   */
  async storeOTP(challengeId, phoneE164, otp, method, expiresInSeconds) {
    // Use the store's storeOTP method if it supports metadata
    if (this.otpStore.storeOTP) {
      await this.otpStore.storeOTP(challengeId, phoneE164, otp, expiresInSeconds);
    } else {
      // Fallback for in-memory store
      const expiresAt = new Date(Date.now() + expiresInSeconds * 1000);
      this.otpStore.set(phoneE164, {
        otp,
        expiresAt,
        attempts: 0,
        maxAttempts: 3,
        method,
        challengeId
      });
    }
  }

  /**
   * Verify OTP code provided by user during recovery completion
   * @param {string} challengeId - Recovery challenge ID
   * @param {string} otpCode - User-provided OTP code
   * @returns {Promise<{valid: boolean, remaining: number, error?: string}>}
   */
  async verifyOTP(challengeId, otpCode) {
    try {
      // Use store's verifyOTP method
      if (this.otpStore.verifyOTP && typeof this.otpStore.verifyOTP === 'function') {
        const result = await this.otpStore.verifyOTP(challengeId, otpCode);
        return result;
      }

      // Fallback for in-memory store (for testing)
      const stored = Array.from(this.otpStore.values()).find(
        item => item.challengeId === challengeId
      );

      if (!stored) {
        return { valid: false, remaining: 0, error: 'OTP_NOT_FOUND' };
      }

      // Check expiration
      if (new Date() > stored.expiresAt) {
        return { valid: false, remaining: 0, error: 'OTP_EXPIRED' };
      }

      // Check attempts
      if (stored.attempts >= stored.maxAttempts) {
        return { valid: false, remaining: 0, error: 'OTP_ATTEMPTS_EXCEEDED' };
      }

      // Verify code
      if (otpCode === stored.otp) {
        await this.clearOTP(challengeId, stored.phoneE164 || null);
        return { valid: true, remaining: 0 };
      }

      // Increment attempts
      stored.attempts++;
      const remaining = stored.maxAttempts - stored.attempts;

      return { valid: false, remaining, error: 'INVALID_OTP' };
    } catch (error) {
      console.error(`OTP verification failed for challenge ${challengeId}:`, error);
      throw new Error(`OTP verification failed: ${error.message}`);
    }
  }

  /**
   * Clear OTP after successful recovery
   * @param {string} challengeId - Recovery challenge ID
   * @param {string} phoneE164 - Phone number (optional, for in-memory cleanup)
   */
  async clearOTP(challengeId, phoneE164 = null) {
    if (this.otpStore.clearOTP && typeof this.otpStore.clearOTP === 'function') {
      await this.otpStore.clearOTP(challengeId);
    } else if (phoneE164) {
      // Fallback for in-memory store
      this.otpStore.delete(phoneE164);
    }
  }

  /**
   * Get remaining OTP attempts for a challenge
   * @param {string} challengeId - Recovery challenge ID
   * @returns {Promise<number>}
   */
  async getRemainingAttempts(challengeId) {
    if (this.otpStore.getRemainingAttempts) {
      return await this.otpStore.getRemainingAttempts(challengeId);
    }

    // Fallback for in-memory store
    const stored = Array.from(this.otpStore.values()).find(
      item => item.challengeId === challengeId
    );

    if (!stored) return 3;
    return Math.max(0, stored.maxAttempts - stored.attempts);
  }
}

/**
 * Fallback in-memory OTP store for testing (when Supabase not available)
 * @private
 */
class InMemoryOTPStore extends Map {
  set(phoneE164, value) {
    return super.set(phoneE164, value);
  }

  get(phoneE164) {
    return super.get(phoneE164);
  }

  delete(phoneE164) {
    return super.delete(phoneE164);
  }
}

/**
 * Initialize Twilio OTP provider from environment
 * @param {SupabaseClient} supabaseClient - Optional Supabase client for persistent storage
 * @returns {TwilioOTPProvider}
 */
export function initTwilioOTP(supabaseClient = null) {
  return new TwilioOTPProvider({
    accountSid: process.env.TWILIO_ACCOUNT_SID,
    authToken: process.env.TWILIO_AUTH_TOKEN,
    fromPhoneNumber: process.env.TWILIO_PHONE_NUMBER,
    whatsappNumber: process.env.TWILIO_WHATSAPP_NUMBER,
    supabaseClient
  });
}
