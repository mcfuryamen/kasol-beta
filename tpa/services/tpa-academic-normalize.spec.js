import assert from 'node:assert/strict';
import { normalizeClassWriteInput, normalizeScheduleWriteInput } from './tpa-academic-normalize.js';

assert.throws(() => normalizeClassWriteInput({}), /CLASS_NAME_REQUIRED/);
assert.throws(() => normalizeClassWriteInput({ name: 'A' }), /CLASS_LEVEL_REQUIRED/);
assert.throws(() => normalizeClassWriteInput({ name: 'A', level: 'bogus' }), /CLASS_LEVEL_INVALID/);
assert.throws(() => normalizeClassWriteInput({ name: 'A', level: 'iqro_1', max_students: 0 }), /CLASS_MAX_INVALID/);
const cls = normalizeClassWriteInput({ name: ' Iqro A ', level: 'iqro_1', max_students: '25', room: ' R1 ', location_id: 'dropped', legacy_id: 9 });
assert.deepEqual(cls, { name: 'Iqro A', level: 'iqro_1', max_students: 25, room: 'R1', is_active: true });
assert.equal(normalizeClassWriteInput({ name: 'B', level: 'juz_amma' }).max_students, 30);

assert.throws(() => normalizeScheduleWriteInput({ day: 'Senin', start_time: '08:00', end_time: '09:00' }), /SCHEDULE_CLASS_INVALID/);
assert.throws(() => normalizeScheduleWriteInput({ class_id: '11111111-1111-1111-1111-111111111111', day: 'Hari', start_time: '08:00', end_time: '09:00' }), /SCHEDULE_DAY_INVALID/);
assert.throws(() => normalizeScheduleWriteInput({ class_id: '11111111-1111-1111-1111-111111111111', day: 'Senin', start_time: '8:00', end_time: '09:00' }), /SCHEDULE_TIME_INVALID/);
assert.throws(() => normalizeScheduleWriteInput({ class_id: '11111111-1111-1111-1111-111111111111', day: 'Senin', start_time: '09:00', end_time: '08:00' }), /SCHEDULE_TIME_ORDER_INVALID/);
assert.throws(() => normalizeScheduleWriteInput({ class_id: '11111111-1111-1111-1111-111111111111', day: 'Senin', start_time: '08:00', end_time: '09:00', teacher_id: 'teacher-1' }), /SCHEDULE_TEACHER_INVALID/);
const sch = normalizeScheduleWriteInput({ class_id: '11111111-1111-1111-1111-111111111111', day: 'Senin', start_time: '08:00', end_time: '09:30', teacher_id: null, room: ' R2 ', location_id: 'dropped' });
assert.deepEqual(sch, { class_id: '11111111-1111-1111-1111-111111111111', day: 'Senin', start_time: '08:00', end_time: '09:30', teacher_id: null, room: 'R2', is_active: true });
console.log('TPA remote academic write contract tests: PASS');