/**
 * Guardian Service
 * Semua operasi data Wali Santri
 */
import { db } from '../db/dexie.js';

/** Ambil semua wali aktif */
export async function getAllGuardians(locationId) {
  return db.guardians.where('locationId').equals(locationId).and(g => g.isActive).toArray();
}

/** Ambil satu wali */
export async function getGuardian(id) {
  return db.guardians.get(id);
}

/** Tambah wali */
export async function addGuardian(data) {
  const id = await db.guardians.add({ ...data, isActive: true });
  return id;
}

/** Update wali */
export async function updateGuardian(id, data) {
  await db.guardians.update(id, data);
  return db.guardians.get(id);
}

/** Hapus wali (soft-delete) */
export async function deleteGuardian(id) {
  await db.guardians.update(id, { isActive: false });
}

/** Ambil santri2 wali ini */
export async function getGuardianStudents(guardianId) {
  const links = await db.classStudents.where('guardianId').equals(guardianId).toArray();
  if (!links.length) return [];
  const sids = [...new Set(links.map(l => l.studentId))];
  const students = await db.students.bulkGet(sids);
  return students.filter(Boolean);
}

/** Get wali + statistik santrinya */
export async function getGuardianWithStats(guardianId) {
  const g = await db.guardians.get(guardianId);
  if (!g) return null;
  const students = await getGuardianStudents(guardianId);
  return {
    ...g,
    studentCount: students.length,
    students
  };
}
