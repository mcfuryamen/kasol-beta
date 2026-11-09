import { isDemoMode } from "@/data/supabase";
import { activeOutletId } from "@/logic/state/app-state";
import { isCloudOutletId } from "@/logic/services/outlet-service";

export const LOCAL_OUTLET_SENTINEL = "local-default-outlet";

/**
 * Outlet context untuk satu mutasi.
 *
 * - Mode demo/local: sentinel `local-default-outlet` sah ( IndexedDB-only).
 * - Mode cloud: WAJIB UUID outlet aktif. Sentinel atau ID non-cloud → null,
 *   dan pemanggil HARUS menolak mutasi (tidak boleh masuk outbox).
 */
export function resolveOutletContext(rowOutletId?: string | null): string | null {
  const candidate = rowOutletId ?? activeOutletId.value;
  if (isDemoMode) return candidate ?? LOCAL_OUTLET_SENTINEL;
  return isCloudOutletId(candidate) ? candidate! : null;
}

/** Outlet aktif cloud saat enqueue; null di demo. Dipakai delete tanpa row. */
export function activeCloudOutletId(): string | null {
  if (isDemoMode) return null;
  return isCloudOutletId(activeOutletId.value) ? activeOutletId.value! : null;
}

/** Predikat murni: entry outbox yang boleh mengontak Supabase saat flush. */
export function isFlushableEntry(entry: { outletId: string }): boolean {
  return isCloudOutletId(entry.outletId);
}
