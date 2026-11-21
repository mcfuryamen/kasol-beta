import { getSupabaseClient } from '../app-boot.js';
import { normalizeRemoteTeacherRoster } from './tpa-remote-normalize.js';
import { normalizeStudentWriteInput, buildStudentConsentPayload, isUuid } from './tpa-student-normalize.js';
import { normalizeClassWriteInput, normalizeScheduleWriteInput } from './tpa-academic-normalize.js';
import { normalizeClassStudentAssignment, normalizeClassTeacherAssignment } from './tpa-assignment-normalize.js';
import { requireSessionLocationId } from './tpa-session-context.js';

function client() {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error('SUPABASE_NOT_READY');
  return supabase;
}

async function requireUser() {
  const { data, error } = await client().auth.getUser();
  if (error || !data?.user) throw new Error('AUTH_REQUIRED');
  return data.user;
}

async function list(table, columns, configure = query => query) {
  await requireUser();
  let query = client().from(table).select(columns);
  query = configure(query);
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

async function one(table, id, columns = '*') {
  await requireUser();
  const { data, error } = await client().from(table).select(columns).eq('id', id).maybeSingle();
  if (error) throw error;
  return data;
}

export async function listRemoteStudents() {
  return list('tpa_student_directory', 'id,legacy_id,location_id,guardian_id,nis,name,gender,is_active', q => q.eq('is_active', true).order('name'));
}

export async function getRemoteStudent(id) {
  if (!id || typeof id !== 'string') throw new Error('STUDENT_ID_REQUIRED');
  return one('tpa_student_detail_directory', id, 'id,legacy_id,location_id,guardian_id,nis,name,gender,is_active');
}

export async function createRemoteStudent(input) {
  const user = await requireUser();
  const payload = normalizeStudentWriteInput(input);
  if (!input?.consent) throw new Error('STUDENT_CONSENT_REQUIRED');
  const { error, data } = await client().from('tpa_students')
    .insert({ ...payload, ...buildStudentConsentPayload({ consent: true, guardianId: payload.guardian_id, currentAuthUserId: user.id }), location_id: requireSessionLocationId() })
    .select('id,legacy_id,location_id,guardian_id,nis,name,gender,is_active').single();
  if (error) throw error;
  return data;
}

export async function updateRemoteStudent(id, input) {
  if (!isUuid(id)) throw new Error('STUDENT_ID_REQUIRED');
  await requireUser();
  const { error, data } = await client().from('tpa_students')
    .update(normalizeStudentWriteInput(input))
    .eq('id', id)
    .select('id,legacy_id,location_id,guardian_id,nis,name,gender,is_active').single();
  if (error) throw error;
  return data;
}

export async function archiveRemoteStudent(id) {
  if (!isUuid(id)) throw new Error('STUDENT_ID_REQUIRED');
  await requireUser();
  const { error, data } = await client().from('tpa_students').update({ is_active: false }).eq('id', id)
    .select('id,legacy_id,location_id,guardian_id,nis,name,gender,is_active').single();
  if (error) throw error;
  return data;
}

export async function listRemoteClasses() {
  return list('tpa_classes', 'id,legacy_id,location_id,name,level,max_students,room,is_active,created_at,updated_at', q => q.eq('is_active', true).order('name'));
}

const CLASS_COLUMNS = 'id,legacy_id,location_id,name,level,max_students,room,is_active';
const SCHEDULE_COLUMNS = 'id,legacy_id,location_id,class_id,teacher_id,day,start_time,end_time,room,is_active';

export async function createRemoteClass(input) {
  await requireUser();
  const { data, error } = await client().from('tpa_classes').insert({ ...normalizeClassWriteInput(input), location_id: requireSessionLocationId() }).select(CLASS_COLUMNS).single();
  if (error) throw error;
  return data;
}

export async function updateRemoteClass(id, input) {
  if (!isUuid(id)) throw new Error('CLASS_ID_REQUIRED');
  await requireUser();
  const { data, error } = await client().from('tpa_classes').update(normalizeClassWriteInput(input)).eq('id', id).select(CLASS_COLUMNS).single();
  if (error) throw error;
  return data;
}

export async function archiveRemoteClass(id) {
  if (!isUuid(id)) throw new Error('CLASS_ID_REQUIRED');
  await requireUser();
  const { data, error } = await client().from('tpa_classes').update({ is_active: false }).eq('id', id).select(CLASS_COLUMNS).single();
  if (error) throw error;
  return data;
}

export async function createRemoteSchedule(input) {
  await requireUser();
  const { data, error } = await client().from('tpa_schedules').insert({ ...normalizeScheduleWriteInput(input), location_id: requireSessionLocationId() }).select(SCHEDULE_COLUMNS).single();
  if (error) throw error;
  return data;
}

export async function updateRemoteSchedule(id, input) {
  if (!isUuid(id)) throw new Error('SCHEDULE_ID_REQUIRED');
  await requireUser();
  const { data, error } = await client().from('tpa_schedules').update(normalizeScheduleWriteInput(input)).eq('id', id).select(SCHEDULE_COLUMNS).single();
  if (error) throw error;
  return data;
}

export async function archiveRemoteSchedule(id) {
  if (!isUuid(id)) throw new Error('SCHEDULE_ID_REQUIRED');
  await requireUser();
  const { data, error } = await client().from('tpa_schedules').update({ is_active: false }).eq('id', id).select(SCHEDULE_COLUMNS).single();
  if (error) throw error;
  return data;
}

export async function listRemoteTeachers() {
  return list('tpa_teacher_directory', 'id,legacy_id,location_id,name,gender,specialization,qualification,tartil,is_active', q => q.eq('is_active', true).order('name'));
}

export async function listRemoteGuardians() {
  return list('tpa_guardian_directory', 'id,legacy_id,location_id,name,relation,is_active', q => q.eq('is_active', true).order('name'));
}

export async function listRemoteSchedules() {
  return list('tpa_schedules', 'id,legacy_id,location_id,class_id,teacher_id,day,start_time,end_time,room,is_active', q => q.eq('is_active', true).order('day').order('start_time'));
}

export async function listRemoteClassStudents(classId) {
  return list('tpa_class_students', 'id,class_id,student_id,location_id,created_at', q => q.eq('class_id', classId));
}

export async function listRemoteClassTeachers(classId) {
  return list('tpa_class_teachers', 'id,class_id,teacher_id,location_id,is_primary,created_at', q => q.eq('class_id', classId));
}

const ASSIGNMENT_COLUMNS = 'id,class_id,teacher_id,location_id,is_primary,created_at';

export async function assignRemoteStudent(input) {
  await requireUser();
  const payload = normalizeClassStudentAssignment(input);
  const { data, error } = await client().from('tpa_class_students').insert({ ...payload, location_id: requireSessionLocationId() }).select('id,class_id,student_id,location_id,created_at').single();
  if (error) throw error;
  return data;
}

export async function unassignRemoteStudent(linkId) {
  if (!isUuid(linkId)) throw new Error('ASSIGNMENT_ID_INVALID');
  await requireUser();
  const { error } = await client().from('tpa_class_students').delete().eq('id', linkId);
  if (error) throw error;
  return true;
}

export async function assignRemoteTeacher(input) {
  await requireUser();
  const payload = normalizeClassTeacherAssignment(input);
  const { data, error } = await client().from('tpa_class_teachers').insert({ ...payload, location_id: requireSessionLocationId() }).select(ASSIGNMENT_COLUMNS).single();
  if (error) throw error;
  return data;
}

export async function unassignRemoteTeacher(linkId) {
  if (!isUuid(linkId)) throw new Error('ASSIGNMENT_ID_INVALID');
  await requireUser();
  const { error } = await client().from('tpa_class_teachers').delete().eq('id', linkId);
  if (error) throw error;
  return true;
}

function requireTeacherId(teacherId) {
  if (!teacherId || typeof teacherId !== 'string') throw new Error('TEACHER_REQUIRED');
  return teacherId;
}

export async function listRemoteTeacherClasses(teacherId) {
  const teacher = requireTeacherId(teacherId);
  await requireUser();
  const supabase = client();
  const { data: assignments, error: assignmentError } = await supabase
    .from('tpa_class_teachers')
    .select('class_id,is_primary')
    .eq('teacher_id', teacher);
  if (assignmentError) throw assignmentError;
  const ids = [...new Set((assignments || []).map(item => item.class_id).filter(Boolean))];
  if (!ids.length) return [];
  const { data: classes, error: classError } = await supabase
    .from('tpa_classes')
    .select('id,legacy_id,location_id,name,level,max_students,room,is_active')
    .in('id', ids)
    .eq('is_active', true)
    .order('name');
  if (classError) throw classError;
  const primaryByClass = new Map((assignments || []).map(item => [item.class_id, item.is_primary]));
  return (classes || []).map(item => ({ ...item, is_primary: primaryByClass.get(item.id) === true }));
}

export async function listRemoteTeacherStudents(teacherId) {
  const classes = await listRemoteTeacherClasses(teacherId);
  if (!classes.length) return [];
  const classIds = classes.map(item => item.id);
  await requireUser();
  const supabase = client();
  const { data: links, error: linkError } = await supabase
    .from('tpa_class_students')
    .select('class_id,student_id')
    .in('class_id', classIds);
  if (linkError) throw linkError;
  const studentIds = [...new Set((links || []).map(item => item.student_id).filter(Boolean))];
  if (!studentIds.length) return [];
  const { data: students, error: studentError } = await supabase
    .from('tpa_students')
    .select('id,nis,name,gender,is_active,guardian_id')
    .in('id', studentIds)
    .eq('is_active', true)
    .order('name');
  if (studentError) throw studentError;
  const classById = new Map(classes.map(item => [item.id, item]));
  const studentById = new Map((students || []).map(item => [item.id, item]));
  return (links || []).map(link => {
    const student = studentById.get(link.student_id);
    const cls = classById.get(link.class_id);
    return student && cls ? { ...student, class_id: cls.id, class_name: cls.name, class_level: cls.level } : null;
  }).filter(Boolean);
}

export async function listRemoteTeacherSchedules(teacherId) {
  const teacher = requireTeacherId(teacherId);
  await requireUser();
  const supabase = client();
  const { data: schedules, error: scheduleError } = await supabase
    .from('tpa_schedules')
    .select('id,class_id,teacher_id,day,start_time,end_time,room,is_active')
    .eq('teacher_id', teacher)
    .eq('is_active', true)
    .order('day')
    .order('start_time');
  if (scheduleError) throw scheduleError;
  const classIds = [...new Set((schedules || []).map(item => item.class_id).filter(Boolean))];
  if (!classIds.length) return [];
  const { data: classes, error: classError } = await supabase
    .from('tpa_classes')
    .select('id,name,level')
    .in('id', classIds);
  if (classError) throw classError;
  const classById = new Map((classes || []).map(item => [item.id, item]));
  return (schedules || []).map(item => ({ ...item, class_name: classById.get(item.class_id)?.name || '-' }));
}

