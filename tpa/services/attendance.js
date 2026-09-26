/**
 * Attendance Service
 * Semua operasi data Kehadiran dan Sesi Kelas
 */
import { db } from '../db/dexie.js';
import { querySessionAttendances, queryStudentAttendances } from '../db/dexie.js';

/** Buat sesi kelas baru */
export async function createSession(classId, teacherId, sessionDate, startTime) {
  const id = await db.classSessions.add({
    classId, teacherId, sessionDate, startTime,
    status: 'planned'
  });
  return id;
}

/** Ambil sesi */
export async function getSession(id) {
  return db.classSessions.get(id);
}

/** Ambil semua sesi kelas */
export async function getClassSessions(classId) {
  return db.classSessions.where('classId').equals(classId).reverse().sortBy('sessionDate');
}

/** Ambil sesi hari ini untuk kelas */
export async function getTodaySessions(classId) {
  const today = new Date().toISOString().split('T')[0];
  return db.classSessions
    .where('classId').equals(classId)
    .and(s => s.sessionDate === today)
    .toArray();
}

/** Catat kehadiran */
export async function recordAttendance(sessionId, studentId, status, notes = '') {
  const existing = await db.attendances
    .where('sessionId').equals(sessionId)
    .and(a => a.studentId === studentId)
    .first();
  if (existing) {
    await db.attendances.update(existing.id, { status, notes });
    return existing.id;
  }
  return db.attendances.add({ sessionId, studentId, status, notes });
}

/** Bulk record attendance */
export async function bulkRecordAttendance(sessionId, records) {
  // records: [{studentId, status, notes}]
  for (const r of records) {
    await recordAttendance(sessionId, r.studentId, r.status, r.notes || '');
  }
}

/** Get semua kehadiran Santi di satu sesi */
export async function getSessionAttendances(sessionId) {
  return querySessionAttendances(sessionId);
}

/** Get histori kehadiran Santi */
export async function getStudentAttendances(studentId) {
  return queryStudentAttendances(studentId);
}

/** Get statistik kehadiran Santi */
export async function getStudentAttendanceStats(studentId) {
  const all = await getStudentAttendances(studentId);
  const total = all.length;
  if (total === 0) return { total: 0, hadir: 0, izin: 0, sakit: 0, alpha: 0 };
  const hadir = all.filter(a => a.status === 'hadir').length;
  const izin = all.filter(a => a.status === 'izin').length;
  const sakit = all.filter(a => a.status === 'sakit').length;
  const alpha = all.filter(a => a.status === 'alpha').length;
  return { total, hadir, izin, sakit, alpha };
}

/** Get statistik kehadiran kelas */
export async function getClassAttendanceStats(classId, sessionId) {
  const attendances = await getSessionAttendances(sessionId);
  const total = attendances.length;
  if (total === 0) return {};
  return {
    total,
    hadir: attendances.filter(a => a.status === 'hadir').length,
    izin: attendances.filter(a => a.status === 'izin').length,
    sakit: attendances.filter(a => a.status === 'sakit').length,
    alpha: attendances.filter(a => a.status === 'alpha').length
  };
}
