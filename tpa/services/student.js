/**
 * Student Service
 * Semua operasi data Santri (Students)
 */
import { db } from '../db/dexie.js';
import { queryClassStudents } from '../db/dexie.js';
import { queryGuardianStudents } from '../db/dexie.js';
import { getActor, requireAdmin, requireGuardianChild, requireLocation, requireRole } from './authorization.js';

/** Ambil semua santri aktif */
export async function getAllStudents(locationId = null) {
  const actor = await getActor();
  requireRole(actor, 'admin', 'ustadz');
  if (locationId != null && locationId !== actor.locationId) throw Object.assign(new Error('Lokasi tidak valid.'), { code: 'TPA_LOCATION_MISMATCH' });
  return db.students.where('locationId').equals(actor.locationId).and(s => s.isActive).toArray();
}

/** Ambil satu santri */
export async function getStudent(id) {
  const actor = await getActor();
  const student = await db.students.get(id);
  if (actor.role === 'wali') return requireGuardianChild(actor, id);
  requireRole(actor, 'admin', 'ustadz');
  return requireLocation(actor, student);
}

/** Ambil santri aktif berdasarkan kelas */
export async function getStudentsByClass(classId) {
  const actor = await getActor();
  requireRole(actor, 'admin', 'ustadz');
  const cls = await db.classes.get(classId);
  requireLocation(actor, cls);
  if (actor.role === 'ustadz') {
    const assigned = await db.classTeachers.where('teacherId').equals(actor.teacherId).and(link => link.classId === classId).first();
    if (!assigned) throw Object.assign(new Error('Kelas bukan assignment ustadz.'), { code: 'TPA_NOT_ASSIGNED' });
  }
  const links = await db.classStudents.where('classId').equals(classId).toArray();
  if (!links.length) return [];
  const sids = [...new Set(links.map(l => l.studentId))];
  const students = await db.students.bulkGet(sids);
  return students.filter(Boolean).filter(s => s.isActive);
}

/** Ambil santri berdasarkan wali */
export async function getStudentsByGuardian(guardianId) {
  const actor = await getActor();
  requireRole(actor, 'admin', 'wali');
  if (actor.role === 'wali' && guardianId !== actor.guardianId) throw Object.assign(new Error('Wali bukan pemilik data.'), { code: 'TPA_NOT_OWNER' });
  return db.students.where('guardianId').equals(guardianId).and(s => s.locationId === actor.locationId && s.isActive).toArray();
}

/** Ambil anak-anak wali yang sedang login (dengan detail kelas & progres) */
export async function getGuardianChildren() {
  const actor = await getActor();
  requireRole(actor, 'wali');
  const children = await db.students.where('guardianId').equals(actor.guardianId)
    .and(s => s.locationId === actor.locationId && s.isActive).toArray();
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
  const actor = await getActor();
  requireAdmin(actor);
  const id = await db.students.add({ ...data, locationId: actor.locationId, isActive: true });
  return id;
}

/** Update santri */
export async function updateStudent(id, data) {
  const actor = await getActor();
  requireAdmin(actor);
  const current = await db.students.get(id);
  requireLocation(actor, current);
  await db.students.update(id, { ...data, locationId: actor.locationId });
  return db.students.get(id);
}

/** Hapus Santri (soft-delete) */
export async function deleteStudent(id) {
  const actor = await getActor();
  requireAdmin(actor);
  const current = await db.students.get(id);
  requireLocation(actor, current);
  await db.students.update(id, { isActive: false });
}

/** Get kelas Santi */
export async function getStudentClasses(studentId) {
  const actor = await getActor();
  const student = await db.students.get(studentId);
  if (actor.role === 'wali') await requireGuardianChild(actor, studentId);
  else requireLocation(actor, student);
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
