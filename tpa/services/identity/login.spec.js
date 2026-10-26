import assert from 'node:assert/strict';
import { MockIdentityProvider } from './mock-provider.js';
import { createIdentityAdapter } from './adapter.js';
import { redactSecurityEvent } from './contract.js';
import { getIdentitySession, verifyIdentitySession } from './session.js';
import { loginWithIdentity, GENERIC_LOGIN_ERROR } from '../auth.js';

globalThis.localStorage = { data: new Map(), getItem(k) { return this.data.get(k) || null; }, setItem(k, v) { this.data.set(k, String(v)); }, removeItem(k) { this.data.delete(k); } };
globalThis.window = { location: { href: '' } };
globalThis.__TPA_IDENTITY_ADAPTER__ = createIdentityAdapter({ providerInstance: new MockIdentityProvider() });

for (const [phone, credential, role] of [['+6281111111111', 'admin-demo-password', 'admin'], ['+6282222222222', '123456', 'ustadz'], ['+6283333333333', '654321', 'wali']]) {
  const session = await loginWithIdentity(phone, credential);
  assert.equal(session.role, role);
  assert.equal(session.appKey, 'tpa');
  assert.ok(session.expiresAt);
}
await assert.rejects(() => loginWithIdentity('+6281111111111', 'wrong'), error => error.code === 'IDENTITY_UNAUTHORIZED');
assert.equal(GENERIC_LOGIN_ERROR, 'Nomor WhatsApp atau credential tidak valid.');

const provider = globalThis.__TPA_IDENTITY_ADAPTER__.provider;
for (let i = 0; i < 5; i++) await assert.rejects(() => loginWithIdentity('+6282222222222', 'wrong'), error => error.code === 'IDENTITY_UNAUTHORIZED');
await assert.rejects(() => loginWithIdentity('+6282222222222', '123456'), error => error.code === 'IDENTITY_UNAUTHORIZED');
assert.ok(provider.securityEvents.some(event => event.eventType === 'lockout'));
await loginWithIdentity('+6282222222222', '123456').catch(() => {});
assert.ok(provider.securityEvents.every(event => !JSON.stringify(event).match(/password|pin|otp|token|secret/i)));

const redacted = redactSecurityEvent({
  identityId: '11111111-1111-4111-8111-111111111111', eventType: 'login_failure', success: false,
  metadataRedacted: { reason: 'invalid', nested: { password: 'do-not-store', phone: '+6281111111111', ok: true } }
});
assert.equal(redacted.metadataRedacted.nested.password, undefined);
assert.equal(redacted.metadataRedacted.nested.phone, undefined);
assert.equal(redacted.metadataRedacted.nested.ok, true);
assert.equal(getIdentitySession().appKey, 'tpa');
assert.equal((await verifyIdentitySession(globalThis.__TPA_IDENTITY_ADAPTER__)).appKey, 'tpa');
console.log('TPA Stage E identity security tests: PASS');
