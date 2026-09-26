import { sidebarOpen } from "@/logic/state/app-state";
import { Sidebar } from "@/ui/organisms/sidebar";
import { Header } from "@/ui/organisms/header";
import { BottomNav } from "@/ui/organisms/bottom-nav";
import { MobileMenuSheet } from "@/ui/organisms/mobile-menu-sheet";
import { ToastContainer } from "@/ui/molecules/toast";
import { ConfirmDialog } from "@/ui/molecules/confirm-dialog";
import { ShortcutHelp } from "@/ui/organisms/shortcut-help";
import { DarkModeSync } from "@/logic/hooks/use-dark-mode";

export function MainLayout({ children }: { children: any }) {
  const open = sidebarOpen.value;
  return (
    <div class="flex h-screen bg-gray-50 dark:bg-gray-900 overflow-hidden">
      {/* Sidebar hanya di layar besar (mobile pakai BottomNav + sheet Menu) */}
      <div class="hidden lg:block">
        <Sidebar />
      </div>
      <div class={`flex-1 flex flex-col min-w-0 transition-all duration-300 ${open ? "lg:ml-60" : "lg:ml-16"}`}>
        <Header />
        {/* Mobile: padding bawah utk BottomNav + safe area; POS mengatur dirinya sendiri */}
        <main class="flex-1 overflow-y-auto scrollbar-thin p-4 pb-[calc(4.75rem+env(safe-area-inset-bottom,0px))] sm:p-6 lg:pb-6">
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
