/**
 * Teacher Service
 * Semua operasi data Ustadz/Ustadzah
 */
import { db } from '../db/dexie.js';

/** Ambil semua ustadz aktif */
export async function getAllTeachers(locationId) {
  return db.teachers.where('locationId').equals(locationId).and(t => t.isActive).toArray();
}

/** Ambil satu ustadz */
export async function getTeacher(id) {
  return db.teachers.get(id);
}

/** Tambah ustadz */
export async function addTeacher(data) {
  const id = await db.teachers.add({ ...data, isActive: true });
  return id;
}

/** Update ustadz */
export async function updateTeacher(id, data) {
  await db.teachers.update(id, data);
  return db.teachers.get(id);
}

/** Hapus ustadz (soft-delete) */
export async function deleteTeacher(id) {
  await db.teachers.update(id, { isActive: false });
}

/** Ambil kelas yang diajar ustadz */
export async function getTeacherClasses(teacherId) {
  const links = await db.classTeachers.where('teacherId').equals(teacherId).toArray();
  if (!links.length) return [];
  const cids = [...new Set(links.map(l => l.classId))];
  return db.classes.bulkGet(cids).then(cs => cs.filter(Boolean));
}

/** Get jadwal mingguan ustadz */
export async function getTeacherSchedule(teacherId) {
  const links = await db.classTeachers.where('teacherId').equals(teacherId).toArray();
  if (!links.length) return [];
  const cids = links.map(l => l.classId);
  const schedules = await db.schedules
    .where('classId')
    .anyOf(cids)
    .and(s => s.isActive)
    .toArray();
  return schedules;
}

/** Get statistik ustadz */
export async function getTeacherStats(locationId) {
  const all = await db.teachers.where('locationId').equals(locationId).and(t => t.isActive).toArray();
  return {
    total: all.length,
    L: all.filter(t => t.gender === 'L').length,
    P: all.filter(t => t.gender === 'P').length
  };
}
