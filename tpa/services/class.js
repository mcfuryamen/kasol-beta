/**
 * Class Service
 * Semua operasi data Kelas
 */
import { db } from '../db/dexie.js';
import { queryClassStudents, queryClassTeachers } from '../db/dexie.js';

/** Ambil semua kelas aktif */
export async function getAllClasses(locationId) {
  return db.classes.where('locationId').equals(locationId).and(c => c.isActive).toArray();
}

/** Ambil kelas yang diampu ustadz yang sedang login */
export async function getTeacherClasses() {
  const user = JSON.parse(localStorage.getItem('tpa_session') || 'null');
  if (!user || !user.teacherId) return [];
  const links = await db.classTeachers.where('teacherId').equals(user.teacherId).toArray();
  const classes = [];
  for (const link of links) {
    const c = await db.classes.get(link.classId);
    if (!c || !c.isActive) continue;
    const students = await db.classStudents.where('classId').equals(c.id).toArray();
    classes.push({ ...c, studentCount: students.length });
  }
  return classes;
}

/** Ambil satu kelas */
export async function getClass(id) {
  return db.classes.get(id);
}

/** Tambah kelas */
export async function addClass(data) {
  const id = await db.classes.add({ ...data, isActive: true });
  return id;
}

/** Update kelas */
export async function updateClass(id, data) {
  await db.classes.update(id, data);
  return db.classes.get(id);
}

/** Hapus kelas (soft-delete) */
export async function deleteClass(id) {
  await db.classes.update(id, { isActive: false });
}

/** Assign siswa ke kelas */
export async function assignStudentToClass(studentId, classId) {
  const existing = await db.classStudents
    .where('studentId').equals(studentId)
    .and(cs => cs.classId === classId)
    .first();
  if (existing) return existing.id;
  return db.classStudents.add({ studentId, classId });
}

/** Remove siswa dari kelas */
export async function removeStudentFromClass(studentId, classId) {
  await db.classStudents
    .where('studentId').equals(studentId)
    .and(cs => cs.classId === classId)
    .delete();
}

/** Assign ustadz ke kelas */
export async function assignTeacherToClass(teacherId, classId, isPrimary = false) {
  const existing = await db.classTeachers
    .where('teacherId').equals(teacherId)
    .and(ct => ct.classId === classId)
    .first();
  if (existing) return existing.id;
  return db.classTeachers.add({ teacherId, classId, isPrimary });
}

/** Remove ustadz dari kelas */
export async function removeTeacherFromClass(teacherId, classId) {
  await db.classTeachers
    .where('teacherId').equals(teacherId)
    .and(ct => ct.classId === classId)
    .delete();
}

/** Get Santi di kelas */
export async function getClassStudents(classId) {
  return queryClassStudents(classId);
}

/** Get Ustadz kelas */
export async function getClassTeachers(classId) {
  return queryClassTeachers(classId);
}

/** Get detail lengkap kelas */
export async function getClassWithDetails(classId) {
  const c = await db.classes.get(classId);
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
