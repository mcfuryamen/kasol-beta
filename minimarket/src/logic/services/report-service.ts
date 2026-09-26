import { ordersSignal } from "./pos-service";
import { productsSignal } from "./product-service";
import type { SalesReport, ProductSalesReport, PaymentReport } from "@/data/types/report";

class ReportService {
  getSalesReport(days = 7): SalesReport[] {
    const result: SalesReport[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const date = d.toISOString().slice(0, 10);
      const orders = ordersSignal.value.filter(o => o.createdAt.startsWith(date) && o.status === "completed");
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

  getTopProducts(limit = 10): ProductSalesReport[] {
    const map = new Map<string, ProductSalesReport>();
    ordersSignal.value.filter(o => o.status === "completed").forEach(o => {
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

  getPaymentReport(): PaymentReport[] {
    const map = new Map<string, PaymentReport>();
    ordersSignal.value.filter(o => o.status === "completed").forEach(o => {
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
