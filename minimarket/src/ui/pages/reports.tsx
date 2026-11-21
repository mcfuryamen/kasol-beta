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
  // Produk Terlaris & Metode Bayar ikut periode — dulu all-time padahal kartu
  // ringkasan & grafik mengikuti filter, laporannya menyesatkan.
  const topProducts = reportService.getTopProducts(10, period);
  const paymentReport = reportService.getPaymentReport(period);
  const stockValue = reportService.getStockValue();

  const totalRevenue = salesReport.reduce((s, r) => s + r.revenue, 0);
  const totalProfit = salesReport.reduce((s, r) => s + r.grossProfit, 0);
  const totalTx = salesReport.reduce((s, r) => s + r.transactionCount, 0);

  return (
    <div class="space-y-4 max-w-5xl mx-auto">
      <div class="flex items-center justify-between">
        <h2 class="text-xl font-black text-gray-900 dark:text-gray-100">Laporan</h2>
        <div class="flex gap-1 p-1 bg-gray-100 dark:bg-gray-800 rounded-xl">
          {([7,14,30] as const).map(d => (
            <button key={d} onClick={() => setPeriod(d)} class={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${period===d?"bg-white dark:bg-gray-700 shadow-sm text-gray-900 dark:text-gray-100":"text-gray-500"}`}>{d} Hari</button>
          ))}
        </div>
      </div>

      {/* Summary cards */}
      <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div class="bg-gradient-to-br from-orange-500 to-orange-600 text-white rounded-xl p-3">
          <p class="text-xs opacity-80 mb-0.5">Total Pendapatan</p>
          <p class="text-base font-black">{formatRupiah(totalRevenue)}</p>
        </div>
        <div class="bg-gradient-to-br from-green-500 to-green-600 text-white rounded-xl p-3">
          <p class="text-xs opacity-80 mb-0.5">Laba Kotor</p>
          <p class="text-base font-black">{formatRupiah(totalProfit)}</p>
        </div>
        <div class="bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-xl p-3">
          <p class="text-xs opacity-80 mb-0.5">Total Transaksi</p>
          <p class="text-base font-black">{totalTx}</p>
        </div>
        <div class="bg-gradient-to-br from-purple-500 to-purple-600 text-white rounded-xl p-3">
          <p class="text-xs opacity-80 mb-0.5">Nilai Stok</p>
          <p class="text-base font-black">{formatRupiah(stockValue)}</p>
        </div>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Daily sales chart (text-based) */}
        <div class="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 overflow-hidden">
          <div class="px-3 py-2.5 border-b border-gray-100 dark:border-gray-700">
            <h3 class="font-semibold text-xs text-gray-900 dark:text-gray-100">Penjualan Harian</h3>
          </div>
          <div class="p-3 space-y-2">
            {salesReport.slice(-7).map(r => {
              const maxRev = Math.max(...salesReport.map(x => x.revenue), 1);
              const pct = (r.revenue / maxRev) * 100;
              return (
                <div key={r.date} class="flex items-center gap-2">
                  <span class="text-xs text-gray-400 w-12 flex-shrink-0">{formatDate(r.date, {day:"2-digit",month:"short"})}</span>
                  <div class="flex-1 bg-gray-100 dark:bg-gray-700 rounded-full h-4 overflow-hidden">
                    <div class="h-full bg-primary-500 rounded-full transition-all" style={{width: `${pct}%`}} />
                  </div>
                  <span class="text-xs font-semibold text-gray-700 dark:text-gray-300 w-20 text-right flex-shrink-0">{formatRupiah(r.revenue)}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Top products */}
        <div class="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 overflow-hidden">
          <div class="px-3 py-2.5 border-b border-gray-100 dark:border-gray-700">
            <h3 class="font-semibold text-xs text-gray-900 dark:text-gray-100">Produk Terlaris</h3>
          </div>
          <div class="divide-y divide-gray-50 dark:divide-gray-700">
            {topProducts.slice(0,7).map((p, i) => (
              <div key={p.productId} class="px-3 py-2 flex items-center gap-2.5">
                <span class="w-5 h-5 rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 flex items-center justify-center text-xs font-bold flex-shrink-0">{i+1}</span>
                <div class="flex-1 min-w-0">
                  <p class="text-xs font-medium text-gray-900 dark:text-gray-100 truncate">{p.productName}</p>
                  <p class="text-[10px] text-gray-400">{p.qtySold} terjual</p>
                </div>
                <p class="font-bold text-xs text-primary-600 dark:text-primary-400">{formatRupiah(p.revenue)}</p>
              </div>
            ))}
            {topProducts.length === 0 && <div class="p-6 text-center text-gray-400 text-xs">Belum ada data penjualan</div>}
          </div>
        </div>

        {/* Payment breakdown */}
        <div class="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 overflow-hidden">
          <div class="px-3 py-2.5 border-b border-gray-100 dark:border-gray-700">
            <h3 class="font-semibold text-xs text-gray-900 dark:text-gray-100">Per Metode Pembayaran</h3>
          </div>
          <div class="divide-y divide-gray-50 dark:divide-gray-700">
            {paymentReport.map(r => (
              <div key={r.method} class="px-3 py-2 flex items-center justify-between">
                <div class="flex items-center gap-2">
                  <Icons.CreditCard size={14} class="text-gray-400" />
                  <p class="text-xs font-medium text-gray-900 dark:text-gray-100">{paymentLabels[r.method] || r.method}</p>
                </div>
                <div class="text-right">
                  <p class="font-bold text-xs text-gray-900 dark:text-gray-100">{formatRupiah(r.total)}</p>
                  <p class="text-[10px] text-gray-400">{r.count} transaksi</p>
                </div>
              </div>
            ))}
            {paymentReport.length === 0 && <div class="p-6 text-center text-gray-400 text-xs">Belum ada data</div>}
          </div>
        </div>

        {/* Detailed daily table */}
        <div class="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 overflow-hidden">
          <div class="px-3 py-2.5 border-b border-gray-100 dark:border-gray-700">
            <h3 class="font-semibold text-xs text-gray-900 dark:text-gray-100">Ringkasan Harian</h3>
          </div>
          <div class="overflow-x-auto">
            <table class="w-full text-xs">
              <thead>
                <tr class="bg-gray-50 dark:bg-gray-900/50">
                  <th class="text-left p-2.5 text-gray-500 font-semibold">Tanggal</th>
                  <th class="text-right p-2.5 text-gray-500 font-semibold">Tx</th>
                  <th class="text-right p-2.5 text-gray-500 font-semibold">Pendapatan</th>
                  <th class="text-right p-2.5 text-gray-500 font-semibold">Laba</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-50 dark:divide-gray-700">
                {salesReport.map(r => (
                  <tr key={r.date} class="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                    <td class="p-2.5 text-gray-700 dark:text-gray-300">{formatDate(r.date, {day:"2-digit",month:"short"})}</td>
                    <td class="p-2.5 text-right text-gray-600 dark:text-gray-400">{r.transactionCount}</td>
                    <td class="p-2.5 text-right font-semibold text-primary-600 dark:text-primary-400">{formatRupiah(r.revenue)}</td>
                    <td class="p-2.5 text-right font-semibold text-green-600 dark:text-green-400">{formatRupiah(r.grossProfit)}</td>
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
