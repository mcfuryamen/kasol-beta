/**
 * Session Service
 * Jadwal & sesi kelas mingguan
 */
import { db } from '../db/dexie.js';

/** Tambah jadwal mingguan */
export async function addSchedule(data) {
  return db.schedules.add({ ...data, isActive: true });
}

/** Update jadwal */
export async function updateSchedule(id, data) {
  await db.schedules.update(id, data);
  return db.schedules.get(id);
}

/** Hapus jadwal (soft-delete) */
export async function deleteSchedule(id) {
  await db.schedules.update(id, { isActive: false });
}

/** Ambil semua jadwal kelas */
export async function getClassSchedules(classId) {
  return db.schedules.where('classId').equals(classId).and(s => s.isActive).toArray();
}

/** Ambil jadwal mingguan lengkap (dengan nama kelas & ustadz) */
export async function getWeeklySchedule(locationId) {
  const schedules = await db.schedules
    .where('locationId').equals(locationId)
    .and(s => s.isActive)
    .toArray();
  if (!schedules.length) return [];
  const cids = [...new Set(schedules.map(s => s.classId))];
  const tids = [...new Set(schedules.map(s => s.teacherId))];
  const [classes, teachers] = await Promise.all([
    db.classes.bulkGet(cids),
    db.teachers.bulkGet(tids)
  ]);
  const cmap = {};
  classes.forEach(c => { if (c) cmap[c.id] = c.name; });
  const tmap = {};
  teachers.forEach(t => { if (t) tmap[t.id] = t.name; });
  return schedules.map(s => ({
    ...s,
    className: cmap[s.classId] || '?',
    teacherName: tmap[s.teacherId] || '?'
  }));
}

/** Ambil jadwal berdasarkan hari */
export async function getScheduleByDay(locationId, day) {
  const all = await getWeeklySchedule(locationId);
  return all.filter(s => s.day === day);
}

/** Cek konflik jadwal (ustadz double-booking) */
export async function checkScheduleConflict(teacherId, day, startTime, endTime, excludeId = null) {
  const schedules = await db.schedules
    .where('teacherId').equals(teacherId)
    .and(s => s.day === day && s.isActive)
    .toArray();
  const filtered = excludeId ? schedules.filter(s => s.id !== excludeId) : schedules;
  return filtered.some(s => {
    return !(endTime <= s.startTime || startTime >= s.endTime);
  });
}

/** Statistik jadwal */
export async function getScheduleStats(locationId) {
  const all = await db.schedules
    .where('locationId').equals(locationId)
    .and(s => s.isActive)
    .toArray();
  return { total: all.length };
}
