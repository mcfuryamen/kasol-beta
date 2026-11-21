import assert from 'node:assert/strict';
import { getSessionLocationId, requireSessionLocationId } from './tpa-session-context.js';

// Node test run: no localStorage global -> no location resolvable.
assert.equal(getSessionLocationId(), null);
assert.throws(() => requireSessionLocationId(), /LOCATION_REQUIRED/);

// Simulated browser storage -> helper resolves the tenant from session.
const store = new Map();
globalThis.localStorage = {
  getItem: key => (store.has(key) ? store.get(key) : null),
  setItem: (key, value) => store.set(key, String(value)),
  removeItem: key => store.delete(key)
};
try {
  assert.equal(getSessionLocationId(), null);
  store.set('tpa_session', JSON.stringify({ id: 'u1', role: 'admin', locationId: 'b88ad846-1c1a-44cc-af1e-84890c43471a' }));
  assert.equal(getSessionLocationId(), 'b88ad846-1c1a-44cc-af1e-84890c43471a');
  assert.equal(requireSessionLocationId(), 'b88ad846-1c1a-44cc-af1e-84890c43471a');
  store.set('tpa_session', '{broken-json');
  assert.equal(getSessionLocationId(), null);
  store.set('tpa_session', JSON.stringify({ role: 'admin' }));
  assert.equal(getSessionLocationId(), null);
} finally {
  delete globalThis.localStorage;
}
console.log('TPA session location context tests: PASS');
