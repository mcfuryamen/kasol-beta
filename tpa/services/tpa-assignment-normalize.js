const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value) {
  return typeof value === 'string' && UUID_PATTERN.test(value);
}

export function normalizeClassStudentAssignment(input = {}) {
  if (!isUuid(input.class_id)) throw new Error('ASSIGNMENT_CLASS_INVALID');
  if (!isUuid(input.student_id)) throw new Error('ASSIGNMENT_STUDENT_INVALID');
  return { class_id: input.class_id, student_id: input.student_id };
}

export function normalizeClassTeacherAssignment(input = {}) {
  if (!isUuid(input.class_id)) throw new Error('ASSIGNMENT_CLASS_INVALID');
  if (!isUuid(input.teacher_id)) throw new Error('ASSIGNMENT_TEACHER_INVALID');
  return { class_id: input.class_id, teacher_id: input.teacher_id, is_primary: input.is_primary === true };
}