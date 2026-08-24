import type { UUID, BaseEntity } from './index';

export type AttendanceStatus = 'hadir' | 'izin' | 'sakit' | 'alpha';

export interface ClassSession extends BaseEntity {
  class_id: UUID;
  teacher_id?: UUID;
  session_date: string;
  start_time?: string;
  end_time?: string;
  topic?: string;
  material_id?: UUID;
  notes?: string;
  // Joined
  class_name?: string;
  teacher_name?: string;
  attendance_count?: number;
}

export interface Attendance extends BaseEntity {
  session_id: UUID;
  student_id: UUID;
  status: AttendanceStatus;
  notes?: string;
  check_in_time?: string;
  // Joined
  student_name?: string;
}

export interface AttendanceInput {
  student_id: string;
  status: AttendanceStatus;
  notes?: string;
}

export interface AttendanceSummary {
  student_id: UUID;
  student_name: string;
  total_sessions: number;
  hadir: number;
  izin: number;
  sakit: number;
  alpha: number;
  percentage: number;
}
