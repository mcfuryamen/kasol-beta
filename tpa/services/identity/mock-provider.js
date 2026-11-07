import { APP_KEY, IdentityContractError, normalizePhoneE164 } from './contract.js';
import { IDENTITY_ADAPTER_ERRORS } from './adapter.js';

const IDS = Object.freeze({
  admin: '11111111-1111-4111-8111-111111111111',
  ustadz: '22222222-2222-4222-8222-222222222222',
  wali: '33333333-3333-4333-8333-333333333333',
  adminMembership: '44444444-4444-4444-8444-444444444444',
  ustadzMembership: '55555555-5555-4555-8555-555555555555',
  waliMembership: '66666666-6666-4666-8666-666666666666',
  tenant: '77777777-7777-4777-8777-777777777777',
  location: '88888888-8888-4888-8888-888888888888',
  guardian: '99999999-9999-4999-8999-999999999999',
  teacher: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
});

const FIXTURES = Object.freeze([
  { key: 'admin', phoneE164: '+6281111111111', secret: 'admin-demo-password', displayName: 'Admin Demo', role: 'admin', membershipId: IDS.adminMembership },
  { key: 'ustadz', phoneE164: '+6282222222222', secret: '123456', displayName: 'Ustadz Demo', role: 'ustadz', membershipId: IDS.ustadzMembership, subjectType: 'teacher', subjectId: IDS.teacher },
  { key: 'wali', phoneE164: '+6283333333333', secret: '654321', displayName: 'Wali Demo', role: 'wali', membershipId: IDS.waliMembership, subjectType: 'guardian', subjectId: IDS.guardian }
]);

function unauthorized() {
  throw new IdentityContractError(IDENTITY_ADAPTER_ERRORS.UNAUTHORIZED, 'Identity atau credential tidak valid.');
}

function identityFor(fixture) {
  return {
    globalIdentityId: IDS[fixture.key], phoneE164: fixture.phoneE164,
    displayName: fixture.displayName, status: 'active', phoneVerifiedAt: '2026-01-01T00:00:00Z'
  };
}

function membershipFor(fixture) {
  return {
    membershipId: fixture.membershipId, globalIdentityId: IDS[fixture.key], appKey: APP_KEY,
    tenantId: IDS.tenant, locationId: IDS.location, role: fixture.role, status: 'active', expiresAt: null
  };
}

export class MockIdentityProvider {
  constructor({ now = () => new Date(), sessionTtlMs = 60 * 60 * 1000, lockoutThreshold = 5, lockoutMs = 15 * 60 * 1000 } = {}) {
    this.now = now;
    this.sessionTtlMs = sessionTtlMs;
    this.lockoutThreshold = lockoutThreshold;
    this.lockoutMs = lockoutMs;
    this.sessions = new Map();
    this.sessionVersions = new Map();
    this.failures = new Map();
    this.securityEvents = [];
    this.recoveryChallenges = new Map();
    this.credentials = new Map(FIXTURES.map(fixture => [IDS[fixture.key], fixture.secret]));
  }

  emitSecurityEvent(event) { this.securityEvents.push(event); }

  fixtureByIdentity(globalIdentityId) { return FIXTURES.find(fixture => IDS[fixture.key] === globalIdentityId); }
  fixtureByPhone(phoneE164) { return FIXTURES.find(fixture => fixture.phoneE164 === normalizePhoneE164(phoneE164)); }

  async resolveIdentity(phoneE164) {
    const fixture = this.fixtureByPhone(phoneE164);
    if (!fixture) unauthorized();
    return identityFor(fixture);
  }

  async verifyCredential({ globalIdentityId, credential }) {
    const fixture = this.fixtureByIdentity(globalIdentityId);
    const now = this.now();
    const state = this.failures.get(globalIdentityId) || { count: 0, lockedUntil: 0 };
    if (!fixture || state.lockedUntil > now.getTime()) unauthorized();
    if (state.lockedUntil && state.lockedUntil <= now.getTime()) { state.count = 0; state.lockedUntil = 0; }
    if (typeof credential !== 'string' || credential !== this.credentials.get(globalIdentityId)) {
      state.count += 1;
      if (state.count >= this.lockoutThreshold) {
        state.lockedUntil = now.getTime() + this.lockoutMs;
        this.emitSecurityEvent({ identityId: globalIdentityId, appKey: APP_KEY, eventType: 'lockout', success: false, metadataRedacted: { reason: 'threshold' } });
      } else {
        this.emitSecurityEvent({ identityId: globalIdentityId, appKey: APP_KEY, eventType: 'login_failure', success: false, metadataRedacted: { reason: 'invalid_credential' } });
      }
      this.failures.set(globalIdentityId, state);
      unauthorized();
    }
    state.count = 0; state.lockedUntil = 0; this.failures.set(globalIdentityId, state);
    this.emitSecurityEvent({ identityId: globalIdentityId, appKey: APP_KEY, eventType: 'login_success', success: true, metadataRedacted: {} });
    return identityFor(fixture);
  }

  async listMemberships({ globalIdentityId, appKey }) {
    const fixture = this.fixtureByIdentity(globalIdentityId);
    if (!fixture || appKey !== APP_KEY) unauthorized();
    const row = { membership: membershipFor(fixture), subjectLinks: [] };
    if (fixture.subjectType) row.subjectLinks.push({ membershipId: fixture.membershipId, subjectType: fixture.subjectType, subjectId: fixture.subjectId, locationId: IDS.location });
    return [row];
  }

  async createAppSession({ membershipId, deviceId = null }) {
    const fixture = FIXTURES.find(item => item.membershipId === membershipId);
    if (!fixture) unauthorized();
    const issuedAt = this.now();
    const appSessionId = crypto.randomUUID();
    const sessionVersion = (this.sessionVersions.get(IDS[fixture.key]) || 0) + 1;
    this.sessionVersions.set(IDS[fixture.key], sessionVersion);
    const session = {
      appSessionId, globalIdentityId: IDS[fixture.key], membershipId, appKey: APP_KEY,
      tenantId: IDS.tenant, locationId: IDS.location, role: fixture.role, sessionVersion,
      issuedAt: issuedAt.toISOString(), expiresAt: new Date(issuedAt.getTime() + this.sessionTtlMs).toISOString(), deviceId
    };
    this.sessions.set(appSessionId, { session, revoked: false });
    this.emitSecurityEvent({ identityId: session.globalIdentityId, appKey: APP_KEY, eventType: 'session_created', success: true, metadataRedacted: { membershipId: session.membershipId } });
    return session;
  }

  async verifySession(appSessionId) {
    const record = this.sessions.get(appSessionId);
    if (!record || record.revoked || new Date(record.session.expiresAt) <= this.now()) unauthorized();
    const currentVersion = this.sessionVersions.get(record.session.globalIdentityId);
    if (currentVersion !== record.session.sessionVersion) unauthorized();
    return record.session;
  }

  async recordSecurityEvent(event) {
    this.emitSecurityEvent(event);
    return { recorded: true };
  }

  async revokeSession(appSessionId) {
    const record = this.sessions.get(appSessionId);
    if (!record) unauthorized();
    record.revoked = true;
    this.emitSecurityEvent({ identityId: record.session.globalIdentityId, appKey: APP_KEY, eventType: 'session_revoked', success: true, metadataRedacted: { membershipId: record.session.membershipId } });
    return { revoked: true };
  }

  async requestRecovery({ phoneE164 }) {
    const normalized = normalizePhoneE164(phoneE164);
    const fixture = this.fixtureByPhone(normalized);
    const challengeId = crypto.randomUUID();
    const expiresAt = new Date(this.now().getTime() + 10 * 60 * 1000);
    const challenge = { challengeId, status: 'pending', method: 'admin_approval', expiresAt: expiresAt.toISOString(), globalIdentityId: fixture ? IDS[fixture.key] : null, approvalToken: fixture ? `approval-${challengeId}` : null };
    this.recoveryChallenges.set(challengeId, challenge);
    this.emitSecurityEvent({ identityId: fixture ? IDS[fixture.key] : null, appKey: APP_KEY, eventType: 'recovery_requested', success: true, metadataRedacted: { method: 'admin_approval' } });
    return { challengeId, status: 'pending', method: 'admin_approval', expiresAt: challenge.expiresAt };
  }

  async approveRecovery({ challengeId }) {
    const challenge = this.recoveryChallenges.get(challengeId);
    const session = [...this.sessions.values()].find(record => !record.revoked && record.session.role === 'admin');
    if (!challenge || !session || challenge.expiresAt <= this.now().toISOString()) unauthorized();
    challenge.status = 'approved';
    challenge.approvedBy = session.session.globalIdentityId;
    return { challengeId, status: 'approved', method: challenge.method, expiresAt: challenge.expiresAt, approvalToken: challenge.approvalToken };
  }

  async completeRecovery({ challengeId, approvalToken, newCredential }) {
    const challenge = this.recoveryChallenges.get(challengeId);
    if (!challenge || challenge.status !== 'approved' || challenge.expiresAt <= this.now().toISOString()) unauthorized();
    if (typeof approvalToken !== 'string' || approvalToken !== challenge.approvalToken || !challenge.globalIdentityId) unauthorized();
    if (typeof newCredential !== 'string' || newCredential.length < 6) unauthorized();
    this.credentials.set(challenge.globalIdentityId, newCredential);
    this.sessionVersions.set(challenge.globalIdentityId, (this.sessionVersions.get(challenge.globalIdentityId) || 0) + 1);
    let sessionsRevoked = 0;
    for (const record of this.sessions.values()) if (record.session.globalIdentityId === challenge.globalIdentityId && !record.revoked) { record.revoked = true; sessionsRevoked += 1; }
    challenge.status = 'completed';
    challenge.approvalToken = null;
    this.emitSecurityEvent({ identityId: challenge.globalIdentityId, appKey: APP_KEY, eventType: 'recovery_completed', success: true, metadataRedacted: { sessionsRevoked } });
    return { completed: true, sessionsRevoked };
  }
}

export { IDS, FIXTURES };
