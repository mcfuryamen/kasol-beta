import { signal } from "@preact/signals";
import type { Supplier, PurchaseOrder } from "@/data/types/supplier";
import { generateId, nextPONumber } from "@/logic/utils/format";
import { currentUser } from "@/logic/state/app-state";
import { localDb } from "@/data/db/local-db";
import { enqueue } from "@/data/sync/sync-engine";

export const suppliersSignal = signal<Supplier[]>([]);
export const purchaseOrdersSignal = signal<PurchaseOrder[]>([]);

class SupplierService {
  getAll(): Supplier[] { return suppliersSignal.value; }
  getById(id: string): Supplier | undefined { return suppliersSignal.value.find(s => s.id === id); }

  search(q: string): Supplier[] {
    const query = q.toLowerCase();
    if (!query) return suppliersSignal.value;
    return suppliersSignal.value.filter(s =>
      s.name.toLowerCase().includes(query) || s.contact.toLowerCase().includes(query) || s.phone.includes(query)
    );
  }

  add(data: Omit<Supplier, "id" | "createdAt">): Supplier {
    const s: Supplier = { ...data, id: generateId(), createdAt: new Date().toISOString() };
    suppliersSignal.value = [...suppliersSignal.value, s];
    void localDb.put("suppliers", s);
    enqueue("suppliers", "upsert", s.id, s);
    return s;
  }

  update(id: string, data: Partial<Supplier>) {
    suppliersSignal.value = suppliersSignal.value.map(s => {
      if (s.id !== id) return s;
      const updated = { ...s, ...data };
      void localDb.put("suppliers", updated);
      enqueue("suppliers", "upsert", id, updated);
      return updated;
    });
  }

  delete(id: string) {
    suppliersSignal.value = suppliersSignal.value.filter(s => s.id !== id);
    void localDb.remove("suppliers", id);
    enqueue("suppliers", "delete", id);
  }

  async createPO(data: Omit<PurchaseOrder, "id" | "poNumber" | "createdAt" | "createdBy">): Promise<PurchaseOrder> {
    const po: PurchaseOrder = {
      ...data,
      id: generateId(),
      poNumber: await nextPONumber(),
      createdBy: currentUser.value?.id ?? "unknown",
      createdAt: new Date().toISOString()
    };
    purchaseOrdersSignal.value = [po, ...purchaseOrdersSignal.value];
    await localDb.put("purchase_orders", po);
    // items berupa jsonb pada kolom items — cocok dengan migrasi
    enqueue("purchase_orders", "upsert", po.id, po);
    return po;
  }

  updatePOStatus(id: string, status: PurchaseOrder["status"]) {
    purchaseOrdersSignal.value = purchaseOrdersSignal.value.map(po => {
      if (po.id !== id) return po;
      const updated: PurchaseOrder = { ...po, status, ...(status === "received" ? { receivedAt: new Date().toISOString() } : {}) };
      void localDb.put("purchase_orders", updated);
      enqueue("purchase_orders", "upsert", id, updated);
      return updated;
    });
  }
}

export const supplierService = new SupplierService();
