import { posService, ordersSignal } from "@/logic/services/pos-service";
import { productService } from "@/logic/services/product-service";
import { activeShift, combinedView, currentUser } from "@/logic/state/app-state";
import { formatRupiah, formatDateTime, isLocalDay, localDateKey } from "@/logic/utils/format";
import { Icons } from "@/ui/atoms/icon";
import { StatCard } from "@/ui/molecules/stat-card";
import { Badge } from "@/ui/atoms/badge";
import { useState } from "preact/hooks";
import { OpenKasModal } from "@/ui/organisms/open-kas-modal";
import { CloseKasModal } from "@/ui/organisms/close-kas-modal";

export function DashboardPage() {
  const [showOpenKas, setShowOpenKas] = useState(false);
  const [showCloseKas, setShowCloseKas] = useState(false);
  const shift = activeShift.value;
  const user = currentUser.value;

  const todayOrders = posService.getTodayOrders();
  const todayRevenue = posService.getTodayRevenue();
  const avgOrder = todayOrders.length > 0 ? Math.round(todayRevenue / todayOrders.length) : 0;
  const lowStock = productService.getLowStock();

  // Trend nyata vs kemarin — dulu badge "+12%" hardcoded tanpa perhitungan.
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayKey = localDateKey(yesterday);
  const yesterdayRevenue = ordersSignal.value
    .filter(o => isLocalDay(o.createdAt, yesterdayKey) && o.status === "completed")
    .reduce((s, o) => s + o.total, 0);
  const trendValue = yesterdayRevenue > 0
    ? Math.round(((todayRevenue - yesterdayRevenue) / yesterdayRevenue) * 100)
    : null;

  const recentOrders = posService.getTodayOrders().slice(0, 5);

  const paymentLabels: Record<string, string> = {
    cash: "Tunai", qris: "QRIS", debit: "Debit", credit: "Kredit", ewallet: "E-Wallet", tempo: "Tempo"
  };

  return (
    <div class="space-y-4 max-w-7xl mx-auto">
      {/* Header */}
      <div class="flex items-center justify-between">
        <div>
          <h2 class="text-xl font-black text-gray-900 dark:text-gray-100">Dashboard</h2>
          <p class="text-xs text-gray-500 dark:text-gray-400">Selamat datang, {user?.name || "Kasir"}!</p>
        </div>
        {/* Tombol Buka/Tutup Kas dipindah ke banner status kas di bawah — header bersih. */}
      </div>

      {/* Kas status banner — tombol aksi ada DI DALAM kontainer */}
      {shift ? (
        <div class="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-3 flex items-center gap-3">
          <div class="w-9 h-9 bg-green-100 dark:bg-green-900/40 rounded-lg flex items-center justify-center text-green-600 dark:text-green-400 flex-shrink-0">
            <Icons.Zap size={18} />
          </div>
          <div class="flex-1">
            <p class="font-semibold text-green-800 dark:text-green-300 flex items-center gap-2">
              <span class="w-2 h-2 bg-green-500 rounded-full kas-pulse inline-block" />
              Kas Sedang Aktif
            </p>
            <p class="text-xs text-green-600 dark:text-green-400">Dibuka: {formatDateTime(shift.openedAt)} · Modal awal: {formatRupiah(shift.openingBalance)}</p>
          </div>
          <button
            onClick={() => setShowCloseKas(true)}
            class="flex items-center gap-2 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-xl font-semibold text-xs transition-colors shadow-sm flex-shrink-0"
          >
            <Icons.X size={16} /> Tutup Kas
          </button>
        </div>
      ) : combinedView.value ? (
        <div class="bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800 rounded-xl p-3 flex items-center gap-3">
          <div class="w-9 h-9 bg-primary-100 dark:bg-primary-900/40 rounded-lg flex items-center justify-center text-primary-600 dark:text-primary-400 flex-shrink-0">
            <Icons.BarChart size={18} />
          </div>
          <div class="flex-1">
            <p class="font-semibold text-primary-800 dark:text-primary-300">Mode Gabungan — Semua Outlet</p>
            <p class="text-xs text-primary-600 dark:text-primary-400">Ringkasan gabungan bersifat lihat-saja. Pilih outlet spesifik di sidebar untuk bertransaksi.</p>
          </div>
        </div>
      ) : (
        <div class="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl p-3 flex items-center gap-3">
          <div class="w-9 h-9 bg-yellow-100 dark:bg-yellow-900/40 rounded-lg flex items-center justify-center text-yellow-600 dark:text-yellow-400 flex-shrink-0">
            <Icons.AlertTriangle size={18} />
          </div>
          <div class="flex-1">
            <p class="font-semibold text-yellow-800 dark:text-yellow-300">Kas Belum Dibuka</p>
            <p class="text-xs text-yellow-600 dark:text-yellow-400">Buka kas untuk mulai menerima transaksi.</p>
          </div>
          <button onClick={() => setShowOpenKas(true)} class="px-3 py-1.5 bg-yellow-500 hover:bg-yellow-600 text-white rounded-lg text-xs font-medium transition-colors">
            Buka Kas
          </button>
        </div>
      )}

      {/* Stats */}
      <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          title="Penjualan Hari Ini"
          value={formatRupiah(todayRevenue)}
          icon={<Icons.TrendingUp size={20} />}
          color="orange"
          trend={trendValue === null ? undefined : { value: trendValue, label: "vs kemarin" }}
        />
        <StatCard title="Total Transaksi" value={todayOrders.length} subtitle="transaksi hari ini" icon={<Icons.Receipt size={20} />} color="blue" />
        <StatCard title="Rata-rata Order" value={formatRupiah(avgOrder)} icon={<Icons.BarChart size={20} />} color="green" />
        <StatCard title="Stok Menipis" value={lowStock.length} subtitle="produk perlu restok" icon={<Icons.AlertTriangle size={20} />} color={lowStock.length > 0 ? "red" : "green"} />
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Recent transactions */}
        <div class="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 overflow-hidden">
          <div class="px-3 py-2.5 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
            <h3 class="font-semibold text-xs text-gray-900 dark:text-gray-100">Transaksi Terbaru</h3>
            <Badge color="orange">{todayOrders.length} hari ini</Badge>
          </div>
          <div class="divide-y divide-gray-50 dark:divide-gray-700">
            {recentOrders.length === 0 ? (
              <div class="p-6 text-center text-gray-400">
                <Icons.Receipt size={28} class="mx-auto mb-2 opacity-30" />
                <p class="text-xs">Belum ada transaksi hari ini</p>
              </div>
            ) : recentOrders.map(o => (
              <div key={o.id} class="px-3 py-2.5 flex items-center justify-between">
                <div>
                  <p class="text-xs font-medium text-gray-900 dark:text-gray-100">{o.orderNumber}</p>
                  <p class="text-xs text-gray-400">{(o.items ?? []).length} item · {paymentLabels[o.paymentMethod] || o.paymentMethod}</p>
                </div>
                <div class="text-right">
                  <p class="font-bold text-primary-600 dark:text-primary-400 text-xs">{formatRupiah(o.total)}</p>
                  <Badge color={o.paymentMethod === "cash" ? "green" : o.paymentMethod === "qris" ? "blue" : "orange"} size="sm">{paymentLabels[o.paymentMethod]}</Badge>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Low stock alert */}
        <div class="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 overflow-hidden">
          <div class="px-3 py-2.5 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
            <h3 class="font-semibold text-xs text-gray-900 dark:text-gray-100">Stok Menipis</h3>
            {lowStock.length > 0 && <Badge color="red">{lowStock.length} produk</Badge>}
          </div>
          <div class="divide-y divide-gray-50 dark:divide-gray-700">
            {lowStock.length === 0 ? (
              <div class="p-6 text-center text-gray-400">
                <Icons.Check size={28} class="mx-auto mb-2 opacity-30 text-green-500" />
                <p class="text-xs">Semua stok dalam kondisi baik</p>
              </div>
            ) : lowStock.slice(0, 6).map(p => (
              <div key={p.id} class="px-3 py-2.5 flex items-center justify-between">
                <div class="flex-1 min-w-0">
                  <p class="text-xs font-medium text-gray-900 dark:text-gray-100 truncate">{p.name}</p>
                  <p class="text-xs text-gray-400">{p.sku}</p>
                </div>
                <div class="text-right ml-3">
                  <p class={`font-bold text-xs ${p.stock === 0 ? "text-red-600 dark:text-red-400" : "text-yellow-600 dark:text-yellow-400"}`}>
                    {p.stock === 0 ? "HABIS" : `${p.stock} ${p.sellUnit}`}
                  </p>
                  <p class="text-xs text-gray-400">Min: {p.minStock}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {showOpenKas && <OpenKasModal onClose={() => setShowOpenKas(false)} onOpened={() => setShowOpenKas(false)} />}
      {showCloseKas && <CloseKasModal onClose={() => setShowCloseKas(false)} onClosed={() => setShowCloseKas(false)} />}
    </div>
  );
}
