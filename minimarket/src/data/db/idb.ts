const DB_NAME = "kasir-solo";
const DB_VERSION = 1;

export const STORES = [
  "products", "customers", "orders", "shifts", "cashflows", "pettycash",
  "voids", "movements", "opnames", "batches", "promos", "vouchers",
  "suppliers", "purchase_orders", "staff", "kv"
] as const;
export type StoreName = typeof STORES[number];

let memoryFallback: Record<string, Map<string, any>> | null = null;
let dbPromise: Promise<IDBDatabase> | null = null;

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
    req.onupgradeneeded = () => {
      const db = req.result;
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
  if (useMemoryFallback()) return Array.from(mem(store).values());
  try {
    return await tx<T[]>(store, "readonly", s => s.getAll() as IDBRequest<T[]>);
  } catch {
    return Array.from(mem(store).values());
  }
}

export async function idbPut(store: StoreName, value: any): Promise<void> {
  if (useMemoryFallback()) { mem(store).set(value.id ?? value.key, value); return; }
  try {
    await tx(store, "readwrite", s => s.put(value));
  } catch {
    mem(store).set(value.id ?? value.key, value);
  }
}

export async function idbBulkPut(store: StoreName, values: any[]): Promise<void> {
  await Promise.all(values.map(v => idbPut(store, v)));
}

export async function idbDelete(store: StoreName, key: string): Promise<void> {
  if (useMemoryFallback()) { mem(store).delete(key); return; }
  try {
    await tx(store, "readwrite", s => s.delete(key));
  } catch {
    mem(store).delete(key);
  }
}

export async function kvGet<T>(key: string): Promise<T | null> {
  if (useMemoryFallback()) return (mem("kv").get(key) as { key: string; value: T })?.value ?? null;
  try {
    const row = await tx<{ key: string; value: T } | undefined>("kv", "readonly", s => s.get(key));
    return row?.value ?? null;
  } catch {
    return (mem("kv").get(key) as { key: string; value: T })?.value ?? null;
  }
}

export async function kvSet<T>(key: string, value: T): Promise<void> {
  return idbPut("kv", { key, value });
}
