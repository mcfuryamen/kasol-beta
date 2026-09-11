import type { UUID, BaseEntity, DayOfWeek } from './index';

export interface Schedule extends BaseEntity {
  class_id: UUID;
  teacher_id?: UUID;
  day: DayOfWeek;
  start_time: string;
  end_time: string;
  room?: string;
  is_active: boolean;
  // Joined
  class_name?: string;
  teacher_name?: string;
}

export interface ScheduleFormData {
  class_id: string;
  teacher_id?: string;
  day: DayOfWeek;
  start_time: string;
  end_time: string;
  room?: string;
  is_active: boolean;
}
