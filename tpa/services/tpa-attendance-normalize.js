const SESSION_STATUSES = new Set(['planned', 'completed', 'cancelled']);
const ATTENDANCE_STATUSES = new Set(['hadir', 'izin', 'sakit', 'alpha']);

export function normalizeAttendanceRecords(records, session, recordedBy) {
  if (!session || typeof session !== 'object' || typeof session.id !== 'string') throw new Error('SESSION_REQUIRED');
  if (typeof session.location_id !== 'string') throw new Error('LOCATION_REQUIRED');
  if (!recordedBy || typeof recordedBy !== 'string') throw new Error('RECORDER_REQUIRED');
  const byStudent = new Map();
  for (const record of records || []) {
    if (!record?.student_id || typeof record.student_id !== 'string') throw new Error('STUDENT_REQUIRED');
    if (!ATTENDANCE_STATUSES.has(record.status)) throw new Error('ATTENDANCE_STATUS_INVALID');
    byStudent.set(record.student_id, {
      location_id: session.location_id,
      session_id: session.id,
      student_id: record.student_id,
      status: record.status,
      notes: record.notes || null,
      recorded_by: recordedBy
    });
  }
  return [...byStudent.values()];
}

export function validateSessionInput(input) {
  if (!input || typeof input.class_id !== 'string' || typeof input.teacher_id !== 'string') throw new Error('SESSION_SUBJECT_REQUIRED');
  if (!input.location_id || typeof input.location_id !== 'string') throw new Error('LOCATION_REQUIRED');
  if (!input.session_date || !input.start_time) throw new Error('SESSION_TIME_REQUIRED');
  if (input.status && !SESSION_STATUSES.has(input.status)) throw new Error('SESSION_STATUS_INVALID');
  return {
    location_id: input.location_id,
    class_id: input.class_id,
    teacher_id: input.teacher_id,
    session_date: input.session_date,
    start_time: input.start_time,
    status: input.status || 'planned'
  };
}

export function normalizeSessionWriteInput(input, locationId, createdBy) {
  if (!locationId || typeof locationId !== 'string') throw new Error('LOCATION_REQUIRED');
  if (!createdBy || typeof createdBy !== 'string') throw new Error('CREATOR_REQUIRED');
  return { ...validateSessionInput({ ...input, location_id: locationId }), created_by: createdBy };
}
