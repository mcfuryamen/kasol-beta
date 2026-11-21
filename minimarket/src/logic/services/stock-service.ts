import { signal } from "@preact/signals";
import type { StockMovement, StockOpname, BatchInfo } from "@/data/types/stock";
import { generateId } from "@/logic/utils/format";
import { currentUser, activeOutletId } from "@/logic/state/app-state";
import { localDb } from "@/data/db/local-db";
import { enqueue } from "@/data/sync/sync-engine";
import { resolveOutletContext } from "@/data/sync/outlet-context";

export const stockMovementsSignal = signal<StockMovement[]>([]);
export const stockOpnameSignal = signal<StockOpname[]>([]);
export const batchInfoSignal = signal<BatchInfo[]>([]);

class StockService {
  addMovement(data: Omit<StockMovement, "id" | "createdAt">): StockMovement {
    const m: StockMovement = {
      ...data,
      id: generateId(),
      createdBy: data.createdBy ?? currentUser.value?.id,
      createdAt: new Date().toISOString()
    };
    stockMovementsSignal.value = [m, ...stockMovementsSignal.value];
    // Tag IndexedDB dengan outlet asal (Tahap 4); lihat product-service.
    const outletId = resolveOutletContext(m.outlet_id);
    void localDb.put("movements", { ...m, outlet_id: outletId ?? m.outlet_id });
    if (outletId !== null) enqueue("stock_mutations", "upsert", m.id, { ...m, outlet_id: outletId });
    return m;
  }

  getMovements(productId?: string): StockMovement[] {
    if (!productId) return stockMovementsSignal.value;
    return stockMovementsSignal.value.filter(m => m.productId === productId);
  }

  addOpname(data: Omit<StockOpname, "id" | "createdAt">): StockOpname {
    const o: StockOpname = { ...data, id: generateId(), createdAt: new Date().toISOString() };
    stockOpnameSignal.value = [o, ...stockOpnameSignal.value];
    void localDb.put("opnames", o);
    return o;
  }

  addBatch(data: Omit<BatchInfo, "id" | "createdAt">): BatchInfo {
    const b: BatchInfo = { ...data, id: generateId(), createdAt: new Date().toISOString() };
    batchInfoSignal.value = [...batchInfoSignal.value, b];
    void localDb.put("batches", b);
    return b;
  }

  getExpiringBatches(days = 30): BatchInfo[] {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() + days);
    return batchInfoSignal.value.filter(b => new Date(b.expiryDate) <= cutoff);
  }
}

export const stockService = new StockService();
