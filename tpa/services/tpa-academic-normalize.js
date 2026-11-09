export const CLASS_LEVELS = new Set(['iqro_1', 'iqro_2', 'iqro_3', 'iqro_4', 'iqro_5', 'iqro_6', 'juz_amma', 'al_quran', 'tahfidz']);
export const SCHEDULE_DAYS = new Set(['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu']);
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

function isUuid(value) { return typeof value === 'string' && UUID_PATTERN.test(value); }

function toMinutes(value) {
  const [hours, minutes] = value.split(':');
  return Number(hours) * 60 + Number(minutes);
}

export function normalizeClassWriteInput(input = {}) {
  const name = String(input.name ?? '').trim();
  if (!name) throw new Error('CLASS_NAME_REQUIRED');
  let level = input.level ? String(input.level) : null;
  if (!level) throw new Error('CLASS_LEVEL_REQUIRED');
  if (!CLASS_LEVELS.has(level)) throw new Error('CLASS_LEVEL_INVALID');
  const maxStudents = input.max_students === undefined || input.max_students === null || input.max_students === '' ? 30 : Number(input.max_students);
  if (!Number.isInteger(maxStudents) || maxStudents <= 0) throw new Error('CLASS_MAX_INVALID');
  const room = input.room ? String(input.room).trim() : null;
  return { name, level, max_students: maxStudents, room, is_active: input.is_active === false ? false : true };
}

export function normalizeScheduleWriteInput(input = {}) {
  if (!isUuid(input.class_id)) throw new Error('SCHEDULE_CLASS_INVALID');
  const day = String(input.day ?? '').trim();
  if (!SCHEDULE_DAYS.has(day)) throw new Error('SCHEDULE_DAY_INVALID');
  const startTime = String(input.start_time ?? '').trim();
  const endTime = String(input.end_time ?? '').trim();
  if (!TIME_PATTERN.test(startTime) || !TIME_PATTERN.test(endTime)) throw new Error('SCHEDULE_TIME_INVALID');
  if (toMinutes(endTime) <= toMinutes(startTime)) throw new Error('SCHEDULE_TIME_ORDER_INVALID');
  const teacherId = input.teacher_id ?? null;
  if (teacherId !== null && !isUuid(teacherId)) throw new Error('SCHEDULE_TEACHER_INVALID');
  const room = input.room ? String(input.room).trim() : null;
  return { class_id: input.class_id, day, start_time: startTime, end_time: endTime, teacher_id: teacherId, room, is_active: input.is_active === false ? false : true };
}