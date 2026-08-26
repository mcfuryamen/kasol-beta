import { sidebarOpen } from "@/logic/state/app-state";
import { Sidebar } from "@/ui/organisms/sidebar";
import { Header } from "@/ui/organisms/header";
import { ToastContainer } from "@/ui/molecules/toast";
import { ConfirmDialog } from "@/ui/molecules/confirm-dialog";
import { ShortcutHelp } from "@/ui/organisms/shortcut-help";
import { useDarkMode } from "@/logic/hooks/use-dark-mode";

export function MainLayout({ children }: { children: any }) {
  useDarkMode();
  const open = sidebarOpen.value;
  return (
    <div class="flex h-screen bg-gray-50 dark:bg-gray-900 overflow-hidden">
      <Sidebar />
      <div class={`flex-1 flex flex-col min-w-0 transition-all duration-300 ${open ? "ml-60" : "ml-16"}`}>
        <Header />
        <main class="flex-1 overflow-y-auto p-6 scrollbar-thin">
          {children}
        </main>
      </div>
      <ToastContainer />
      <ConfirmDialog />
      <ShortcutHelp />
    </div>
  );
}
