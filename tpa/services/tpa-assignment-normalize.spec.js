import assert from 'node:assert/strict';
import { normalizeClassStudentAssignment, normalizeClassTeacherAssignment, isUuid } from './tpa-assignment-normalize.js';

const classId = '11111111-1111-1111-1111-111111111111';
const studentId = '22222222-2222-2222-2222-222222222222';
const teacherId = '33333333-3333-3333-3333-333333333333';

assert.throws(() => normalizeClassStudentAssignment({ student_id: studentId }), /ASSIGNMENT_CLASS_INVALID/);
assert.throws(() => normalizeClassStudentAssignment({ class_id: classId, student_id: 'student-1' }), /ASSIGNMENT_STUDENT_INVALID/);
assert.deepEqual(normalizeClassStudentAssignment({ class_id: classId, student_id: studentId, location_id: 'dropped', legacy_id: 4 }), { class_id: classId, student_id: studentId });

assert.throws(() => normalizeClassTeacherAssignment({ class_id: classId }), /ASSIGNMENT_TEACHER_INVALID/);
assert.throws(() => normalizeClassTeacherAssignment({ class_id: 'x', teacher_id: teacherId }), /ASSIGNMENT_CLASS_INVALID/);
assert.deepEqual(normalizeClassTeacherAssignment({ class_id: classId, teacher_id: teacherId }), { class_id: classId, teacher_id: teacherId, is_primary: false });
assert.deepEqual(normalizeClassTeacherAssignment({ class_id: classId, teacher_id: teacherId, is_primary: true }).is_primary, true);
assert.equal(isUuid(classId), true);
assert.equal(isUuid('class-1'), false);
console.log('TPA remote assignment contract tests: PASS');