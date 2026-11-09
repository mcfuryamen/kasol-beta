/**
 * Strategi merge lokal-first.
 *
 * Dipisah dari hydrate.ts supaya murni dan bisa diuji tanpa browser/IndexedDB.
 */
export type Identifiable = { id: string };

/**
 * Last-write-wins: baris server menimpa baris lokal untuk id yang sama.
 *
 * `hasPendingChange` melindungi baris lokal yang masih ada di outbox. Tanpa itu,
 * `pull()` menimpa perubahan lokal yang belum sempat ter-flush lalu menuliskannya
 * kembali ke IndexedDB — perubahannya hilang permanen tanpa jejak.
 *
 * Perhatikan: merge bersifat aditif. Baris lokal yang dihapus di server tidak
 * ikut terhapus; penghapusan diurus oleh entri outbox dengan op "delete".
 */
export function mergeById<T extends Identifiable>(
  local: T[],
  server: T[],
  hasPendingChange?: (id: string) => boolean
): T[] {
  const map = new Map(local.map(r => [r.id, r]));
  for (const row of server) {
    if (hasPendingChange?.(row.id)) continue;
    map.set(row.id, row);
  }
  return Array.from(map.values());
}

/**
 * Filter per-outlet untuk hydrate lokal (Tahap 4).
 *
 * Baris hasil pull cloud membawa `outletId`; baris lokal lama/demo belum
 * bertag. Aturan: baris bertag hanya tampil di outlet-nya sendiri, baris tanpa
 * tag tetap tampil di mana saja supaya histori legacy tidak menghilang.
 * `outletId` null/undefined = tampilkan semua (mode demo / tanpa context).
 */
export function filterByOutlet<T extends { outletId?: string | null }>(
  rows: T[],
  outletId: string | null | undefined
): T[] {
  if (!outletId) return rows;
  return rows.filter(row => !row.outletId || row.outletId === outletId);
}
