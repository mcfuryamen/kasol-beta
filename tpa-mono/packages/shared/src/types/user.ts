import type { UUID, BaseEntity } from './index';

export type UserRole = 'admin' | 'ustadz' | 'wali';

export interface User extends BaseEntity {
  auth_id?: UUID;
  email?: string;
  phone?: string;
  name: string;
  role: UserRole;
  avatar_url?: string;
  location_id?: UUID;
  is_active: boolean;
  last_login?: string;
  settings: Record<string, unknown>;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}
