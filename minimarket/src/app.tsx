import type { JSX } from "preact";
import { useEffect } from "preact/hooks";
import { useSignal } from "@preact/signals";
import { currentUser, currentPage, pageLoading } from "@/logic/state/app-state";
import { AuthLayout } from "@/ui/templates/auth-layout";
import { MainLayout } from "@/ui/templates/main-layout";
import { LoginPage } from "@/ui/pages/login";
import { getLicenseStatus, isHardGateActive, RevokedLockScreen, type LicenseStatus } from "@/logic/services/license";
import { ROLE_LABELS } from "@/logic/services/auth-service";
import { PAGE_ROLES } from "@/logic/roles";
import { useRoleGuard } from "@/logic/hooks/use-role-guard";
import { Icons } from "@/ui/atoms/icon";
import { Skeleton, StatCardSkeleton, ListItemSkeleton } from "@/ui/atoms/skeleton";

/** Panel saat role mencoba membuka halaman di luar izinnya (defense-in-depth). */
function AccessDeniedPage({ role }: { role: string }) {
  return (
    <div class="max-w-md mx-auto mt-12 p-6 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 text-center">
      <Icons.Shield size={36} class="mx-auto text-red-300 dark:text-red-800 mb-2" />
      <h2 class="text-lg font-black text-gray-900 dark:text-gray-100">Akses Ditolak</h2>
      <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
        Role <b>{ROLE_LABELS[role as keyof typeof ROLE_LABELS] ?? role}</b> tidak memiliki izin membuka halaman ini.
        Hubungi owner jika seharusnya Anda punya akses.
      </p>
    </div>
  );
}

// Lazy-load all page components to reduce initial bundle size (~538 KB → per-page chunks)
type PageLoader = () => Promise<() => JSX.Element>;
const pageMap: Record<string, PageLoader> = {
  dashboard:  () => import("@/ui/pages/dashboard").then(m => m.DashboardPage as () => JSX.Element),
  pos:        () => import("@/ui/pages/pos").then(m => m.POSPage as () => JSX.Element),
  products:   () => import("@/ui/pages/products").then(m => m.ProductsPage as () => JSX.Element),
  stock:      () => import("@/ui/pages/stock").then(m => m.StockPage as () => JSX.Element),
  suppliers:  () => import("@/ui/pages/suppliers").then(m => m.SuppliersPage as () => JSX.Element),
  customers:  () => import("@/ui/pages/customers").then(m => m.CustomersPage as () => JSX.Element),
  finance:    () => import("@/ui/pages/finance").then(m => m.FinancePage as () => JSX.Element),
  promos:     () => import("@/ui/pages/promos").then(m => m.PromosPage as () => JSX.Element),
  reports:    () => import("@/ui/pages/reports").then(m => m.ReportsPage as () => JSX.Element),
  staff:      () => import("@/ui/pages/staff").then(m => m.StaffPage as () => JSX.Element),
  settings:   () => import("@/ui/pages/settings").then(m => m.SettingsPage as () => JSX.Element),
  help:       () => import("@/ui/pages/help").then(m => m.HelpPage as () => JSX.Element),
};

/** Full-page skeleton shown during chunk fetch / page transition */
function PageLoadingSkeleton() {
  return (
    <div class="space-y-4 p-3 max-w-7xl mx-auto animate-pulse">
      {/* Header skeleton */}
      <div class="flex items-center justify-between">
        <div>
          <Skeleton width="8rem" height="1.5rem" rounded="lg" class="mb-0.5" />
          <Skeleton width="5rem" height="0.75rem" rounded="md" />
        </div>
        <Skeleton width="4rem" height="2rem" rounded="xl" />
      </div>
      {/* Banner skeleton */}
      <Skeleton width="100%" height="4rem" rounded="xl" />
      {/* Stats grid skeleton */}
      <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCardSkeleton />
        <StatCardSkeleton />
        <StatCardSkeleton />
        <StatCardSkeleton />
      </div>
      {/* Two-col layout skeleton */}
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div class="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 overflow-hidden">
          <div class="px-3 py-2 border-b border-gray-100 dark:border-gray-700 flex justify-between">
            <Skeleton width="7rem" height="0.875rem" rounded="md" />
            <Skeleton width="2.5rem" height="1.125rem" rounded="md" />
          </div>
          <div class="divide-y divide-gray-50 dark:divide-gray-700">
            <ListItemSkeleton />
            <ListItemSkeleton />
            <ListItemSkeleton />
          </div>
        </div>
        <div class="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 overflow-hidden">
          <div class="px-3 py-2 border-b border-gray-100 dark:border-gray-700 flex justify-between">
            <Skeleton width="7rem" height="0.875rem" rounded="md" />
            <Skeleton width="2.5rem" height="1.125rem" rounded="md" />
          </div>
          <div class="divide-y divide-gray-50 dark:divide-gray-700">
            <ListItemSkeleton />
            <ListItemSkeleton />
            <ListItemSkeleton />
          </div>
        </div>
      </div>
    </div>
  );
}

export function App() {
  const licenseStatus = useSignal<LicenseStatus | null>(null);
  const pageComponent = useSignal<() => JSX.Element | null>(() => null);
  // pageLoading is the shared signal from app-state — written here, read by pages

  useEffect(() => {
    getLicenseStatus().then(s => { licenseStatus.value = s; });
  }, []);

  // Page guard — nav yang difilter bukan satu-satunya pertahanan; halaman juga
  // dicek langsung terhadap PAGE_ROLES lewat useRoleGuard (dulu hook ini
  // didefinisikan tapi tidak pernah dipakai di mana pun).
  const pageAllowed = useRoleGuard(PAGE_ROLES[currentPage.value] ?? PAGE_ROLES.dashboard);

  // Re-run when either currentUser or currentPage signals change.
  useEffect(() => {
    const user = currentUser.value;
    const route = currentPage.value;

    // Ignore stale loads if user/navigation changes again mid-flight
    const stamp = (user?.id ?? "") + route;
    const loader = pageMap[route] ?? pageMap["dashboard"];
    pageLoading.value = true;
    loader().then(Page => {
      if (stamp !== (currentUser.value?.id ?? "") + currentPage.value) return; // stale
      pageComponent.value = Page;
      pageLoading.value = false;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser.value, currentPage.value]);

  const user = currentUser.value;

  // Hard gate: license revoked — before any layout
  if (isHardGateActive() || licenseStatus.value?.level === 'revoked') {
    return <RevokedLockScreen />;
  }

  // Not logged in → show AuthLayout + LoginPage only (no MainLayout/sidebar)
  if (!user) {
    return (
      <AuthLayout>
        <LoginPage />
      </AuthLayout>
    );
  }

  // Role tidak diizinkan membuka halaman ini
  if (!pageAllowed) {
    return (
      <MainLayout>
        <AccessDeniedPage role={user.role} />
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      {pageLoading.value ? <PageLoadingSkeleton /> : (
        pageComponent.value && <pageComponent.value />
      )}
    </MainLayout>
  );
}
