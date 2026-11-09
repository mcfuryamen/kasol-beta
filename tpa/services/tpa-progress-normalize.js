const HAFALAN_TYPES = new Set(['ziyadah', 'murajaah', 'tasmi']);
const HAFALAN_GRADES = new Set(['mumtaz', 'jayyid_jiddan', 'jayyid', 'maqbul', 'belum_lulus']);
const IQRO_GRADES = new Set(['lancar', 'cukup', 'mengulang']);
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value) {
  return typeof value === 'string' && UUID_PATTERN.test(value);
}

function requireUuid(value, code) {
  if (!isUuid(value)) throw new Error(code);
  return value;
}

function toInt(value, code) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) throw new Error(code);
  return parsed;
}

function optionalText(value) {
  const text = value === undefined || value === null ? '' : String(value).trim();
  return text || null;
}

export function normalizeHafalanWriteInput(input = {}) {
  const studentId = requireUuid(input.student_id, 'PROGRESS_STUDENT_INVALID');
  const teacherId = requireUuid(input.teacher_id, 'PROGRESS_TEACHER_INVALID');
  const surahNumber = toInt(input.surah_number, 'PROGRESS_SURAH_INVALID');
  if (surahNumber < 1 || surahNumber > 114) throw new Error('PROGRESS_SURAH_INVALID');
  const type = String(input.type ?? '').trim();
  if (!HAFALAN_TYPES.has(type)) throw new Error('PROGRESS_TYPE_INVALID');
  const grade = String(input.grade ?? '').trim();
  if (!HAFALAN_GRADES.has(grade)) throw new Error('PROGRESS_GRADE_INVALID');
  const ayatFrom = input.ayat_from === undefined || input.ayat_from === null || input.ayat_from === '' ? null : toInt(input.ayat_from, 'PROGRESS_AYAT_INVALID');
  const ayatTo = input.ayat_to === undefined || input.ayat_to === null || input.ayat_to === '' ? null : toInt(input.ayat_to, 'PROGRESS_AYAT_INVALID');
  if (ayatFrom !== null && ayatFrom < 1) throw new Error('PROGRESS_AYAT_INVALID');
  if (ayatTo !== null && ayatTo < 1) throw new Error('PROGRESS_AYAT_INVALID');
  if (ayatFrom !== null && ayatTo !== null && ayatTo < ayatFrom) throw new Error('PROGRESS_AYAT_ORDER_INVALID');
  const juz = input.juz === undefined || input.juz === null || input.juz === '' ? null : toInt(input.juz, 'PROGRESS_JUZ_INVALID');
  if (juz !== null && (juz < 1 || juz > 30)) throw new Error('PROGRESS_JUZ_INVALID');
  return {
    student_id: studentId,
    teacher_id: teacherId,
    surah_number: surahNumber,
    surah_name: optionalText(input.surah_name),
    ayat_from: ayatFrom,
    ayat_to: ayatTo,
    juz,
    type,
    grade,
    notes: optionalText(input.notes)
  };
}

export function composeProgressWriteInput(normalized, locationId, recordedBy) {
  if (!isUuid(locationId)) throw new Error('PROGRESS_LOCATION_INVALID');
  if (!isUuid(recordedBy)) throw new Error('PROGRESS_RECORDER_INVALID');
  return { ...normalized, location_id: locationId, recorded_by: recordedBy };
}

export function normalizeIqroWriteInput(input = {}) {
  const studentId = requireUuid(input.student_id, 'PROGRESS_STUDENT_INVALID');
  const teacherId = requireUuid(input.teacher_id, 'PROGRESS_TEACHER_INVALID');
  const jilid = toInt(input.jilid, 'PROGRESS_JILID_INVALID');
  if (jilid < 1 || jilid > 6) throw new Error('PROGRESS_JILID_INVALID');
  const page = toInt(input.page, 'PROGRESS_PAGE_INVALID');
  if (page < 1) throw new Error('PROGRESS_PAGE_INVALID');
  const grade = String(input.grade ?? '').trim();
  if (!IQRO_GRADES.has(grade)) throw new Error('PROGRESS_GRADE_INVALID');
  return { student_id: studentId, teacher_id: teacherId, jilid, page, grade, notes: optionalText(input.notes) };
}