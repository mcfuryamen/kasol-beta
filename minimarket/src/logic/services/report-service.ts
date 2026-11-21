import { ordersSignal } from "./pos-service";
import { productsSignal } from "./product-service";
import { localDateKey, isLocalDay } from "@/logic/utils/format";
import type { SalesReport, ProductSalesReport, PaymentReport } from "@/data/types/report";

class ReportService {
  getSalesReport(days = 7): SalesReport[] {
    const result: SalesReport[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const date = localDateKey(d);
      const orders = ordersSignal.value.filter(o => isLocalDay(o.createdAt, date) && o.status === "completed");
      const revenue = orders.reduce((sum, o) => sum + o.total, 0);
      const cogs = orders.reduce((sum, o) => sum + o.items.reduce((s, it) => s + it.buyPrice * it.qty, 0), 0);
      result.push({
        date, revenue, cogs, grossProfit: revenue - cogs,
        transactionCount: orders.length,
        avgTransaction: orders.length > 0 ? Math.round(revenue / orders.length) : 0
      });
    }
    return result;
  }

  /**
   * Batas awal periode `days` hari lokal (termasuk hari ini) sebagai instant.
   * Dipakai bersama getSalesReport supaya semua panel laporan memakai definisi
   * periode yang sama.
   */
  private periodStart(days: number): Date {
    const d = new Date();
    d.setDate(d.getDate() - (days - 1));
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }

  getTopProducts(limit = 10, days = 7): ProductSalesReport[] {
    const start = this.periodStart(days);
    const map = new Map<string, ProductSalesReport>();
    ordersSignal.value.filter(o => o.status === "completed" && new Date(o.createdAt) >= start).forEach(o => {
      o.items.forEach(item => {
        const existing = map.get(item.productId);
        const profit = item.qty * (item.sellPrice - item.buyPrice);
        if (existing) {
          existing.qtySold += item.qty;
          existing.revenue += item.subtotal;
          existing.profit += profit;
        } else {
          map.set(item.productId, { productId: item.productId, productName: item.productName, qtySold: item.qty, revenue: item.subtotal, profit });
        }
      });
    });
    return Array.from(map.values()).sort((a, b) => b.revenue - a.revenue).slice(0, limit);
  }

  getPaymentReport(days = 7): PaymentReport[] {
    const start = this.periodStart(days);
    const map = new Map<string, PaymentReport>();
    ordersSignal.value.filter(o => o.status === "completed" && new Date(o.createdAt) >= start).forEach(o => {
      const existing = map.get(o.paymentMethod);
      if (existing) { existing.count++; existing.total += o.total; }
      else map.set(o.paymentMethod, { method: o.paymentMethod, count: 1, total: o.total });
    });
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }

  getStockValue(): number {
    return productsSignal.value.reduce((sum, p) => sum + p.stock * p.buyPrice, 0);
  }
}

export const reportService = new ReportService();
