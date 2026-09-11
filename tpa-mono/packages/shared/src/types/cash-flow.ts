import type { UUID, BaseEntity } from './index';

export type CashFlowType = 'masuk' | 'keluar';

export interface CashFlow extends BaseEntity {
  location_id: UUID;
  type: CashFlowType;
  category: string;
  amount: number;
  description?: string;
  reference_number?: string;
  transaction_date: string;
  created_by?: UUID;
  // Joined
  creator_name?: string;
}

export interface CashFlowFormData {
  type: CashFlowType;
  category: string;
  amount: number;
  description?: string;
  reference_number?: string;
  transaction_date?: string;
}

export interface CashFlowSummary {
  total_masuk: number;
  total_keluar: number;
  saldo: number;
  period: string;
}

export const CASH_FLOW_CATEGORIES = {
  masuk: ['SPP', 'Infaq', 'Donasi', 'Zakat', 'Sumbangan', 'Lainnya'],
  keluar: ['Gaji Guru', 'Listrik', 'Air', 'ATK', 'Konsumsi', 'Perawatan', 'Operasional', 'Lainnya']
};
