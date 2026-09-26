export type PromoType = "percent" | "amount" | "bxgy" | "bundling" | "happyhour";

export interface Promo {
  id: string;
  name: string;
  type: PromoType;
  discountValue: number;
  discountType: "percent" | "amount";
  minPurchase: number;
  maxDiscount?: number;
  startDate: string;
  endDate: string;
  active: boolean;
  usageCount: number;
  maxUsage?: number;
  productIds?: string[];
  createdAt: string;
}

export interface Voucher {
  id: string;
  code: string;
  promoId: string;
  discountValue: number;
  discountType: "percent" | "amount";
  minPurchase: number;
  maxDiscount?: number;
  used: boolean;
  usedAt?: string;
  expiresAt: string;
  createdAt: string;
}
