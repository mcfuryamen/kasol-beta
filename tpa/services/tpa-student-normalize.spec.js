import assert from 'node:assert/strict';
import { normalizeStudentWriteInput, buildStudentConsentPayload, isUuid } from './tpa-student-normalize.js';

assert.throws(() => normalizeStudentWriteInput({ nis: '001' }), /STUDENT_NAME_REQUIRED/);
assert.throws(() => normalizeStudentWriteInput({ name: 'A' }), /STUDENT_NIS_REQUIRED/);
assert.throws(() => normalizeStudentWriteInput({ name: 'A', nis: '001', gender: 'X' }), /STUDENT_GENDER_INVALID/);
assert.throws(() => normalizeStudentWriteInput({ name: 'A', nis: '001', guardian_id: 'guardian-1' }), /STUDENT_GUARDIAN_INVALID/);
const row = normalizeStudentWriteInput({ name: ' Ahmad ', nis: ' 001 ', gender: 'L', guardian_id: null, location_id: 'should-be-dropped', legacy_id: 7 });
assert.deepEqual(row, { name: 'Ahmad', nis: '001', gender: 'L', guardian_id: null, is_active: true });
assert.equal(normalizeStudentWriteInput({ name: 'A', nis: '1', is_active: false }).is_active, false);
assert.throws(() => buildStudentConsentPayload({ consent: false, currentAuthUserId: '11111111-1111-1111-1111-111111111111' }), /STUDENT_CONSENT_REQUIRED/);
assert.throws(() => buildStudentConsentPayload({ consent: true, currentAuthUserId: 'not-a-uuid' }), /STUDENT_CONSENT_ACTOR_REQUIRED/);
const consent = buildStudentConsentPayload({ consent: true, guardianId: '22222222-2222-2222-2222-222222222222', currentAuthUserId: '11111111-1111-1111-1111-111111111111', now: '2026-10-11T00:00:00.000Z' });
assert.equal(consent.consent_by, '11111111-1111-1111-1111-111111111111');
assert.equal(consent.consent_at, '2026-10-11T00:00:00.000Z');
assert.equal(isUuid('11111111-1111-1111-1111-111111111111'), true);
assert.equal(isUuid('guardian-1'), false);
console.log('TPA remote student write contract tests: PASS');