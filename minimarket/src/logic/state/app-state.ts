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

// Computed cart — PPN mengikuti pengaturan toko (bukan konstanta)
export const cartSubtotal = computed(() =>
  cartItems.value.reduce((sum, item) => sum + item.subtotal, 0)
);
export const cartTax = computed(() =>
  Math.round((cartSubtotal.value - orderDiscount.value) * (storeSettings.value.taxRate / 100))
);
export const cartTotal = computed(() =>
  cartSubtotal.value - orderDiscount.value + cartTax.value
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
