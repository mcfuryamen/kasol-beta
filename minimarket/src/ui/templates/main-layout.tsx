import type { JSX } from "preact";
import { sidebarOpen, currentPage } from "@/logic/state/app-state";
import { storageDegraded } from "@/data/db/local-db";
import { Sidebar } from "@/ui/organisms/sidebar";
import { Header } from "@/ui/organisms/header";
import { BottomNav } from "@/ui/organisms/bottom-nav";
import { MobileMenuSheet } from "@/ui/organisms/mobile-menu-sheet";
import { ToastContainer } from "@/ui/molecules/toast";
import { ConfirmDialog } from "@/ui/molecules/confirm-dialog";
import { ShortcutHelp } from "@/ui/organisms/shortcut-help";
import { DarkModeSync } from "@/logic/hooks/use-dark-mode";
import { Icons } from "@/ui/atoms/icon";

export function MainLayout({ children }: { children: JSX.Element | JSX.Element[] }) {
  const open = sidebarOpen.value;
  return (
    <div class="flex h-screen bg-gray-50 dark:bg-gray-900 overflow-hidden">
      {/* Sidebar hanya di layar besar (mobile pakai BottomNav + sheet Menu) */}
      <div class="hidden lg:block">
        <Sidebar />
      </div>
      <div class={`flex-1 flex flex-col min-w-0 transition-all duration-300 ${open ? "lg:ml-60" : "lg:ml-16"}`}>
        <Header />
        {/* Penyimpanan perangkat rusak: data terbaru hilang saat aplikasi ditutup.
            Kasir WAJIB tahu — tanpa ini, penjualan tetap "sukses" lalu hilang. */}
        {storageDegraded.value && (
          <div class="flex items-center gap-2 px-4 py-2 bg-red-600 text-white text-xs font-medium">
            <Icons.AlertTriangle size={14} class="flex-shrink-0" />
            <span>Penyimpanan perangkat bermasalah — data terbaru bisa hilang saat aplikasi ditutup. Jangan tutup aplikasi.</span>
          </div>
        )}
        {/* Mobile: padding bawah utk BottomNav + safe area; POS fullscreen tanpa bottom nav */}
        <main class={`flex-1 overflow-y-auto scrollbar-thin p-3 ${currentPage.value !== "pos" ? "pb-[calc(4rem+env(safe-area-inset-bottom,0px))]" : ""} sm:p-4 lg:p-5`}>
          {children}
        </main>
      </div>
      <DarkModeSync />
      <BottomNav />
      <MobileMenuSheet />
      <ToastContainer />
      <ConfirmDialog />
      <ShortcutHelp />
    </div>
  );
}
