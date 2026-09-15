import type { UUID, BaseEntity, Gender } from './index';

export interface Student extends BaseEntity {
  location_id: UUID;
  guardian_id?: UUID;
  nis?: string;
  name: string;
  gender: Gender;
  birth_date?: string;
  birth_place?: string;
  address?: string;
  phone?: string;
  photo_url?: string;
  join_date: string;
  previous_education?: string;
  health_notes?: string;
  is_active: boolean;
  notes?: string;
  // Joined
  guardian_name?: string;
  class_names?: string[];
}

export interface StudentFormData {
  location_id: string;
  guardian_id?: string;
  nis?: string;
  name: string;
  gender: Gender;
  birth_date?: string;
  birth_place?: string;
  address?: string;
  phone?: string;
  join_date?: string;
  previous_education?: string;
  health_notes?: string;
  is_active: boolean;
  notes?: string;
}
