import type { JSX } from "preact";
import { currentUser, currentPage } from "@/logic/state/app-state";
import { AuthLayout } from "@/ui/templates/auth-layout";
import { MainLayout } from "@/ui/templates/main-layout";
import { LoginPage } from "@/ui/pages/login";
import { DashboardPage } from "@/ui/pages/dashboard";
import { POSPage } from "@/ui/pages/pos";
import { ProductsPage } from "@/ui/pages/products";
import { StockPage } from "@/ui/pages/stock";
import { SuppliersPage } from "@/ui/pages/suppliers";
import { CustomersPage } from "@/ui/pages/customers";
import { FinancePage } from "@/ui/pages/finance";
import { PromosPage } from "@/ui/pages/promos";
import { ReportsPage } from "@/ui/pages/reports";
import { StaffPage } from "@/ui/pages/staff";
import { SettingsPage } from "@/ui/pages/settings";

const pageMap: Record<string, () => JSX.Element> = {
  dashboard:  () => <DashboardPage />,
  pos:        () => <POSPage />,
  products:   () => <ProductsPage />,
  stock:      () => <StockPage />,
  suppliers:  () => <SuppliersPage />,
  customers:  () => <CustomersPage />,
  finance:    () => <FinancePage />,
  promos:     () => <PromosPage />,
  reports:    () => <ReportsPage />,
  staff:      () => <StaffPage />,
  settings:   () => <SettingsPage />,
};

export function App() {
  const user = currentUser.value;
  const route = currentPage.value;

  if (!user) {
    return (
      <AuthLayout>
        <LoginPage />
      </AuthLayout>
    );
  }

  const PageComponent = pageMap[route] ?? pageMap["dashboard"];

  return (
    <MainLayout>
      <PageComponent />
    </MainLayout>
  );
}
