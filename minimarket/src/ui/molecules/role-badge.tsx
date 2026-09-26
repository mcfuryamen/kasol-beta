import type { UserRole } from "@/logic/services/auth-service";

const roleConfig: Record<UserRole, { label: string; class: string }> = {
  owner:   { label: "Pemilik",  class: "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400" },
  manager: { label: "Manager", class: "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400" },
  cashier: { label: "Kasir",   class: "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400" },
  stock:   { label: "Gudang",  class: "bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400" }
};

export function RoleBadge({ role }: { role: UserRole }) {
  const cfg = roleConfig[role];
  return <span class={`inline-flex px-1.5 py-0 rounded text-[10px] font-semibold ${cfg.class}`}>{cfg.label}</span>;
}
