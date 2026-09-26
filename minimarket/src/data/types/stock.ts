export type StockMovementType = "purchase" | "sale" | "adjustment" | "damaged" | "expired" | "return";

export interface StockMovement {
  id: string;
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
  productId: string;
  batchNumber: string;
  expiryDate: string;
  qty: number;
  createdAt: string;
}
