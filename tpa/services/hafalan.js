/**
 * Hafalan Service
 * Semua operasi data Hafalan & Progress Iqro
 */
import { db } from '../db/dexie.js';
import { queryStudentHafalan } from '../db/dexie.js';

/** Tambah record hafalan/hafalan */
export async function addHafalan(data) {
  return db.hafalanProgress.add(data);
}

/** Update hafalan */
export async function updateHafalan(id, data) {
  await db.hafalanProgress.update(id, data);
  return db.hafalanProgress.get(id);
}

/** Hapus hafalan */
export async function deleteHafalan(id) {
  await db.hafalanProgress.delete(id);
}

/** Ambil histori hafalan Santi */
export async function getStudentHafalan(studentId) {
  return queryStudentHafalan(studentId);
}

/** Ambil semua hafalan kelas */
export async function getClassHafalan(classId) {
  const links = await db.classStudents.where('classId').equals(classId).toArray();
  const sids = links.map(l => l.studentId);
  if (!sids.length) return [];
  const all = await db.hafalanProgress.where('studentId').anyOf(sids).toArray();
  const students = await db.students.bulkGet(sids);
  const smap = {};
  students.forEach(s => { if (s) smap[s.id] = s.name; });
  return all.map(h => ({ ...h, studentName: smap[h.studentId] || '?' }));
}

/** Statistik hafalan Santi */
export async function getStudentHafalanStats(studentId) {
  const all = await getStudentHafalan(studentId);
  const grades = { mumtaz: 0, 'jayyid jiddan': 0, jayyid: 0, maqbul: 0 };
  all.forEach(h => { if (grades[h.grade] !== undefined) grades[h.grade]++; });
  return { total: all.length, grades };
}

/** Rekap hafalan per kelas per periode */
export async function getClassHafalanSummary(classId, startDate, endDate) {
  const links = await db.classStudents.where('classId').equals(classId).toArray();
  const sids = links.map(l => l.studentId);
  if (!sids.length) return [];
  let query = db.hafalanProgress.where('studentId').anyOf(sids);
  const all = await query.toArray();
  const filtered = all.filter(h => {
    const d = h.recordedAt.split('T')[0];
    return d >= startDate && d <= endDate;
  });
  const students = await db.students.bulkGet(sids);
  const smap = {};
  students.forEach(s => { if (s) smap[s.id] = s.name; });
  return filtered.map(h => ({ ...h, studentName: smap[h.studentId] || '?' }));
}

/* ── Iqro Progress ── */
export async function addIqroProgress(data) {
  return db.iqroProgress.add(data);
}

export async function getStudentIqroProgress(studentId) {
  return db.iqroProgress.where('studentId').equals(studentId).reverse().sortBy('recordedAt');
}

export async function getClassIqroProgress(classId) {
  const links = await db.classStudents.where('classId').equals(classId).toArray();
  const sids = links.map(l => l.studentId);
  if (!sids.length) return [];
  const all = await db.iqroProgress.where('studentId').anyOf(sids).toArray();
  const students = await db.students.bulkGet(sids);
  const smap = {};
  students.forEach(s => { if (s) smap[s.id] = s.name; });
  return all.map(h => ({ ...h, studentName: smap[h.studentId] || '?' }));
}
