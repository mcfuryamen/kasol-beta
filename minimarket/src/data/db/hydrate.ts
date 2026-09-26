import { effect } from "@preact/signals";
import { isDemoMode } from "@/data/supabase";
import { localDb, kvGet, kvSet } from "@/data/db/local-db";
import {
  seedProducts, seedCustomers, seedSuppliers, seedPromos, seedVouchers, seedOrders
} from "@/data/db/seeds";
import { registerPuller } from "@/data/sync/sync-engine";
import { setOrderCounterProvider } from "@/logic/utils/format";
import { productsSignal } from "@/logic/services/product-service";
import { customersSignal } from "@/logic/services/customer-service";
import { ordersSignal } from "@/logic/services/pos-service";
import {
  shiftsSignal, pettyCashSignal, voidRecordsSignal, cashFlowsSignal
} from "@/logic/services/finance-service";
import { activeShift } from "@/logic/state/app-state";
import {
  stockMovementsSignal, stockOpnameSignal, batchInfoSignal
} from "@/logic/services/stock-service";
import { promosSignal, vouchersSignal } from "@/logic/services/promo-service";
import { suppliersSignal, purchaseOrdersSignal } from "@/logic/services/supplier-service";
import {
  cartItems, heldOrders, storeSettings, printerConfig
} from "@/logic/state/app-state";

const DEMO_CASHIER_ID = "demo-kasir";
const DEMO_CASHIER_NAME = "Andi Prasetyo";

function orderCounterKey(): string {
  const d = new Date();
  return `order_counter_${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
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

/**
 * Boot data: muat dari IndexedDB; jika mode demo & kosong, isi seed.
 * Mode online menunggu pull() dari Supabase setelah login.
 */
export async function initLocalData(): Promise<void> {
  // ---- Produk
  await seedIfEmpty("products", isDemoMode ? seedProducts : [], rows => { productsSignal.value = rows; });

  // ---- Pelanggan
  await seedIfEmpty("customers", isDemoMode ? seedCustomers : [], rows => { customersSignal.value = rows; });

  // ---- Supplier & PO
  await seedIfEmpty("suppliers", isDemoMode ? seedSuppliers : [], rows => { suppliersSignal.value = rows; });
  purchaseOrdersSignal.value = await localDb.getAll("purchase_orders");

  // ---- Promo & voucher
  await seedIfEmpty("promos", isDemoMode ? seedPromos : [], rows => { promosSignal.value = rows; });
  await seedIfEmpty("vouchers", isDemoMode ? seedVouchers : [], rows => { vouchersSignal.value = rows; });

  // ---- Order
  await seedIfEmpty(
    "orders",
    isDemoMode ? seedOrders(DEMO_CASHIER_ID, DEMO_CASHIER_NAME) : [],
    rows => { ordersSignal.value = [...rows].sort((a, b) => b.createdAt.localeCompare(a.createdAt)); }
  );

  // ---- Keuangan
  shiftsSignal.value = await localDb.getAll("shifts");
  activeShift.value = shiftsSignal.value.find(s => s.status === "open") ?? null;
  cashFlowsSignal.value = await localDb.getAll("cashflows");
  pettyCashSignal.value = await localDb.getAll("pettycash");
  voidRecordsSignal.value = await localDb.getAll("voids");

  // ---- Stok
  stockMovementsSignal.value = await localDb.getAll("movements");
  stockOpnameSignal.value = await localDb.getAll("opnames");
  batchInfoSignal.value = await localDb.getAll("batches");

  // ---- Counter nomor order sekuensial harian
  setOrderCounterProvider(async () => {
    const key = orderCounterKey();
    const next = ((await kvGet<number>(key)) ?? 0) + 1;
    await kvSet(key, next);
    return next;
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

  // ---- Penerima hasil pull Supabase (mode online)
  registerPuller("products", async rows => {
    productsSignal.value = rows;
    await localDb.bulkPut("products", rows);
  });
  registerPuller("customers", async rows => {
    customersSignal.value = rows;
    await localDb.bulkPut("customers", rows);
  });
  registerPuller("orders", async rows => {
    ordersSignal.value = [...rows].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    await localDb.bulkPut("orders", rows);
  });
  registerPuller("shifts", async rows => {
    shiftsSignal.value = rows;
    if (!activeShift.value) activeShift.value = rows.find(s => s.status === "open") ?? null;
    await localDb.bulkPut("shifts", rows);
  });
  registerPuller("cash_flows", async rows => {
    cashFlowsSignal.value = rows;
    await localDb.bulkPut("cashflows", rows);
  });
  registerPuller("petty_cash", async rows => {
    pettyCashSignal.value = rows;
    await localDb.bulkPut("pettycash", rows);
  });
  registerPuller("void_records", async rows => {
    voidRecordsSignal.value = rows;
    await localDb.bulkPut("voids", rows);
  });
  registerPuller("stock_mutations", async rows => {
    stockMovementsSignal.value = rows;
    await localDb.bulkPut("movements", rows);
  });
  registerPuller("promos", async rows => {
    promosSignal.value = rows;
    await localDb.bulkPut("promos", rows);
  });
  registerPuller("vouchers", async rows => {
    vouchersSignal.value = rows;
    await localDb.bulkPut("vouchers", rows);
  });
  registerPuller("suppliers", async rows => {
    suppliersSignal.value = rows;
    await localDb.bulkPut("suppliers", rows);
  });
  registerPuller("purchase_orders", async rows => {
    purchaseOrdersSignal.value = rows;
    await localDb.bulkPut("purchase_orders", rows);
  });
}
