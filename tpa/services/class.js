/**
 * Class Service
 * Semua operasi data Kelas
 */
import { db } from '../db/dexie.js';
import { queryClassStudents, queryClassTeachers } from '../db/dexie.js';
import { getActor, requireAdmin, requireLocation, requireTeacherAssignment, requireRole } from './authorization.js';

/** Ambil semua kelas aktif pada lokasi actor */
export async function getAllClasses(locationId = null) {
  const actor = await getActor();
  requireRole(actor, 'admin', 'ustadz');
  if (locationId != null && locationId !== actor.locationId) throw Object.assign(new Error('Lokasi tidak valid.'), { code: 'TPA_LOCATION_MISMATCH' });
  return db.classes.where('locationId').equals(actor.locationId).and(c => c.isActive).toArray();
}

/** Ambil kelas yang diampu ustadz yang sedang login */
export async function getTeacherClasses() {
  const actor = await getActor();
  requireRole(actor, 'ustadz');
  const links = await db.classTeachers.where('teacherId').equals(actor.teacherId)
    .and(link => link.locationId == null || link.locationId === actor.locationId).toArray();
  const classes = [];
  for (const link of links) {
    const c = await db.classes.get(link.classId);
    if (!c || !c.isActive || c.locationId !== actor.locationId) continue;
    const students = await db.classStudents.where('classId').equals(c.id).toArray();
    classes.push({ ...c, studentCount: students.length });
  }
  return classes;
}

/** Ambil satu kelas */
export async function getClass(id) {
  const actor = await getActor();
  const cls = await db.classes.get(id);
  requireLocation(actor, cls);
  if (actor.role === 'ustadz') await requireTeacherAssignment(actor, id);
  return cls;
}

/** Tambah kelas */
export async function addClass(data) {
  const actor = await getActor();
  requireAdmin(actor);
  const id = await db.classes.add({ ...data, locationId: actor.locationId, isActive: true });
  return id;
}

/** Update kelas */
export async function updateClass(id, data) {
  const actor = await getActor();
  requireAdmin(actor);
  const current = await db.classes.get(id);
  requireLocation(actor, current);
  const idSafe = { ...data, locationId: actor.locationId };
  await db.classes.update(id, idSafe);
  return db.classes.get(id);
}

/** Hapus kelas (soft-delete) */
export async function deleteClass(id) {
  const actor = await getActor();
  requireAdmin(actor);
  const current = await db.classes.get(id);
  requireLocation(actor, current);
  await db.classes.update(id, { isActive: false });
}

/** Assign siswa ke kelas */
export async function assignStudentToClass(studentId, classId) {
  const actor = await getActor();
  requireAdmin(actor);
  const cls = await db.classes.get(classId);
  const student = await db.students.get(studentId);
  requireLocation(actor, cls);
  requireLocation(actor, student);
  const existing = await db.classStudents
    .where('studentId').equals(studentId)
    .and(cs => cs.classId === classId)
    .first();
  if (existing) return existing.id;
  if (!student || !cls || student.locationId !== cls.locationId || student.isActive === false || cls.isActive === false) {
    throw new Error('Santri dan kelas harus berada di lokasi yang sama dan aktif.');
  }
  return db.classStudents.add({ studentId, classId, locationId: cls.locationId });
}

/** Remove siswa dari kelas */
export async function removeStudentFromClass(studentId, classId) {
  const actor = await getActor();
  requireAdmin(actor);
  const cls = await db.classes.get(classId);
  const student = await db.students.get(studentId);
  requireLocation(actor, cls);
  requireLocation(actor, student);
  await db.classStudents
    .where('studentId').equals(studentId)
    .and(cs => cs.classId === classId)
    .delete();
}

/** Assign ustadz ke kelas */
export async function assignTeacherToClass(teacherId, classId, isPrimary = false) {
  const actor = await getActor();
  requireAdmin(actor);
  const existing = await db.classTeachers
    .where('teacherId').equals(teacherId)
    .and(ct => ct.classId === classId)
    .first();
  if (existing) return existing.id;
  const [teacher, cls] = await Promise.all([db.teachers.get(teacherId), db.classes.get(classId)]);
  if (!teacher || !cls || teacher.locationId !== cls.locationId || teacher.isActive === false || cls.isActive === false) {
    throw new Error('Guru dan kelas harus berada di lokasi yang sama dan aktif.');
  }
  return db.classTeachers.add({ teacherId, classId, isPrimary, locationId: cls.locationId });
}

/** Remove ustadz dari kelas */
export async function removeTeacherFromClass(teacherId, classId) {
  const actor = await getActor();
  requireAdmin(actor);
  const cls = await db.classes.get(classId);
  const teacher = await db.teachers.get(teacherId);
  requireLocation(actor, cls);
  requireLocation(actor, teacher);
  await db.classTeachers
    .where('teacherId').equals(teacherId)
    .and(ct => ct.classId === classId)
    .delete();
}

/** Get Santri di kelas */
export async function getClassStudents(classId) {
  const actor = await getActor();
  const cls = await db.classes.get(classId);
  requireLocation(actor, cls);
  if (actor.role === 'ustadz') await requireTeacherAssignment(actor, classId);
  if (actor.role === 'wali') throw Object.assign(new Error('Akses tidak diizinkan.'), { code: 'TPA_FORBIDDEN' });
  return queryClassStudents(classId);
}

/** Get Ustadz kelas */
export async function getClassTeachers(classId) {
  const actor = await getActor();
  const cls = await db.classes.get(classId);
  requireLocation(actor, cls);
  if (actor.role === 'ustadz') await requireTeacherAssignment(actor, classId);
  if (actor.role === 'wali') throw Object.assign(new Error('Akses tidak diizinkan.'), { code: 'TPA_FORBIDDEN' });
  return queryClassTeachers(classId);
}

/** Get detail lengkap kelas */
export async function getClassWithDetails(classId) {
  const actor = await getActor();
  const c = await db.classes.get(classId);
  requireLocation(actor, c);
  if (actor.role === 'ustadz') await requireTeacherAssignment(actor, classId);
  if (!c) return null;
  const [students, teachers, scheduleCount] = await Promise.all([
    getClassStudents(classId),
    getClassTeachers(classId),
    db.schedules.where('classId').equals(classId).count()
  ]);
  return { ...c, students, teachers, scheduleCount, studentCount: students.length };
}

/** Statistik kelas */
export async function getClassStats(locationId) {
  const all = await db.classes.where('locationId').equals(locationId).and(c => c.isActive).toArray();
  return { total: all.length };
}
