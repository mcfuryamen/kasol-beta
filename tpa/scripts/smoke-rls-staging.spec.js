import assert from 'node:assert/strict';
import { STAGING_REF, accountEnvKey, passwordEnvKey, missingRoles } from './smoke-rls-staging.js';

assert.equal(STAGING_REF, 'ozsjflxfkbcygbuxgwyf');
assert.equal(accountEnvKey('admin'), 'TPA_STAGING_ADMIN_EMAIL');
assert.equal(passwordEnvKey('wali'), 'TPA_STAGING_WALI_PASSWORD');
assert.deepEqual(missingRoles({ TPA_STAGING_ADMIN_EMAIL: 'a', TPA_STAGING_ADMIN_PASSWORD: 'p' }), ['ustadz', 'wali']);
assert.deepEqual(missingRoles({ TPA_STAGING_ADMIN_EMAIL: 'a', TPA_STAGING_ADMIN_PASSWORD: 'p', TPA_STAGING_USTADZ_EMAIL: 'u', TPA_STAGING_USTADZ_PASSWORD: 'p', TPA_STAGING_WALI_EMAIL: 'w', TPA_STAGING_WALI_PASSWORD: 'p' }), []);
console.log('TPA staging RLS smoke contract tests: PASS');
