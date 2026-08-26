import type { UUID, BaseEntity } from './index';

export interface Guardian extends BaseEntity {
  user_id?: UUID;
  location_id: UUID;
  name: string;
  relation?: string;
  phone?: string;
  email?: string;
  address?: string;
  occupation?: string;
  photo_url?: string;
  is_active: boolean;
  // Joined
  children?: Array<{ id: UUID; name: string }>;
}

export interface GuardianFormData {
  location_id: string;
  name: string;
  relation?: string;
  phone?: string;
  email?: string;
  address?: string;
  occupation?: string;
  is_active: boolean;
}
