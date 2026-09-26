export type ShiftStatus = "open" | "closed";
export type PettyCashCategory = "operational" | "cleaning" | "maintenance" | "food" | "other";
export type CashFlowType = "in" | "out";

export type CashInCategory = "setoran_tambahan" | "pengembalian" | "lainnya";
export type CashOutCategory = "belanja_operasional" | "setor_bank" | "gaji" | "listrik_air" | "kebersihan" | "lainnya";

export interface Shift {
  id: string;
  openedBy: string;
  closedBy?: string;
  openedAt: string;
  closedAt?: string;
  openingBalance: number;
  closingBalance?: number;
  expectedCash?: number;
  difference?: number;
  totalSales?: number;
  transactionCount?: number;
  status: ShiftStatus;
  notes?: string;
}

export interface PettyCash {
  id: string;
  shiftId: string;
  description: string;
  amount: number;
  category: PettyCashCategory;
  createdBy: string;
  createdAt: string;
}

export interface CashFlow {
  id: string;
  shiftId?: string;
  type: CashFlowType;
  category: CashInCategory | CashOutCategory;
  amount: number;
  description: string;
  createdBy: string;
  createdAt: string;
}

export interface VoidRecord {
  id: string;
  orderId: string;
  orderNumber: string;
  reason: string;
  amount: number;
  type: "void" | "return";
  createdBy: string;
  createdAt: string;
}

export interface Denomination {
  value: number;
  label: string;
  count: number;
}

export const DENOMINATIONS: Denomination[] = [
  { value: 100000, label: "100.000", count: 0 },
  { value: 50000,  label: "50.000",  count: 0 },
  { value: 20000,  label: "20.000",  count: 0 },
  { value: 10000,  label: "10.000",  count: 0 },
  { value: 5000,   label: "5.000",   count: 0 },
  { value: 2000,   label: "2.000",   count: 0 },
  { value: 1000,   label: "1.000",   count: 0 },
  { value: 500,    label: "500",     count: 0 },
];
