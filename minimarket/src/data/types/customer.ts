export type CustomerTier = "bronze" | "silver" | "gold";

export interface Customer {
  id: string;
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
  customerId: string;
  type: "earn" | "redeem";
  points: number;
  referenceId?: string;
  description: string;
  createdAt: string;
}
