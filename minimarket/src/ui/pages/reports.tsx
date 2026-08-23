import { reportService } from "@/logic/services/report-service";
import { formatRupiah, formatDate } from "@/logic/utils/format";
import { Icons } from "@/ui/atoms/icon";
import { useState } from "preact/hooks";
import { Badge } from "@/ui/atoms/badge";

const paymentLabels: Record<string, string> = {
  cash: "Tunai", qris: "QRIS", debit: "Debit", credit: "Kredit", ewallet: "E-Wallet", tempo: "Tempo"
};

export function ReportsPage() {
  const [period, setPeriod] = useState<7|14|30>(7);
  const salesReport = reportService.getSalesReport(period);
  const topProducts = reportService.getTopProducts(10);
  const paymentReport = reportService.getPaymentReport();
  const stockValue = reportService.getStockValue();

  const totalRevenue = salesReport.reduce((s, r) => s + r.revenue, 0);
  const totalProfit = salesReport.reduce((s, r) => s + r.grossProfit, 0);
  const totalTx = salesReport.reduce((s, r) => s + r.transactionCount, 0);

  return (
    <div class="space-y-6 max-w-5xl mx-auto">
      <div class="flex items-center justify-between">
        <h2 class="text-2xl font-black text-gray-900 dark:text-gray-100">Laporan</h2>
        <div class="flex gap-1 p-1 bg-gray-100 dark:bg-gray-800 rounded-xl">
          {([7,14,30] as const).map(d => (
            <button key={d} onClick={() => setPeriod(d)} class={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${period===d?"bg-white dark:bg-gray-700 shadow-sm text-gray-900 dark:text-gray-100":"text-gray-500"}`}>{d} Hari</button>
          ))}
        </div>
      </div>

      {/* Summary cards */}
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div class="bg-gradient-to-br from-orange-500 to-orange-600 text-white rounded-2xl p-4">
          <p class="text-xs opacity-80 mb-1">Total Pendapatan</p>
          <p class="text-xl font-black">{formatRupiah(totalRevenue)}</p>
        </div>
        <div class="bg-gradient-to-br from-green-500 to-green-600 text-white rounded-2xl p-4">
          <p class="text-xs opacity-80 mb-1">Laba Kotor</p>
          <p class="text-xl font-black">{formatRupiah(totalProfit)}</p>
        </div>
        <div class="bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-2xl p-4">
          <p class="text-xs opacity-80 mb-1">Total Transaksi</p>
          <p class="text-xl font-black">{totalTx}</p>
        </div>
        <div class="bg-gradient-to-br from-purple-500 to-purple-600 text-white rounded-2xl p-4">
          <p class="text-xs opacity-80 mb-1">Nilai Stok</p>
          <p class="text-xl font-black">{formatRupiah(stockValue)}</p>
        </div>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Daily sales chart (text-based) */}
        <div class="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 overflow-hidden">
          <div class="p-4 border-b border-gray-100 dark:border-gray-700">
            <h3 class="font-semibold text-gray-900 dark:text-gray-100">Penjualan Harian</h3>
          </div>
          <div class="p-4 space-y-2">
            {salesReport.slice(-7).map(r => {
              const maxRev = Math.max(...salesReport.map(x => x.revenue), 1);
              const pct = (r.revenue / maxRev) * 100;
              return (
                <div key={r.date} class="flex items-center gap-3">
                  <span class="text-xs text-gray-400 w-16 flex-shrink-0">{formatDate(r.date, {day:"2-digit",month:"short"})}</span>
                  <div class="flex-1 bg-gray-100 dark:bg-gray-700 rounded-full h-5 overflow-hidden">
                    <div class="h-full bg-primary-500 rounded-full transition-all" style={{width: `${pct}%`}} />
                  </div>
                  <span class="text-xs font-semibold text-gray-700 dark:text-gray-300 w-24 text-right flex-shrink-0">{formatRupiah(r.revenue)}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Top products */}
        <div class="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 overflow-hidden">
          <div class="p-4 border-b border-gray-100 dark:border-gray-700">
            <h3 class="font-semibold text-gray-900 dark:text-gray-100">Produk Terlaris</h3>
          </div>
          <div class="divide-y divide-gray-50 dark:divide-gray-700">
            {topProducts.slice(0,7).map((p, i) => (
              <div key={p.productId} class="p-3 flex items-center gap-3">
                <span class="w-6 h-6 rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 flex items-center justify-center text-xs font-bold flex-shrink-0">{i+1}</span>
                <div class="flex-1 min-w-0">
                  <p class="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{p.productName}</p>
                  <p class="text-xs text-gray-400">{p.qtySold} terjual</p>
                </div>
                <p class="font-bold text-sm text-primary-600 dark:text-primary-400">{formatRupiah(p.revenue)}</p>
              </div>
            ))}
            {topProducts.length === 0 && <div class="p-8 text-center text-gray-400 text-sm">Belum ada data penjualan</div>}
          </div>
        </div>

        {/* Payment breakdown */}
        <div class="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 overflow-hidden">
          <div class="p-4 border-b border-gray-100 dark:border-gray-700">
            <h3 class="font-semibold text-gray-900 dark:text-gray-100">Per Metode Pembayaran</h3>
          </div>
          <div class="divide-y divide-gray-50 dark:divide-gray-700">
            {paymentReport.map(r => (
              <div key={r.method} class="p-3 flex items-center justify-between">
                <div class="flex items-center gap-2">
                  <Icons.CreditCard size={16} class="text-gray-400" />
                  <p class="text-sm font-medium text-gray-900 dark:text-gray-100">{paymentLabels[r.method] || r.method}</p>
                </div>
                <div class="text-right">
                  <p class="font-bold text-sm text-gray-900 dark:text-gray-100">{formatRupiah(r.total)}</p>
                  <p class="text-xs text-gray-400">{r.count} transaksi</p>
                </div>
              </div>
            ))}
            {paymentReport.length === 0 && <div class="p-8 text-center text-gray-400 text-sm">Belum ada data</div>}
          </div>
        </div>

        {/* Detailed daily table */}
        <div class="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 overflow-hidden">
          <div class="p-4 border-b border-gray-100 dark:border-gray-700">
            <h3 class="font-semibold text-gray-900 dark:text-gray-100">Ringkasan Harian</h3>
          </div>
          <div class="overflow-x-auto">
            <table class="w-full text-xs">
              <thead>
                <tr class="bg-gray-50 dark:bg-gray-900/50">
                  <th class="text-left p-3 text-gray-500 font-semibold">Tanggal</th>
                  <th class="text-right p-3 text-gray-500 font-semibold">Tx</th>
                  <th class="text-right p-3 text-gray-500 font-semibold">Pendapatan</th>
                  <th class="text-right p-3 text-gray-500 font-semibold">Laba</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-50 dark:divide-gray-700">
                {salesReport.map(r => (
                  <tr key={r.date} class="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                    <td class="p-3 text-gray-700 dark:text-gray-300">{formatDate(r.date, {day:"2-digit",month:"short"})}</td>
                    <td class="p-3 text-right text-gray-600 dark:text-gray-400">{r.transactionCount}</td>
                    <td class="p-3 text-right font-semibold text-primary-600 dark:text-primary-400">{formatRupiah(r.revenue)}</td>
                    <td class="p-3 text-right font-semibold text-green-600 dark:text-green-400">{formatRupiah(r.grossProfit)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
