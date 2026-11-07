import assert from 'node:assert/strict';
import { normalizeHafalanWriteInput, normalizeIqroWriteInput, composeProgressWriteInput, isUuid } from './tpa-progress-normalize.js';

const studentId = '11111111-1111-1111-1111-111111111111';
const teacherId = '22222222-2222-2222-2222-222222222222';
const locationId = '33333333-3333-3333-3333-333333333333';
const recorderId = '44444444-4444-4444-4444-444444444444';

assert.throws(() => normalizeHafalanWriteInput({}), /PROGRESS_STUDENT_INVALID/);
assert.throws(() => normalizeHafalanWriteInput({ student_id: studentId, teacher_id: teacherId, surah_number: 200, type: 'ziyadah', grade: 'mumtaz' }), /PROGRESS_SURAH_INVALID/);
assert.throws(() => normalizeHafalanWriteInput({ student_id: studentId, teacher_id: teacherId, surah_number: 1, type: 'bogus', grade: 'mumtaz' }), /PROGRESS_TYPE_INVALID/);
assert.throws(() => normalizeHafalanWriteInput({ student_id: studentId, teacher_id: teacherId, surah_number: 1, type: 'ziyadah', grade: 'lumayan' }), /PROGRESS_GRADE_INVALID/);
assert.throws(() => normalizeHafalanWriteInput({ student_id: studentId, teacher_id: teacherId, surah_number: 1, type: 'ziyadah', grade: 'mumtaz', ayat_from: 5, ayat_to: 2 }), /PROGRESS_AYAT_ORDER_INVALID/);
assert.throws(() => normalizeHafalanWriteInput({ student_id: studentId, teacher_id: teacherId, surah_number: 1, type: 'ziyadah', grade: 'mumtaz', juz: 40 }), /PROGRESS_JUZ_INVALID/);
const hafalan = normalizeHafalanWriteInput({ student_id: studentId, teacher_id: teacherId, surah_number: 112, surah_name: ' Al-Ikhlas ', ayat_from: '1', ayat_to: '3', juz: '30', type: 'ziyadah', grade: 'mumtaz', notes: '  ', location_id: 'dropped', legacy_id: 5, recorded_by: 'attacker' });
assert.deepEqual(hafalan, { student_id: studentId, teacher_id: teacherId, surah_number: 112, surah_name: 'Al-Ikhlas', ayat_from: 1, ayat_to: 3, juz: 30, type: 'ziyadah', grade: 'mumtaz', notes: null });

assert.throws(() => normalizeIqroWriteInput({ student_id: studentId, teacher_id: teacherId, jilid: 9, page: 1, grade: 'lancar' }), /PROGRESS_JILID_INVALID/);
assert.throws(() => normalizeIqroWriteInput({ student_id: studentId, teacher_id: teacherId, jilid: 2, page: 0, grade: 'lancar' }), /PROGRESS_PAGE_INVALID/);
assert.throws(() => normalizeIqroWriteInput({ student_id: studentId, teacher_id: teacherId, jilid: 2, page: 5, grade: 'mumtaz' }), /PROGRESS_GRADE_INVALID/);
const iqro = normalizeIqroWriteInput({ student_id: studentId, teacher_id: teacherId, jilid: '2', page: '5', grade: 'lancar', location_id: 'dropped' });
assert.deepEqual(iqro, { student_id: studentId, teacher_id: teacherId, jilid: 2, page: 5, grade: 'lancar', notes: null });

const composed = composeProgressWriteInput(hafalan, locationId, recorderId);
assert.equal(composed.location_id, locationId);
assert.equal(composed.recorded_by, recorderId);
assert.equal(composed.student_id, studentId);
assert.throws(() => composeProgressWriteInput(hafalan, 'not-a-uuid', recorderId), /PROGRESS_LOCATION_INVALID/);
assert.throws(() => composeProgressWriteInput(hafalan, null, recorderId), /PROGRESS_LOCATION_INVALID/);
assert.throws(() => composeProgressWriteInput(hafalan, locationId, 'not-a-uuid'), /PROGRESS_RECORDER_INVALID/);
assert.throws(() => composeProgressWriteInput(hafalan, locationId, null), /PROGRESS_RECORDER_INVALID/);
const spoofed = composeProgressWriteInput({ ...hafalan, location_id: 'attacker', recorded_by: 'attacker' }, locationId, recorderId);
assert.equal(spoofed.location_id, locationId);
assert.equal(spoofed.recorded_by, recorderId);
assert.equal(isUuid(studentId), true);
assert.equal(isUuid('student-1'), false);
console.log('TPA remote progress write contract tests: PASS');