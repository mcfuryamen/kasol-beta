export type StockMovementType = "purchase" | "sale" | "adjustment" | "damaged" | "expired" | "return" | "initial";

export interface StockMovement {
  id: string;
  outlet_id?: string;
  productId: string;
  productName: string;
  type: StockMovementType;
  qty: number;
  referenceId?: string;
  notes?: string;
  createdAt: string;
  createdBy?: string;
}

export interface StockOpname {
  id: string;
  outlet_id?: string;
  productId: string;
  productName: string;
  systemStock: number;
  physicalStock: number;
  variance: number;
  notes?: string;
  createdAt: string;
  createdBy: string;
}

export interface BatchInfo {
  id: string;
  outlet_id?: string;
  productId: string;
  batchNumber: string;
  expiryDate: string;
  qty: number;
  createdAt: string;
}
