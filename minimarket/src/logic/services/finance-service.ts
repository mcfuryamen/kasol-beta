import { signal } from "@preact/signals";
import type { Shift, PettyCash, VoidRecord, CashFlow, CashFlowType } from "@/data/types/finance";
import { activeShift, currentUser, storeSettings } from "@/logic/state/app-state";
import { ordersSignal } from "./pos-service";
import { productService } from "./product-service";
import { stockService } from "./stock-service";
import { customerService } from "./customer-service";
import { generateId, isToday, isLocalDay } from "@/logic/utils/format";
import { localDb } from "@/data/db/local-db";
import { enqueue, type RemoteTable } from "@/data/sync/sync-engine";
import { resolveOutletContext } from "@/data/sync/outlet-context";
import { hasConcreteOutlet } from "@/logic/services/outlet-service";
import { showToast } from "@/ui/molecules/toast";
import { activeOutletId } from "@/logic/state/app-state";

export const shiftsSignal = signal<Shift[]>([]);
export const pettyCashSignal = signal<PettyCash[]>([]);
export const voidRecordsSignal = signal<VoidRecord[]>([]);
export const cashFlowsSignal = signal<CashFlow[]>([]);

const STORES = {
  shifts: "shifts",
  pettyCash: "pettycash",
  voids: "voids",
  cashFlows: "cashflows"
} as const;

function userId(): string {
  return currentUser.value?.id ?? "unknown";
}

class FinanceService {
  openShift(openingBalance: number, notes?: string): Shift | null {
    // Mode gabungan tidak punya outlet konkret — shift wajib milik satu outlet.
    if (!hasConcreteOutlet()) {
      showToast("Pilih outlet spesifik dulu untuk membuka kas", "error");
      return null;
    }
    const shift: Shift = {
      id: generateId(), openedBy: userId(), openedAt: new Date().toISOString(),
      openingBalance, status: "open", notes
    };
    shiftsSignal.value = [shift, ...shiftsSignal.value];
    activeShift.value = shift;
    void this.persistOne(STORES.shifts, "shifts", shift);
    return shift;
  }

  /**
   * Cashflow turunan penjualan (data legacy: dulu ada versi yang menulis
   * cashflow "in" untuk tiap penjualan tunai) TIDAK boleh ikut menambah kas —
   * penjualan tunai sudah dihitung dari orders, sehingga memasukkannya lagi
   * membuat saldo/ekspektasi kas terhitung ganda (temuan QA F2).
   */
  private saleOrderNumbers(): Set<string> {
    return new Set(ordersSignal.value.map(o => o.orderNumber));
  }

  private isSaleDerivedCashIn(cf: CashFlow, orderNumbers: Set<string>): boolean {
    if (cf.type !== "in" || !cf.description) return false;
    for (const num of orderNumbers) {
      if (num && cf.description.includes(num)) return true;
    }
    return false;
  }

  /**
   * Rincian kas SATU shift — SATU sumber kebenaran perhitungan ekspektasi kas.
   * Dipakai closeShift() DAN CloseKasModal() supaya angka "Ekspektasi Kas" yang
   * dilihat kasir selalu identik dengan `expectedCash` yang tersimpan di shift.
   * Dulu modal menghitung dari rekap per hari kalender (getDailyCashFlow) sementara
   * closeShift menghitung per shift — shift lintas tengah malam atau dua shift
   * sehari menghasilkan selisih yang dilihat kasir ≠ selisih yang tercatat.
   */
  getShiftCashSummary(shift: Shift) {
    const shiftId = shift.id;
    const shiftOrders = ordersSignal.value.filter(
      o => o.shiftId === shiftId && o.createdAt >= shift.openedAt && o.status === "completed"
    );
    const cashSales = shiftOrders.filter(o => o.paymentMethod === "cash").reduce((sum, o) => sum + o.total, 0);
    const nonCashSales = shiftOrders.filter(o => o.paymentMethod !== "cash").reduce((sum, o) => sum + o.total, 0);
    const pettyOut = pettyCashSignal.value.filter(p => p.shiftId === shiftId).reduce((sum, p) => sum + p.amount, 0);
    const orderNumbers = this.saleOrderNumbers();
    const cashIn = cashFlowsSignal.value.filter(cf => cf.shiftId === shiftId && cf.type === "in" && !this.isSaleDerivedCashIn(cf, orderNumbers)).reduce((sum, cf) => sum + cf.amount, 0);
    const cashOut = cashFlowsSignal.value.filter(cf => cf.shiftId === shiftId && cf.type === "out").reduce((sum, cf) => sum + cf.amount, 0);
    return {
      cashSales,
      nonCashSales,
      cashIn,
      cashOut,
      pettyOut,
      transactionCount: shiftOrders.length,
      totalSales: cashSales + nonCashSales,
      totalCashOut: cashOut + pettyOut,
      expectedCash: shift.openingBalance + cashSales + cashIn - pettyOut - cashOut,
    };
  }

  /**
   * Tutup kas HANYA menghitung order milik shift ini (bukan seluruh riwayat),
   * dan uang tunai dihitung dari metode bayar 'cash' — QRIS/debit/e-wallet
   * tidak pernah masuk laci.
   */
  closeShift(actualCash: number, notes?: string): Shift | null {
    if (!activeShift.value) return null;
    const shift = activeShift.value;
    const sum = this.getShiftCashSummary(shift);

    const updated: Shift = {
      ...shift,
      closedBy: userId(), closedAt: new Date().toISOString(),
      closingBalance: actualCash, expectedCash: sum.expectedCash,
      difference: actualCash - sum.expectedCash, status: "closed", notes,
      totalSales: sum.totalSales, transactionCount: sum.transactionCount
    };
    shiftsSignal.value = shiftsSignal.value.map(s => (s.id === shift.id ? updated : s));
    activeShift.value = null;
    void this.persistOne(STORES.shifts, "shifts", updated);
    return updated;
  }

  addPettyCash(data: Omit<PettyCash, "id" | "createdAt">): PettyCash {
    const pc: PettyCash = { ...data, id: generateId(), createdAt: new Date().toISOString() };
    pettyCashSignal.value = [pc, ...pettyCashSignal.value];
    void this.persistOne(STORES.pettyCash, "petty_cash", pc);
    return pc;
  }

  addCashFlow(data: Omit<CashFlow, "id" | "createdAt">): CashFlow {
    const cf: CashFlow = { ...data, id: generateId(), createdAt: new Date().toISOString() };
    cashFlowsSignal.value = [cf, ...cashFlowsSignal.value];
    void this.persistOne(STORES.cashFlows, "cash_flows", cf);
    return cf;
  }

  getCashFlows(type?: CashFlowType, date?: string): CashFlow[] {
    return cashFlowsSignal.value.filter(cf => {
      const matchType = !type || cf.type === type;
      // Tanpa argumen tanggal: semua hari. Dengan tanggal: bandingkan hari LOKAL.
      const matchDate = !date || isLocalDay(cf.createdAt, date);
      return matchType && matchDate;
    });
  }

  /**
   * Void/retur membalikkan SEMUA efek transaksi:
   * stok dikembalikan (mutasi 'return'), poin & total belanja pelanggan dibatalkan.
   */
  voidOrder(orderId: string, reason: string, type: "void" | "return") {
    const order = ordersSignal.value.find(o => o.id === orderId);
    if (!order || order.status === "voided" || order.status === "returned") return;

    const newStatus = type === "void" ? ("voided" as const) : ("returned" as const);
    ordersSignal.value = ordersSignal.value.map(o =>
      o.id === orderId ? { ...o, status: newStatus } : o
    );
    void localDb.put("orders", { ...order, status: newStatus });
    const orderOutlet = resolveOutletContext(order.outlet_id);
    if (orderOutlet !== null) enqueue("orders", "upsert", orderId, { ...order, status: newStatus, outlet_id: orderOutlet });

    for (const item of order.items) {
      productService.updateStock(item.productId, item.qty);
      stockService.addMovement({
        productId: item.productId, productName: item.productName,
        type: "return", qty: item.qty, referenceId: order.id,
        notes: `${type === "void" ? "Void" : "Retur"} ${order.orderNumber}: ${reason}`
      });
    }

    if (order.customerId) {
      customerService.updateSpent(order.customerId, -order.total);
      const pointsToReverse = Math.floor(order.total / storeSettings.value.pointsSpendPerPoint);
      if (pointsToReverse > 0) {
        customerService.adjustPoints(
          order.customerId, -pointsToReverse,
          `${type === "void" ? "Void" : "Retur"} ${order.orderNumber}`,
          order.id
        );
      }
    }

    const vr: VoidRecord = {
      id: generateId(), orderId, orderNumber: order.orderNumber, reason,
      amount: order.total, type, createdBy: userId(), createdAt: new Date().toISOString()
    };
    voidRecordsSignal.value = [vr, ...voidRecordsSignal.value];
    void this.persistOne(STORES.voids, "void_records", vr);
  }

  getActiveShift(): Shift | null { return activeShift.value; }

  /** Rekap kas harian: tunai dipisah dari non-tunai untuk rekonsiliasi laci. */
  getDailyCashFlow() {
    const todayOrders = ordersSignal.value.filter(o => isToday(o.createdAt) && o.status === "completed");
    const cashSales = todayOrders.filter(o => o.paymentMethod === "cash").reduce((s, o) => s + o.total, 0);
    const digitalSales = todayOrders.filter(o => o.paymentMethod !== "cash").reduce((s, o) => s + o.total, 0);
    const orderNumbers = this.saleOrderNumbers();
    const extraIn = cashFlowsSignal.value.filter(cf => isToday(cf.createdAt) && cf.type === "in" && !this.isSaleDerivedCashIn(cf, orderNumbers)).reduce((s, cf) => s + cf.amount, 0);
    const extraOut = cashFlowsSignal.value.filter(cf => isToday(cf.createdAt) && cf.type === "out").reduce((s, cf) => s + cf.amount, 0);
    const pettyOut = pettyCashSignal.value.filter(p => isToday(p.createdAt)).reduce((s, p) => s + p.amount, 0);

    return {
      cashIn: cashSales + extraIn,
      digitalSales,
      cashOut: extraOut + pettyOut,
      net: cashSales + extraIn + digitalSales - extraOut - pettyOut
    };
  }

  getRunningBalance(): number {
    const shift = activeShift.value;
    if (!shift) return 0;
    const shiftOrders = ordersSignal.value.filter(
      o => o.shiftId === shift.id && o.createdAt >= shift.openedAt && o.status === "completed"
    );
    const cashSales = shiftOrders.filter(o => o.paymentMethod === "cash").reduce((s, o) => s + o.total, 0);
    const orderNumbers = this.saleOrderNumbers();
    const cashIn = cashFlowsSignal.value.filter(cf => cf.shiftId === shift.id && cf.type === "in" && !this.isSaleDerivedCashIn(cf, orderNumbers)).reduce((s, cf) => s + cf.amount, 0);
    const cashOut = cashFlowsSignal.value.filter(cf => cf.shiftId === shift.id && cf.type === "out").reduce((s, cf) => s + cf.amount, 0);
    const pettyOut = pettyCashSignal.value.filter(p => p.shiftId === shift.id).reduce((s, p) => s + p.amount, 0);
    return shift.openingBalance + cashSales + cashIn - cashOut - pettyOut;
  }

  private async persistOne(store: "shifts" | "cashflows" | "pettycash" | "voids", table: RemoteTable, row: any) {
    // Tag IndexedDB dengan outlet asal (Tahap 4); lihat product-service.
    const outletId = resolveOutletContext(row.outlet_id);
    await localDb.put(store, { ...row, outlet_id: outletId ?? row.outlet_id });
    if (outletId !== null) enqueue(table, "upsert", row.id, { ...row, outlet_id: outletId });
  }
}

export const financeService = new FinanceService();
