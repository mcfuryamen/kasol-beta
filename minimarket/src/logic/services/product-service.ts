import { signal } from "@preact/signals";
import type { Product, ProductCategory } from "@/data/types/product";
import { generateId } from "@/logic/utils/format";
import { localDb } from "@/data/db/local-db";
import { enqueue } from "@/data/sync/sync-engine";
import { resolveOutletContext } from "@/data/sync/outlet-context";
import { activeOutletId } from "@/logic/state/app-state";

export const productsSignal = signal<Product[]>([]);

const STORE = "products";

class ProductService {
  getAll(): Product[] { return productsSignal.value; }
  getById(id: string): Product | undefined { return productsSignal.value.find(p => p.id === id); }
  getByBarcode(barcode: string): Product | undefined {
    return productsSignal.value.find(p => p.barcode === barcode && p.active);
  }

  search(query: string, category?: string): Product[] {
    const q = query.toLowerCase();
    return productsSignal.value.filter(p => {
      const matchQ = !q || p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q) || (p.barcode || "").includes(q);
      const matchCat = !category || category === "all" || p.category === category;
      return matchQ && matchCat && p.active;
    });
  }

  add(data: Omit<Product, "id" | "createdAt" | "updatedAt">): Product {
    const now = new Date().toISOString();
    const product: Product = { ...data, id: generateId(), createdAt: now, updatedAt: now };
    productsSignal.value = [...productsSignal.value, product];
    void this.persist(product);
    return product;
  }

  update(id: string, data: Partial<Product>) {
    productsSignal.value = productsSignal.value.map(p => {
      if (p.id !== id) return p;
      const updated: Product = { ...p, ...data, updatedAt: new Date().toISOString() };
      void this.persist(updated);
      return updated;
    });
  }

  delete(id: string) {
    productsSignal.value = productsSignal.value.filter(p => p.id !== id);
    void localDb.remove(STORE, id);
    enqueue(STORE, "delete", id);
  }

  /**
   * Kurangi/tambah stok. Stok minus DIBOLEHKAN dan tercatat apa adanya
   * agar selisih fisik terdeteksi saat opname (tidak lagi di-clamp diam-diam).
   * Mengembalikan stok setelah perubahan.
   */
  updateStock(id: string, delta: number): number | undefined {
    let result: number | undefined;
    productsSignal.value = productsSignal.value.map(p => {
      if (p.id !== id) return p;
      const stock = p.stock + delta;
      result = stock;
      const updated: Product = { ...p, stock, updatedAt: new Date().toISOString() };
      void this.persist(updated);
      return updated;
    });
    return result;
  }

  getLowStock(): Product[] { return productsSignal.value.filter(p => p.stock <= p.minStock && p.active); }
  getOverstock(): Product[] { return productsSignal.value.filter(p => p.stock > p.maxStock && p.active); }

  private async persist(product: Product) {
    // Tag salinan IndexedDB dengan outlet asal (Tahap 4) agar hydrate
    // per-outlet bisa memfilter; null di cloud tanpa outlet → baris lokal
    // tetap tanpa tag dan tetap tampil (aturan filter legacy).
    const outletId = resolveOutletContext(product.outlet_id);
    const tagged: Product = { ...product, outlet_id: outletId ?? product.outlet_id };
    await localDb.put(STORE, tagged);
    if (outletId !== null) enqueue(STORE, "upsert", product.id, tagged);
  }
}

export type { ProductCategory };
export const productService = new ProductService();
