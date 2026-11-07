export interface SalesReport {
  date: string;
  revenue: number;
  cogs: number;
  grossProfit: number;
  transactionCount: number;
  avgTransaction: number;
}

export interface ProductSalesReport {
  productId: string;
  productName: string;
  qtySold: number;
  revenue: number;
  profit: number;
}

export interface PaymentReport {
  method: string;
  count: number;
  total: number;
}
