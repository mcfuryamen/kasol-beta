/**
 * Student Service
 * Semua operasi data Santri (Students)
 */
import { db } from '../db/dexie.js';
import { queryClassStudents } from '../db/dexie.js';
import { queryGuardianStudents } from '../db/dexie.js';

/** Ambil semua santri aktif */
export async function getAllStudents(locationId) {
  return db.students.where('locationId').equals(locationId).and(s => s.isActive).toArray();
}

/** Ambil satu santri */
export async function getStudent(id) {
  return db.students.get(id);
}

/** Ambil santri aktif berdasarkan kelas */
export async function getStudentsByClass(classId) {
  const links = await db.classStudents.where('classId').equals(classId).toArray();
  if (!links.length) return [];
  const sids = [...new Set(links.map(l => l.studentId))];
  const students = await db.students.bulkGet(sids);
  return students.filter(Boolean).filter(s => s.isActive);
}

/** Ambil santri berdasarkan wali */
export async function getStudentsByGuardian(guardianId) {
  return db.students.where('guardianId').equals(guardianId).and(s => s.isActive).toArray();
}

/** Ambil anak-anak wali yang sedang login (dengan detail kelas & progres) */
export async function getGuardianChildren() {
  const user = JSON.parse(localStorage.getItem('tpa_session') || 'null');
  if (!user || !user.guardianId) return [];
  const children = await db.students.where('guardianId').equals(user.guardianId).and(s => s.isActive).toArray();
  const result = [];
  for (const child of children) {
    const classes = await getStudentClasses(child.id);
    const hafalan = await db.hafalanProgress.where('studentId').equals(child.id).toArray();
    const done = hafalan.filter(h => h.status === 'completed').length;
    result.push({
      ...child,
      class: classes[0]?.name || 'Belum ada kelas',
      hafalanProgress: Math.min(100, Math.round(done / 37 * 100)),
      hafalanJuz: Math.floor(done / 37),
      hafalanSurat: hafalan.filter(h => h.status === 'completed' && h.type === 'surat').length,
      recentHafalan: hafalan.slice(-3).reverse().map(h => ({
        surat: h.suratName || h.description || 'Hafalan',
        tanggal: h.createdAt ? new Date(h.createdAt).toLocaleDateString('id-ID') : '-',
        status: h.status === 'completed' ? 'Selesai' : 'Proses'
      }))
    });
  }
  return result;
}

/** Tambah santri baru */
export async function addStudent(data) {
  const id = await db.students.add({ ...data, isActive: true });
  return id;
}

/** Update santri */
export async function updateStudent(id, data) {
  await db.students.update(id, data);
  return db.students.get(id);
}

/** Hapus Santi (soft-delete) */
export async function deleteStudent(id) {
  await db.students.update(id, { isActive: false });
}

/** Get kelas Santi */
export async function getStudentClasses(studentId) {
  const links = await db.classStudents.where('studentId').equals(studentId).toArray();
  if (!links.length) return [];
  const cids = links.map(l => l.classId);
  return db.classes.bulkGet(cids).then(cs => cs.filter(Boolean));
}

/** Get kelas lengkap +wali Santi */
export async function getStudentWithDetails(studentId) {
  const s = await db.students.get(studentId);
  if (!s) return null;
  const [guardian, classes] = await Promise.all([
    s.guardianId ? db.guardians.get(s.guardianId) : null,
    getStudentClasses(studentId)
  ]);
  return { ...s, guardian, classes };
}

/** Get statistik Santi */
export async function getStudentStats(locationId) {
  const all = await db.students.where('locationId').equals(locationId).and(s => s.isActive).toArray();
  return {
    total: all.length,
    L: all.filter(s => s.gender === 'L').length,
    P: all.filter(s => s.gender === 'P').length
  };
}
