import type { UUID } from './index';

export type NotificationType = 'info' | 'warning' | 'success' | 'payment' | 'progress' | 'attendance';

export interface Notification {
  id: UUID;
  user_id: UUID;
  type: NotificationType;
  title: string;
  message: string;
  data: Record<string, unknown>;
  is_read: boolean;
  read_at?: string;
  created_at: string;
}
