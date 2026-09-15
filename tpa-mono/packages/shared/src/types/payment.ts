import type { UUID, BaseEntity } from './index';

export type PaymentStatus = 'pending' | 'paid' | 'partial' | 'overdue';
export type PaymentMethod = 'tunai' | 'transfer' | 'qris';

export interface SppType {
  id: UUID;
  location_id: UUID;
  name: string;
  amount: number;
  is_recurring: boolean;
  description?: string;
  is_active: boolean;
  created_at: string;
}

export interface SppBill extends BaseEntity {
  student_id: UUID;
  spp_type_id?: UUID;
  academic_year_id?: UUID;
  bill_month: string;
  amount: number;
  paid_amount: number;
  status: PaymentStatus;
  due_date?: string;
  notes?: string;
  // Joined
  student_name?: string;
  spp_type_name?: string;
}

export interface Payment {
  id: UUID;
  bill_id: UUID;
  student_id?: UUID;
  amount: number;
  method: PaymentMethod;
  receipt_number?: string;
  paid_by?: string;
  notes?: string;
  paid_at: string;
  created_by?: UUID;
  created_at: string;
}

export interface PaymentFormData {
  bill_id: string;
  amount: number;
  method: PaymentMethod;
  paid_by?: string;
  notes?: string;
}

export interface PaymentSummary {
  total_bills: number;
  total_amount: number;
  total_paid: number;
  total_pending: number;
  total_overdue: number;
}
