export type PaymentMethod = "cash" | "qris" | "debit" | "credit" | "ewallet" | "tempo";
export type OrderStatus = "pending" | "completed" | "voided" | "returned";

export interface OrderItem {
  id: string;
  productId: string;
  productName: string;
  sku: string;
  qty: number;
  unit: string;
  buyPrice: number;
  sellPrice: number;
  discount: number;
  subtotal: number;
}

export interface Order {
  id: string;
  orderNumber: string;
  items: OrderItem[];
  customerId?: string;
  customerName?: string;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  paymentMethod: PaymentMethod;
  amountPaid: number;
  change: number;
  status: OrderStatus;
  shiftId?: string;
  cashierId: string;
  cashierName: string;
  voucherCode?: string;
  voucherDiscount?: number;
  notes?: string;
  createdAt: string;
}

export interface HeldOrder {
  id: string;
  label: string;
  items: OrderItem[];
  customerId?: string;
  customerName?: string;
  discount: number;
  heldAt: string;
}
