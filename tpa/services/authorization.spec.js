import assert from 'node:assert/strict';
import { getActor, requireGuardianChild, requireTeacherAssignment, AUTHZ_ERRORS } from './authorization.js';

const ids = { locA: 'loc-a', locB: 'loc-b', guardianA: 'guardian-a', guardianB: 'guardian-b', teacherA: 'teacher-a', classA: 'class-a', classB: 'class-b', studentA: 'student-a', studentB: 'student-b' };
const tables = {
  locations: { get: async id => ({ id, isActive: true }) },
  teachers: { get: async id => id === ids.teacherA ? { id, locationId: ids.locA, isActive: true } : null },
  guardians: { get: async id => id === ids.guardianA || id === ids.guardianB ? { id, locationId: ids.locA, isActive: true } : null },
  classes: { get: async id => ({ id, locationId: id === ids.classB ? ids.locB : ids.locA, isActive: true }) },
  students: { get: async id => id === ids.studentA ? { id, locationId: ids.locA, guardianId: ids.guardianA, isActive: true } : { id, locationId: ids.locB, guardianId: ids.guardianB, isActive: true } },
  classTeachers: { where: () => ({ equals: () => ({ and: () => ({ first: async () => ({ classId: ids.classA }) }) }) }) }
};

const admin = await getActor({ session: { id: 'a', role: 'admin', locationId: ids.locA }, database: tables });
assert.equal(admin.locationId, ids.locA);
const teacher = await getActor({ session: { id: 't', role: 'ustadz', teacherId: ids.teacherA, locationId: ids.locA }, database: tables });
await requireTeacherAssignment(teacher, ids.classA, tables);
await assert.rejects(() => requireTeacherAssignment(teacher, ids.classB, tables), error => error.code === AUTHZ_ERRORS.LOCATION_MISMATCH);
const guardian = await getActor({ session: { id: 'g', role: 'wali', guardianId: ids.guardianA, locationId: ids.locA }, database: tables });
await requireGuardianChild(guardian, ids.studentA, tables);
await assert.rejects(() => requireGuardianChild(guardian, ids.studentB, tables), error => error.code === AUTHZ_ERRORS.NOT_OWNER);
await assert.rejects(() => getActor({ session: { id: 'x', role: 'wali', guardianId: ids.guardianA, locationId: ids.locB }, database: tables }), error => error.code === AUTHZ_ERRORS.FORBIDDEN);
console.log('TPA Stage F authorization tests: PASS');
