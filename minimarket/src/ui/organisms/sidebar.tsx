import { currentPage, sidebarOpen, currentUser, activeShift } from "@/logic/state/app-state";
import { Icons } from "@/ui/atoms/icon";
import { Avatar } from "@/ui/molecules/avatar";
import { RoleBadge } from "@/ui/molecules/role-badge";
import { authService } from "@/logic/services/auth-service";

interface NavItem {
  id: string;
  label: string;
  icon: any;
  roles?: string[];
}

const navItems: NavItem[] = [
  { id: "dashboard",  label: "Dashboard",   icon: Icons.Home },
  { id: "pos",        label: "Kasir",        icon: Icons.ShoppingCart },
  { id: "products",   label: "Produk",       icon: Icons.Package },
  { id: "stock",      label: "Stok",         icon: Icons.Box },
  { id: "suppliers",  label: "Supplier",     icon: Icons.Truck },
  { id: "customers",  label: "Pelanggan",    icon: Icons.Users },
  { id: "finance",    label: "Keuangan",     icon: Icons.DollarSign, roles: ["owner", "manager"] },
  { id: "promos",     label: "Promo",        icon: Icons.Tag },
  { id: "reports",    label: "Laporan",      icon: Icons.BarChart, roles: ["owner", "manager"] },
  { id: "staff",      label: "Staf",         icon: Icons.Shield, roles: ["owner", "manager"] },
  { id: "settings",   label: "Pengaturan",   icon: Icons.Settings }
];

export function Sidebar() {
  const user = currentUser.value;
  const open = sidebarOpen.value;
  const shift = activeShift.value;

  const visibleItems = navItems.filter(item => {
    if (!item.roles) return true;
    if (!user) return false;
    return item.roles.includes(user.role);
  });

  return (
    <aside class={`fixed left-0 top-0 h-screen bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 z-30 flex flex-col transition-all duration-300 ${open ? "w-60" : "w-16"}`}>
      {/* Logo */}
      <div class="p-4 border-b border-gray-100 dark:border-gray-800 flex items-center gap-3">
        <img src="/logo.png" alt="Logo" class="w-8 h-8 rounded-lg flex-shrink-0 object-contain" />
        {open && (
          <div class="min-w-0">
            <p class="font-bold text-gray-900 dark:text-gray-100 text-xs truncate">Kasir Solo</p>
            <p class="text-[10px] text-primary-500 font-medium">Minimarket</p>
          </div>
        )}
      </div>

      {/* Kas status indicator */}
      {open && (
        <div class={`mx-3 mt-3 px-3 py-2 rounded-lg flex items-center gap-2 text-xs font-medium ${shift ? "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400" : "bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400"}`}>
          <div class={`w-2 h-2 rounded-full flex-shrink-0 ${shift ? "bg-green-500 kas-pulse" : "bg-red-500"}`} />
          {shift ? "Kas Aktif" : "Kas Tutup"}
        </div>
      )}

      {/* Nav */}
      <nav class="flex-1 overflow-y-auto py-4 scrollbar-thin">
        {visibleItems.map(item => {
          const Icon = item.icon;
          const active = currentPage.value === item.id;
          return (
            <button
              key={item.id}
              onClick={() => { currentPage.value = item.id; }}
              class={`w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-all duration-150 ${active
                ? "bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400 border-r-2 border-primary-500"
                : "text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100"}`}
              title={!open ? item.label : undefined}
            >
              <Icon size={20} class="flex-shrink-0" />
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
        <div class="p-4 border-t border-gray-100 dark:border-gray-800">
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
