export type POStatus = "draft" | "approved" | "ordered" | "received";

export interface Supplier {
  id: string;
  name: string;
  contact: string;
  phone: string;
  email?: string;
  address?: string;
  active: boolean;
  createdAt: string;
}

export interface PurchaseOrderItem {
  productId: string;
  productName: string;
  qty: number;
  unit: string;
  unitPrice: number;
  subtotal: number;
}

export interface PurchaseOrder {
  id: string;
  poNumber: string;
  supplierId: string;
  supplierName: string;
  items: PurchaseOrderItem[];
  total: number;
  status: POStatus;
  notes?: string;
  createdBy: string;
  createdAt: string;
  receivedAt?: string;
}
