import { getSupabaseClient } from '../app-boot.js';
import { normalizeAttendanceRecords, normalizeSessionWriteInput } from './tpa-attendance-normalize.js';

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

export async function listRemoteTeacherSessions(teacherId) {
  if (!teacherId || typeof teacherId !== 'string') throw new Error('TEACHER_REQUIRED');
  await requireUser();
  const { data, error } = await client().from('tpa_class_sessions')
    .select('id,location_id,class_id,teacher_id,session_date,start_time,status,created_at')
    .eq('teacher_id', teacherId)
    .order('session_date', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function getRemoteSessionRoster(sessionId) {
  if (!sessionId || typeof sessionId !== 'string') throw new Error('SESSION_REQUIRED');
  await requireUser();
  const { data: session, error: sessionError } = await client().from('tpa_class_sessions')
    .select('id,location_id,class_id,teacher_id,session_date,start_time,status')
    .eq('id', sessionId).maybeSingle();
  if (sessionError) throw sessionError;
  if (!session) return { session: null, students: [] };
  const { data: links, error: linkError } = await client().from('tpa_class_students').select('student_id').eq('class_id', session.class_id);
  if (linkError) throw linkError;
  const ids = [...new Set((links || []).map(item => item.student_id).filter(Boolean))];
  if (!ids.length) return { session, students: [] };
  const { data: students, error: studentError } = await client().from('tpa_student_directory').select('id,nis,name,gender,is_active').in('id', ids).eq('is_active', true).order('name');
  if (studentError) throw studentError;
  return { session, students: students || [] };
}

export async function listRemoteLocationSessions(limit = 20) {
  await requireUser();
  const { data, error } = await client().from('tpa_class_sessions')
    .select('id,location_id,class_id,teacher_id,session_date,start_time,status,created_at')
    .order('session_date', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data || [];
}

export async function createRemoteSessionForClass(input, locationId) {
  const user = await requireUser();
  if (!locationId || typeof locationId !== 'string') throw new Error('LOCATION_REQUIRED');
  const payload = normalizeSessionWriteInput(input, locationId, user.id);
  const { data, error } = await client().from('tpa_class_sessions').insert(payload)
    .select('id,location_id,class_id,teacher_id,session_date,start_time,status').single();
  if (error) throw error;
  return data;
}

export async function upsertRemoteAttendance(sessionId, records, teacherId = null) {
  const user = await requireUser();
  if (!sessionId || typeof sessionId !== 'string') throw new Error('SESSION_REQUIRED');
  if (teacherId !== null && typeof teacherId !== 'string') throw new Error('TEACHER_REQUIRED');
  const { data: session, error: sessionError } = await client().from('tpa_class_sessions').select('id,location_id,teacher_id,status').eq('id', sessionId).maybeSingle();
  if (sessionError) throw sessionError;
  if (!session) throw new Error('SESSION_NOT_FOUND');
  if (teacherId && session.teacher_id !== teacherId) throw new Error('SESSION_TEACHER_MISMATCH');
  if (session.status !== 'planned') throw new Error('SESSION_NOT_EDITABLE');
  const payload = normalizeAttendanceRecords(records, session, user.id);
  if (!payload.length) return [];
  const { data, error } = await client().from('tpa_attendances').upsert(payload, { onConflict: 'session_id,student_id' }).select('*');
  if (error) throw error;
  return data || [];
}

export async function listRemoteSessionAttendance(sessionId) {
  if (!sessionId || typeof sessionId !== 'string') throw new Error('SESSION_REQUIRED');
  await requireUser();
  const { data, error } = await client().from('tpa_attendances').select('id,session_id,student_id,status,notes,recorded_by,created_at,updated_at').eq('session_id', sessionId);
  if (error) throw error;
  return data || [];
}
