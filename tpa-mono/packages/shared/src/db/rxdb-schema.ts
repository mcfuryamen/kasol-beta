// ============================================================
// RxDB Schema Definitions for Offline-First
// ============================================================

import type { RxJsonSchema } from 'rxdb';

export const studentSchema: RxJsonSchema<any> = {
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: { type: 'string', maxLength: 36 },
    location_id: { type: 'string' },
    guardian_id: { type: 'string' },
    nis: { type: 'string' },
    name: { type: 'string' },
    gender: { type: 'string', enum: ['L', 'P'] },
    birth_date: { type: 'string' },
    birth_place: { type: 'string' },
    address: { type: 'string' },
    phone: { type: 'string' },
    photo_url: { type: 'string' },
    join_date: { type: 'string' },
    is_active: { type: 'boolean' },
    notes: { type: 'string' },
    updated_at: { type: 'string' },
    _deleted: { type: 'boolean' },
  },
  required: ['id', 'name', 'gender'],
  indexes: ['location_id', 'guardian_id', 'name'],
};

export const attendanceSchema: RxJsonSchema<any> = {
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: { type: 'string', maxLength: 36 },
    session_id: { type: 'string' },
    student_id: { type: 'string' },
    status: { type: 'string', enum: ['hadir', 'izin', 'sakit', 'alpha'] },
    notes: { type: 'string' },
    check_in_time: { type: 'string' },
    updated_at: { type: 'string' },
    _deleted: { type: 'boolean' },
  },
  required: ['id', 'session_id', 'student_id', 'status'],
  indexes: ['session_id', 'student_id'],
};

export const hafalanSchema: RxJsonSchema<any> = {
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: { type: 'string', maxLength: 36 },
    student_id: { type: 'string' },
    teacher_id: { type: 'string' },
    session_id: { type: 'string' },
    type: { type: 'string', enum: ['ziyadah', 'murajaah', 'tasmi'] },
    surah_number: { type: 'integer' },
    surah_name: { type: 'string' },
    ayat_from: { type: 'integer' },
    ayat_to: { type: 'integer' },
    juz: { type: 'integer' },
    page: { type: 'integer' },
    grade: { type: 'string' },
    notes: { type: 'string' },
    recorded_at: { type: 'string' },
    updated_at: { type: 'string' },
    _deleted: { type: 'boolean' },
  },
  required: ['id', 'student_id', 'type', 'surah_number', 'grade'],
  indexes: ['student_id'],
};

export const iqroSchema: RxJsonSchema<any> = {
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: { type: 'string', maxLength: 36 },
    student_id: { type: 'string' },
    teacher_id: { type: 'string' },
    session_id: { type: 'string' },
    jilid: { type: 'integer' },
    page: { type: 'integer' },
    grade: { type: 'string', enum: ['lancar', 'cukup', 'mengulang'] },
    notes: { type: 'string' },
    recorded_at: { type: 'string' },
    updated_at: { type: 'string' },
    _deleted: { type: 'boolean' },
  },
  required: ['id', 'student_id', 'jilid', 'page', 'grade'],
  indexes: ['student_id'],
};

export const DB_COLLECTIONS = {
  students: { schema: studentSchema },
  attendances: { schema: attendanceSchema },
  hafalan_progress: { schema: hafalanSchema },
  iqro_progress: { schema: iqroSchema },
} as const;
