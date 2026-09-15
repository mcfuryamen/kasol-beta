// ============================================================
// KASIR SOLO - TPA | Type Definitions
// ============================================================

export * from './user';
export * from './location';
export * from './student';
export * from './teacher';
export * from './guardian';
export * from './class';
export * from './schedule';
export * from './curriculum';
export * from './attendance';
export * from './hafalan';
export * from './iqro';
export * from './assessment';
export * from './payment';
export * from './cash-flow';
export * from './certificate';
export * from './project';
export * from './notification';

// Common types
export type UUID = string;
export type Gender = 'L' | 'P';
export type DayOfWeek = 'senin' | 'selasa' | 'rabu' | 'kamis' | 'jumat' | 'sabtu' | 'minggu';

export interface BaseEntity {
  id: UUID;
  created_at: string;
  updated_at: string;
}

export interface PaginationParams {
  page: number;
  limit: number;
  search?: string;
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}

export interface SelectOption {
  value: string;
  label: string;
}

export interface FilterState {
  search: string;
  location_id?: string;
  class_id?: string;
  status?: string;
  date_from?: string;
  date_to?: string;
}
