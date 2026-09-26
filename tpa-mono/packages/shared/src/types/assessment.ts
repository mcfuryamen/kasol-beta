import type { UUID, BaseEntity } from './index';

export interface Assessment extends BaseEntity {
  student_id: UUID;
  teacher_id?: UUID;
  academic_year_id?: UUID;
  category: string;
  score?: number;
  grade?: string;
  notes?: string;
  assessed_at: string;
  // Joined
  student_name?: string;
  teacher_name?: string;
}

export interface StudentNote extends BaseEntity {
  student_id: UUID;
  teacher_id?: UUID;
  title?: string;
  content: string;
  is_shared_with_guardian: boolean;
  // Joined
  teacher_name?: string;
}
