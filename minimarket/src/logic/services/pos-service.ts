import { signal } from "@preact/signals";
import {
  cartItems, cartTotal, cartSubtotal, orderDiscount, selectedCustomer,
  heldOrders, cartTax, lastScannedBarcode, scanCount, numpadInput, numpadMode, currentUser, storeSettings
} from "@/logic/state/app-state";
import { productService } from "./product-service";
import { stockService } from "./stock-service";
import { customerService } from "./customer-service";
import { notificationService } from "./notification-service";
import type { Order, OrderItem, HeldOrder, PaymentMethod } from "@/data/types/order";
import { generateId, nextOrderNumber } from "@/logic/utils/format";
import { localDb } from "@/data/db/local-db";
import { enqueue } from "@/data/sync/sync-engine";

export const ordersSignal = signal<Order[]>([]);

const STORE = "orders";

class POSService {
  scanBarcode(barcode: string): boolean {
    const product = productService.getByBarcode(barcode);
    if (!product) return false;
    lastScannedBarcode.value = barcode;
    scanCount.value = scanCount.value + 1;
    this.addToCart(product.id);
    return true;
  }

  addToCart(productId: string, qty = 1) {
    const product = productService.getById(productId);
    if (!product) return;
    const customer = selectedCustomer.value;
    const price = customer?.tier === "gold" && product.wholesalePrice ? product.wholesalePrice : product.sellPrice;
    const existing = cartItems.value.find(i => i.productId === productId);
    if (existing) {
      cartItems.value = cartItems.value.map(i =>
        i.productId === productId
          ? { ...i, qty: i.qty + qty, subtotal: (i.qty + qty) * (price - i.discount) }
          : i
      );
    } else {
      const item: OrderItem = {
        id: generateId(), productId, productName: product.name, sku: product.sku,
        qty, unit: product.sellUnit, buyPrice: product.buyPrice, sellPrice: price,
        discount: 0, subtotal: price * qty
      };
      cartItems.value = [...cartItems.value, item];
    }
  }

  updateQty(itemId: string, qty: number) {
    if (qty <= 0) { this.removeItem(itemId); return; }
    cartItems.value = cartItems.value.map(i =>
      i.id === itemId ? { ...i, qty, subtotal: qty * (i.sellPrice - i.discount) } : i
    );
  }

  setItemDiscount(itemId: string, discount: number) {
    cartItems.value = cartItems.value.map(i =>
      i.id === itemId ? { ...i, discount, subtotal: i.qty * (i.sellPrice - discount) } : i
    );
  }

  removeItem(itemId: string) {
    cartItems.value = cartItems.value.filter(i => i.id !== itemId);
  }

  clearCart() {
    cartItems.value = [];
    orderDiscount.value = 0;
    selectedCustomer.value = null;
    numpadInput.value = "";
  }

  holdOrder(label: string) {
    const held: HeldOrder = {
      id: generateId(), label, items: [...cartItems.value],
      customerId: selectedCustomer.value?.id, customerName: selectedCustomer.value?.name,
      discount: orderDiscount.value, heldAt: new Date().toISOString()
    };
    heldOrders.value = [...heldOrders.value, held];
    this.clearCart();
  }

  recallOrder(heldId: string) {
    const held = heldOrders.value.find(h => h.id === heldId);
    if (!held) return;
    cartItems.value = held.items;
    orderDiscount.value = held.discount;
    if (held.customerId) {
      selectedCustomer.value = customerService.getById(held.customerId) ?? null;
    }
    heldOrders.value = heldOrders.value.filter(h => h.id !== heldId);
  }

  async processPayment(method: PaymentMethod, amountPaid: number, shiftId?: string, voucherCode?: string): Promise<Order> {
    const total = cartTotal.value;
    if (method === "cash" && amountPaid < total) {
      throw new Error("Uang bayar kurang dari total tagihan");
    }

    const items = [...cartItems.value];
    const subtotal = cartSubtotal.value;
    const discount = orderDiscount.value;
    const tax = cartTax.value;
    const customer = selectedCustomer.value;
    const user = currentUser.value;

    const order: Order = {
      id: generateId(),
      orderNumber: await nextOrderNumber(),
      items,
      customerId: customer?.id, customerName: customer?.name,
      subtotal, discount, tax, total, paymentMethod: method,
      amountPaid, change: Math.max(0, amountPaid - total),
      status: "completed", shiftId,
      voucherCode: voucherCode || undefined,
      cashierId: user?.id ?? "unknown",
      cashierName: user?.name ?? "Tidak diketahui",
      createdAt: new Date().toISOString()
    };

    ordersSignal.value = [order, ...ordersSignal.value];
    void this.persist(order);

    for (const item of items) {
      const afterStock = productService.updateStock(item.productId, -item.qty);
      if (afterStock !== undefined && afterStock < 0) {
        notificationService.add(
          "warning", "Stok Minus",
          `${item.productName} stok menjadi ${afterStock}. Segera lakukan opname.`,
          "stock"
        );
      }
      stockService.addMovement({
        productId: item.productId, productName: item.productName,
        type: "sale", qty: item.qty, referenceId: order.id
      });
    }

    if (customer) {
      const pointsEarned = Math.floor(total / storeSettings.value.pointsSpendPerPoint);
      if (pointsEarned > 0) {
        customerService.addPoints(customer.id, pointsEarned, order.id);
      }
      customerService.updateSpent(customer.id, total);
    }

    this.clearCart();
    return order;
  }

  voidLastItem() {
    if (cartItems.value.length > 0) {
      const last = cartItems.value[cartItems.value.length - 1];
      this.removeItem(last.id);
    }
  }

  getTodayOrders(): Order[] {
    const today = new Date().toISOString().slice(0, 10);
    return ordersSignal.value.filter(o => o.createdAt.startsWith(today) && o.status === "completed");
  }

  getTodayRevenue(): number {
    return this.getTodayOrders().reduce((sum, o) => sum + o.total, 0);
  }

  private async persist(order: Order) {
    await localDb.put(STORE, order);
    // items disimpan sebagai baris order_items terpisah agar cocok dengan skema Supabase
    const { items, ...orderRow } = order;
    enqueue(STORE, "upsert", order.id, orderRow as unknown as Record<string, any>);
    for (const item of items) {
      enqueue("order_items", "upsert", item.id, { ...item, orderId: order.id });
    }
  }
}

export const posService = new POSService();
