import { currentPage, mobileNavOpen, currentUser, darkMode } from "@/logic/state/app-state";
import { authService } from "@/logic/services/auth-service";
import { Icons } from "@/ui/atoms/icon";
import { showActivationModal, getLicenseStatus } from "@/logic/services/license";
import { visibleNavItems } from "./sidebar";

/**
 * Sheet "Menu" ala aplikasi native: naik dari bawah, grid ikon semua halaman,
 * aksi tambahan (lisensi, dark mode), dan keluar. Buka via tombol Menu di BottomNav.
 */
export function MobileMenuSheet() {
  if (!mobileNavOpen.value) return null;

  const user = currentUser.value;
  const items = visibleNavItems(user?.role);
  const isDark = darkMode.value;
  const close = () => { mobileNavOpen.value = false; };
  const go = (id: string) => {
    currentPage.value = id;
    close();
  };

  return (
    <div class="lg:hidden fixed inset-0 z-40" role="dialog" aria-modal="true" aria-label="Menu">
      {/* Backdrop */}
      <button
        class="absolute inset-0 bg-black/50"
        onClick={close}
        aria-label="Tutup menu"
      />
      {/* Panel */}
      <div class="absolute bottom-0 inset-x-0 bg-white dark:bg-gray-900 rounded-t-3xl shadow-2xl pb-safe max-h-[85vh] overflow-y-auto animate-sheet-up">
        {/* Grabber */}
        <div class="sticky top-0 bg-white dark:bg-gray-900 pt-3 pb-1 flex justify-center rounded-t-3xl">
          <span class="w-10 h-1.5 rounded-full bg-gray-200 dark:bg-gray-700" />
        </div>

        {/* Header user */}
        <div class="px-5 pb-3 flex items-center gap-3">
          <div class="w-11 h-11 rounded-2xl bg-primary-500 text-white flex items-center justify-center font-black flex-shrink-0">
            {user?.name?.[0]?.toUpperCase() ?? "?"}
          </div>
          <div class="flex-1 min-w-0">
            <p class="font-bold text-gray-900 dark:text-gray-100 truncate">{user?.name ?? "—"}</p>
            <p class="text-xs text-gray-400 capitalize">{user?.role ?? ""}</p>
          </div>
          <button onClick={close} class="touch-target p-2 text-gray-400 hover:text-gray-600" aria-label="Tutup">
            <Icons.X size={20} />
          </button>
        </div>

        {/* Grid semua menu */}
        <div class="grid grid-cols-4 gap-1 px-4 pb-2">
          {items.map(item => {
            const Icon = item.icon;
            const active = currentPage.value === item.id;
            return (
              <button
                key={item.id}
                onClick={() => go(item.id)}
                class={`touch-target flex flex-col items-center justify-center gap-1.5 rounded-2xl py-3 transition-colors ${
                  active
                    ? "bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400"
                    : "text-gray-500 dark:text-gray-400 active:bg-gray-50 dark:active:bg-gray-800"
                }`}
              >
                <Icon size={22} />
                <span class="text-[11px] font-medium leading-none">{item.label}</span>
              </button>
            );
          })}
        </div>

        {/* Aksi tambahan */}
        <div class="px-4 pt-2 pb-4 space-y-1 border-t border-gray-100 dark:border-gray-800 mt-2">
          <button
            onClick={() => {
              close();
              getLicenseStatus().then(s => showActivationModal(s.unitId));
            }}
            class="w-full touch-target flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-medium text-gray-700 dark:text-gray-200 active:bg-gray-50 dark:active:bg-gray-800 transition-colors"
          >
            <span class="w-9 h-9 rounded-xl bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 flex items-center justify-center flex-shrink-0">
              <Icons.Shield size={18} />
            </span>
            Lisensi & Aktivasi
          </button>
          <button
            onClick={() => { darkMode.value = !darkMode.value; }}
            class="w-full touch-target flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-medium text-gray-700 dark:text-gray-200 active:bg-gray-50 dark:active:bg-gray-800 transition-colors"
          >
            <span class="w-9 h-9 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 flex items-center justify-center flex-shrink-0">
              {isDark ? <Icons.Sun size={18} /> : <Icons.Moon size={18} />}
            </span>
            {isDark ? "Mode Terang" : "Mode Gelap"}
          </button>
          <button
            onClick={() => {
              close();
              authService.logout();
            }}
            class="w-full touch-target flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-medium text-red-600 dark:text-red-400 active:bg-red-50 dark:active:bg-red-900/20 transition-colors"
          >
            <span class="w-9 h-9 rounded-xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center flex-shrink-0">
              <Icons.Logout size={18} />
            </span>
            Keluar
          </button>
        </div>
      </div>
    </div>
  );
}
