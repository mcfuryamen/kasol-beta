import type { UserRole } from "@/logic/services/auth-service";

/**
 * Peta hak akses halaman — SATU sumber kebenaran untuk Sidebar, BottomNav,
 * sheet mobile, dan page guard di App. Sesuai janji halaman Bantuan:
 * Owner (semua menu), Manager (kecuali pengaturan tarif pajak),
 * Kasir (POS + lihat produk), Gudang (stok & penerimaan barang).
 *
 * Halaman yang cocok untuk beberapa role punya halaman read-only / field
 * ter-guard di level tombol (products.tsx: kasir lihat-saja; settings.tsx:
 * tarif pajak owner-saja).
 */
export const PAGE_ROLES: Record<string, UserRole[]> = {
  dashboard: ["owner", "manager", "cashier", "stock"],
  pos:       ["owner", "manager", "cashier"],
  products:  ["owner", "manager", "cashier", "stock"],
  stock:     ["owner", "manager", "stock"],
  suppliers: ["owner", "manager", "stock"],
  customers: ["owner", "manager", "cashier"],
  finance:   ["owner", "manager"],
  promos:    ["owner", "manager"],
  reports:   ["owner", "manager"],
  staff:     ["owner", "manager"],
  settings:  ["owner", "manager"],
  help:      ["owner", "manager", "cashier", "stock"],
};

/** Bolehkah role ini membuka halaman ini? */
export function canAccessPage(page: string, role?: UserRole): boolean {
  const allowed = PAGE_ROLES[page];
  if (!allowed || !role) return false;
  return allowed.includes(role);
}
