import { effect } from "@preact/signals";
import { isDemoMode } from "@/data/supabase";
import { localDb, kvGet, kvSet, kvIncrement } from "@/data/db/local-db";
import {
  seedProducts, seedCustomers, seedSuppliers, seedPromos, seedVouchers, seedOrders
} from "@/data/db/seeds";
import { registerPuller, pendingIdsFor, flush, pull, type RemoteTable } from "@/data/sync/sync-engine";
import { mergeById, filterByOutlet } from "@/data/sync/merge";
import { onOutletSwitched } from "@/logic/services/outlet-service";
import { setCounterProvider, setOrderCounterProvider, localDateKey } from "@/logic/utils/format";
import { productsSignal } from "@/logic/services/product-service";
import { customersSignal, loyaltyTxSignal } from "@/logic/services/customer-service";
import { ordersSignal } from "@/logic/services/pos-service";
import {
  shiftsSignal, pettyCashSignal, voidRecordsSignal, cashFlowsSignal
} from "@/logic/services/finance-service";
import { activeShift } from "@/logic/state/app-state";
import { outletService } from "@/logic/services/outlet-service";
import type { OrderItem } from "@/data/types/order";
import {
  stockMovementsSignal, stockOpnameSignal, batchInfoSignal
} from "@/logic/services/stock-service";
import { promosSignal, vouchersSignal } from "@/logic/services/promo-service";
import { suppliersSignal, purchaseOrdersSignal } from "@/logic/services/supplier-service";
import {
  cartItems, heldOrders, storeSettings, printerConfig,
  orderDiscount, selectedCustomer, numpadInput, lastScannedBarcode,
  activeOutletId
} from "@/logic/state/app-state";

const DEMO_CASHIER_ID = "demo-kasir";
const DEMO_CASHIER_NAME = "Andi Prasetyo";

function orderCounterKey(): string {
  // Memakai hari LOKAL agar konsisten dengan nomor order (format.todayKey) dan
  // dengan filter "hari ini" di service — sebelumnya campur UTC/lokal.
  return `order_counter_${localDateKey().replace(/-/g, "")}`;
}

/** Predikat merge untuk sebuah tabel: true bila id-nya masih di outbox. */
function protectPending(table: RemoteTable) {
  const pending = pendingIdsFor(table);
  return (id: string) => pending.has(id);
}

async function seedIfEmpty<T extends { id: string }>(store: Parameters<typeof localDb.getAll>[0], rows: T[], apply: (rows: T[]) => void) {
  const existing = await localDb.getAll<T>(store);
  if (existing.length > 0) {
    apply(existing);
    return;
  }
  if (rows.length > 0) await localDb.bulkPut(store, rows);
  apply(rows);
}

function normalizeProducts<T extends { id: string }>(rows: T[]): T[] {
  return rows.map(row => {
    const source = row as T & Record<string, any>;
    const { isActive, is_active, ...rest } = source;
    return { ...rest, active: source.active ?? isActive ?? is_active ?? true } as T;
  });
}

/**
 * Muat ulang data operasional dari IndexedDB untuk SATU outlet (Tahap 4).
 *
 * Hanya setengah "load" dari initLocalData: membaca store, memfilter per-outlet
 * (baris tanpa tag legacy tetap tampil), lalu mengisi signal. Tidak mendaftar
 * puller/effect/counter dan tidak menyentuh kv cart — itu kerja initLocalData
 * saja, supaya fungsi ini aman dipanggil ulang setiap kali outlet berpindah.
 */
export async function hydrateForOutlet(outletId: string | null | undefined): Promise<void> {
  const products = normalizeProducts(await localDb.getAll<any>("products"));
  productsSignal.value = filterByOutlet(products, outletId);

  const customers = await localDb.getAll<any>("customers");
  customersSignal.value = filterByOutlet(customers, outletId);
  loyaltyTxSignal.value = await localDb.getAll("loyalty_transactions");

  const suppliers = await localDb.getAll<any>("suppliers");
  suppliersSignal.value = filterByOutlet(suppliers, outletId);
  const purchaseOrders = await localDb.getAll<any>("purchase_orders");
  purchaseOrdersSignal.value = filterByOutlet(purchaseOrders, outletId);

  const promos = await localDb.getAll<any>("promos");
  promosSignal.value = filterByOutlet(promos, outletId);
  const vouchers = await localDb.getAll<any>("vouchers");
  vouchersSignal.value = filterByOutlet(vouchers, outletId);

  const orders = await localDb.getAll<any>("orders");
  ordersSignal.value = [...filterByOutlet(orders, outletId)]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const shifts = await localDb.getAll<any>("shifts");
  shiftsSignal.value = filterByOutlet(shifts, outletId);
  // Mode gabungan (outletId null): tidak ada SATU shift aktif yang berlaku —
  // transaksi diblokir sampai outlet konkret dipilih.
  activeShift.value = outletId
    ? shiftsSignal.value.find(s => s.status === "open") ?? null
    : null;
  const cashFlows = await localDb.getAll<any>("cashflows");
  cashFlowsSignal.value = filterByOutlet(cashFlows, outletId);
  const pettyCash = await localDb.getAll<any>("pettycash");
  pettyCashSignal.value = filterByOutlet(pettyCash, outletId);
  const voids = await localDb.getAll<any>("voids");
  voidRecordsSignal.value = filterByOutlet(voids, outletId);

  const movements = await localDb.getAll<any>("movements");
  stockMovementsSignal.value = filterByOutlet(movements, outletId);
  stockOpnameSignal.value = await localDb.getAll("opnames");
  batchInfoSignal.value = await localDb.getAll("batches");
}

/**
 * Boot data: muat dari IndexedDB; jika mode demo & kosong, isi seed.
 * Mode online menunggu pull() dari Supabase setelah login.
 */
export async function initLocalData(): Promise<void> {
  // ---- Seed demo (sekali, saat store kosong) — signal diisi ulang di bawah.
  await seedIfEmpty("products", isDemoMode ? seedProducts : [], () => {});
  await seedIfEmpty("customers", isDemoMode ? seedCustomers : [], () => {});
  await seedIfEmpty("suppliers", isDemoMode ? seedSuppliers : [], () => {});
  await seedIfEmpty("promos", isDemoMode ? seedPromos : [], () => {});
  await seedIfEmpty("vouchers", isDemoMode ? seedVouchers : [], () => {});
  await seedIfEmpty("orders", isDemoMode ? seedOrders(DEMO_CASHIER_ID, DEMO_CASHIER_NAME) : [], () => {});

  // ---- Outlet context dulu, baru hydrate terfilter (Tahap 4).
  await outletService.load();
  await hydrateForOutlet(activeOutletId.value);

  // ---- Counter nomor order sekuensial harian — atomik via kvIncrement
  setOrderCounterProvider(async () => {
    return kvIncrement(orderCounterKey());
  });

  // ---- Counter nomor PO harian — atomik via kvIncrement.
  //      Tanpa provider, nextPONumber() selalu jatuh ke seq=1 sehingga semua
  //      PO di hari yang sama bernomor identik (PO-YYYYMMDD-001).
  setCounterProvider("PO", async () => {
    return kvIncrement(`po_counter_${localDateKey().replace(/-/g, "")}`);
  });

  // ---- Snapshot UI POS agar transaksi tertahan selamat dari refresh
  const savedCart = await kvGet<typeof cartItems.value>("pos_cart");
  if (savedCart?.length) cartItems.value = savedCart;
  const savedHeld = await kvGet<typeof heldOrders.value>("pos_held");
  if (savedHeld) heldOrders.value = savedHeld;

  const savedSettings = await kvGet<Partial<typeof storeSettings.value>>("store_settings");
  if (savedSettings) storeSettings.value = { ...storeSettings.value, ...savedSettings };

  const savedPrinter = await kvGet<Partial<typeof printerConfig.value>>("printer_config");
  if (savedPrinter) printerConfig.value = { ...printerConfig.value, ...savedPrinter };

  effect(() => { void kvSet("pos_cart", cartItems.value); });
  effect(() => { void kvSet("pos_held", heldOrders.value); });
  effect(() => { void kvSet("store_settings", storeSettings.value); });
  effect(() => { void kvSet("printer_config", printerConfig.value); });

  // ---- Penerima hasil pull Supabase (mode online) — merge, bukan replace
  registerPuller("products", async rows => {
    // pos_products memakai kolom is_active; setelah toCamel() namanya menjadi
    // isActive, sedangkan model UI memakai active. Normalisasi juga menjaga
    // snapshot lama di IndexedDB tetap bisa ditampilkan.
    const normalized = normalizeProducts(rows);
    const merged = mergeById(productsSignal.value, normalized, protectPending("products"));
    productsSignal.value = merged;
    await localDb.bulkPut("products", merged);
  });
  registerPuller("customers", async rows => {
    const merged = mergeById(customersSignal.value, rows, protectPending("customers"));
    customersSignal.value = merged;
    await localDb.bulkPut("customers", merged);
  });
  registerPuller("orders", async rows => {
    // Baris order dari Supabase tidak membawa `items` (keduanya ada di tabel
    // order_items). Tanpa penjagaan ini merge akan menimpa order lokal yang
    // sudah punya item dengan order server yang items-nya kosong.
    const localItems = new Map(ordersSignal.value.map(o => [o.id, o.items]));
    const merged = mergeById(ordersSignal.value, rows, protectPending("orders")).map(o => {
      if (o.items?.length) return o;
      const kept = localItems.get(o.id);
      return { ...o, items: kept?.length ? kept : [] };
    });
    ordersSignal.value = [...merged].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    await localDb.bulkPut("orders", merged);
  });
  registerPuller("order_items", async rows => {
    // Item ditarik terpisah lalu ditempelkan kembali ke order-nya.
    // Didaftarkan setelah "orders" supaya order-nya sudah ada di signal.
    const byOrder = new Map<string, OrderItem[]>();
    for (const row of rows) {
      const { orderId, ...item } = row as Record<string, any>;
      if (!orderId) continue;
      const list = byOrder.get(orderId) ?? [];
      list.push(item as unknown as OrderItem);
      byOrder.set(orderId, list);
    }
    if (byOrder.size === 0) return;

    // Order lokal yang sudah punya item tidak ditimpa: di POS item tidak
    // pernah diedit setelah transaksi, jadi yang lebih lengkap selalu benar.
    let changed = false;
    const merged = ordersSignal.value.map(o => {
      const incoming = byOrder.get(o.id);
      if (!incoming || (o.items ?? []).length > 0) return o;
      changed = true;
      return { ...o, items: incoming };
    });
    if (!changed) return;
    ordersSignal.value = [...merged].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    await localDb.bulkPut("orders", merged);
  });
  registerPuller("shifts", async rows => {
    const merged = mergeById(shiftsSignal.value, rows, protectPending("shifts"));
    shiftsSignal.value = merged;
    if (!activeShift.value) activeShift.value = merged.find(s => s.status === "open") ?? null;
    await localDb.bulkPut("shifts", merged);
  });
  registerPuller("cash_flows", async rows => {
    const merged = mergeById(cashFlowsSignal.value, rows, protectPending("cash_flows"));
    cashFlowsSignal.value = merged;
    await localDb.bulkPut("cashflows", merged);
  });
  registerPuller("petty_cash", async rows => {
    const merged = mergeById(pettyCashSignal.value, rows, protectPending("petty_cash"));
    pettyCashSignal.value = merged;
    await localDb.bulkPut("pettycash", merged);
  });
  registerPuller("void_records", async rows => {
    const merged = mergeById(voidRecordsSignal.value, rows, protectPending("void_records"));
    voidRecordsSignal.value = merged;
    await localDb.bulkPut("voids", merged);
  });
  registerPuller("stock_mutations", async rows => {
    const merged = mergeById(stockMovementsSignal.value, rows, protectPending("stock_mutations"));
    stockMovementsSignal.value = merged;
    await localDb.bulkPut("movements", merged);
  });
  registerPuller("promos", async rows => {
    const merged = mergeById(promosSignal.value, rows, protectPending("promos"));
    promosSignal.value = merged;
    await localDb.bulkPut("promos", merged);
  });
  registerPuller("vouchers", async rows => {
    const merged = mergeById(vouchersSignal.value, rows, protectPending("vouchers"));
    vouchersSignal.value = merged;
    await localDb.bulkPut("vouchers", merged);
  });
  registerPuller("suppliers", async rows => {
    const merged = mergeById(suppliersSignal.value, rows, protectPending("suppliers"));
    suppliersSignal.value = merged;
    await localDb.bulkPut("suppliers", merged);
  });
  registerPuller("purchase_orders", async rows => {
    const merged = mergeById(purchaseOrdersSignal.value, rows, protectPending("purchase_orders"));
    purchaseOrdersSignal.value = merged;
    await localDb.bulkPut("purchase_orders", merged);
  });
  // Loyalty transactions remain local-only until the cloud table is deployed.

  // ---- Tahap 4: isolasi state saat outlet berpindah.
  //      Dipasang SETELAH boot selesai supaya force-select dari outletService.load()
  //      di atas tidak memicu hydrate ganda.
  onOutletSwitched(async newOutletId => {
    // Sesi POS milik outlet lama tidak boleh terbawa: keranjang, order ditahan,
    // pelanggan terpilih, dan shift aktif di-reset sebelum data outlet baru dimuat.
    cartItems.value = [];
    heldOrders.value = [];
    orderDiscount.value = 0;
    selectedCustomer.value = null;
    numpadInput.value = "";
    lastScannedBarcode.value = "";
    activeShift.value = null;

    await hydrateForOutlet(newOutletId);

    // Cloud: dorong antrean lama lalu tarik data outlet baru. Outbox tetap
    // membawa outlet asal mutasi, jadi flush aman walau aktif sudah berpindah.
    if (!isDemoMode) { void flush(); void pull(); }
  });
}

/**
 * Muat data cloud setelah login berhasil (F13).
 *
 * Boot memanggil initLocalData() SEBELUM user login: tanpa sesi, outlet cloud
 * tidak terbaca RLS sehingga activeOutletId null dan pull() di-skip — aplikasi
 * tampil kosong sampai reload. Fungsi ini idempotent terhadap initLocalData:
 * tidak mendaftar ulang puller/effect, hanya memuat outlet, mendorong outbox,
 * menarik data server, lalu menghidrasi signal dari IndexedDB.
 */
export async function loadDataAfterLogin(): Promise<void> {
  if (isDemoMode) return;
  await outletService.load();
  await flush();
  await pull();
  await hydrateForOutlet(activeOutletId.value);
}
