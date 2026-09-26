import { signal } from "@preact/signals";
import type { Shift, PettyCash, VoidRecord, CashFlow, CashFlowType } from "@/data/types/finance";
import { activeShift, currentUser, storeSettings } from "@/logic/state/app-state";
import { ordersSignal } from "./pos-service";
import { productService } from "./product-service";
import { stockService } from "./stock-service";
import { customerService } from "./customer-service";
import { generateId } from "@/logic/utils/format";
import { localDb } from "@/data/db/local-db";
import { enqueue, type RemoteTable } from "@/data/sync/sync-engine";

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
  openShift(openingBalance: number, notes?: string): Shift {
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
   * Tutup kas HANYA menghitung order milik shift ini (bukan seluruh riwayat),
   * dan uang tunai dihitung dari metode bayar 'cash' — QRIS/debit/e-wallet
   * tidak pernah masuk laci.
   */
  closeShift(actualCash: number, notes?: string): Shift | null {
    if (!activeShift.value) return null;
    const shift = activeShift.value;
    const shiftId = shift.id;

    const shiftOrders = ordersSignal.value.filter(
      o => o.shiftId === shiftId && o.createdAt >= shift.openedAt && o.status === "completed"
    );
    const cashSales = shiftOrders.filter(o => o.paymentMethod === "cash").reduce((sum, o) => sum + o.total, 0);
    const nonCashSales = shiftOrders.filter(o => o.paymentMethod !== "cash").reduce((sum, o) => sum + o.total, 0);
    const pettyOut = pettyCashSignal.value.filter(p => p.shiftId === shiftId).reduce((sum, p) => sum + p.amount, 0);
    const cashIn = cashFlowsSignal.value.filter(cf => cf.shiftId === shiftId && cf.type === "in").reduce((sum, cf) => sum + cf.amount, 0);
    const cashOut = cashFlowsSignal.value.filter(cf => cf.shiftId === shiftId && cf.type === "out").reduce((sum, cf) => sum + cf.amount, 0);
    const expectedCash = shift.openingBalance + cashSales + cashIn - pettyOut - cashOut;

    const updated: Shift = {
      ...shift,
      closedBy: userId(), closedAt: new Date().toISOString(),
      closingBalance: actualCash, expectedCash,
      difference: actualCash - expectedCash, status: "closed", notes,
      totalSales: cashSales + nonCashSales, transactionCount: shiftOrders.length
    };
    shiftsSignal.value = shiftsSignal.value.map(s => (s.id === shiftId ? updated : s));
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
      const matchDate = !date || cf.createdAt.startsWith(date);
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
    enqueue("orders", "upsert", orderId, { ...order, status: newStatus });

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
      if (pointsToReverse > 0) customerService.redeemPoints(order.customerId, pointsToReverse);
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
    const today = new Date().toISOString().slice(0, 10);
    const todayOrders = ordersSignal.value.filter(o => o.createdAt.startsWith(today) && o.status === "completed");
    const cashSales = todayOrders.filter(o => o.paymentMethod === "cash").reduce((s, o) => s + o.total, 0);
    const digitalSales = todayOrders.filter(o => o.paymentMethod !== "cash").reduce((s, o) => s + o.total, 0);
    const extraIn = cashFlowsSignal.value.filter(cf => cf.createdAt.startsWith(today) && cf.type === "in").reduce((s, cf) => s + cf.amount, 0);
    const extraOut = cashFlowsSignal.value.filter(cf => cf.createdAt.startsWith(today) && cf.type === "out").reduce((s, cf) => s + cf.amount, 0);
    const pettyOut = pettyCashSignal.value.filter(p => p.createdAt.startsWith(today)).reduce((s, p) => s + p.amount, 0);

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
    const cashIn = cashFlowsSignal.value.filter(cf => cf.shiftId === shift.id && cf.type === "in").reduce((s, cf) => s + cf.amount, 0);
    const cashOut = cashFlowsSignal.value.filter(cf => cf.shiftId === shift.id && cf.type === "out").reduce((s, cf) => s + cf.amount, 0);
    const pettyOut = pettyCashSignal.value.filter(p => p.shiftId === shift.id).reduce((s, p) => s + p.amount, 0);
    return shift.openingBalance + cashSales + cashIn - cashOut - pettyOut;
  }

  private async persistOne(store: "shifts" | "cashflows" | "pettycash" | "voids", table: RemoteTable, row: any) {
    await localDb.put(store, row);
    enqueue(table, "upsert", row.id, row);
  }
}

export const financeService = new FinanceService();
