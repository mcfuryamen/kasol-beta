import { getSupabaseClient } from '../app-boot.js';
import { normalizeHafalanWriteInput, normalizeIqroWriteInput, composeProgressWriteInput, isUuid } from './tpa-progress-normalize.js';

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

const HAFALAN_COLUMNS = 'id,location_id,student_id,teacher_id,surah_number,surah_name,ayat_from,ayat_to,juz,type,grade,notes,recorded_at';
const IQRO_COLUMNS = 'id,location_id,student_id,teacher_id,jilid,page,grade,notes,recorded_at';

function requireLimit(limit) {
  const parsed = Number(limit);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 200) throw new Error('PROGRESS_LIMIT_INVALID');
  return parsed;
}

async function listProgress(table, columns, configure) {
  await requireUser();
  const { data, error } = await configure(client().from(table).select(columns));
  if (error) throw error;
  return data || [];
}

export async function listRemoteStudentHafalan(studentId, limit = 30) {
  if (!isUuid(studentId)) throw new Error('PROGRESS_STUDENT_INVALID');
  return listProgress('tpa_hafalan_progress', HAFALAN_COLUMNS, q => q.eq('student_id', studentId).order('recorded_at', { ascending: false }).limit(requireLimit(limit)));
}

export async function listRemoteStudentIqro(studentId, limit = 30) {
  if (!isUuid(studentId)) throw new Error('PROGRESS_STUDENT_INVALID');
  return listProgress('tpa_iqro_progress', IQRO_COLUMNS, q => q.eq('student_id', studentId).order('recorded_at', { ascending: false }).limit(requireLimit(limit)));
}

export async function listRemoteLocationHafalan(limit = 30) {
  return listProgress('tpa_hafalan_progress', HAFALAN_COLUMNS, q => q.order('recorded_at', { ascending: false }).limit(requireLimit(limit)));
}

export async function listRemoteLocationIqro(limit = 30) {
  return listProgress('tpa_iqro_progress', IQRO_COLUMNS, q => q.order('recorded_at', { ascending: false }).limit(requireLimit(limit)));
}

async function requireStudentLocation(studentId) {
  const { data, error } = await client().from('tpa_students').select('id,location_id').eq('id', studentId).maybeSingle();
  if (error) throw error;
  if (!data?.location_id) throw new Error('PROGRESS_STUDENT_NOT_FOUND');
  return data.location_id;
}

export async function createRemoteHafalan(input) {
  const user = await requireUser();
  const normalized = normalizeHafalanWriteInput(input);
  const payload = composeProgressWriteInput(normalized, await requireStudentLocation(normalized.student_id), user.id);
  const { data, error } = await client().from('tpa_hafalan_progress').insert(payload).select(HAFALAN_COLUMNS).single();
  if (error) throw error;
  return data;
}

export async function createRemoteIqro(input) {
  const user = await requireUser();
  const normalized = normalizeIqroWriteInput(input);
  const payload = composeProgressWriteInput(normalized, await requireStudentLocation(normalized.student_id), user.id);
  const { data, error } = await client().from('tpa_iqro_progress').insert(payload).select(IQRO_COLUMNS).single();
  if (error) throw error;
  return data;
}

export function normalizeProgressRoster(students, records) {
  const byStudent = new Map((students || []).map(item => [item.id, item]));
  return (records || []).map(record => ({ ...record, student_name: byStudent.get(record.student_id)?.name || null }));
}