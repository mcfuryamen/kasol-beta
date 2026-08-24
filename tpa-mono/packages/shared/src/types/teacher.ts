import type { UUID, BaseEntity, Gender } from './index';

export interface Teacher extends BaseEntity {
  user_id?: UUID;
  location_id: UUID;
  nip?: string;
  name: string;
  gender: Gender;
  phone?: string;
  email?: string;
  address?: string;
  photo_url?: string;
  specialization?: string;
  join_date?: string;
  is_active: boolean;
  notes?: string;
}

export interface TeacherFormData {
  location_id: string;
  nip?: string;
  name: string;
  gender: Gender;
  phone?: string;
  email?: string;
  address?: string;
  specialization?: string;
  join_date?: string;
  is_active: boolean;
  notes?: string;
}
