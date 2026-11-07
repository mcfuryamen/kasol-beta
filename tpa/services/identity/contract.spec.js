import assert from 'node:assert/strict';
import {
  APP_KEY,
  IdentityContractError,
  redactSecurityEvent,
  validateAppSession,
  validateIdentity,
  validateMembership,
  validateSubjectLink
} from './contract.js';
import { createIdentityAdapter } from './adapter.js';

const ids = {
  identity: '11111111-1111-4111-8111-111111111111',
  membership: '22222222-2222-4222-8222-222222222222',
  tenant: '33333333-3333-4333-8333-333333333333',
  location: '44444444-4444-4444-8444-444444444444',
  subject: '55555555-5555-4555-8555-555555555555',
  session: '66666666-6666-4666-8666-666666666666',
  device: '77777777-7777-4777-8777-777777777777'
};

const identity = validateIdentity({
  globalIdentityId: ids.identity,
  phoneE164: '+62 812-3456-7890',
  displayName: 'Akun TPA',
  status: 'active',
  phoneVerifiedAt: '2026-01-01T00:00:00Z'
});
assert.equal(identity.phoneE164, '+6281234567890');

const membership = validateMembership({
  membershipId: ids.membership,
  globalIdentityId: ids.identity,
  appKey: APP_KEY,
  tenantId: ids.tenant,
  locationId: ids.location,
  role: 'wali',
  status: 'active',
  expiresAt: null
});
assert.equal(membership.role, 'wali');

const subject = validateSubjectLink({
  membershipId: ids.membership,
  subjectType: 'guardian',
  subjectId: ids.subject,
  locationId: ids.location
});
assert.equal(subject.subjectType, 'guardian');

const session = validateAppSession({
  appSessionId: ids.session,
  globalIdentityId: ids.identity,
  membershipId: ids.membership,
  appKey: APP_KEY,
  tenantId: ids.tenant,
  locationId: ids.location,
  role: 'wali',
  sessionVersion: 1,
  issuedAt: '2026-01-01T00:00:00Z',
  expiresAt: '2026-01-01T01:00:00Z',
  deviceId: ids.device
});
assert.equal(session.deviceId, ids.device);

assert.throws(() => validateIdentity({ ...identity, pinHash: 'must-not-cross-boundary' }), error => error.code === 'CREDENTIAL_BOUNDARY_VIOLATION');
assert.throws(() => validateMembership({ ...membership, appKey: 'kasirsolo' }), error => error.code === 'WRONG_APP');
assert.throws(() => validateMembership({ ...membership, role: 'owner' }), error => error.code === 'INVALID_ENUM');
assert.throws(() => validateSubjectLink({ ...subject, subjectType: 'student' }), error => error.code === 'INVALID_ENUM');
assert.throws(() => validateAppSession({ ...session, expiresAt: '2025-01-01T00:00:00Z' }), error => error.code === 'INVALID_SESSION_WINDOW');

const event = redactSecurityEvent({
  identityId: ids.identity,
  eventType: 'login_failure',
  success: false,
  metadataRedacted: { reason: 'invalid', pin: '123456', otp: '000000' }
});
assert.equal(event.metadataRedacted.pin, undefined);
assert.equal(event.metadataRedacted.otp, undefined);

const adapter = createIdentityAdapter();
assert.equal(adapter.appKey, APP_KEY);
await assert.rejects(
  () => adapter.resolveIdentity('+6281234567890'),
  error => error instanceof IdentityContractError && error.code === 'IDENTITY_PROVIDER_NOT_CONFIGURED'
);

console.log('TPA identity Stage A contract tests: PASS');
