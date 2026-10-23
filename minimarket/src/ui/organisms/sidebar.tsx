import { currentPage, sidebarOpen, currentUser, activeShift, activeOutletId, combinedView, outlets, operatingMode } from "@/logic/state/app-state";
import { PAGE_ROLES } from "@/logic/roles";
import { Icons } from "@/ui/atoms/icon";
import { Avatar } from "@/ui/molecules/avatar";
import { RoleBadge } from "@/ui/molecules/role-badge";
import { Select } from "@/ui/atoms/input";
import { showToast } from "@/ui/molecules/toast";
import { authService } from "@/logic/services/auth-service";
import { outletService, ALL_OUTLETS } from "@/logic/services/outlet-service";

export interface NavItem {
  id: string;
  label: string;
  icon: any;
  roles?: string[];
}

/** Roles tiap nav SELALU dari PAGE_ROLES — satu sumber kebenaran dgn page guard di App. */
export const navItems: NavItem[] = [
  { id: "dashboard",  label: "Dashboard",   icon: Icons.Home,         roles: PAGE_ROLES.dashboard },
  { id: "pos",        label: "Kasir",        icon: Icons.ShoppingCart, roles: PAGE_ROLES.pos },
  { id: "products",   label: "Produk",       icon: Icons.Package,      roles: PAGE_ROLES.products },
  { id: "stock",      label: "Stok",         icon: Icons.Box,          roles: PAGE_ROLES.stock },
  { id: "suppliers",  label: "Supplier",     icon: Icons.Truck,        roles: PAGE_ROLES.suppliers },
  { id: "customers",  label: "Pelanggan",    icon: Icons.Users,        roles: PAGE_ROLES.customers },
  { id: "finance",    label: "Keuangan",     icon: Icons.DollarSign,   roles: PAGE_ROLES.finance },
  { id: "promos",     label: "Promo",        icon: Icons.Tag,          roles: PAGE_ROLES.promos },
  { id: "reports",    label: "Laporan",      icon: Icons.BarChart,     roles: PAGE_ROLES.reports },
  { id: "staff",      label: "Staf",         icon: Icons.Shield,       roles: PAGE_ROLES.staff },
  { id: "settings",   label: "Pengaturan",   icon: Icons.Settings,     roles: PAGE_ROLES.settings },
  { id: "help",       label: "Bantuan",       icon: Icons.HelpCircle,  roles: PAGE_ROLES.help }
];

/** Nav yang terlihat untuk role tertentu (dipakai Sidebar, BottomNav, sheet mobile). */
export function visibleNavItems(role?: string): NavItem[] {
  return navItems.filter(item => {
    if (!item.roles) return true;
    if (!role) return false;
    return item.roles.includes(role);
  });
}

export function Sidebar() {
  const user = currentUser.value;
  const open = sidebarOpen.value;
  const shift = activeShift.value;
  // Outlet picker: hanya outlet operasional (aktif, tidak diarsipkan).
  const operationalOutlets = outlets.value.filter(o => outletService.isOperational(o));
  // Opsi gabungan: multi mode + owner/manager + minimal 2 outlet aktif.
  const canSeeCombined =
    operatingMode.value === "multi" &&
    ["owner", "manager"].includes(user?.role || "") &&
    operationalOutlets.length >= 2;

  const handleSwitchOutlet = (id: string) => {
    if (id !== ALL_OUTLETS && id === activeOutletId.value && !combinedView.value) return;
    const r = outletService.select(id);
    if (!r.ok) { showToast(r.error || "Tidak bisa pindah outlet", "error"); return; }
    // Data outlet baru dimuat oleh listener switch (hydrate + pull).
    showToast(
      id === ALL_OUTLETS
        ? "Mode gabungan: menampilkan semua outlet (lihat-saja)"
        : `Berpindah ke ${outlets.value.find(o => o.id === id)?.name || "outlet"} — data dimuat ulang`,
      "success"
    );
  };

  const visibleItems = visibleNavItems(user?.role);

  return (
    <aside class={`fixed left-0 top-0 h-screen bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 z-30 flex flex-col transition-all duration-300 ${open ? "w-60" : "w-16"}`}>
      {/* Logo */}
      <div class="p-3 border-b border-gray-100 dark:border-gray-800 flex items-center gap-3">
        <img src="/logo.png" alt="Logo" class="w-8 h-8 rounded-lg flex-shrink-0 object-contain" />
        {open && (
          <div class="min-w-0">
            <p class="font-bold text-gray-900 dark:text-gray-100 text-xs truncate">Kasir Solo</p>
            <p class="text-[10px] text-primary-500 font-medium">Minimarket</p>
          </div>
        )}
      </div>

      {/* Outlet picker (Tahap 4) — status kas jadi titik indikator di sampingnya */}
      {open && operationalOutlets.length > 0 && (
        <div class="mx-3 mt-3 px-2 py-1.5 rounded-lg flex items-center gap-2 bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700">
          <div
            class={`w-2 h-2 rounded-full flex-shrink-0 ${shift ? "bg-green-500 kas-pulse" : combinedView.value ? "bg-primary-500" : "bg-red-500"}`}
            title={shift ? "Kas aktif" : combinedView.value ? "Mode gabungan" : "Kas tutup"}
          />
          <Select
            value={combinedView.value ? ALL_OUTLETS : (activeOutletId.value ?? "")}
            onChange={(e: any) => handleSwitchOutlet(e.target.value)}
            options={[
              ...(canSeeCombined ? [{ value: ALL_OUTLETS, label: "📊 Semua Outlet" }] : []),
              ...operationalOutlets.map(o => ({ value: o.id, label: o.name })),
            ]}
            class="!px-2 !py-1 !text-xs"
          />
        </div>
      )}
      {open && operationalOutlets.length === 0 && (
        <div class={`mx-3 mt-3 px-3 py-2 rounded-lg flex items-center gap-2 text-xs font-medium ${shift ? "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400" : "bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400"}`}>
          <div class={`w-2 h-2 rounded-full flex-shrink-0 ${shift ? "bg-green-500 kas-pulse" : "bg-red-500"}`} />
          {shift ? "Kas Aktif" : "Kas Tutup"}
        </div>
      )}

      {/* Nav */}
      <nav class="flex-1 overflow-y-auto py-2 scrollbar-thin">
        {visibleItems.map(item => {
          const Icon = item.icon;
          const active = currentPage.value === item.id;
          return (
            <button
              key={item.id}
              onClick={() => { currentPage.value = item.id; }}
              class={`w-full flex items-center gap-3 px-3 py-1.5 text-sm font-medium transition-all duration-150 ${active
                ? "bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400 border-r-2 border-primary-500"
                : "text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100"}`}
              title={!open ? item.label : undefined}
            >
              <Icon size={18} class="flex-shrink-0" />
              {open && <span class="truncate">{item.label}</span>}
              {/* POS badge for shift required */}
              {open && item.id === "pos" && !shift && (
                <span class="ml-auto w-2 h-2 rounded-full bg-red-400 flex-shrink-0" title="Buka kas dulu" />
              )}
            </button>
          );
        })}
      </nav>

      {/* User section */}
      {user && (
        <div class="p-3 border-t border-gray-100 dark:border-gray-800">
          {open ? (
            <div class="flex items-center gap-3">
              <Avatar name={user.name} size="sm" />
              <div class="flex-1 min-w-0">
                <p class="text-xs font-semibold text-gray-900 dark:text-gray-100 truncate">{user.name}</p>
                <RoleBadge role={user.role} />
              </div>
              <button onClick={() => authService.logout()} title="Keluar" class="text-gray-400 hover:text-red-500 transition-colors">
                <Icons.Logout size={16} />
              </button>
            </div>
          ) : (
            <button onClick={() => authService.logout()} title="Keluar" class="w-full flex justify-center text-gray-400 hover:text-red-500 transition-colors">
              <Icons.Logout size={20} />
            </button>
          )}
        </div>
      )}
    </aside>
  );
}
