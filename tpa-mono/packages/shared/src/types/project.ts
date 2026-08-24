import type { UUID, BaseEntity } from './index';

export type ProjectStatus = 'planned' | 'in_progress' | 'completed' | 'cancelled';
export type ProjectPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface Project extends BaseEntity {
  location_id: UUID;
  title: string;
  description?: string;
  status: ProjectStatus;
  priority: ProjectPriority;
  start_date?: string;
  due_date?: string;
  completed_at?: string;
  budget?: number;
  spent: number;
  assigned_to?: UUID;
  created_by?: UUID;
  tags: string[];
  // Joined
  assigned_name?: string;
  task_count?: number;
  completed_tasks?: number;
}

export interface ProjectFormData {
  title: string;
  description?: string;
  status: ProjectStatus;
  priority: ProjectPriority;
  start_date?: string;
  due_date?: string;
  budget?: number;
  assigned_to?: string;
  tags?: string[];
}

export interface ProjectTask extends BaseEntity {
  project_id: UUID;
  title: string;
  description?: string;
  status: ProjectStatus;
  priority: ProjectPriority;
  assigned_to?: UUID;
  due_date?: string;
  completed_at?: string;
  sort_order: number;
  // Joined
  assigned_name?: string;
}

export interface ProjectComment {
  id: UUID;
  project_id: UUID;
  task_id?: UUID;
  user_id?: UUID;
  content: string;
  created_at: string;
  // Joined
  user_name?: string;
}
