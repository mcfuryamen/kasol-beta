import { signal } from "@preact/signals";
import { supabase, isDemoMode } from "@/data/supabase";
import { toCamel, toSnake } from "@/data/mappers";
import { kvGet, kvSet } from "@/data/db/idb";
import { isFlushableEntry } from "@/data/sync/outlet-context";
import { combinedView } from "@/logic/state/app-state";
import { notificationService } from "@/logic/services/notification-service";
import { activeOutletId } from "@/logic/state/app-state";
import { isCloudOutletId } from "@/logic/services/outlet-service";
import { generateId } from "@/logic/utils/format";

export type SyncStatus = "disabled" | "offline" | "idle" | "syncing" | "error";

export const REMOTE_TABLES = [
  "products", "customers", "orders", "order_items",
  "shifts", "cash_flows", "petty_cash", "void_records",
  "stock_mutations", "suppliers", "purchase_orders",
  "promos", "vouchers"
] as const;
export type RemoteTable = typeof REMOTE_TABLES[number];

/**
 * Nama tabel remote per tabel logis. Katalog kasir memakai "pos_products"
 * karena tabel "products" di project Supabase ini sudah dipakai katalog
 * Control dengan schema berbeda.
 */
const REMOTE_NAME: Record<RemoteTable, string> = {
  products: "pos_products",
  customers: "customers",
  orders: "orders",
  order_items: "order_items",
  shifts: "shifts",
  cash_flows: "cash_flows",
  petty_cash: "petty_cash",
  void_records: "void_records",
  stock_mutations: "stock_mutations",
  suppliers: "suppliers",
  purchase_orders: "purchase_orders",
  promos: "promos",
  vouchers: "vouchers",
};

export const isOnline = signal(navigator.onLine);
export const syncStatus = signal<SyncStatus>(isDemoMode ? "disabled" : navigator.onLine ? "idle" : "offline");
export const pendingCount = signal(0);
export const lastSyncAt = signal<string | null>(null);

interface OutboxEntry {
  id: string;
  table: RemoteTable;
  op: "upsert" | "delete";
  recordId: string;
  /** Outlet asal mutasi; immutable walau user berpindah outlet sebelum flush. */
  outletId: string;
  row?: Record<string, any>;
  createdAt: string;
  /** Berapa kali record ini ditolak server (mis. pelanggaran skema). */
  failCount?: number;
}

const OUTBOX_KEY = "sync_outbox";
const FLUSH_DELAY_MS = 2000;
const OUTBOX_MAX = 20000;
/** Record yang ditolak server N kali "diparkir" — berhenti dicoba, tetap disimpan. */
const PARK_AFTER_FAILS = 5;

/** Pagar pengaman terakhir kalau perangkat offline sangat lama. */
let outboxOverflowWarned = false;

const TABLE_PRIORITY: RemoteTable[] = [
  "products", "suppliers", "purchase_orders", "promos", "vouchers",
  "customers", "shifts", "orders", "order_items",
  "cash_flows", "petty_cash", "void_records", "stock_mutations"
];

// Guard DEV-only: flush() hanya mengiterasi TABLE_PRIORITY.
// Di production, array statis ini sudah termasuk semua tabel di REMOTE_TABLES.
// Catch: tbl yang di-enqueue tapi tidak di-TABLE_PRIORITY → diam di outbox selamanya.
const MISSING_PRIORITY = REMOTE_TABLES.filter(t => !TABLE_PRIORITY.includes(t));
if (import.meta.env.DEV && MISSING_PRIORITY.length > 0) {
  throw new Error("[sync] Tabel di-enqueue tapi tidak di TABLE_PRIORITY: " + MISSING_PRIORITY.join(", "));
}

let outbox: OutboxEntry[] = [];
let flushing = false;
let pulling = false;
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let persistTimer: ReturnType<typeof setTimeout> | null = null;
let flushAttempts = 0;
let lastFailureNotice = 0;
const FAILURE_NOTICE_COOLDOWN_MS = 60_000;
/** Notifikasi "data diparkir" cukup sekali per sesi. */
let parkNotified = false;

const pullers = new Map<RemoteTable, (rows: any[]) => Promise<void> | void>();
export function registerPuller(table: RemoteTable, fn: (rows: any[]) => Promise<void> | void) {
  pullers.set(table, fn);
}

export async function loadOutbox() {
  const saved = (await kvGet<Partial<OutboxEntry>[]>(OUTBOX_KEY)) ?? [];
  // Legacy entries did not retain outlet context. Keep them visible for repair,
  // but bind them once at load time rather than silently rebinding during flush.
  let corruptedCount = 0;
  outbox = saved
    .filter(e => !!e.id && !!e.table && !!e.recordId)
    .filter(e => {
      // Entri rusak (op tak dikenal, atau upsert tanpa row) dibuang — entri
      // seperti ini membuat flush macet selamanya (row undefined dikirim ke
      // server, ditolak terus-menerus, dan menahan antrean).
      const opValid = e.op === "upsert" || e.op === "delete";
      const rowValid = e.op !== "upsert" || (!!e.row && typeof e.row === "object");
      if (!opValid || !rowValid) { corruptedCount++; return false; }
      return true;
    })
    .map(e => ({ ...e, outletId: e.outletId || e.row?.outlet_id || "local-default-outlet" } as OutboxEntry))
    // Entry legacy tanpa outlet cloud valid tidak boleh dikirim ke Supabase
    // memakai sentinel; biarkan tersimpan (repair manual), tidak ikut flush.
    .filter(e => isDemoMode || isFlushableEntry(e));
  pendingCount.value = outbox.length;
  if (corruptedCount > 0) {
    // Perbaikan langsung di-persist supaya pembersihan tidak diulang (dan
    // notifikasi tidak muncul lagi) pada boot berikutnya.
    persistOutbox(true);
    notificationService.add(
      "warning",
      "Antrean Diperbaiki",
      `${corruptedCount} entri antrean rusak dibuang agar sinkronisasi tidak macet.`,
      undefined
    );
  }
}

/**
 * Id record yang masih punya antrean outbound untuk sebuah tabel.
 * Dipakai puller saat merge supaya versi server tidak menimpa perubahan lokal
 * yang belum sempat ter-flush (local lost-update).
 */
export function pendingIdsFor(table: RemoteTable): Set<string> {
  return new Set(outbox.filter(e => e.table === table).map(e => e.recordId));
}

/**
 * Tulis outbox ke IndexedDB.
 *
 * Dipanggil dengan `immediate` setelah flush sukses supaya hasil flush langsung
 * durable. Selain itu penulisan di-debounce: setiap enqueue menulis ulang SELURUH
 * array, jadi pada kasir yang selling cepat itu jadi O(n) write per item.
 */
function wireRow(table: RemoteTable, row: Record<string, any>, outletId: string): Record<string, any> {
  const base: Record<string, any> = { ...row, outlet_id: outletId };
  if (table === "orders") {
    const { items: _items, change, ...order } = base;
    return { ...order, change_amount: change ?? order.change_amount ?? 0 };
  }
  if (table === "order_items") {
    const { sku, sell_price, ...item } = base;
    return { ...item, product_sku: sku ?? item.product_sku ?? "", unit_price: sell_price ?? item.unit_price ?? 0 };
  }
  if (table === "products") {
    // Model lokal memakai active; tabel pos_products memakai is_active.
    const { active, isActive, is_active, ...product } = base;
    return { ...product, is_active: active ?? isActive ?? is_active ?? true };
  }
  return base;
}

function persistOutbox(immediate = false) {
  if (persistTimer) { clearTimeout(persistTimer); persistTimer = null; }
  const write = () => { persistTimer = null; void kvSet(OUTBOX_KEY, outbox); };
  if (immediate) write();
  else persistTimer = setTimeout(write, 500);
}

/**
 * Catat mutasi lokal untuk dipush ke Supabase.
 * Aplikasi SELALU menulis lokal-first; antrean hanya aktif saat mode online.
 */
export function enqueue(table: RemoteTable, op: "upsert" | "delete", recordId: string, row?: Record<string, any>) {
  if (isDemoMode) return;
  const requestedOutlet = row?.outlet_id;
  // Cloud wajib UUID outlet sah. Sentinel local TIDAK boleh masuk outbox;
  // kalau tidak ada outlet valid, mutasi tidak diantrikan (local tetap aman).
  const outletId = requestedOutlet && requestedOutlet !== "local-default-outlet"
    ? (isCloudOutletId(requestedOutlet) ? requestedOutlet : null)
    : (isCloudOutletId(activeOutletId.value) ? activeOutletId.value! : null);
  if (!outletId) {
    notificationService.add("warning", "Outlet Belum Dipilih", combinedView.value
      ? "Mode gabungan hanya untuk melihat data. Pilih outlet spesifik untuk mencatat perubahan."
      : "Perubahan tidak dikirim ke server karena outlet aktif belum tervalidasi. Data tetap tersimpan di perangkat.", undefined);
    return;
  }
  const scopedRow = row ? { ...row, outlet_id: outletId } : undefined;
  // Catat kondisi antrean SEBELUM push — dipakai scheduleFlush untuk memutuskan
  // apakah backoff retry boleh di-reset (kosong = kondisi sehat).
  const outboxWasEmpty = outbox.length === 0;
  // randomUUID tidak tersedia di non-secure context (http) — pakai fallback.
  outbox.push({ id: crypto?.randomUUID ? crypto.randomUUID() : generateId(), table, op, recordId, outletId, row: scopedRow, createdAt: new Date().toISOString() });
  pendingCount.value = outbox.length;

  if (outbox.length > OUTBOX_MAX) {
    const dropped = outbox.length - OUTBOX_MAX;
    // Pagar pengaman: jangan sampai sini diam-diam. Diberi tahu sekali per sesi.
    outbox = outbox.slice(outbox.length - OUTBOX_MAX);
    if (!outboxOverflowWarned) {
      outboxOverflowWarned = true;

      notificationService.add(
        "error",
        "Antrean Sinkronisasi Penuh",
        "Perangkat terlalu lama offline sehingga antrean data kehabisan ruang. Sebagian perubahan awal mungkin belum tersimpan di server. Sambungkan internet lalu muat ulang.",
        undefined
      );
    }
  }

  persistOutbox();
  scheduleFlush(outboxWasEmpty);
}

function scheduleFlush(outboxWasEmpty: boolean) {
  if (flushTimer) clearTimeout(flushTimer);
  // Percobaan dipicu aktivitas user (enqueue) — jangan pakai backoff.
  // TAPI: jumlah percobaan hanya di-reset kalau antrean tadinya kosong.
  // Kalau kasir terus menjual di tengah server error, reset terus-menerus
  // membuat backoff eksponensial tidak pernah naik (retry storm tiap 2 detik).
  if (outboxWasEmpty) flushAttempts = 0;
  flushTimer = setTimeout(() => { void flush(); }, FLUSH_DELAY_MS);
}

/**
 * Retry setelah kegagalan dengan backoff eksponensial.
 *
 * Sebelumnya `catch` selalu menjadwalkan ulang dalam 2 detik, jadi server yang
 * tidak terjangkau memicu percobaan tiap 2 detik selamanya sambil menumpuk
 * notifikasi error. Sekarang: 2s → 4s → 8s … maksimal 5 menit, dan notifikasi
 * dibatasi satu kali per menit supaya kasir tidak dibanjiri.
 */
function scheduleRetry() {
  flushAttempts++;
  const delay = Math.min(FLUSH_DELAY_MS * 2 ** (flushAttempts - 1), 5 * 60_000);
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = setTimeout(() => { void flush(); }, delay);
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

  let session: boolean;
  try {
    session = await hasSession();
  } catch (err) {
    // getSession sendiri bisa gagal (jaringan) — jangan biarkan rejection
    // lolos dari timer; jalurkan ke scheduleRetry seperti kegagalan lain.
    console.error("[sync] session check failed", err);
    syncStatus.value = "error";
    scheduleRetry();
    return false;
  }
  if (!session) { syncStatus.value = "offline"; return false; }

  flushing = true;
  syncStatus.value = "syncing";
  try {
    let newlyParked = 0;
    let flushableExisted = false;
    let anyDone = false;
    const markFail = (e: OutboxEntry) => {
      e.failCount = (e.failCount ?? 0) + 1;
      if (e.failCount === PARK_AFTER_FAILS) newlyParked++;
    };

    for (const table of TABLE_PRIORITY) {
      const entries = outbox.filter(e => e.table === table && (e.failCount ?? 0) < PARK_AFTER_FAILS)
        // Pagar flush: entry tanpa outlet cloud valid tidak pernah menyentuh Supabase.
        .filter(isFlushableEntry);
      if (entries.length === 0) continue;
      flushableExisted = true;

      // Koalesensi per recordId: grup entri diurutkan berdasar createdAt dan
      // HANYA entri terakhir yang dikirim. Upsert berkali-kali saat offline
      // cukup diwakili kondisi akhirnya — mengirim seluruh riwayat boros dan
      // rawan salah urut (server bisa membalik urutan antrean).
      const groups = new Map<string, OutboxEntry[]>();
      for (const e of entries) {
        const g = groups.get(e.recordId);
        if (g) g.push(e); else groups.set(e.recordId, [e]);
      }
      for (const g of groups.values()) {
        g.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      }
      const lastOps = [...groups.values()].map(g => g[g.length - 1]);
      const doneRecordIds = new Set<string>();

      const upserts = lastOps.filter(e => e.op === "upsert");
      for (let i = 0; i < upserts.length; i += 100) {
        const chunkEntries = upserts.slice(i, i + 100);
        // toSnake WAJIB: model aplikasi camelCase, kolom Supabase snake_case.
        // Dulu tanpa ini semua tulis cloud gagal PGRST204 secara diam-diam.
        const chunk = chunkEntries.map(e => toSnake(wireRow(table, e.row!, e.outletId)));
        const { error } = await supabase.from(REMOTE_NAME[table]).upsert(chunk, { onConflict: "id" });
        if (!error) {
          chunkEntries.forEach(e => doneRecordIds.add(e.recordId));
        } else {
          // Chunk ditolak → coba satu-per-satu supaya SATU record bermasalah
          // (mis. pelanggaran skema) tidak menahan 99 record lain — dulu
          // seluruh tabel macet selamanya dengan retry tanpa ujung.
          for (const e of chunkEntries) {
            const row = toSnake(wireRow(table, e.row!, e.outletId));
            const { error: err1 } = await supabase.from(REMOTE_NAME[table]).upsert(row, { onConflict: "id" });
            if (err1) {
              markFail(e);
              console.error(`[sync] upsert failed for ${table}`, err1);
            }
            else doneRecordIds.add(e.recordId);
          }
        }
      }

      for (const entry of lastOps.filter(e => e.op === "delete")) {
        // Delete dibatasi outlet asal mutasi — guard tambahan walau id unik.
        // .select("id") wajib: tanpa itu PostgREST melaporkan sukses walaupun
        // 0 baris cocok (mis. salah outlet / sudah terhapus di tempat lain).
        const { error, data } = await supabase.from(REMOTE_NAME[table]).delete()
          .eq("id", entry.recordId)
          .eq("outlet_id", entry.outletId)
          .select("id");
        if (error) markFail(entry);
        else if (!data || data.length === 0) {
          // 0 baris terhapus → dianggap gagal agar dicoba ulang, bukan dianggap
          // selesai diam-diam padahal data masih ada di server.
          markFail(entry);
          console.error("[sync] delete matched 0 rows", table, entry.recordId);
        }
        else doneRecordIds.add(entry.recordId);
      }

      if (doneRecordIds.size > 0) anyDone = true;
      // Op terakhir sebuah recordId berhasil → SELURUH grup (upsert lama di
      // depannya) sudah usang dan dibuang dari outbox. Gagal → hanya entri
      // terakhir yang di-markFail; grup tetap utuh untuk percobaan berikutnya.
      outbox = outbox.filter(e => !(e.table === table && doneRecordIds.has(e.recordId)));
    }
    flushAttempts = 0;

    // Record yang selalu ditolak server diparkir (tetap tersimpan di outbox &
    // IndexedDB) supaya tidak memboros percobaan; kasir diberi tahu SEKALI.
    if (newlyParked > 0 && !parkNotified) {
      parkNotified = true;
      notificationService.add(
        "error",
        "Sebagian Data Tertahan",
        `${newlyParked} perubahan ditolak server berulang kali dan ditahan di perangkat. Data tetap aman di sini — hubungi owner agar skema data diperiksa.`,
        undefined
      );
    }

    // Ada entry flushable tapi TIDAK ADA yang berhasil — jangan perbarui
    // lastSyncAt supaya UI tidak menampilkan sinkronisasi "segar" padahal
    // tidak ada satu pun data yang benar-benar terkirim.
    if (flushableExisted && !anyDone) {
      syncStatus.value = "error";
      return false;
    }

    lastSyncAt.value = new Date().toISOString();
    syncStatus.value = "idle";
    return true;
  } catch (err) {
    syncStatus.value = "error";
    console.error("[sync] flush failed", err);
    if (Date.now() - lastFailureNotice > FAILURE_NOTICE_COOLDOWN_MS) {
      lastFailureNotice = Date.now();
      notificationService.add(
        "error",
        "Sinkronisasi Gagal",
        "Data lokal belum tersinkronkan ke server. Sistem akan otomatis mencoba lagi.",
        undefined
      );
    }
    scheduleRetry();
    return false;
  } finally {
    flushing = false;
    pendingCount.value = outbox.length;
    persistOutbox(true);
  }
}

/**
 * Ambil SELURUH baris sebuah tabel, bertahap.
 *
 * `select("*")` polos hanya mengembalikan 1000 baris pertama (batas default
 * PostgREST) tanpa memberitahukan apa pun — data yang lewat diam-diam tidak
 * pernah masuk ke perangkat. Karena itu setiap tabel harus di-loop sampai habis.
 */
const PULL_PAGE = 1000;
const PULL_MAX_ROWS = 100_000; // pagar pengaman, bukan pemotongan diam-diam

async function fetchAllRows(table: RemoteTable): Promise<any[]> {
  const rows: any[] = [];
  for (let from = 0; from < PULL_MAX_ROWS; from += PULL_PAGE) {
    let query = supabase.from(REMOTE_NAME[table]).select("*");
    if (isCloudOutletId(activeOutletId.value)) query = query.eq("outlet_id", activeOutletId.value);
    const { data, error } = await query.order("id", { ascending: true })
      .range(from, from + PULL_PAGE - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    rows.push(...data);
    if (data.length < PULL_PAGE) break;
  }
  if (rows.length >= PULL_MAX_ROWS) {
    // Pagar pengaman tercapai — jangan diam-diam (dulu blok kosong).
    notificationService.add(
      "warning",
      "Data Sangat Besar",
      `Tabel "${table}" mencapai batas ${PULL_MAX_ROWS.toLocaleString("id-ID")} baris saat sinkronisasi. Data di atas batas belum termuat di perangkat ini — hubungi owner.`,
      undefined
    );
  }
  return rows;
}

/** Tarik data server -> lokal (hanya mode online). Dipakai saat login/boot online. */
export async function pull(): Promise<boolean> {
  if (isDemoMode || !isOnline.value) return false;
  // Mutex: online-event + boot bisa memicu pull bersamaan → dobel beban server
  // dan merge ganda. Sama seperti flush(), sekali jalan dalam satu waktu.
  if (pulling) return false;
  if (!(await hasSession())) return false;
  // Mode gabungan: tanpa filter outlet — RLS owner mengembalikan seluruh outlet
  // yang boleh diakses. Mode per-outlet: wajib outlet cloud valid.
  if (!combinedView.value && !isCloudOutletId(activeOutletId.value)) return false;

  pulling = true;
  try {
    // Dorong antrean lokal DULU sebelum menarik. Kalau tidak, perubahan yang
    // baru saja dibuat di perangkat ini bisa ditimpa versi server yang belum
    // memuatnya (local lost-update saat boot/login).
    if (outbox.length > 0) await flush();

    for (const [table, apply] of pullers) {
      const data = await fetchAllRows(table);
      if (data.length > 0) await apply(data.map(toCamel));
    }
    lastSyncAt.value = new Date().toISOString();
    return true;
  } catch (err) {
    console.error("[sync] pull failed", err);
    notificationService.add(
      "warning",
      "Sinkronisasi Data Gagal",
      "Gagal mengambil data dari server. Cek koneksi internet Anda.",
      undefined
    );
    return false;
  } finally {
    pulling = false;
  }
}

// Handler disimpan sebagai ref agar bisa dilepas saat app unmount / hot-reload.
const _onOnline = () => {
  isOnline.value = true;
  if (!isDemoMode) { void flush(); void pull(); }
};
const _onOffline = () => {
  isOnline.value = false;
  syncStatus.value = "offline";
};

let listenersAttached = false;

/**
 * Pasang listener online/offline. Dipanggil eksplisit dari bootstrap, bukan
 * saat modul di-import — dulu listener menempel hanya karena modul ini di-import,
 * sehingga `cleanupSyncEngine()` praktis tidak pernah terpakai (HMR/HMR reload
 * menumpuk listener).
 */
export function initSyncEngine(): void {
  if (listenersAttached) return;
  listenersAttached = true;
  window.addEventListener("online", _onOnline);
  window.addEventListener("offline", _onOffline);
}

/** Panggil saat app unmount / sebelum hot-reload agar listener tidak menumpuk. */
export function cleanupSyncEngine() {
  if (!listenersAttached) return;
  listenersAttached = false;
  window.removeEventListener("online", _onOnline);
  window.removeEventListener("offline", _onOffline);
  if (flushTimer) { clearTimeout(flushTimer); flushTimer = null; }
  if (persistTimer) { clearTimeout(persistTimer); persistTimer = null; }
}
