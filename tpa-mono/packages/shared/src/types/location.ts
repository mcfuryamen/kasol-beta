import type { UUID, BaseEntity } from './index';

export interface Location extends BaseEntity {
  name: string;
  address?: string;
  phone?: string;
  email?: string;
  head_name?: string;
  logo_url?: string;
  is_active: boolean;
  settings: Record<string, unknown>;
}

export interface LocationFormData {
  name: string;
  address?: string;
  phone?: string;
  email?: string;
  head_name?: string;
  is_active: boolean;
}
