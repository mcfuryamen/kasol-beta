import { idbGetAll, idbPut, idbDelete, idbBulkPut, idbPutChecked, type StoreName } from "./idb";

/**
 * Akses penyimpanan lokal (IndexedDB) dengan fallback memori.
 * Semua tulisan aplikasi bersifat LOCAL-FIRST: sinyal diupdate sinkron,
 * lalu dipersist di sini secara fire-and-forget, dan antrean sync
 * menangani dorongan ke Supabase saat online.
 */
export const localDb = {
  async getAll<T>(store: StoreName): Promise<T[]> {
    return idbGetAll<T>(store);
  },
  async put<T extends { id: string }>(store: StoreName, value: T): Promise<void> {
    return idbPut(store, value);
  },
  /**
   * Untuk jalur kritis (mis. order kasir): `true` hanya kalau benar-benar
   * masuk IndexedDB. `false` berarti data ditahan di memori dan hilang saat
   * aplikasi ditutup — pemanggil wajib menaggap sebagai kegagalan.
   */
  async putDurable<T extends { id: string }>(store: StoreName, value: T): Promise<boolean> {
    return idbPutChecked(store, value);
  },
  async bulkPut<T extends { id: string }>(store: StoreName, values: T[]): Promise<void> {
    return idbBulkPut(store, values);
  },
  async remove(store: StoreName, id: string): Promise<void> {
    return idbDelete(store, id);
  },
};

export { kvGet, kvSet, kvIncrement, storageDegraded } from "./idb";
