import { currentPage, darkMode, unreadCount, sidebarOpen, activeShift } from "@/logic/state/app-state";
import { currentLang, setLang } from "@/i18n";
import { Icons } from "@/ui/atoms/icon";
import { isOnline } from "@/data/sync/sync-engine";
import { useState } from "preact/hooks";
import { NotificationPanel } from "./notification-panel";
import { formatTime } from "@/logic/utils/format";

const pageLabels: Record<string, string> = {
  dashboard: "Dashboard", pos: "Kasir POS", products: "Produk", stock: "Stok",
  suppliers: "Supplier", customers: "Pelanggan", finance: "Keuangan & Kas",
  promos: "Promo", reports: "Laporan", staff: "Staf", settings: "Pengaturan"
};

export function Header() {
  const [showNotif, setShowNotif] = useState(false);
  const shift = activeShift.value;
  const now = new Date().toISOString();

  return (
    <header class="h-14 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 flex items-center px-4 gap-3 sticky top-0 z-20">
      <button
        onClick={() => { sidebarOpen.value = !sidebarOpen.value; }}
        class="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
      >
        <Icons.Menu size={20} />
      </button>

      <h1 class="text-base font-semibold text-gray-900 dark:text-gray-100 flex-1">
        {pageLabels[currentPage.value] || currentPage.value}
      </h1>

      <div class="flex items-center gap-2">
        {/* Kas status */}
        <div class={`hidden sm:flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium ${shift ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400" : "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400"}`}>
          <div class={`w-1.5 h-1.5 rounded-full ${shift ? "bg-green-500 kas-pulse" : "bg-red-500"}`} />
          {shift ? "Kas Aktif" : "Kas Tutup"}
        </div>

        {/* Online indicator */}
        <div class={`hidden sm:flex items-center gap-1 text-xs px-2 py-1 rounded-full ${isOnline.value ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400" : "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400"}`}>
          {isOnline.value ? <Icons.Wifi size={12} /> : <Icons.WifiOff size={12} />}
          {isOnline.value ? "Online" : "Offline"}
        </div>

        {/* Lang toggle */}
        <button
          onClick={() => setLang(currentLang.value === "id" ? "en" : "id")}
          class="text-xs font-bold px-2 py-1 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
        >
          {currentLang.value.toUpperCase()}
        </button>

        {/* Dark mode */}
        <button
          onClick={() => { darkMode.value = !darkMode.value; }}
          class="p-1.5 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        >
          {darkMode.value ? <Icons.Sun size={18} /> : <Icons.Moon size={18} />}
        </button>

        {/* Notifications */}
        <div class="relative">
          <button
            onClick={() => setShowNotif(!showNotif)}
            class="p-1.5 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors relative"
          >
            <Icons.Bell size={18} />
            {unreadCount.value > 0 && (
              <span class="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[10px] rounded-full flex items-center justify-center font-bold">
                {unreadCount.value > 9 ? "9+" : unreadCount.value}
              </span>
            )}
          </button>
          {showNotif && <NotificationPanel onClose={() => setShowNotif(false)} />}
        </div>
      </div>
    </header>
  );
}
