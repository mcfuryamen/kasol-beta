// ============================================================
// Data Service Layer - Primary Dexie CRUD operations
// All mutations write to Dexie first, queue for Supabase sync
// ============================================================

import { db, seedDemoData, clearAllData, type StudentRecord, type TeacherRecord, type ClassRecord, type AttendanceRecord, type SessionRecord } from '../db/dexie';
import { queueChange } from './sync-queue';
import type { Student, StudentFormData } from '../types/student';
import type { Teacher, TeacherFormData } from '../types/teacher';
import type { Class, ClassFormData } from '../types/class';
import type { Attendance, AttendanceInput } from '../types/attendance';
import type { ClassSession } from '../types/attendance';

const DEMO_LOCATION_ID = '00000000-0000-0000-0000-000000000001';

function generateId(): string {
  return crypto.randomUUID();
}

function now(): string {
  return new Date().toISOString();
}

// ============================================================
// STUDENTS
// ============================================================

export async function getStudents(locationId: string = DEMO_LOCATION_ID): Promise<Student[]> {
  return db.students.where('location_id').equals(locationId).reverse().sortBy('created_at');
}

export async function getStudentById(id: string): Promise<Student | undefined> {
  return db.students.get(id);
}

export async function createStudent(data: StudentFormData, locationId: string = DEMO_LOCATION_ID): Promise<Student> {
  const id = generateId();
  const record: StudentRecord = {
    ...data,
    id,
    location_id: locationId,
    created_at: now(),
    updated_at: now(),
    _dirty: true,
  };

  await db.students.add(record);
  await queueChange('students', 'create', id, { ...record });

  return record;
}

export async function updateStudent(id: string, data: Partial<StudentFormData>): Promise<void> {
  const updated = { ...data, updated_at: now(), _dirty: true };
  await db.students.update(id, updated);
  await queueChange('students', 'update', id, updated);
}

export async function deleteStudent(id: string): Promise<void> {
  await db.students.delete(id);
  await queueChange('students', 'delete', id, { id });
}

// ============================================================
// TEACHERS
// ============================================================

export async function getTeachers(locationId: string = DEMO_LOCATION_ID): Promise<Teacher[]> {
  return db.teachers.where('location_id').equals(locationId).reverse().sortBy('created_at');
}

export async function getTeacherById(id: string): Promise<Teacher | undefined> {
  return db.teachers.get(id);
}

export async function createTeacher(data: TeacherFormData, locationId: string = DEMO_LOCATION_ID): Promise<Teacher> {
  const id = generateId();
  const record: TeacherRecord = {
    ...data,
    id,
    location_id: locationId,
    created_at: now(),
    updated_at: now(),
    _dirty: true,
  };

  await db.teachers.add(record);
  await queueChange('teachers', 'create', id, record);

  return record;
}

export async function updateTeacher(id: string, data: Partial<TeacherFormData>): Promise<void> {
  const updated = { ...data, updated_at: now(), _dirty: true };
  await db.teachers.update(id, updated);
  await queueChange('teachers', 'update', id, updated);
}

export async function deleteTeacher(id: string): Promise<void> {
  await db.teachers.delete(id);
  await queueChange('teachers', 'delete', id, { id });
}

// ============================================================
// CLASSES
// ============================================================

export async function getClasses(locationId: string = DEMO_LOCATION_ID): Promise<Class[]> {
  return db.classes.where('location_id').equals(locationId).filter(c => c.is_active).reverse().sortBy('created_at');
}

export async function getAllClasses(locationId: string = DEMO_LOCATION_ID): Promise<Class[]> {
  return db.classes.where('location_id').equals(locationId).reverse().sortBy('created_at');
}

export async function getClassById(id: string): Promise<Class | undefined> {
  return db.classes.get(id);
}

export async function createClass(data: ClassFormData, locationId: string = DEMO_LOCATION_ID): Promise<Class> {
  const id = generateId();
  const record: ClassRecord = {
    ...data,
    id,
    location_id: locationId,
    created_at: now(),
    updated_at: now(),
    _dirty: true,
  };

  await db.classes.add(record);
  await queueChange('classes', 'create', id, record);

  return record;
}

export async function updateClass(id: string, data: Partial<ClassFormData>): Promise<void> {
  const updated = { ...data, updated_at: now(), _dirty: true };
  await db.classes.update(id, updated);
  await queueChange('classes', 'update', id, updated);
}

export async function deleteClass(id: string): Promise<void> {
  await db.classes.delete(id);
  await queueChange('classes', 'delete', id, { id });
}

// ============================================================
// SESSIONS
// ============================================================

export async function getSessions(locationId: string = DEMO_LOCATION_ID): Promise<ClassSession[]> {
  return db.sessions.where('location_id').equals(locationId).reverse().sortBy('created_at');
}

export async function getSessionById(id: string): Promise<ClassSession | undefined> {
  return db.sessions.get(id);
}

export async function createSession(data: Partial<ClassSession>, locationId: string = DEMO_LOCATION_ID): Promise<ClassSession> {
  const id = generateId();
  const record: SessionRecord = {
    ...data,
    id,
    location_id: locationId,
    session_date: data.session_date || new Date().toISOString().split('T')[0],
    is_active: true,
    created_at: now(),
    updated_at: now(),
    _dirty: true,
  } as SessionRecord;

  await db.sessions.add(record);
  await queueChange('sessions', 'create', id, record);

  return record;
}

// ============================================================
// ATTENDANCES
// ============================================================

export async function getAttendancesBySession(sessionId: string): Promise<Attendance[]> {
  return db.attendances.where('session_id').equals(sessionId).toArray();
}

export async function getAttendancesByStudent(studentId: string): Promise<Attendance[]> {
  return db.attendances.where('student_id').equals(studentId).toArray();
}

export async function upsertAttendance(sessionId: string, input: AttendanceInput): Promise<Attendance> {
  const existing = await db.attendances
    .where('session_id').equals(sessionId)
    .and(r => r.student_id === input.student_id)
    .first();

  if (existing) {
    const updated = { ...input, updated_at: now(), _dirty: true };
    await db.attendances.update(existing.id, updated);
    await queueChange('attendances', 'update', existing.id, updated);
    return { ...existing, ...updated } as Attendance;
  } else {
    const id = generateId();
    const record: AttendanceRecord = {
      id,
      session_id: sessionId,
      student_id: input.student_id,
      status: input.status,
      notes: input.notes,
      check_in_time: now(),
      created_at: now(),
      updated_at: now(),
      _dirty: true,
    };
    await db.attendances.add(record);
    await queueChange('attendances', 'create', id, record);
    return record;
  }
}

// ============================================================
// DASHBOARD STATS
// ============================================================

export interface DashboardStats {
  totalStudents: number;
  activeStudents: number;
  totalTeachers: number;
  activeTeachers: number;
  totalClasses: number;
  todayAttendance: number;
}

export async function getDashboardStats(locationId: string = DEMO_LOCATION_ID): Promise<DashboardStats> {
  const today = new Date().toISOString().split('T')[0];

  const [students, teachers, classes, sessions] = await Promise.all([
    db.students.where('location_id').equals(locationId).toArray(),
    db.teachers.where('location_id').equals(locationId).toArray(),
    db.classes.where('location_id').equals(locationId).filter(c => c.is_active).toArray(),
    db.sessions.where('session_date').equals(today).toArray(),
  ]);

  const sessionIds = sessions.map((s: ClassSession) => s.id);
  const todayAttendances = sessionIds.length > 0
    ? await db.attendances.where('session_id').anyOf(sessionIds).toArray()
    : [];

  return {
    totalStudents: students.length,
    activeStudents: students.filter(s => s.is_active).length,
    totalTeachers: teachers.length,
    activeTeachers: teachers.filter(t => t.is_active).length,
    totalClasses: classes.length,
    todayAttendance: todayAttendances.filter(a => a.status === 'hadir').length,
  };
}

// ============================================================
// INIT & CLEAR
// ============================================================

export async function initOfflineData(locationId: string = DEMO_LOCATION_ID): Promise<void> {
  await seedDemoData(locationId);
}

export { clearAllData };
