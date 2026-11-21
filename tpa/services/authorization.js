import { db } from '../db/dexie.js';
import { verifySession } from '../db/init.js';

export const AUTHZ_ERRORS = Object.freeze({
  UNAUTHENTICATED: 'TPA_UNAUTHENTICATED',
  FORBIDDEN: 'TPA_FORBIDDEN',
  LOCATION_MISMATCH: 'TPA_LOCATION_MISMATCH',
  NOT_ASSIGNED: 'TPA_NOT_ASSIGNED',
  NOT_OWNER: 'TPA_NOT_OWNER'
});

function deny(code, message = 'Akses tidak diizinkan.') {
  const error = new Error(message);
  error.code = code;
  throw error;
}

export async function getActor({ session = null, database = db } = {}) {
  const user = session || await verifySession();
  if (!user?.role || !user.locationId) deny(AUTHZ_ERRORS.UNAUTHENTICATED, 'Sesi TPA tidak valid.');
  if (!['admin', 'ustadz', 'wali'].includes(user.role)) deny(AUTHZ_ERRORS.FORBIDDEN);
  const location = await database.locations.get(user.locationId);
  if (!location || location.isActive === false) deny(AUTHZ_ERRORS.FORBIDDEN);
  if (user.role === 'ustadz') {
    const teacher = await database.teachers.get(user.teacherId);
    if (!teacher || teacher.isActive === false || teacher.locationId !== user.locationId) deny(AUTHZ_ERRORS.FORBIDDEN);
  }
  if (user.role === 'wali') {
    const guardian = await database.guardians.get(user.guardianId);
    if (!guardian || guardian.isActive === false || guardian.locationId !== user.locationId) deny(AUTHZ_ERRORS.FORBIDDEN);
  }
  return Object.freeze({ ...user, locationId: location.id });
}

export function requireRole(actor, ...roles) {
  if (!actor || !roles.includes(actor.role)) deny(AUTHZ_ERRORS.FORBIDDEN);
  return actor;
}

export function requireAdmin(actor) { return requireRole(actor, 'admin'); }

export function requireLocation(actor, record) {
  if (!record || record.locationId !== actor.locationId) deny(AUTHZ_ERRORS.LOCATION_MISMATCH);
  return record;
}

export async function requireTeacherAssignment(actor, classId, database = db) {
  requireRole(actor, 'ustadz', 'admin');
  if (actor.role === 'admin') return database.classes.get(classId).then(cls => requireLocation(actor, cls));
  const cls = await database.classes.get(classId);
  requireLocation(actor, cls);
  const link = await database.classTeachers.where('teacherId').equals(actor.teacherId)
    .and(item => item.classId === classId && (item.locationId == null || item.locationId === actor.locationId)).first();
  if (!link) deny(AUTHZ_ERRORS.NOT_ASSIGNED);
  return cls;
}

export async function requireGuardianChild(actor, studentId, database = db) {
  requireRole(actor, 'wali');
  const child = await database.students.get(studentId);
  if (!child || child.locationId !== actor.locationId || child.guardianId !== actor.guardianId || child.isActive === false) {
    deny(AUTHZ_ERRORS.NOT_OWNER);
  }
  return child;
}

export async function requireScopedRecord(actor, table, id, database = db) {
  const record = await database[table].get(id);
  return requireLocation(actor, record);
}
