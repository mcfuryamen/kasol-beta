import { APP_KEY, IdentityContractError, normalizePhoneE164 } from './contract.js';

const METHODS = Object.freeze({
  resolveIdentity: 'identity_resolve',
  verifyCredential: 'identity_verify_credential',
  listMemberships: 'identity_list_memberships',
  createAppSession: 'identity_create_app_session',
  verifySession: 'identity_verify_app_session',
  revokeSession: 'identity_revoke_app_session',
  recordSecurityEvent: 'identity_record_security_event',
  requestRecovery: 'identity_request_recovery',
  approveRecovery: 'identity_approve_recovery',
  completeRecovery: 'identity_complete_recovery'
});

// RPC hub-only (SQL-nya ada di proyek identity-hub EKSTERNAL, bukan repo ini);
// payload-nya tetap memakai camelCase + appKey sesuai kontrak hub.
const HUB_RPC_METHODS = Object.freeze(new Set([
  METHODS.resolveIdentity,
  METHODS.verifyCredential,
  METHODS.listMemberships,
  METHODS.createAppSession,
  METHODS.verifySession,
  METHODS.revokeSession
]));

// RPC recovery/security milik repo ini (migrasi 20261009). Signature SQL:
//   identity_request_recovery(p_phone_e164 TEXT)
//   identity_approve_recovery(p_challenge_id UUID, p_approver_user_id UUID)
//   identity_complete_recovery(p_challenge_id UUID, p_otp TEXT, p_new_credential_hash TEXT)
//   identity_record_security_event(p_global_identity_id UUID, p_event_type TEXT,
//                                  p_success BOOLEAN DEFAULT true, p_metadata JSONB DEFAULT '{}')
// Nama param Postgres dipakai persis dan TANPA appKey (appKey menyebabkan
// PGRST202 karena tidak cocok dengan signature fungsi).
const RECOVERY_RPC_METHODS = Object.freeze(new Set([
  METHODS.recordSecurityEvent,
  METHODS.requestRecovery,
  METHODS.approveRecovery,
  METHODS.completeRecovery
]));

/**
 * Supabase-ready transport boundary. The injected transport must call a
 * server-owned RPC/Edge Function; it must never expose credential tables or a
 * service-role key to browser code.
 */
export class SupabaseIdentityProvider {
  constructor(transport) {
    if (!transport || typeof transport.invoke !== 'function') throw new IdentityContractError('INVALID_TRANSPORT', 'Identity transport wajib menyediakan invoke()');
    this.transport = transport;
  }

  invoke(method, payload) {
    const rpcName = METHODS[method];
    const enriched = RECOVERY_RPC_METHODS.has(rpcName) ? payload : { ...payload, appKey: APP_KEY };
    return this.transport.invoke(rpcName, enriched);
  }

  resolveIdentity(phoneE164) { return this.invoke('resolveIdentity', { phoneE164: normalizePhoneE164(phoneE164) }); }
  verifyCredential({ globalIdentityId, credential }) { return this.invoke('verifyCredential', { globalIdentityId, credential }); }
  listMemberships({ globalIdentityId, appKey }) {
    if (appKey !== APP_KEY) throw new IdentityContractError('WRONG_APP', 'Provider hanya menerima appKey TPA');
    return this.invoke('listMemberships', { globalIdentityId });
  }
  createAppSession({ membershipId, deviceId }) { return this.invoke('createAppSession', { membershipId, deviceId }); }
  verifySession(appSessionId) { return this.invoke('verifySession', { appSessionId }); }
  revokeSession(appSessionId) { return this.invoke('revokeSession', { appSessionId }); }
  recordSecurityEvent(event) {
    return this.invoke('recordSecurityEvent', {
      p_global_identity_id: event?.identityId ?? null,
      p_event_type: event?.eventType,
      p_success: event?.success !== false,
      p_metadata: event?.metadataRedacted ?? {}
    });
  }
  requestRecovery({ phoneE164 }) { return this.invoke('requestRecovery', { p_phone_e164: normalizePhoneE164(phoneE164) }); }
  approveRecovery({ challengeId, approverUserId }) {
    // approverUserId opsional; otorisasi approver yang sah tetap ditentukan
    // server (auth.uid()/roling) saat layer recovery ini diaktifkan.
    return this.invoke('approveRecovery', { p_challenge_id: challengeId, p_approver_user_id: approverUserId ?? null });
  }
  completeRecovery({ challengeId, approvalToken, newCredential }) {
    // approvalToken = artefak verifikasi user (OTP) -> p_otp; hash credential
    // baru dihitung server-side oleh RPC, klien hanya meneruskan nilainya.
    return this.invoke('completeRecovery', { p_challenge_id: challengeId, p_otp: approvalToken, p_new_credential_hash: newCredential });
  }
}

export { METHODS };
