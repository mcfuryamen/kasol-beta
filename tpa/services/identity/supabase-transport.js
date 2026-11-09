/**
 * Supabase Transport Layer
 * Invokes Supabase RPC functions from the browser.
 * Never exposes service-role keys; uses anon/authenticated keys only.
 */

import { SupabaseIdentityProvider } from './supabase-provider.js';

let supabaseClient = null;

export function getSupabaseClient() {
  if (!supabaseClient) {
    throw new Error('Supabase client not initialized. Call initSupabaseClient() first.');
  }
  return supabaseClient;
}

export async function initSupabaseClient(client) {
  supabaseClient = client;
  return supabaseClient;
}

/**
 * Transport wrapper that calls Supabase RPC functions.
 * Handles response parsing, error mapping, and retry logic.
 */
export class SupabaseTransport {
  constructor(client) {
    if (!client) {
      throw new Error('Supabase client required');
    }
    this.client = client;
  }

  /**
   * Invoke a Supabase RPC function by name.
   * @param {string} rpcName - RPC function name (e.g., 'identity_verify_credential')
   * @param {object} payload - Arguments to pass to the RPC
   * @returns {Promise<object>} RPC response
   */
  async invoke(rpcName, payload) {
    try {
      const { data, error } = await this.client.rpc(rpcName, payload);

      if (error) {
        // Map Postgres errors to IdentityContractError
        const code = this.mapPostgresErrorCode(error.message);
        const err = new Error(error.message);
        err.code = code;
        throw err;
      }

      return data;
    } catch (error) {
      // Re-throw with normalized code
      if (!error.code) {
        error.code = 'RPC_INVOKE_FAILED';
      }
      throw error;
    }
  }

  /**
   * Map Postgres exception messages to contract error codes.
   * @private
   */
  mapPostgresErrorCode(message) {
    if (!message) return 'RPC_INVOKE_FAILED';

    const lower = message.toLowerCase();

    // Recovery errors
    if (lower.includes('challenge_not_found')) return 'CHALLENGE_NOT_FOUND';
    if (lower.includes('challenge_not_pending')) return 'CHALLENGE_NOT_PENDING';
    if (lower.includes('challenge_not_approved')) return 'CHALLENGE_NOT_APPROVED';
    if (lower.includes('challenge_expired')) return 'CHALLENGE_EXPIRED';
    if (lower.includes('recovery_throttled')) return 'RECOVERY_THROTTLED';
    if (lower.includes('proof_required')) return 'PROOF_REQUIRED';
    if (lower.includes('credential_too_weak')) return 'CREDENTIAL_TOO_WEAK';
    if (lower.includes('invalid_otp')) return 'INVALID_OTP';
    if (lower.includes('otp_attempts_exceeded')) return 'OTP_ATTEMPTS_EXCEEDED';
    if (lower.includes('invalid_approver_session')) return 'INVALID_APPROVER_SESSION';
    if (lower.includes('insufficient_approver_role')) return 'INSUFFICIENT_APPROVER_ROLE';

    // Auth errors
    if (lower.includes('identity not found') || lower.includes('phone_not_found'))
      return 'IDENTITY_NOT_FOUND';
    if (lower.includes('credential mismatch') || lower.includes('invalid credential'))
      return 'IDENTITY_UNAUTHORIZED';
    if (lower.includes('membership not found') || lower.includes('ambiguous'))
      return 'AMBIGUOUS_OR_MISSING_MEMBERSHIP';

    // Session errors
    if (lower.includes('session expired') || lower.includes('session not found'))
      return 'SESSION_EXPIRED';
    if (lower.includes('unauthorized')) return 'UNAUTHORIZED';

    return 'RPC_INVOKE_FAILED';
  }
}

/**
 * Bootstrap Supabase with the identity provider.
 * Call this once during app initialization.
 *
 * @param {object} supabaseClient - @supabase/supabase-js client instance
 * @returns {object} { transport, provider }
 */
export function bootstrapSupabaseIdentity(supabaseClient, options = {}) {
  if (!supabaseClient) {
    throw new Error('Supabase client required');
  }

  const transport = new SupabaseTransport(supabaseClient);

  // This module is already ESM; use the static import at module scope.
  const provider = new SupabaseIdentityProvider(transport);

  // Store globally for access elsewhere.
  // Jalur login aktif = Supabase Auth (IDENTITY-CONTRACT.md, update 2026-10-12):
  // provider hub (RPC identity_*) HANYA dipasang global bila hub eksplisit
  // diaktifkan (options.hubEnabled | __TPA_IDENTITY_HUB_ENABLED__ |
  // VITE_IDENTITY_HUB_ENABLED). Tanpa itu, loginWithIdentity jatuh ke jalur
  // Supabase Auth dan tidak menyadap RPC hub yang belum ada di project
  // (PGRST202 / RPC_INVOKE_FAILED).
  const flagGlobal = globalThis.__TPA_IDENTITY_HUB_ENABLED__ === true;
  const flagEnv = import.meta.env?.VITE_IDENTITY_HUB_ENABLED === 'true';
  const hubEnabled = options.hubEnabled ?? (flagGlobal || flagEnv);
  if (hubEnabled) {
    globalThis.__TPA_IDENTITY_ADAPTER__ = provider;
  }
  globalThis.__TPA_SUPABASE_CLIENT__ = supabaseClient;

  return { transport, provider, client: supabaseClient, hubEnabled };
}
