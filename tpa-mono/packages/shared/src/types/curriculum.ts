import type { UUID, BaseEntity } from './index';

export interface CurriculumCategory extends Omit<BaseEntity, 'updated_at'> {
  location_id: UUID;
  name: string;
  description?: string;
  sort_order: number;
  is_active: boolean;
}

export interface CurriculumMaterial extends BaseEntity {
  category_id: UUID;
  title: string;
  description?: string;
  content?: string;
  level?: string;
  sort_order: number;
  duration_minutes?: number;
  attachments: Array<{ name: string; url: string; type: string }>;
  is_active: boolean;
  // Joined
  category_name?: string;
}

export interface CurriculumMaterialFormData {
  category_id: string;
  title: string;
  description?: string;
  content?: string;
  level?: string;
  sort_order?: number;
  duration_minutes?: number;
  is_active: boolean;
}

export interface ClassCurriculum {
  id: UUID;
  class_id: UUID;
  material_id: UUID;
  target_date?: string;
  is_completed: boolean;
  completed_at?: string;
  notes?: string;
  // Joined
  material_title?: string;
}
