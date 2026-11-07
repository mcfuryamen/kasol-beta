import { signal } from "@preact/signals";
import {
  cartItems, cartTotal, cartSubtotal, orderDiscount, selectedCustomer,
  heldOrders, cartTax, lastScannedBarcode, scanCount, numpadInput, numpadMode, currentUser, storeSettings
} from "@/logic/state/app-state";
import { productService } from "./product-service";
import { stockService } from "./stock-service";
import { customerService } from "./customer-service";
import { promoService, vouchersSignal } from "./promo-service";
import { notificationService } from "./notification-service";
import type { Order, OrderItem, HeldOrder, PaymentMethod } from "@/data/types/order";
import { generateId, nextOrderNumber, isToday } from "@/logic/utils/format";
import { localDb } from "@/data/db/local-db";
import { enqueue } from "@/data/sync/sync-engine";
import { resolveOutletContext } from "@/data/sync/outlet-context";
import { incrementTxCount } from "./license";
import { activeOutletId } from "@/logic/state/app-state";

export const ordersSignal = signal<Order[]>([]);

const STORE = "orders";

export type CartResult = { ok: true } | { ok: false; reason: string };

/** Sisa stok yang boleh dijual untuk satu produk, dengan considering qty di keranjang. */
function availableStock(productId: string): number {
  const product = productService.getById(productId);
  if (!product) return 0;
  const inCart = cartItems.value.find(i => i.productId === productId)?.qty ?? 0;
  return product.stock - inCart;
}

class POSService {
  /**
   * Pindai barcode. `allowOversell` dipakai untuk kasus stok tidak tercatat
   * akurat (barang timbang, produk baru) — tanpa itu, kasir terkunci dari
   * menjual barang yang sistemnya salah stok.
   */
  scanBarcode(barcode: string, allowOversell = false): CartResult | null {
    const product = productService.getByBarcode(barcode);
    if (!product) return null;
    if (!allowOversell && availableStock(product.id) < 1) {
      return { ok: false, reason: `Stok ${product.name} habis (sisa ${product.stock})` };
    }
    lastScannedBarcode.value = barcode;
    scanCount.value = scanCount.value + 1;
    this.addToCart(product.id, 1, { allowOversell });
    return { ok: true };
  }

  /**
   * Tambah produk ke keranjang.
   *
   * Sebelumnya tidak ada pemeriksaan stok sama sekali — oversell baru ketahuan
   * SETELAH pembayaran lewat peringatan "Stok Minus". Keranjang kini menolak
   * melebihi stok yang tersedia, kecuali pemanggil menyetel `allowOversell`.
   */
  addToCart(productId: string, qty = 1, opts: { allowOversell?: boolean } = {}): CartResult {
    const product = productService.getById(productId);
    if (!product) return { ok: false, reason: "Produk tidak ditemukan" };
    if (product.stock <= 0 && !opts.allowOversell) {
      return { ok: false, reason: `Stok ${product.name} habis` };
    }
    if (!opts.allowOversell && availableStock(productId) < qty) {
      const sisa = availableStock(productId);
      return { ok: false, reason: `Stok ${product.name} tidak cukup (sisa ${sisa} ${product.sellUnit})` };
    }
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
    return { ok: true };
  }

  updateQty(itemId: string, qty: number, opts: { allowOversell?: boolean } = {}): CartResult {
    if (qty <= 0) { this.removeItem(itemId); return { ok: true }; }
    const item = cartItems.value.find(i => i.id === itemId);
    if (!item) return { ok: false, reason: "Item tidak ada di keranjang" };

    if (!opts.allowOversell) {
      const product = productService.getById(item.productId);
      const stok = product?.stock ?? 0;
      // Baris lain dengan produk yang sama (jarang, addToCart menggabung) ikut dipotong.
      const barisLain = cartItems.value
        .filter(i => i.productId === item.productId && i.id !== itemId)
        .reduce((s, i) => s + i.qty, 0);
      const maks = stok - barisLain;
      if (qty > maks) {
        const sisa = Math.max(0, maks);
        return { ok: false, reason: `Stok ${item.productName} tidak cukup (sisa ${sisa} ${item.unit})` };
      }
    }

    cartItems.value = cartItems.value.map(i =>
      i.id === itemId ? { ...i, qty, subtotal: qty * (i.sellPrice - i.discount) } : i
    );
    return { ok: true };
  }

  setItemDiscount(itemId: string, discount: number) {
    cartItems.value = cartItems.value.map(i => {
      if (i.id !== itemId) return i;
      // Clamp 0..harga jual — dulu diskon > harga membuat subtotal item minus.
      const d = Math.max(0, Math.min(discount, i.sellPrice));
      return { ...i, discount: d, subtotal: i.qty * (i.sellPrice - d) };
    });
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

  /**
   * Panggil order ditahan. Stok bisa berubah selama order ditahan — qty yang
   * melebihi stok sekarang di-clamp dan item yang stoknya habis dibuang
   * (dengan notifikasi), supaya keranjang realistis sebelum bayar.
   */
  recallOrder(heldId: string) {
    const held = heldOrders.value.find(h => h.id === heldId);
    if (!held) return;
    const adjusted: OrderItem[] = [];
    let clamped = false;
    for (const item of held.items) {
      const product = productService.getById(item.productId);
      if (!product) { clamped = true; continue; }
      if (item.qty > product.stock) {
        clamped = true;
        if (product.stock <= 0) continue;
        adjusted.push({ ...item, qty: product.stock, subtotal: product.stock * (item.sellPrice - item.discount) });
      } else {
        adjusted.push(item);
      }
    }
    cartItems.value = adjusted;
    orderDiscount.value = held.discount;
    if (held.customerId) {
      selectedCustomer.value = customerService.getById(held.customerId) ?? null;
    }
    heldOrders.value = heldOrders.value.filter(h => h.id !== heldId);
    if (clamped) {
      notificationService.add(
        "warning", "Stok Berubah",
        `Beberapa item pada order ditahan "${held.label}" disesuaikan karena stok berubah. Periksa keranjang sebelum bayar.`,
        "pos"
      );
    }
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

    // Simpan DULU dan pastikan benar-benar masuk IndexedDB. Kalau tidak, jangan
    // lanjut: menyelesaikan transaksi yang tidak tercatat berarti uang diterima
    // tanpa bukti — untuk kasir ini lebih baik gagal eksplisit.
    ordersSignal.value = [order, ...ordersSignal.value];
    try {
      await this.persist(order);
    } catch (err) {
      ordersSignal.value = ordersSignal.value.filter(o => o.id !== order.id);
      throw new Error(
        err instanceof Error
          ? `Transaksi dibatalkan: ${err.message}`
          : "Transaksi dibatalkan: gagal menyimpan ke penyimpanan perangkat."
      );
    }

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

    // Promo usage_count: naikkan hitungan saat voucher ditukarkan
    if (voucherCode) {
      const voucher = vouchersSignal.value.find(v => v.code === voucherCode);
      if (voucher?.promoId) {
        try {
          promoService.incrementUsageCount(voucher.promoId);
        } catch {
          notificationService.add("warning", "Promo", "Usage count voucher gagal diperbarui.", "promo");
        }
      }
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
    return ordersSignal.value.filter(o => isToday(o.createdAt) && o.status === "completed");
  }

  getTodayRevenue(): number {
    return this.getTodayOrders().reduce((sum, o) => sum + o.total, 0);
  }

  private async persist(order: Order) {
    // Tag order + item dengan outlet asal SEBELUM ditulis ke IndexedDB (Tahap 4).
    const orderOutlet = resolveOutletContext(order.outlet_id);
    const tagged: Order = {
      ...order,
      outlet_id: orderOutlet ?? order.outlet_id,
      items: order.items.map(i => ({ ...i, outlet_id: i.outlet_id ?? orderOutlet ?? order.outlet_id }))
    };
    const durable = await localDb.putDurable(STORE, tagged);
    if (!durable) {
      throw new Error("penyimpanan perangkat penuh atau tidak tersedia");
    }
    // items disimpan sebagai baris order_items terpisah agar cocok dengan skema Supabase
    const { items, ...orderRow } = tagged;
    if (orderOutlet !== null) {
      enqueue(STORE, "upsert", order.id, { ...orderRow, outlet_id: orderOutlet });
      for (const item of items) {
        enqueue("order_items", "upsert", item.id, { ...item, orderId: order.id, outlet_id: item.outlet_id ?? orderOutlet });
      }
    }
    // Penghitung kuota lisensi (pola kaki5 simpanPenjualanSync): dicatat
    // SETELAH order tersimpan, non-blokir (api gagal → biarkan).
    try { await incrementTxCount(); } catch { /* license non-kritikal */ }
  }
}

export const posService = new POSService();
