import assert from 'node:assert/strict';
import { normalizeAttendanceRecords, normalizeSessionWriteInput, validateSessionInput } from './tpa-attendance-normalize.js';

const rows = normalizeAttendanceRecords([
  { student_id: 'student-a', status: 'hadir' },
  { student_id: 'student-a', status: 'izin', notes: 'updated' }
], { id: 'session-a', location_id: 'location-a' }, 'user-a');
assert.equal(rows.length, 1);
assert.equal(rows[0].student_id, 'student-a');
assert.equal(rows[0].status, 'izin');
assert.equal(typeof rows[0].session_id, 'string');
assert.equal(rows[0].location_id, 'location-a');
assert.throws(() => normalizeAttendanceRecords([{ student_id: 'student-a', status: 'unknown' }], { id: 'session-a', location_id: 'location-a' }, 'user-a'), /ATTENDANCE_STATUS_INVALID/);
assert.deepEqual(validateSessionInput({ location_id: 'loc-a', class_id: 'class-a', teacher_id: 'teacher-a', session_date: '2026-10-11', start_time: '08:00' }).status, 'planned');
assert.throws(() => validateSessionInput({ location_id: 'loc-a', class_id: 'class-a', teacher_id: 'teacher-a', session_date: '2026-10-11', start_time: '08:00', status: 'bad' }), /SESSION_STATUS_INVALID/);
const sessionWrite = normalizeSessionWriteInput({ class_id: 'class-a', teacher_id: 'teacher-a', session_date: '2026-10-11', start_time: '08:00', location_id: 'attacker-loc' }, 'loc-a', 'user-a');
assert.equal(sessionWrite.location_id, 'loc-a');
assert.equal(sessionWrite.created_by, 'user-a');
assert.equal(sessionWrite.status, 'planned');
assert.throws(() => normalizeSessionWriteInput({ class_id: 'class-a', teacher_id: 'teacher-a', session_date: '2026-10-11', start_time: '08:00' }, null, 'user-a'), /LOCATION_REQUIRED/);
assert.throws(() => normalizeSessionWriteInput({ class_id: 'class-a', teacher_id: 'teacher-a', session_date: '2026-10-11', start_time: '08:00' }, 'loc-a', null), /CREATOR_REQUIRED/);
console.log('TPA remote attendance contract tests: PASS');
