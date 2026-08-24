import type { UUID, BaseEntity } from './index';

export type IqroGrade = 'lancar' | 'cukup' | 'mengulang';

export interface IqroProgress extends BaseEntity {
  student_id: UUID;
  teacher_id?: UUID;
  session_id?: UUID;
  jilid: number;
  page: number;
  grade: IqroGrade;
  notes?: string;
  recorded_at: string;
  // Joined
  student_name?: string;
  teacher_name?: string;
}

export interface IqroFormData {
  student_id: string;
  jilid: number;
  page: number;
  grade: IqroGrade;
  notes?: string;
}

export interface IqroSummary {
  student_id: UUID;
  student_name: string;
  current_jilid: number;
  current_page: number;
  total_entries: number;
  is_graduated: boolean;
}

export const IQRO_JILID_PAGES: Record<number, number> = {
  1: 35, 2: 32, 3: 32, 4: 32, 5: 32, 6: 32
};
