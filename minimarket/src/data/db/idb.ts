import { signal } from "@preact/signals";
import { notificationService } from "@/logic/services/notification-service";

const DB_NAME = "kasir-solo";
const DB_VERSION = 2;

export const STORES = [
  "products", "customers", "orders", "shifts", "cashflows", "pettycash",
  "voids", "movements", "opnames", "batches", "promos", "vouchers",
  "suppliers", "purchase_orders", "staff", "kv", "loyalty_transactions"
] as const;
export type StoreName = typeof STORES[number];

let memoryFallback: Record<string, Map<string, any>> | null = null;
let dbPromise: Promise<IDBDatabase> | null = null;

/**
 * True kalau ada penulisan yang TIDAK masuk IndexedDB dan hanya ditahan di memori.
 *
 * Data di memori hilang begitu halaman ditutup. Sebelumnya kegagalan ini
 * ditelan `catch` kosong, jadi kasir melihat data "tersimpan" padahal hilang —
 * terburuk untuk aplikasi yang menerima uang. Sekarang statusnya dipublikasikan
 * ke UI dan diberi tahu ke pengguna.
 */
export const storageDegraded = signal(false);
let degradedNotified = false;

function markDegraded(err?: unknown) {
  storageDegraded.value = true;
  if (degradedNotified) return;
  degradedNotified = true;
  notificationService.add(
    "error",
    "Penyimpanan Perangkat Bermasalah",
    "Data tidak bisa ditulis ke penyimpanan perangkat (kuota penuh atau mode penyamaran). Perubahan terbaru akan hilang saat aplikasi ditutup. Tutup tab penyamaran atau kosongkan ruang penyimpanan, lalu muat ulang.",
    undefined
  );
}

function useMemoryFallback(): boolean {
  return typeof indexedDB === "undefined";
}

function mem(store: StoreName): Map<string, any> {
  if (!memoryFallback) {
    memoryFallback = {};
    for (const s of STORES) memoryFallback[s] = new Map();
  }
  return memoryFallback[store];
}

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (event) => {
      const db = req.result;
      const oldVersion = event.oldVersion;

      // V1 → V2: add loyalty_transactions store
      if (oldVersion < 2) {
        if (!db.objectStoreNames.contains("loyalty_transactions")) {
          db.createObjectStore("loyalty_transactions", { keyPath: "id" });
        }
      }

      // Ensure all known stores exist (covers fresh installs at current version)
      for (const store of STORES) {
        if (!db.objectStoreNames.contains(store)) {
          if (store === "kv") db.createObjectStore(store, { keyPath: "key" });
          else db.createObjectStore(store, { keyPath: "id" });
        }
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function tx<T>(store: StoreName, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  if (useMemoryFallback()) return Promise.reject(new Error("memory-mode"));
  return openDb().then(db => new Promise<T>((resolve, reject) => {
    const t = db.transaction(store, mode);
    const req = fn(t.objectStore(store));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  }));
}

export async function idbGetAll<T>(store: StoreName): Promise<T[]> {
  if (useMemoryFallback()) { markDegraded(); return Array.from(mem(store).values()); }
  try {
    return await tx<T[]>(store, "readonly", s => s.getAll() as IDBRequest<T[]>);
  } catch (err) {
    markDegraded(err);
    return Array.from(mem(store).values());
  }
}

/**
 * Tulis ke IndexedDB dan laporkan jujur apakah berhasil.
 *
 * `true`  = benar-benar tersimpan di perangkat (bertahan setelah refresh).
 * `false` = hanya tersimpan di memori (hilang saat refresh).
 *
 * Jalur kritis (mis. menyimpan order kasir) memakai nilai balik ini supaya
 * bisa menolak menyelesaikan transaksi yang tidak tercatat.
 */
export async function idbPutChecked(store: StoreName, value: any): Promise<boolean> {
  if (useMemoryFallback()) {
    mem(store).set(value.id ?? value.key, value);
    markDegraded();
    return false;
  }
  try {
    await tx(store, "readwrite", s => s.put(value));
    return true;
  } catch (err) {
    markDegraded(err);
    mem(store).set(value.id ?? value.key, value);
    return false;
  }
}

export async function idbPut(store: StoreName, value: any): Promise<void> {
  await idbPutChecked(store, value);
}

export async function idbBulkPut(store: StoreName, values: any[]): Promise<void> {
  await Promise.all(values.map(v => idbPut(store, v)));
}

export async function idbDelete(store: StoreName, key: string): Promise<void> {
  if (useMemoryFallback()) { mem(store).delete(key); return; }
  try {
    await tx(store, "readwrite", s => s.delete(key));
  } catch (err) {
    markDegraded(err);
    mem(store).delete(key);
  }
}

export async function kvGet<T>(key: string): Promise<T | null> {
  if (useMemoryFallback()) return (mem("kv").get(key) as { key: string; value: T })?.value ?? null;
  try {
    const row = await tx<{ key: string; value: T } | undefined>("kv", "readonly", s => s.get(key));
    return row?.value ?? null;
  } catch (err) {
    markDegraded(err);
    return (mem("kv").get(key) as { key: string; value: T })?.value ?? null;
  }
}

export async function kvSet<T>(key: string, value: T): Promise<void> {
  return idbPut("kv", { key, value });
}

/**
 * Atomically increment a numeric counter stored in the "kv" store.
 * Uses IDB cursor to avoid read-then-write race between tabs/instances.
 * Returns the NEW value after increment.
 */
export async function kvIncrement(key: string): Promise<number> {
  if (useMemoryFallback()) {
    markDegraded();
    const current = (mem("kv").get(key) as { key: string; value: number })?.value ?? 0;
    const next = current + 1;
    mem("kv").set(key, { key, value: next });
    return next;
  }
  try {
    return await openDb().then(db => new Promise<number>((resolve, reject) => {
      const t = db.transaction("kv", "readwrite");
      const store = t.objectStore("kv");
      const getReq = store.get(key);
      getReq.onsuccess = () => {
        const current = (getReq.result as { key: string; value: number } | undefined)?.value ?? 0;
        const next = current + 1;
        const putReq = store.put({ key, value: next });
        putReq.onsuccess = () => resolve(next);
        putReq.onerror = () => reject(putReq.error);
      };
      getReq.onerror = () => reject(getReq.error);
    }));
  } catch (err) {
    // Nomor dokumen tidak boleh gagal: fallback ke memori supaya kasir tetap
    // bisa selling, tapi tandai degradasi karena angka akan terulang setelah reload.
    markDegraded(err);
    const current = (mem("kv").get(key) as { key: string; value: number })?.value ?? 0;
    const next = current + 1;
    mem("kv").set(key, { key, value: next });
    return next;
  }
}
