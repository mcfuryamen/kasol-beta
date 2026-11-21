import { signal, computed } from "@preact/signals";
import type { Order, OrderItem, HeldOrder } from "@/data/types/order";
import type { Customer } from "@/data/types/customer";
import type { Shift } from "@/data/types/finance";
import type { AppNotification } from "@/data/types/notification";
import type { PrinterConfig } from "@/data/types/printer";
import type { User } from "@/logic/services/auth-service";

// Auth state
export const currentUser = signal<User | null>(null);
export const isAuthenticated = computed(() => currentUser.value !== null);

// POS state
export const cartItems = signal<OrderItem[]>([]);
export const selectedCustomer = signal<Customer | null>(null);
export const orderDiscount = signal<number>(0);
export const heldOrders = signal<HeldOrder[]>([]);
export const posSearchQuery = signal<string>("");
export const posCategoryFilter = signal<string>("all");
export const lastScannedBarcode = signal<string>("");
export const scanCount = signal<number>(0);

// Numpad state
export type NumpadMode = "qty" | "disc" | "price" | "cash";
export const numpadMode = signal<NumpadMode>("cash");
export const numpadInput = signal<string>("");
export const selectedCartItemId = signal<string | null>(null);

// Computed cart — PPN mengikuti pengaturan toko (bukan konstanta).
// PPN dan total di-clamp di 0: diskon yang melebihi subtotal (mis. voucher salah
// konfigurasi) sebelumnya menghasilkan PPN negatif dan total negatif, yang
// membuat kwitansi menampilkan nominal tak masuk akal.
export const cartSubtotal = computed(() =>
  cartItems.value.reduce((sum, item) => sum + item.subtotal, 0)
);
export const cartTax = computed(() =>
  Math.max(
    0,
    Math.round((cartSubtotal.value - orderDiscount.value) * (storeSettings.value.taxRate / 100))
  )
);
export const cartTotal = computed(() =>
  Math.max(0, cartSubtotal.value - orderDiscount.value + cartTax.value)
);

// Active shift
export const activeShift = signal<Shift | null>(null);

// Notifications
export const notifications = signal<AppNotification[]>([]);
export const unreadCount = computed(() =>
  notifications.value.filter(n => !n.read).length
);

// UI state
export const sidebarOpen = signal(true);
export const darkMode = signal(false);
export const currentPage = signal<string>("dashboard");
export const showShortcutHelp = signal(false);
export const posFullscreen = signal(false);
export const mobileNavOpen = signal(false);
export const pageLoading = signal(false);

// Printer state
export const printerConfig = signal<PrinterConfig>({
  enabled: false,
  paperSize: "58mm",
  connectionType: "usb",
  autoPrint: false,
  copies: 1,
  headerText: "Kasir Solo - Minimarket",
  footerText: "Terima kasih telah berbelanja!",
  printBarcode: false
});

// Multi-outlet context. Outlet-specific settings remain compatible with the legacy storeSettings object.
export interface Outlet {
  id: string;
  businessId: string;
  /** Kode outlet unik per business (UTM, UT02, ...) — dipakai di laporan/nomor trx. */
  code: string;
  name: string;
  address: string;
  phone: string;
  taxRate: number;
  receiptFooter: string;
  isActive: boolean;
  isDefault: boolean;
  /** Terisi bila outlet diarsipkan (multi → single) — histori tetap utuh. */
  archivedAt: string | null;
}

export const outlets = signal<Outlet[]>([]);
export const activeOutletId = signal<string | null>(null);
/** Mode gabungan: tampilkan data semua outlet sekaligus (multi mode, owner/manager). */
export const combinedView = signal(false);
/** Mode operasional business: "single" menyembunyikan kompleksitas outlet. */
export const operatingMode = signal<"single" | "multi">("single");
export const businessId = signal<string | null>(null);

// Settings
export const storeSettings = signal({
  name: "Kasir Solo - Minimarket",
  address: "Jl. Solo Raya No. 1, Surakarta",
  phone: "0271-123456",
  taxRate: 11,
  receiptFooter: "Terima kasih telah berbelanja di Minimarket kami!",
  currency: "IDR",
  loyaltySilverMin: 500000,
  loyaltyGoldMin: 2000000,
  pointsSpendPerPoint: 10000
});
