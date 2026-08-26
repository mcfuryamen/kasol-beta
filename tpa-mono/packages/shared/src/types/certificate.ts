import type { UUID } from './index';

export type CertificateType = 'khatam_iqro' | 'khatam_quran' | 'hafalan' | 'kelulusan' | 'penghargaan';

export interface Certificate {
  id: UUID;
  student_id: UUID;
  type: CertificateType;
  title: string;
  description?: string;
  certificate_number?: string;
  issued_date: string;
  issued_by?: string;
  template: Record<string, unknown>;
  created_at: string;
  // Joined
  student_name?: string;
}

export interface ReportCard {
  id: UUID;
  student_id: UUID;
  academic_year_id?: UUID;
  class_id?: UUID;
  attendance_summary: Record<string, number>;
  hafalan_summary: Record<string, unknown>;
  iqro_summary: Record<string, unknown>;
  assessment_summary: Record<string, unknown>;
  teacher_notes?: string;
  head_notes?: string;
  is_published: boolean;
  published_at?: string;
  created_at: string;
  updated_at: string;
  // Joined
  student_name?: string;
  class_name?: string;
  academic_year_name?: string;
}
