import type { UUID, BaseEntity } from './index';

export interface Class extends BaseEntity {
  location_id: UUID;
  academic_year_id?: UUID;
  name: string;
  level?: string;
  description?: string;
  max_students: number;
  room?: string;
  is_active: boolean;
  // Joined
  teacher_names?: string[];
  student_count?: number;
}

export interface ClassFormData {
  location_id: string;
  academic_year_id?: string;
  name: string;
  level?: string;
  description?: string;
  max_students: number;
  room?: string;
  is_active: boolean;
}

export interface ClassTeacher {
  id: UUID;
  class_id: UUID;
  teacher_id: UUID;
  is_primary: boolean;
}

export interface ClassStudent {
  id: UUID;
  class_id: UUID;
  student_id: UUID;
  enrolled_at: string;
  is_active: boolean;
}

export type AcademicSemester = 'ganjil' | 'genap';

export interface AcademicYear extends BaseEntity {
  location_id: UUID;
  name: string;
  semester: AcademicSemester;
  start_date: string;
  end_date: string;
  is_active: boolean;
}
