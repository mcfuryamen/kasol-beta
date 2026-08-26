import { signal } from "@preact/signals";
import type { Promo, Voucher } from "@/data/types/promo";
import { generateId } from "@/logic/utils/format";
import { localDb } from "@/data/db/local-db";
import { enqueue } from "@/data/sync/sync-engine";

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
      void localDb.put("vouchers", updated);
      enqueue("vouchers", "upsert", updated.id, updated);
      return updated;
    });
  }

  add(data: Omit<Promo, "id" | "usageCount" | "createdAt">): Promo {
    const p: Promo = { ...data, id: generateId(), usageCount: 0, createdAt: new Date().toISOString() };
    promosSignal.value = [...promosSignal.value, p];
    void localDb.put("promos", p);
    enqueue("promos", "upsert", p.id, p);
    return p;
  }

  update(id: string, data: Partial<Promo>) {
    promosSignal.value = promosSignal.value.map(p => {
      if (p.id !== id) return p;
      const updated: Promo = { ...p, ...data };
      void localDb.put("promos", updated);
      enqueue("promos", "upsert", id, updated);
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
    void localDb.put("vouchers", v);
    enqueue("vouchers", "upsert", v.id, v);
    return v;
  }
}

export const promoService = new PromoService();
