// ============================================================
// Dexie Database - Offline-First Primary Data Layer
// Following kak5 ecosystem architecture (Kasir Solo standard)
// ============================================================

import Dexie, { Table } from 'dexie';
import type { Student } from '../types/student';
import type { Teacher } from '../types/teacher';
import type { Class } from '../types/class';
import type { Attendance } from '../types/attendance';
import type { ClassSession } from '../types/attendance';

export type SyncTable = 'students' | 'teachers' | 'classes' | 'attendances' | 'sessions';

// Extended types with _dirty flag for sync tracking
export interface DirtyEntity {
  _dirty?: boolean;
  _synced_at?: string;
}

export type StudentRecord = Student & DirtyEntity;
export type TeacherRecord = Teacher & DirtyEntity;
export type ClassRecord = Class & DirtyEntity;
export type AttendanceRecord = Attendance & DirtyEntity;
export type SessionRecord = ClassSession & DirtyEntity;

export class TPADatabase extends Dexie {
  students!: Table<StudentRecord, string>;
  teachers!: Table<TeacherRecord, string>;
  classes!: Table<ClassRecord, string>;
  attendances!: Table<AttendanceRecord, string>;
  sessions!: Table<SessionRecord, string>;
  sync_queue!: Table<{ id: string; table: SyncTable; action: 'create' | 'update' | 'delete'; record_id: string; data: any; created_at: string }, string>;

  constructor() {
    super('tpa_offline_db');

    this.version(1).stores({
      students: 'id, location_id, guardian_id, name, gender, is_active, nis, updated_at',
      teachers: 'id, location_id, user_id, name, gender, is_active, email, updated_at',
      classes: 'id, location_id, academic_year_id, name, level, is_active, updated_at',
      attendances: 'id, session_id, student_id, status, updated_at',
      sessions: 'id, class_id, teacher_id, session_date, updated_at',
      sync_queue: 'id, table, action, record_id, created_at',
    });
  }
}

export const db = new TPADatabase();

// ============================================================
// Seed Demo Data - populate IndexedDB with sample data
// ============================================================

const DEMO_LOCATION_ID = '00000000-0000-0000-0000-000000000001';

function generateId(): string {
  return crypto.randomUUID();
}

function now(): string {
  return new Date().toISOString();
}

export async function seedDemoData(locationId: string = DEMO_LOCATION_ID): Promise<void> {
  const existing = await db.students.count();
  if (existing > 0) return; // Already seeded

  const kelasIqro1 = generateId();
  const kelasIqro2 = generateId();
  const kelasJuzAmma = generateId();

  // Seed Classes
  const classes: ClassRecord[] = [
    { id: kelasIqro1, location_id: locationId, name: 'Iqro 1', level: 'Iqro 1', description: 'Kelas Iqro tingkat 1', max_students: 20, room: 'Ruang 1', is_active: true, created_at: now(), updated_at: now() },
    { id: kelasIqro2, location_id: locationId, name: 'Iqro 2', level: 'Iqro 2', description: 'Kelas Iqro tingkat 2', max_students: 20, room: 'Ruang 2', is_active: true, created_at: now(), updated_at: now() },
    { id: kelasJuzAmma, location_id: locationId, name: 'Juz Amma', level: 'Juz Amma', description: 'Kelas Hafalan Juz Amma', max_students: 15, room: 'Ruang 3', is_active: true, created_at: now(), updated_at: now() },
  ];

  // Seed Teachers
  const ustadzAhmad = generateId();
  const ustadzFatimah = generateId();
  const teachers: TeacherRecord[] = [
    { id: ustadzAhmad, location_id: locationId, name: 'Ustadz Ahmad Fauzi', gender: 'L', phone: '081234567890', email: 'ahmad@tpa.demo', specialization: 'Hafalan Al-Quran', join_date: '2023-01-15', is_active: true, created_at: now(), updated_at: now() },
    { id: ustadzFatimah, location_id: locationId, name: 'Ustadzah Fatimah Zahra', gender: 'P', phone: '081234567891', email: 'fatimah@tpa.demo', specialization: 'Iqro & Tajwid', join_date: '2023-03-01', is_active: true, created_at: now(), updated_at: now() },
  ];

  // Seed Students
  const studentNames = [
    { name: 'Muhammad Rizki', gender: 'L' as const },
    { name: 'Aisyah Putri', gender: 'P' as const },
    { name: 'Umar ibn Khattab', gender: 'L' as const },
    { name: 'Hafizah Rahman', gender: 'P' as const },
    { name: 'Bilal ibn Rabah', gender: 'L' as const },
    { name: 'Khadijah al-Kubra', gender: 'P' as const },
    { name: 'Ali ibn Abi Thalib', gender: 'L' as const },
    { name: 'Fatimah az-Zahra', gender: 'P' as const },
    { name: 'Hassan ibn Thabit', gender: 'L' as const },
    { name: 'Zainab binti Ali', gender: 'P' as const },
    { name: 'Abdurrahman ibn Awf', gender: 'L' as const },
    { name: 'Aminah binti Wahb', gender: 'P' as const },
  ];

  const students: StudentRecord[] = studentNames.map((s, i) => ({
    id: generateId(),
    location_id: locationId,
    nis: `2024${String(i + 1).padStart(4, '0')}`,
    name: s.name,
    gender: s.gender,
    birth_date: `2015-${String((i % 12) + 1).padStart(2, '0')}-${String((i % 28) + 1).padStart(2, '0')}`,
    birth_place: 'Solo',
    address: `Jl. Demo No. ${i + 1}, Solo`,
    phone: `0812345678${String(i).padStart(2, '0')}`,
    join_date: '2024-01-10',
    is_active: true,
    created_at: now(),
    updated_at: now(),
  }));

  // Seed Sessions (today's sessions)
  const today = new Date().toISOString().split('T')[0];
  const sessions: SessionRecord[] = [
    { id: generateId(), class_id: kelasIqro1, teacher_id: ustadzFatimah, session_date: today, start_time: '08:00', end_time: '09:30', topic: 'Iqro Jilid 1 Halaman 1-5', created_at: now(), updated_at: now() },
    { id: generateId(), class_id: kelasIqro2, teacher_id: ustadzFatimah, session_date: today, start_time: '09:30', end_time: '11:00', topic: 'Iqro Jilid 2 Halaman 1-5', created_at: now(), updated_at: now() },
    { id: generateId(), class_id: kelasJuzAmma, teacher_id: ustadzAhmad, session_date: today, start_time: '13:00', end_time: '14:30', topic: 'Hafalan Surah Al-Mulk', created_at: now(), updated_at: now() },
  ];

  // Seed Attendances (for today's sessions)
  const attendances: AttendanceRecord[] = [];
  for (const session of sessions) {
    const classStudents = students.slice(0, Math.floor(3 + Math.random() * 5));
    for (const student of classStudents) {
      const statuses: Array<'hadir' | 'izin' | 'sakit' | 'alpha'> = ['hadir', 'hadir', 'hadir', 'izin', 'sakit'];
      attendances.push({
        id: generateId(),
        session_id: session.id,
        student_id: student.id,
        status: statuses[Math.floor(Math.random() * statuses.length)],
        check_in_time: new Date().toISOString(),
        created_at: now(),
        updated_at: now(),
      });
    }
  }

  // Bulk insert
  await db.transaction('rw', [db.classes, db.teachers, db.students, db.sessions, db.attendances], async () => {
    await db.classes.bulkAdd(classes);
    await db.teachers.bulkAdd(teachers);
    await db.students.bulkAdd(students);
    await db.sessions.bulkAdd(sessions);
    await db.attendances.bulkAdd(attendances);
  });

  console.log('[Dexie] Demo data seeded:', {
    students: students.length,
    teachers: teachers.length,
    classes: classes.length,
    sessions: sessions.length,
    attendances: attendances.length,
  });
}

// ============================================================
// Clear all data (for logout/reset)
// ============================================================
export async function clearAllData(): Promise<void> {
  await db.transaction('rw', [db.students, db.teachers, db.classes, db.attendances, db.sessions, db.sync_queue], async () => {
    await db.students.clear();
    await db.teachers.clear();
    await db.classes.clear();
    await db.attendances.clear();
    await db.sessions.clear();
    await db.sync_queue.clear();
  });
}
