import {
  APP_KEY,
  IdentityContractError,
  normalizePhoneE164,
  validateAppSession,
  validateIdentity,
  redactSecurityEvent,
  validateMembership,
  validateSubjectLink,
  validateRecoveryRequest,
  validateRecoveryChallenge,
  validateRecoveryCompletion,
  validateNewCredential
} from './contract.js';

export const IDENTITY_ADAPTER_ERRORS = Object.freeze({
  NOT_CONFIGURED: 'IDENTITY_PROVIDER_NOT_CONFIGURED',
  UNAUTHORIZED: 'IDENTITY_UNAUTHORIZED',
  UNAVAILABLE: 'IDENTITY_PROVIDER_UNAVAILABLE',
  INVALID_RESPONSE: 'IDENTITY_INVALID_PROVIDER_RESPONSE'
});

function invalidResponse(operation, cause) {
  return new IdentityContractError(
    IDENTITY_ADAPTER_ERRORS.INVALID_RESPONSE,
    `Response identity provider tidak valid untuk operasi ${operation}`,
    { operation, cause: cause?.code || cause?.message || String(cause) }
  );
}

function mapProviderError(error) {
  if (error instanceof IdentityContractError) return error;
  if (error?.code === 'UNAUTHORIZED' || error?.code === IDENTITY_ADAPTER_ERRORS.UNAUTHORIZED) {
    return new IdentityContractError(IDENTITY_ADAPTER_ERRORS.UNAUTHORIZED, 'Identity atau credential tidak valid.');
  }
  return new IdentityContractError(
    IDENTITY_ADAPTER_ERRORS.UNAVAILABLE,
    'Identity provider tidak tersedia.'
  );
}

export class NotConfiguredIdentityAdapter {
  constructor() { this.appKey = APP_KEY; }

  notConfigured(operation) {
    throw new IdentityContractError(
      IDENTITY_ADAPTER_ERRORS.NOT_CONFIGURED,
      `Identity provider belum dikonfigurasi untuk operasi ${operation}`,
      { operation, appKey: this.appKey }
    );
  }

  async resolveIdentity(phoneE164) { normalizePhoneE164(phoneE164); return this.notConfigured('resolveIdentity'); }
  async verifyCredential(globalIdentityId, credential) {
    if (!globalIdentityId || typeof globalIdentityId !== 'string') throw new IdentityContractError('INVALID_IDENTITY_ID', 'globalIdentityId wajib diisi');
    if (typeof credential !== 'string' || !credential) throw new IdentityContractError('INVALID_CREDENTIAL', 'Credential wajib diisi');
    return this.notConfigured('verifyCredential');
  }
  async listMemberships(globalIdentityId, appKey = APP_KEY) {
    if (!globalIdentityId || typeof globalIdentityId !== 'string') throw new IdentityContractError('INVALID_IDENTITY_ID', 'globalIdentityId wajib diisi');
    if (appKey !== APP_KEY) throw new IdentityContractError('WRONG_APP', 'Adapter hanya menerima appKey TPA');
    return this.notConfigured('listMemberships');
  }
  async createAppSession(membershipId, deviceId = null) {
    if (!membershipId || typeof membershipId !== 'string') throw new IdentityContractError('INVALID_MEMBERSHIP_ID', 'membershipId wajib diisi');
    if (deviceId !== null && typeof deviceId !== 'string') throw new IdentityContractError('INVALID_DEVICE_ID', 'deviceId tidak valid');
    return this.notConfigured('createAppSession');
  }
  async verifySession(appSessionId) {
    if (!appSessionId || typeof appSessionId !== 'string') throw new IdentityContractError('INVALID_SESSION_ID', 'appSessionId wajib diisi');
    return this.notConfigured('verifySession');
  }
  async revokeSession(appSessionId) {
    if (!appSessionId || typeof appSessionId !== 'string') throw new IdentityContractError('INVALID_SESSION_ID', 'appSessionId wajib diisi');
    return this.notConfigured('revokeSession');
  }
  async recordSecurityEvent(event) {
    redactSecurityEvent(event);
    return this.notConfigured('recordSecurityEvent');
  }
  async requestRecovery(phoneE164) { validateRecoveryRequest({ phoneE164 }); return this.notConfigured('requestRecovery'); }
  async approveRecovery(challengeId) {
    if (!challengeId || typeof challengeId !== 'string') throw new IdentityContractError('INVALID_CHALLENGE_ID', 'challengeId wajib diisi');
    return this.notConfigured('approveRecovery');
  }
  async completeRecovery(challengeId, approvalToken, newCredential) {
    if (!challengeId || typeof challengeId !== 'string') throw new IdentityContractError('INVALID_CHALLENGE_ID', 'challengeId wajib diisi');
    if (!approvalToken || typeof approvalToken !== 'string') throw new IdentityContractError('INVALID_APPROVAL_ARTIFACT', 'approvalToken wajib diisi');
    validateNewCredential(newCredential);
    return this.notConfigured('completeRecovery');
  }
}

export class IdentityAdapter {
  constructor(provider) {
    if (!provider || typeof provider !== 'object') throw new IdentityContractError('INVALID_PROVIDER', 'Provider identity wajib berupa object');
    this.provider = provider;
    this.appKey = APP_KEY;
  }

  async call(operation, input, mapper) {
    try {
      const result = await this.provider[operation](input);
      return mapper(result);
    } catch (error) {
      if (error instanceof IdentityContractError && error.code === IDENTITY_ADAPTER_ERRORS.INVALID_RESPONSE) throw error;
      const mapped = mapProviderError(error);
      if (mapped.code !== IDENTITY_ADAPTER_ERRORS.UNAVAILABLE && mapped.code !== IDENTITY_ADAPTER_ERRORS.UNAUTHORIZED) throw mapped;
      throw mapped;
    }
  }

  resolveIdentity(phoneE164) {
    const normalized = normalizePhoneE164(phoneE164);
    return this.call('resolveIdentity', normalized, result => {
      try { return validateIdentity(result); } catch (error) { throw invalidResponse('resolveIdentity', error); }
    });
  }

  verifyCredential(globalIdentityId, credential) {
    return this.call('verifyCredential', { globalIdentityId, credential }, result => {
      try { return validateIdentity(result); } catch (error) { throw invalidResponse('verifyCredential', error); }
    });
  }

  listMemberships(globalIdentityId, appKey = APP_KEY) {
    if (appKey !== APP_KEY) throw new IdentityContractError('WRONG_APP', 'Adapter hanya menerima appKey TPA');
    return this.call('listMemberships', { globalIdentityId, appKey }, result => {
      const rows = Array.isArray(result) ? result : result?.memberships;
      if (!Array.isArray(rows)) throw invalidResponse('listMemberships', new Error('memberships harus array'));
      try {
        return rows.map(row => ({
          membership: validateMembership(row.membership || row),
          subjectLinks: (row.subjectLinks || []).map(validateSubjectLink)
        }));
      } catch (error) { throw invalidResponse('listMemberships', error); }
    });
  }

  createAppSession(membershipId, deviceId = null) {
    return this.call('createAppSession', { membershipId, deviceId }, result => {
      try { return validateAppSession(result); } catch (error) { throw invalidResponse('createAppSession', error); }
    });
  }

  verifySession(appSessionId) {
    return this.call('verifySession', appSessionId, result => {
      try { return validateAppSession(result); } catch (error) { throw invalidResponse('verifySession', error); }
    });
  }

  revokeSession(appSessionId) {
    return this.call('revokeSession', appSessionId, result => {
      if (result !== true && result?.revoked !== true) throw invalidResponse('revokeSession', new Error('revoked harus true'));
      return true;
    });
  }

  recordSecurityEvent(event) {
    const redacted = redactSecurityEvent(event);
    return this.call('recordSecurityEvent', redacted, result => {
      if (result !== true && result?.recorded !== true) throw invalidResponse('recordSecurityEvent', new Error('recorded harus true'));
      return true;
    });
  }

  requestRecovery(phoneE164) {
    const input = validateRecoveryRequest({ phoneE164 });
    return this.call('requestRecovery', input, result => {
      try { return validateRecoveryChallenge(result); } catch (error) { throw invalidResponse('requestRecovery', error); }
    });
  }

  approveRecovery(challengeId) {
    if (!challengeId || typeof challengeId !== 'string') throw new IdentityContractError('INVALID_CHALLENGE_ID', 'challengeId wajib diisi');
    return this.call('approveRecovery', { challengeId }, result => {
      try { return validateRecoveryChallenge(result); } catch (error) { throw invalidResponse('approveRecovery', error); }
    });
  }

  completeRecovery(challengeId, approvalToken, newCredential) {
    if (!challengeId || typeof challengeId !== 'string') throw new IdentityContractError('INVALID_CHALLENGE_ID', 'challengeId wajib diisi');
    if (!approvalToken || typeof approvalToken !== 'string') throw new IdentityContractError('INVALID_APPROVAL_ARTIFACT', 'approvalToken wajib diisi');
    validateNewCredential(newCredential);
    return this.call('completeRecovery', { challengeId, approvalToken, newCredential }, result => {
      try { return validateRecoveryCompletion(result); } catch (error) { throw invalidResponse('completeRecovery', error); }
    });
  }
}

export function createIdentityAdapter({ provider = null, providerInstance = null } = {}) {
  if (providerInstance) return new IdentityAdapter(providerInstance);
  if (provider) return new IdentityAdapter(provider);
  return new NotConfiguredIdentityAdapter();
}
