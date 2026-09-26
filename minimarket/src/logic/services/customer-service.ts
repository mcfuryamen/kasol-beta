import { signal } from "@preact/signals";
import type { Customer, CustomerTier, LoyaltyTransaction } from "@/data/types/customer";
import { generateId } from "@/logic/utils/format";
import { localDb } from "@/data/db/local-db";
import { enqueue } from "@/data/sync/sync-engine";
import { storeSettings } from "@/logic/state/app-state";

export const customersSignal = signal<Customer[]>([]);
export const loyaltyTxSignal = signal<LoyaltyTransaction[]>([]);

const STORE = "customers";

/** Tier ditentukan oleh TOTAL BELANJA sesuai ambang di pengaturan toko (satu sumber kebenaran). */
export function computeTier(totalSpent: number): CustomerTier {
  const s = storeSettings.value;
  if (totalSpent >= s.loyaltyGoldMin) return "gold";
  if (totalSpent >= s.loyaltySilverMin) return "silver";
  return "bronze";
}

class CustomerService {
  getAll(): Customer[] { return customersSignal.value; }
  getById(id: string): Customer | undefined { return customersSignal.value.find(c => c.id === id); }

  search(q: string): Customer[] {
    const query = q.toLowerCase();
    if (!query) return customersSignal.value;
    return customersSignal.value.filter(c =>
      c.name.toLowerCase().includes(query) || c.phone.includes(query) || c.memberCard.toLowerCase().includes(query)
    );
  }

  add(data: Omit<Customer, "id" | "memberCard" | "memberSince" | "tier"> & { tier?: CustomerTier }): Customer {
    const customer: Customer = {
      ...data,
      id: generateId(),
      tier: data.tier ?? computeTier(data.totalSpent),
      memberCard: this.nextMemberCard(),
      memberSince: new Date().toISOString(),
    };
    customersSignal.value = [...customersSignal.value, customer];
    void this.persist(customer);
    return customer;
  }

  update(id: string, data: Partial<Customer>) {
    customersSignal.value = customersSignal.value.map(c => {
      if (c.id !== id) return c;
      const updated: Customer = { ...c, ...data };
      void this.persist(updated);
      return updated;
    });
  }

  delete(id: string) {
    customersSignal.value = customersSignal.value.filter(c => c.id !== id);
    void localDb.remove(STORE, id);
    enqueue(STORE, "delete", id);
  }

  addPoints(customerId: string, points: number, referenceId?: string) {
    const tx: LoyaltyTransaction = {
      id: generateId(), customerId, type: "earn", points,
      referenceId, description: "Poin dari transaksi", createdAt: new Date().toISOString()
    };
    loyaltyTxSignal.value = [tx, ...loyaltyTxSignal.value];
    this.mutate(customerId, c => ({ points: Math.max(0, c.points + points), tier: computeTier(c.totalSpent) }));
  }

  redeemPoints(customerId: string, points: number) {
    const tx: LoyaltyTransaction = {
      id: generateId(), customerId, type: "redeem", points: -points,
      description: "Penukaran poin", createdAt: new Date().toISOString()
    };
    loyaltyTxSignal.value = [tx, ...loyaltyTxSignal.value];
    this.mutate(customerId, c => ({ points: Math.max(0, c.points - points) }));
  }

  updateSpent(customerId: string, amount: number) {
    this.mutate(customerId, c => ({
      totalSpent: Math.max(0, c.totalSpent + amount),
      tier: computeTier(Math.max(0, c.totalSpent + amount)),
      lastVisit: new Date().toISOString(),
    }));
  }

  private mutate(id: string, fn: (c: Customer) => Partial<Customer>) {
    customersSignal.value = customersSignal.value.map(c => {
      if (c.id !== id) return c;
      const updated: Customer = { ...c, ...fn(c) };
      void this.persist(updated);
      return updated;
    });
  }

  /** Nomor kartu bebas-collision: lanjut dari nomor tertinggi yang ada. */
  private nextMemberCard(): string {
    let max = 0;
    for (const c of customersSignal.value) {
      const n = parseInt(c.memberCard.replace(/\D/g, ""), 10);
      if (!Number.isNaN(n) && n > max) max = n;
    }
    return "MM-" + String(max + 1).padStart(4, "0");
  }

  private async persist(customer: Customer) {
    await localDb.put(STORE, customer);
    enqueue(STORE, "upsert", customer.id, customer);
  }
}

export const customerService = new CustomerService();
