import { signal } from "@preact/signals";
import type { Supplier, PurchaseOrder, POStatus } from "@/data/types/supplier";
import { generateId, nextPONumber } from "@/logic/utils/format";
import { currentUser, activeOutletId } from "@/logic/state/app-state";
import { localDb } from "@/data/db/local-db";
import { enqueue } from "@/data/sync/sync-engine";
import { resolveOutletContext } from "@/data/sync/outlet-context";
import { productService } from "./product-service";
import { stockService } from "./stock-service";

/** Urutan status PO — transisi hanya boleh maju, "received" adalah final. */
const PO_STATUS_RANK: Record<POStatus, number> = { draft: 0, approved: 1, ordered: 2, received: 3 };

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
    // Tag IndexedDB dengan outlet asal (Tahap 4); lihat product-service.
    const outletId = resolveOutletContext(s.outlet_id);
    const tagged: Supplier = { ...s, outlet_id: outletId ?? s.outlet_id };
    void localDb.put("suppliers", tagged);
    if (outletId !== null) enqueue("suppliers", "upsert", s.id, tagged);
    return s;
  }

  update(id: string, data: Partial<Supplier>) {
    suppliersSignal.value = suppliersSignal.value.map(s => {
      if (s.id !== id) return s;
      const updated = { ...s, ...data };
      const outletId = resolveOutletContext(updated.outlet_id);
      void localDb.put("suppliers", { ...updated, outlet_id: outletId ?? updated.outlet_id });
      if (outletId !== null) enqueue("suppliers", "upsert", id, { ...updated, outlet_id: outletId });
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
    // items berupa jsonb pada kolom items — cocok dengan migrasi
    const poOutlet = resolveOutletContext(po.outlet_id);
    await localDb.put("purchase_orders", { ...po, outlet_id: poOutlet ?? po.outlet_id });
    if (poOutlet !== null) enqueue("purchase_orders", "upsert", po.id, { ...po, outlet_id: poOutlet });
    return po;
  }

  /**
   * Ubah status PO. Transisi hanya maju (draft → approved → ordered);
   * penerimaan barang harus lewat receivePO() agar stok ikut bertambah.
   */
  updatePOStatus(id: string, status: POStatus) {
    const po = purchaseOrdersSignal.value.find(p => p.id === id);
    if (!po) return;
    if (PO_STATUS_RANK[status] <= PO_STATUS_RANK[po.status]) return;
    const updated: PurchaseOrder = { ...po, status };
    purchaseOrdersSignal.value = purchaseOrdersSignal.value.map(p => (p.id === id ? updated : p));
    const statusOutlet = resolveOutletContext(updated.outlet_id);
    void localDb.put("purchase_orders", { ...updated, outlet_id: statusOutlet ?? updated.outlet_id });
    if (statusOutlet !== null) enqueue("purchase_orders", "upsert", id, { ...updated, outlet_id: statusOutlet });
  }

  /**
   * Terima barang PO: status → received DAN stok tiap item bertambah
   * (mutasi 'purchase' tercatat di riwayat). Dulu status received hanya
   * mengisi timestamp — barang datang tapi stok tidak pernah naik.
   * Guard dobel-terima: status "received" final, panggilan ulang ditolak.
   */
  receivePO(id: string): { ok: boolean; message: string } {
    const po = purchaseOrdersSignal.value.find(p => p.id === id);
    if (!po) return { ok: false, message: "PO tidak ditemukan" };
    if (po.status === "received") return { ok: false, message: "PO ini sudah pernah diterima" };

    let addedCount = 0;
    for (const item of po.items) {
      const afterStock = productService.updateStock(item.productId, item.qty);
      if (afterStock === undefined) continue; // produk sudah terhapus — lewati item ini
      addedCount++;
      stockService.addMovement({
        productId: item.productId, productName: item.productName,
        type: "purchase", qty: item.qty, referenceId: po.id,
        notes: `Terima ${po.poNumber} dari ${po.supplierName}`
      });
    }

    const updated: PurchaseOrder = { ...po, status: "received", receivedAt: new Date().toISOString() };
    purchaseOrdersSignal.value = purchaseOrdersSignal.value.map(p => (p.id === id ? updated : p));
    const receivedOutlet = resolveOutletContext(updated.outlet_id);
    void localDb.put("purchase_orders", { ...updated, outlet_id: receivedOutlet ?? updated.outlet_id });
    if (receivedOutlet !== null) enqueue("purchase_orders", "upsert", id, { ...updated, outlet_id: receivedOutlet });

    const message = addedCount === po.items.length
      ? `PO ${po.poNumber} diterima — stok ${addedCount} item bertambah`
      : `PO ${po.poNumber} diterima — stok bertambah untuk ${addedCount}/${po.items.length} item`;
    return { ok: true, message };
  }
}

export const supplierService = new SupplierService();
