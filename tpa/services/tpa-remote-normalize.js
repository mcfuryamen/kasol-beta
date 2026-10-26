export function normalizeRemoteTeacherRoster(classes, students) {
  const countByClass = new Map();
  for (const student of students || []) countByClass.set(student.class_id, (countByClass.get(student.class_id) || 0) + 1);
  return (classes || []).map(item => ({ ...item, student_count: countByClass.get(item.id) || 0 }));
}
