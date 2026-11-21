# Referensi API — Services, Types & Database Schema

Referensi teknis untuk developer yang ingin extend atau customize aplikasi.

---

## Arsitektur Layer

```
┌────────────────────────────────────────────┐
│                UI Layer                     │
│  Pages → Organisms → Molecules → Atoms     │
├────────────────────────────────────────────┤
│              Logic Layer                    │
│  Hooks → Services → State (Signals)        │
├────────────────────────────────────────────┤
│              Data Layer                     │
│  Types → Supabase Client → RxDB Sync       │
└────────────────────────────────────────────┘
```

---

## Type Definitions

### `data/types/product.ts`

```typescript
interface Product {
  id: string;
  name: string;
  sku: string;
  barcode?: string;
  categoryId: string;
  categoryName: string;
  buyPrice: number;       // Harga beli (modal)
  sellPrice: number;      // Harga jual retail
  wholesalePrice?: number; // Harga grosir/member
  buyUnit: string;        // Satuan beli (Karton, Dus)
  sellUnit: string;       // Satuan jual (Pcs, Botol)
  stock: number;
  minStock: number;
  maxStock: number;
  image?: string;
  active: boolean;
}

type Category = {
  id: string;
  name: string;
  slug: string;
}
```

### `data/types/order.ts`

```typescript
type PaymentMethod = "cash" | "qris" | "debit" | "credit" | "ewallet" | "tempo";
type OrderStatus = "pending" | "completed" | "void" | "returned";

interface OrderItem {
  id: string;
  productId: string;
  productName: string;
  sku: string;
  qty: number;
  unit: string;
  buyPrice: number;
  sellPrice: number;
  discount: number;       // Diskon per item (Rp)
  subtotal: number;       // qty × (sellPrice - discount)
}

interface Order {
  id: string;
  orderNumber: string;    // Format: INV-YYYYMMDD-XXXX
  items: OrderItem[];
  customerId?: string;
  customerName?: string;
  subtotal: number;
  discount: number;       // Diskon total order (Rp)
  tax: number;            // PPN
  total: number;          // subtotal - discount + tax
  paymentMethod: PaymentMethod;
  amountPaid: number;
  change: number;
  status: OrderStatus;
  shiftId?: string;
  cashierId: string;
  cashierName: string;
  notes?: string;
  createdAt: string;      // ISO 8601
}

interface HeldOrder {
  id: string;
  label: string;
  items: OrderItem[];
  customerId?: string;
  customerName?: string;
  discount: number;
  heldAt: string;
}
```

### `data/types/finance.ts`

```typescript
type ShiftStatus = "open" | "closed";
type CashFlowType = "in" | "out";
type CashInCategory = "setoran_tambahan" | "pengembalian" | "lainnya";
type CashOutCategory = "belanja_operasional" | "setor_bank" | "gaji"
                     | "listrik_air" | "kebersihan" | "lainnya";

interface Shift {
  id: string;
  openedBy: string;
  closedBy?: string;
  openedAt: string;       // ISO 8601
  closedAt?: string;
  openingBalance: number; // Modal awal
  closingBalance?: number;// Kas aktual saat tutup
  expectedCash?: number;  // Kas seharusnya (calc by system)
  difference?: number;    // closingBalance - expectedCash
  status: ShiftStatus;
  notes?: string;
}

interface CashFlow {
  id: string;
  shiftId?: string;
  type: CashFlowType;
  category: CashInCategory | CashOutCategory;
  amount: number;
  description: string;
  createdBy: string;
  createdAt: string;
}

interface PettyCash {
  id: string;
  shiftId: string;
  description: string;
  amount: number;
  category: PettyCashCategory;
  createdBy: string;
  createdAt: string;
}

interface VoidRecord {
  id: string;
  orderId: string;
  orderNumber: string;
  reason: string;
  amount: number;
  type: "void" | "return";
  createdBy: string;
  createdAt: string;
}

interface Denomination {
  value: number;     // 100000, 50000, etc.
  label: string;     // "100.000"
  count: number;     // jumlah lembar
}
```

### `data/types/customer.ts`

```typescript
type MemberTier = "bronze" | "silver" | "gold";

interface Customer {
  id: string;
  name: string;
  phone: string;
  email?: string;
  address?: string;
  memberCard: string;    // MBR-XXXX
  tier: MemberTier;
  points: number;
  totalSpent: number;
  joinedAt: string;
}
```

### `data/types/printer.ts`

```typescript
type PaperSize = "58mm" | "80mm" | "a4";
type ConnectionType = "usb" | "bluetooth" | "network";
type PrintJobStatus = "pending" | "printing" | "done" | "error";

interface PrinterConfig {
  enabled: boolean;
  paperSize: PaperSize;
  connectionType: ConnectionType;
  ipAddress?: string;
  autoPrint: boolean;
  copies: number;
  headerText: string;
  footerText: string;
  printBarcode: boolean;
}

interface PrintJob {
  id: string;
  type: "receipt" | "label" | "report" | "test";
  status: PrintJobStatus;
  content: string;
  createdAt: string;
  completedAt?: string;
  error?: string;
}
```

---

## Services API

### `AuthService`

```typescript
class AuthService {
  login(email: string, password: string): Promise<{user, error}>
  demoLogin(role: UserRole): void
  logout(): void
  getCurrentUser(): User | null
}
export const authService: AuthService;
```

### `ProductService`

```typescript
class ProductService {
  getAll(): Product[]
  getById(id: string): Product | null
  search(query: string, category?: string): Product[]
  getByBarcode(barcode: string): Product | null
  create(data: Partial<Product>): Product
  update(id: string, data: Partial<Product>): void
  delete(id: string): void
  updateStock(id: string, delta: number): void
  getLowStock(): Product[]
}
export const productService: ProductService;
```

### `POSService`

```typescript
class POSService {
  addToCart(productId: string, qty?: number): void
  scanBarcode(barcode: string): boolean        // NEW: barcode scan
  updateQty(itemId: string, qty: number): void
  setItemDiscount(itemId: string, discount: number): void
  removeItem(itemId: string): void
  voidLastItem(): void                          // NEW: void last added
  clearCart(): void
  holdOrder(label: string): void
  recallOrder(heldId: string): void
  processPayment(method: PaymentMethod, amountPaid: number, shiftId?: string): Order
  getTodayOrders(): Order[]
  getTodayRevenue(): number
}
export const posService: POSService;
export const ordersSignal: Signal<Order[]>;
```

### `FinanceService`

```typescript
class FinanceService {
  openShift(openingBalance: number, userId: string, notes?: string): Shift
  closeShift(actualCash: number, userId: string, notes?: string): void
  getActiveShift(): Shift | null
  addCashFlow(data: Omit<CashFlow, 'id' | 'createdAt'>): CashFlow  // NEW
  addPettyCash(data: Omit<PettyCash, 'id' | 'createdAt'>): PettyCash
  voidOrder(orderId: string, reason: string, type: "void" | "return", userId: string): void
  getDailyCashFlow(): { cashIn: number; cashOut: number; net: number }
  getRunningBalance(): number                    // NEW
}
export const financeService: FinanceService;
export const shiftsSignal: Signal<Shift[]>;
export const cashFlowsSignal: Signal<CashFlow[]>;  // NEW
export const pettyCashSignal: Signal<PettyCash[]>;
export const voidRecordsSignal: Signal<VoidRecord[]>;
```

### `PrinterService`

```typescript
class PrinterService {
  updateConfig(cfg: Partial<PrinterConfig>): void
  buildReceiptText(order: Order): string      // Generate ESC/POS text
  printReceipt(order: Order): PrintJob        // Print receipt
  printTest(): PrintJob                        // Test print
  browserPrint(text: string, order: Order): void  // Browser fallback
  setConnected(v: boolean): void
}
export const printerService: PrinterService;
export const printerConnected: Signal<boolean>;
export const printQueue: Signal<PrintJob[]>;
export const lastPrintJob: Signal<PrintJob | null>;
```

### `CustomerService`

```typescript
class CustomerService {
  getAll(): Customer[]
  search(query: string): Customer[]
  getById(id: string): Customer | null
  create(data: Partial<Customer>): Customer
  update(id: string, data: Partial<Customer>): void
  addPoints(customerId: string, points: number, orderId: string): void
  updateSpent(customerId: string, amount: number): void
}
export const customerService: CustomerService;
```

---

## Hooks API

### `useKeyboardShortcuts`

```typescript
interface ShortcutHandlers {
  onF1?: () => void;    // Focus barcode
  onF2?: () => void;    // Hold order
  onF3?: () => void;    // Show held
  onF4?: () => void;    // Pay
  onF5?: () => void;    // Clear cart
  onF6?: () => void;    // Toggle numpad mode
  onF7?: () => void;    // Select customer
  onF8?: () => void;    // Cash drawer
  onF9?: () => void;    // Print receipt
  onF10?: () => void;   // Void last
  onF12?: () => void;   // Fullscreen
  onEsc?: () => void;   // Close modal
  onEnter?: () => void; // Confirm
  onPlus?: () => void;  // Qty +
  onMinus?: () => void; // Qty -
  onDelete?: () => void;// Remove item
}

function useKeyboardShortcuts(handlers: ShortcutHandlers, active?: boolean): void
```

### Other Hooks

```typescript
function useDarkMode(): void           // Toggle & persist dark mode
function useOnline(): boolean          // Online/offline status
function useResponsive(): {            // Responsive breakpoints
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
}
function useRoleGuard(allowed: UserRole[]): boolean  // Role check
```

---

## Global State (Signals)

```typescript
// Auth
export const currentUser: Signal<User | null>
export const isAuthenticated: Computed<boolean>

// POS / Cart
export const cartItems: Signal<OrderItem[]>
export const selectedCustomer: Signal<Customer | null>
export const orderDiscount: Signal<number>
export const heldOrders: Signal<HeldOrder[]>
export const posSearchQuery: Signal<string>
export const posCategoryFilter: Signal<string>
export const lastScannedBarcode: Signal<string>
export const scanCount: Signal<number>

// Numpad
export type NumpadMode = "qty" | "disc" | "price" | "cash"
export const numpadMode: Signal<NumpadMode>
export const numpadInput: Signal<string>
export const selectedCartItemId: Signal<string | null>

// Computed Cart
export const cartSubtotal: Computed<number>
export const cartTax: Computed<number>        // 11% PPN
export const cartTotal: Computed<number>

// Shift
export const activeShift: Signal<Shift | null>

// Notifications
export const notifications: Signal<AppNotification[]>
export const unreadCount: Computed<number>

// UI
export const sidebarOpen: Signal<boolean>
export const darkMode: Signal<boolean>
export const currentPage: Signal<string>
export const showShortcutHelp: Signal<boolean>
export const posFullscreen: Signal<boolean>

// Printer
export const printerConfig: Signal<PrinterConfig>

// Store Settings
export const storeSettings: Signal<StoreSettings>
```

---

## Database Schema (Supabase)

### 7 Migration Files

| File | Tabel |
|------|-------|
| `001_users.sql` | `profiles` (id, name, email, role, active) |
| `002_products.sql` | `categories`, `products` (dengan barcode index) |
| `003_orders.sql` | `customers`, `orders`, `order_items` |
| `004_finance.sql` | `shifts`, `cash_flows`, `petty_cash`, `void_records` |
| `005_stock.sql` | `stock_mutations`, `suppliers`, `purchase_orders` |
| `006_promos.sql` | `promos`, `vouchers` |
| `007_settings.sql` | `store_settings` (key-value), views |

### Entity Relationship

```
profiles ─── shifts ─── orders ─── order_items
                │                       │
                ├── cash_flows          products ─── categories
                ├── petty_cash              │
                └── void_records       stock_mutations
                                            │
                                       suppliers ─── purchase_orders
                                       
customers ─── orders
         
promos ─── vouchers
```

### RLS (Row Level Security)

Semua tabel dilindungi RLS:
- `SELECT`: Semua authenticated user
- `INSERT/UPDATE/DELETE`: Berdasarkan role (owner/manager untuk data sensitif)

---

## Utility Functions

```typescript
// format.ts

formatRupiah(amount: number): string
// Input: 50000 → Output: "Rp 50.000"

formatDate(isoString: string): string
// Input: "2026-08-14T10:30:00Z" → Output: "14/08/2026"

formatDateTime(isoString: string): string
// Input: "2026-08-14T10:30:00Z" → Output: "14/08/2026 10:30:25"

formatNumber(num: number): string
// Input: 1234567 → Output: "1.234.567"

generateId(): string
// Output: random UUID-like string

generateOrderNumber(): string
// Output: "INV-20260814-0001"

generateMemberCard(): string
// Output: "MBR-XXXX"

parseRupiah(str: string): number
// Input: "Rp 50.000" → Output: 50000
```

---

## i18n Keys

Tersedia 250+ translation keys di `i18n/id.ts` dan `i18n/en.ts`.

### Penggunaan

```typescript
import { t } from "@/i18n";

// Dalam component
<p>{t("dashboard.title")}</p>
<button>{t("pos.pay")}</button>
```

### Menambah Bahasa Baru

1. Copy `i18n/id.ts` → `i18n/xx.ts`
2. Translate semua values
3. Import di `i18n/index.ts`
4. Tambah ke locale switcher di Settings

---

## Extending the App

### Menambah Halaman Baru

1. Buat file di `src/ui/pages/new-page.tsx`
2. Export component `NewPage`
3. Tambah ke `src/app.tsx` di switch/case
4. Tambah ke sidebar di `src/ui/organisms/sidebar.tsx`
5. Tambah ke routes di `src/routes/index.ts`
6. Tambah i18n keys jika perlu

### Menambah Service Baru

1. Buat types di `src/data/types/new-type.ts`
2. Buat service di `src/logic/services/new-service.ts`
3. Tambah signals di `src/logic/state/app-state.ts` jika perlu
4. Import dan gunakan di component

### Menambah SQL Migration

1. Buat file baru: `supabase/migrations/008_new_feature.sql`
2. Definisikan tabel dan RLS
3. Jalankan di Supabase SQL Editor

---

*Dokumentasi ini mencakup seluruh API dan arsitektur Kasir Solo - Minimarket v1.0.0.*
