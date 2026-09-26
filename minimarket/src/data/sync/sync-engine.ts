import { signal } from "@preact/signals";
import { supabase, isDemoMode } from "@/data/supabase";
import { toSnake, toCamel } from "@/data/mappers";
import { kvGet, kvSet } from "@/data/db/idb";

export type SyncStatus = "disabled" | "offline" | "idle" | "syncing" | "error";

export type RemoteTable =
  | "products" | "customers" | "orders" | "order_items"
  | "shifts" | "cash_flows" | "petty_cash" | "void_records"
  | "stock_mutations" | "suppliers" | "purchase_orders"
  | "promos" | "vouchers";

export const isOnline = signal(navigator.onLine);
export const syncStatus = signal<SyncStatus>(isDemoMode ? "disabled" : navigator.onLine ? "idle" : "offline");
export const pendingCount = signal(0);
export const lastSyncAt = signal<string | null>(null);

interface OutboxEntry {
  id: string;
  table: RemoteTable;
  op: "upsert" | "delete";
  recordId: string;
  row?: Record<string, any>;
  createdAt: string;
}

const OUTBOX_KEY = "sync_outbox";
const FLUSH_DELAY_MS = 2000;

// Parent harus ter-push sebelum child (FK), urutan ini menjamin itu.
const TABLE_PRIORITY: RemoteTable[] = [
  "products", "suppliers", "purchase_orders", "promos", "vouchers",
  "customers", "shifts", "orders", "order_items",
  "cash_flows", "petty_cash", "void_records", "stock_mutations"
];

let outbox: OutboxEntry[] = [];
let flushing = false;
let flushTimer: ReturnType<typeof setTimeout> | null = null;

const pullers = new Map<RemoteTable, (rows: any[]) => Promise<void> | void>();
export function registerPuller(table: RemoteTable, fn: (rows: any[]) => Promise<void> | void) {
  pullers.set(table, fn);
}

export async function loadOutbox() {
  outbox = (await kvGet<OutboxEntry[]>(OUTBOX_KEY)) ?? [];
  pendingCount.value = outbox.length;
}

/**
 * Catat mutasi lokal untuk dipush ke Supabase.
 * Aplikasi SELALU menulis lokal-first; antrean hanya aktif saat mode online.
 */
export function enqueue(table: RemoteTable, op: "upsert" | "delete", recordId: string, row?: Record<string, any>) {
  if (isDemoMode) return;
  outbox.push({ id: crypto.randomUUID(), table, op, recordId, row, createdAt: new Date().toISOString() });
  if (outbox.length > 5000) outbox = outbox.slice(outbox.length - 5000);
  pendingCount.value = outbox.length;
  void kvSet(OUTBOX_KEY, outbox);
  scheduleFlush();
}

function scheduleFlush() {
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = setTimeout(() => { void flush(); }, FLUSH_DELAY_MS);
}

async function hasSession(): Promise<boolean> {
  const { data } = await supabase.auth.getSession();
  return !!data.session;
}

/** Push seluruh antrean ke Supabase. Aman dipanggil berkali-kali. */
export async function flush(): Promise<boolean> {
  if (isDemoMode) { syncStatus.value = "disabled"; return false; }
  if (!isOnline.value) { syncStatus.value = "offline"; return false; }
  if (flushing) return false;
  if (outbox.length === 0) { syncStatus.value = "idle"; return true; }
  if (!(await hasSession())) { syncStatus.value = "offline"; return false; }

  flushing = true;
  syncStatus.value = "syncing";
  try {
    for (const table of TABLE_PRIORITY) {
      const entries = outbox.filter(e => e.table === table);
      if (entries.length === 0) continue;

      const upserts = entries.filter(e => e.op === "upsert");
      for (let i = 0; i < upserts.length; i += 100) {
        const chunk = upserts.slice(i, i + 100).map(e => e.row!);
        const { error } = await supabase.from(table).upsert(chunk, { onConflict: "id" });
        if (error) throw error;
      }

      for (const entry of entries.filter(e => e.op === "delete")) {
        const { error } = await supabase.from(table).delete().eq("id", entry.recordId);
        if (error) throw error;
      }

      const doneIds = new Set(entries.map(e => e.id));
      outbox = outbox.filter(e => !doneIds.has(e.id));
    }
    lastSyncAt.value = new Date().toISOString();
    syncStatus.value = "idle";
    return true;
  } catch (err) {
    console.warn("[sync] flush gagal, akan dicoba ulang:", err);
    syncStatus.value = "error";
    scheduleFlush();
    return false;
  } finally {
    flushing = false;
    pendingCount.value = outbox.length;
    void kvSet(OUTBOX_KEY, outbox);
  }
}

/** Tarik data server -> lokal (hanya mode online). Dipakai saat login/boot online. */
export async function pull(): Promise<boolean> {
  if (isDemoMode || !isOnline.value) return false;
  if (!(await hasSession())) return false;
  try {
    for (const [table, apply] of pullers) {
      const { data, error } = await supabase.from(table).select("*");
      if (error) throw error;
      if (data) await apply(data.map(toCamel));
    }
    lastSyncAt.value = new Date().toISOString();
    return true;
  } catch (err) {
    console.warn("[sync] pull gagal:", err);
    return false;
  }
}

window.addEventListener("online", () => {
  isOnline.value = true;
  if (!isDemoMode) { void flush(); void pull(); }
});
window.addEventListener("offline", () => {
  isOnline.value = false;
  syncStatus.value = "offline";
});
