import assert from 'node:assert/strict';
import { createIdentityAdapter, IDENTITY_ADAPTER_ERRORS } from './adapter.js';
import { MockIdentityProvider } from './mock-provider.js';
import { METHODS, SupabaseIdentityProvider } from './supabase-provider.js';
import { getIdentitySession, setIdentitySession, clearIdentitySession, verifyIdentitySession } from './session.js';

globalThis.localStorage = {
  data: new Map(),
  getItem(key) { return this.data.has(key) ? this.data.get(key) : null; },
  setItem(key, value) { this.data.set(key, String(value)); },
  removeItem(key) { this.data.delete(key); }
};

const provider = new MockIdentityProvider({ now: () => new Date('2026-01-01T00:00:00Z') });
const adapter = createIdentityAdapter({ providerInstance: provider });

const identity = await adapter.resolveIdentity(' +62 811-1111-1111 ');
assert.equal(identity.phoneE164, '+6281111111111');
await assert.rejects(() => adapter.verifyCredential(identity.globalIdentityId, 'wrong'), error => error.code === IDENTITY_ADAPTER_ERRORS.UNAUTHORIZED);
const verified = await adapter.verifyCredential(identity.globalIdentityId, 'admin-demo-password');
assert.equal(verified.globalIdentityId, identity.globalIdentityId);

const memberships = await adapter.listMemberships(identity.globalIdentityId, 'tpa');
assert.equal(memberships.length, 1);
assert.equal(memberships[0].membership.role, 'admin');
assert.equal(memberships[0].membership.appKey, 'tpa');
const session = await adapter.createAppSession(memberships[0].membership.membershipId);
assert.equal(session.appKey, 'tpa');
assert.equal((await adapter.verifySession(session.appSessionId)).appSessionId, session.appSessionId);
await adapter.revokeSession(session.appSessionId);
await assert.rejects(() => adapter.verifySession(session.appSessionId), error => error.code === IDENTITY_ADAPTER_ERRORS.UNAUTHORIZED);

const transportCalls = [];
const transport = new SupabaseIdentityProvider({
  invoke: async (method, payload) => {
    transportCalls.push({ method, payload });
    return { ok: true };
  }
});
await transport.resolveIdentity('+6281111111111');
assert.equal(transportCalls[0].method, METHODS.resolveIdentity);
assert.equal(transportCalls[0].payload.appKey, 'tpa');
assert.throws(() => transport.listMemberships({ globalIdentityId: identity.globalIdentityId, appKey: 'kasirsolo' }), error => error.code === 'WRONG_APP');

setIdentitySession(session);
assert.equal(getIdentitySession().appSessionId, session.appSessionId);
clearIdentitySession();
assert.equal(getIdentitySession(), null);
assert.equal(await verifyIdentitySession(adapter), null);

const defaultAdapter = createIdentityAdapter();
await assert.rejects(() => defaultAdapter.resolveIdentity('+6281111111111'), error => error.code === IDENTITY_ADAPTER_ERRORS.NOT_CONFIGURED);

console.log('TPA identity Stage B provider/session tests: PASS');
