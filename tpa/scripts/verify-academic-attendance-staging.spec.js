import assert from 'node:assert/strict';
import { STAGING_REF, REQUIRED_TABLES, buildVerifierQuery, assertStagingUrl, validateReport } from './verify-academic-attendance-staging.js';

assert.equal(STAGING_REF, 'ozsjflxfkbcygbuxgwyf');
assert.ok(REQUIRED_TABLES.includes('tpa_attendances'));
assert.doesNotThrow(() => assertStagingUrl(`https://${STAGING_REF}.supabase.co`));
assert.throws(() => assertStagingUrl('https://other.supabase.co'), /STAGING_TARGET_MISMATCH/);
const query = buildVerifierQuery().trim().toLowerCase();
assert.ok(query.startsWith('with '));
assert.ok(query.includes('select json_build_object'));
assert.ok(!/\b(insert|update|delete|drop|alter|create)\b/.test(query));
assert.deepEqual(validateReport({ tables: [{ name: 'tpa_attendances', present: true }], columns: [], rls: [{ table_name: 'tpa_attendances', enabled: true }], policies: [], triggers: [], functions: [] }), []);
assert.deepEqual(validateReport({ tables: [{ name: 'tpa_attendances', present: false }], columns: [], rls: [], policies: [], triggers: [], functions: [] }), ['tables:tpa_attendances']);
console.log('TPA staging verifier contract tests: PASS');
