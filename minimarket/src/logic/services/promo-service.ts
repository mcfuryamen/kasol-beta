import { signal } from "@preact/signals";
import type { Promo, Voucher } from "@/data/types/promo";
import { generateId } from "@/logic/utils/format";
import { localDb } from "@/data/db/local-db";
import { enqueue } from "@/data/sync/sync-engine";
import { resolveOutletContext } from "@/data/sync/outlet-context";
import { activeOutletId } from "@/logic/state/app-state";

export const promosSignal = signal<Promo[]>([]);
export const vouchersSignal = signal<Voucher[]>([]);

/** Alasan voucher terakhir ditolak — untuk pesan UX kasir. */
export const lastVoucherError = signal<string>("");

class PromoService {
  getAll(): Promo[] { return promosSignal.value; }

  validateVoucher(code: string, subtotal: number): Voucher | null {
    const v = vouchersSignal.value.find(v => v.code.toUpperCase() === code.toUpperCase());
    if (!v) { lastVoucherError.value = "Kode voucher tidak ditemukan"; return null; }
    if (v.used) { lastVoucherError.value = "Voucher sudah pernah dipakai"; return null; }
    if (new Date(v.expiresAt) < new Date()) { lastVoucherError.value = "Voucher sudah kedaluwarsa"; return null; }
    if (subtotal < v.minPurchase) {
      lastVoucherError.value = `Minimal belanja Rp ${v.minPurchase.toLocaleString("id-ID")}`;
      return null;
    }
    lastVoucherError.value = "";
    return v;
  }

  applyVoucher(voucherId: string) {
    vouchersSignal.value = vouchersSignal.value.map(v => {
      if (v.id !== voucherId) return v;
      const updated: Voucher = { ...v, used: true, usedAt: new Date().toISOString() };
      // Tag IndexedDB dengan outlet asal (Tahap 4); lihat product-service.
      const outletId = resolveOutletContext(updated.outlet_id);
      void localDb.put("vouchers", { ...updated, outlet_id: outletId ?? updated.outlet_id });
      if (outletId !== null) enqueue("vouchers", "upsert", updated.id, { ...updated, outlet_id: outletId });
      return updated;
    });
  }

  add(data: Omit<Promo, "id" | "usageCount" | "createdAt">): Promo {
    const p: Promo = { ...data, id: generateId(), usageCount: 0, createdAt: new Date().toISOString() };
    promosSignal.value = [...promosSignal.value, p];
    const outletId = resolveOutletContext(p.outlet_id);
    void localDb.put("promos", { ...p, outlet_id: outletId ?? p.outlet_id });
    if (outletId !== null) enqueue("promos", "upsert", p.id, { ...p, outlet_id: outletId });
    return p;
  }

  update(id: string, data: Partial<Promo>) {
    promosSignal.value = promosSignal.value.map(p => {
      if (p.id !== id) return p;
      const updated: Promo = { ...p, ...data };
      const outletId = resolveOutletContext(updated.outlet_id);
      void localDb.put("promos", { ...updated, outlet_id: outletId ?? updated.outlet_id });
      if (outletId !== null) enqueue("promos", "upsert", id, { ...updated, outlet_id: outletId });
      return updated;
    });
  }

  /** Naikkan usageCount promo saat poin ditukarkan pelanggan. */
  incrementUsageCount(promoId: string) {
    promosSignal.value = promosSignal.value.map(p => {
      if (p.id !== promoId) return p;
      const updated: Promo = { ...p, usageCount: p.usageCount + 1 };
      const outletId = resolveOutletContext(updated.outlet_id);
      void localDb.put("promos", { ...updated, outlet_id: outletId ?? updated.outlet_id });
      if (outletId !== null) enqueue("promos", "upsert", promoId, { ...updated, outlet_id: outletId });
      return updated;
    });
  }

  delete(id: string) {
    promosSignal.value = promosSignal.value.filter(p => p.id !== id);
    void localDb.remove("promos", id);
    enqueue("promos", "delete", id);
  }

  addVoucher(data: Omit<Voucher, "id" | "createdAt" | "used">): Voucher {
    const v: Voucher = { ...data, id: generateId(), used: false, createdAt: new Date().toISOString() };
    vouchersSignal.value = [...vouchersSignal.value, v];
    const outletId = resolveOutletContext(v.outlet_id);
    void localDb.put("vouchers", { ...v, outlet_id: outletId ?? v.outlet_id });
    if (outletId !== null) enqueue("vouchers", "upsert", v.id, { ...v, outlet_id: outletId });
    return v;
  }
}

export const promoService = new PromoService();
