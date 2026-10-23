export type CustomerTier = "bronze" | "silver" | "gold";

export interface Customer {
  id: string;
  outlet_id?: string;
  name: string;
  phone: string;
  email?: string;
  address?: string;
  memberCard: string;
  tier: CustomerTier;
  points: number;
  totalSpent: number;
  debt: number;
  memberSince: string;
  lastVisit?: string;
  active: boolean;
}

export interface LoyaltyTransaction {
  id: string;
  outlet_id?: string;
  customerId: string;
  type: "earn" | "redeem" | "adjustment";
  points: number;
  referenceId?: string;
  description: string;
  /** Reason for adjustment/void reversals — "void", "return", "correction", etc. */
  reason?: string;
  createdAt: string;
}
