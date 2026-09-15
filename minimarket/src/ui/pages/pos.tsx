import { useState, useRef, useEffect } from "preact/hooks";
import {
  cartItems, cartSubtotal, cartTax, cartTotal, orderDiscount,
  selectedCustomer, heldOrders, posSearchQuery, posCategoryFilter,
  activeShift, lastScannedBarcode, scanCount, numpadMode, numpadInput,
  selectedCartItemId, showShortcutHelp
} from "@/logic/state/app-state";
import { posService } from "@/logic/services/pos-service";
import { productService } from "@/logic/services/product-service";
import { customerService } from "@/logic/services/customer-service";
import { promoService, lastVoucherError } from "@/logic/services/promo-service";
import { printerService } from "@/logic/services/printer-service";
import { formatRupiah, generateId } from "@/logic/utils/format";
import { showToast } from "@/ui/molecules/toast";
import { Icons } from "@/ui/atoms/icon";
import { Button } from "@/ui/atoms/button";
import { Input } from "@/ui/atoms/input";
import { Badge } from "@/ui/atoms/badge";
import { NumpadPanel } from "@/ui/organisms/numpad-panel";
import { ReceiptModal } from "@/ui/organisms/receipt-modal";
import { OpenKasModal } from "@/ui/organisms/open-kas-modal";
import { useKeyboardShortcuts } from "@/logic/hooks/use-keyboard-shortcuts";
import type { Order, PaymentMethod } from "@/data/types/order";
import type { Customer } from "@/data/types/customer";

const PAYMENT_METHODS: { id: PaymentMethod; label: string; icon: any; color: string }[] = [
  { id: "cash",   label: "Tunai",    icon: Icons.DollarSign, color: "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-700 text-green-700 dark:text-green-400" },
  { id: "qris",   label: "QRIS",     icon: Icons.Scan,       color: "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-700 text-blue-700 dark:text-blue-400" },
  { id: "debit",  label: "Debit",    icon: Icons.CreditCard, color: "bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-700 text-purple-700 dark:text-purple-400" },
  { id: "credit", label: "Kredit",   icon: Icons.CreditCard, color: "bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-700 text-orange-700 dark:text-orange-400" },
  { id: "ewallet",label: "E-Wallet", icon: Icons.Wallet,     color: "bg-pink-50 dark:bg-pink-900/20 border-pink-200 dark:border-pink-700 text-pink-700 dark:text-pink-400" },
  { id: "tempo",  label: "Tempo",    icon: Icons.Clock,      color: "bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300" }
];

const CATEGORIES = [
  { id: "all",        label: "Semua" },
  { id: "snacks",     label: "Snack" },
  { id: "beverages",  label: "Minuman" },
  { id: "staples",    label: "Sembako" },
  { id: "tobacco",    label: "Rokok" },
  { id: "toiletries", label: "Toiletries" },
  { id: "household",  label: "Rumah Tangga" },
  { id: "frozen",     label: "Frozen" },
  { id: "spices",     label: "Bumbu" },
  { id: "dairy",      label: "Susu" },
  { id: "other",      label: "Lainnya" }
];

export function POSPage() {
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [showHeld, setShowHeld] = useState(false);
  const [completedOrder, setCompletedOrder] = useState<Order | null>(null);
  const [voucherCode, setVoucherCode] = useState("");
  const [appliedVoucherCode, setAppliedVoucherCode] = useState("");
  const [holdLabel, setHoldLabel] = useState("");
  const [barcodeBuffer, setBarcodeBuffer] = useState("");
  const [scannerActive, setScannerActive] = useState(true);

  const barcodeRef = useRef<HTMLInputElement>(null);
  const shift = activeShift.value;
  const items = cartItems.value;
  const subtotal = cartSubtotal.value;
  const discount = orderDiscount.value;
  const tax = cartTax.value;
  const total = cartTotal.value;
  const customer = selectedCustomer.value;
  const mode = numpadMode.value;
  const input = numpadInput.value;

  // Auto-focus barcode on mount
  useEffect(() => {
    barcodeRef.current?.focus();
  }, []);

  const focusBarcode = () => { barcodeRef.current?.focus(); };

  const handleBarcodeInput = (e: any) => {
    const val = e.target.value;
    setBarcodeBuffer(val);
  };

  const handleBarcodeKeyDown = (e: any) => {
    if (e.key === "Enter") {
      const barcode = barcodeBuffer.trim();
      if (!barcode) return;
      // Try barcode scan first
      const found = posService.scanBarcode(barcode);
      if (found) {
        showToast(`✓ Produk ditambahkan`, "success", 1500);
        setScannerActive(true);
      } else {
        // Try as search query
        posSearchQuery.value = barcode;
        showToast(`Tidak ditemukan barcode: ${barcode}`, "warning");
      }
      setBarcodeBuffer("");
      e.target.value = "";
    }
  };

  const handlePay = async (amountPaid: number) => {
    if (items.length === 0) { showToast("Keranjang kosong!", "error"); return; }
    if (!shift) { showToast("Buka kas terlebih dahulu!", "error"); return; }
    if (paymentMethod === "cash" && amountPaid < total) {
      showToast("Uang tidak cukup!", "error"); return;
    }
    const paid = paymentMethod === "cash" ? amountPaid : total;
    try {
      const order = await posService.processPayment(paymentMethod, paid, shift.id, appliedVoucherCode || undefined);
      setCompletedOrder(order);
      setShowPaymentModal(false);
      numpadInput.value = "0";
      setAppliedVoucherCode("");
      showToast("Transaksi berhasil!", "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Transaksi gagal", "error");
    }
  };

  const handleHold = () => {
    if (items.length === 0) return;
    posService.holdOrder(holdLabel || "Order " + (heldOrders.value.length + 1));
    setHoldLabel("");
    showToast("Order ditahan", "info");
  };

  const applyVoucher = () => {
    const v = promoService.validateVoucher(voucherCode, subtotal);
    if (!v) {
      showToast(lastVoucherError.value || "Voucher tidak valid", "error");
      return;
    }
    const disc = v.discountType === "percent"
      ? Math.min(subtotal * v.discountValue / 100, v.maxDiscount || Infinity)
      : v.discountValue;
    orderDiscount.value = disc;
    promoService.applyVoucher(v.id);
    setAppliedVoucherCode(v.code);
    showToast(`Voucher OK! Diskon ${formatRupiah(disc)}`, "success");
    setVoucherCode("");
  };

  // Keyboard shortcuts
  useKeyboardShortcuts({
    onF1: focusBarcode,
    onF2: handleHold,
    onF3: () => setShowHeld(!showHeld),
    onF4: () => {
      if (items.length > 0 && shift) {
        if (mode === "cash" && parseFloat(input) >= total) {
          handlePay(parseFloat(input) || total);
        } else {
          setShowPaymentModal(true);
        }
      }
    },
    onF5: () => { posService.clearCart(); showToast("Keranjang dikosongkan", "info"); },
    onF6: () => {
      const modes: any[] = ["cash", "qty", "disc", "price"];
      const idx = modes.indexOf(numpadMode.value);
      numpadMode.value = modes[(idx + 1) % modes.length];
      numpadInput.value = "0";
    },
    onF7: () => setShowCustomerModal(true),
    onF8: () => showToast("Cash drawer dibuka", "info"),
    onF9: () => {
      if (completedOrder) printerService.printReceipt(completedOrder);
      else showToast("Tidak ada struk terakhir", "warning");
    },
    onF10: () => { posService.voidLastItem(); showToast("Item terakhir dihapus", "info"); },
    onEsc: () => {
      setShowPaymentModal(false);
      setShowCustomerModal(false);
      setShowHeld(false);
      showShortcutHelp.value = false;
    }
  });

  // If no shift, show gate modal
  if (!shift) {
    return <KasRequiredScreen />;
  }

  return (
    <div class="flex gap-0 h-[calc(100vh-3.5rem)] -mx-6 -my-6 overflow-hidden">

      {/* ── LEFT COLUMN: Keranjang Belanja ── */}
      <div class="flex flex-col w-[38%] min-w-0 bg-gray-50 dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 overflow-hidden">

        {/* Barcode + Search */}
        <div class="p-3 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 space-y-2 flex-shrink-0">
          {/* Barcode input */}
          <div class="relative">
            <div class="absolute left-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
              <div class={`w-2 h-2 rounded-full ${scannerActive ? "bg-green-500 scanner-active" : "bg-gray-300"}`} />
              <Icons.Scan size={14} class="text-gray-400" />
            </div>
            <input
              ref={barcodeRef}
              value={barcodeBuffer}
              onInput={handleBarcodeInput}
              onKeyDown={handleBarcodeKeyDown}
              onFocus={() => setScannerActive(true)}
              onBlur={() => setScannerActive(false)}
              placeholder="Scan barcode atau ketik lalu Enter... [F1]"
              class="w-full pl-10 pr-3 py-2 text-sm border-2 border-green-300 dark:border-green-700 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-green-400 focus:border-green-400 transition-all"
            />
          </div>
          {/* Search */}
          <Input
            value={posSearchQuery.value}
            onInput={(e: any) => { posSearchQuery.value = e.target.value; }}
            placeholder="Cari produk nama/SKU..."
            icon={<Icons.Search size={14} />}
          />
          {/* Categories */}
          <div class="flex gap-1.5 overflow-x-auto pb-0.5 scrollbar-thin">
            {CATEGORIES.map(cat => (
              <button
                key={cat.id}
                onClick={() => { posCategoryFilter.value = cat.id; }}
                class={`flex-shrink-0 px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${posCategoryFilter.value === cat.id ? "bg-primary-500 text-white" : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"}`}
              >
                {cat.label}
              </button>
            ))}
          </div>
          {/* Scan counter */}
          {scanCount.value > 0 && (
            <div class="flex items-center justify-between text-xs text-gray-400">
              <span>Scan hari ini: {scanCount.value}x</span>
              {lastScannedBarcode.value && <span>Terakhir: {lastScannedBarcode.value}</span>}
            </div>
          )}
        </div>

        {/* Cart header */}
        <div class="flex items-center justify-between px-3 py-2 bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700 flex-shrink-0">
          <h2 class="font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-1.5 text-sm">
            <Icons.ShoppingCart size={16} class="text-primary-500" />
            Keranjang
            {items.length > 0 && <Badge color="orange" size="sm">{items.length}</Badge>}
          </h2>
          <div class="flex gap-1">
            <button
              onClick={() => setShowHeld(!showHeld)}
              class="relative p-1.5 text-gray-500 hover:text-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-lg transition-colors"
              title="Order ditahan [F3]"
            >
              <Icons.Clipboard size={15} />
              {heldOrders.value.length > 0 && (
                <span class="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 bg-yellow-500 text-white text-[9px] rounded-full flex items-center justify-center font-bold">
                  {heldOrders.value.length}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Held orders drawer */}
        {showHeld && heldOrders.value.length > 0 && (
          <div class="p-2 bg-yellow-50 dark:bg-yellow-900/20 border-b border-yellow-200 dark:border-yellow-800 flex-shrink-0">
            <p class="text-xs font-semibold text-yellow-700 dark:text-yellow-400 mb-1.5">Order Ditahan [F3]:</p>
            <div class="space-y-1">
              {heldOrders.value.map(h => (
                <button
                  key={h.id}
                  onClick={() => { posService.recallOrder(h.id); setShowHeld(false); }}
                  class="w-full flex items-center justify-between p-2 bg-white dark:bg-gray-800 rounded-lg border border-yellow-200 dark:border-yellow-700 hover:border-primary-400 text-xs transition-colors"
                >
                  <span class="font-medium text-gray-900 dark:text-gray-100">{h.label}</span>
                  <span class="text-gray-500">{h.items.length} item</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Cart items */}
        <div class="flex-1 overflow-y-auto scrollbar-thin">
          {items.length === 0 ? (
            <div class="flex flex-col items-center justify-center h-full text-gray-300 dark:text-gray-600">
              <Icons.ShoppingCart size={40} class="mb-2" />
              <p class="text-sm">Keranjang kosong</p>
              <p class="text-xs mt-1 opacity-70">Scan barcode atau klik produk</p>
            </div>
          ) : (
            <div class="p-2 space-y-1.5">
              {items.map((item, idx) => {
                const isSelected = selectedCartItemId.value === item.id;
                return (
                  <div
                    key={item.id}
                    onClick={() => { selectedCartItemId.value = isSelected ? null : item.id; }}
                    class={`rounded-xl p-2.5 cursor-pointer transition-all border-2 ${isSelected ? "border-primary-400 bg-primary-50 dark:bg-primary-900/20" : "border-transparent bg-white dark:bg-gray-800 hover:border-gray-200 dark:hover:border-gray-600"}`}
                  >
                    <div class="flex items-start justify-between gap-1.5 mb-1.5">
                      <div class="min-w-0 flex-1">
                        <p class="text-xs font-semibold text-gray-900 dark:text-gray-100 truncate">{item.productName}</p>
                        <p class="text-[10px] text-gray-400">{formatRupiah(item.sellPrice)} / {item.unit}</p>
                      </div>
                      <button
                        onClick={(e: Event) => { e.stopPropagation(); posService.removeItem(item.id); }}
                        class="text-gray-300 hover:text-red-500 flex-shrink-0 p-0.5"
                      >
                        <Icons.X size={13} />
                      </button>
                    </div>
                    <div class="flex items-center justify-between">
                      <div class="flex items-center gap-1.5">
                        <button
                          onClick={(e: Event) => { e.stopPropagation(); posService.updateQty(item.id, item.qty - 1); }}
                          class="w-6 h-6 rounded-md bg-gray-100 dark:bg-gray-600 flex items-center justify-center hover:bg-primary-100 dark:hover:bg-primary-900/30 text-gray-600 dark:text-gray-300 transition-colors"
                        >
                          <Icons.Minus size={10} />
                        </button>
                        <input
                          type="number" value={item.qty} min="1"
                          onClick={(e: Event) => e.stopPropagation()}
                          onInput={(e: any) => { e.stopPropagation(); posService.updateQty(item.id, parseInt(e.target.value) || 1); }}
                          class="w-10 text-center text-xs font-bold border border-gray-200 dark:border-gray-600 rounded-md py-0.5 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-primary-500"
                        />
                        <button
                          onClick={(e: Event) => { e.stopPropagation(); posService.updateQty(item.id, item.qty + 1); }}
                          class="w-6 h-6 rounded-md bg-gray-100 dark:bg-gray-600 flex items-center justify-center hover:bg-primary-100 dark:hover:bg-primary-900/30 text-gray-600 dark:text-gray-300 transition-colors"
                        >
                          <Icons.Plus size={10} />
                        </button>
                      </div>
                      <span class="font-bold text-xs text-primary-600 dark:text-primary-400">{formatRupiah(item.subtotal)}</span>
                    </div>
                    {item.discount > 0 && (
                      <div class="flex items-center justify-between mt-1">
                        <span class="text-[10px] text-red-500">Diskon item:</span>
                        <span class="text-[10px] text-red-500 font-medium">-{formatRupiah(item.discount * item.qty)}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Cart bottom actions */}
        <div class="p-2 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 flex gap-2 flex-shrink-0">
          <button
            onClick={handleHold}
            disabled={items.length === 0}
            class="flex-1 py-2 text-xs font-semibold border border-gray-300 dark:border-gray-600 rounded-xl text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40 transition-colors flex items-center justify-center gap-1.5"
          >
            <Icons.Clipboard size={13} /> Tahan <span class="opacity-50 text-[10px]">[F2]</span>
          </button>
          <button
            onClick={() => { posService.clearCart(); showToast("Keranjang dikosongkan", "info"); }}
            disabled={items.length === 0}
            class="flex-1 py-2 text-xs font-semibold border border-red-200 dark:border-red-700 text-red-500 rounded-xl hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-40 transition-colors flex items-center justify-center gap-1.5"
          >
            <Icons.Trash size={13} /> Hapus <span class="opacity-50 text-[10px]">[F5]</span>
          </button>
        </div>
      </div>

      {/* ── MIDDLE COLUMN: Pembayaran ── */}
      <div class="flex flex-col w-[30%] min-w-0 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 overflow-hidden">

        {/* Payment methods */}
        <div class="p-3 border-b border-gray-100 dark:border-gray-700 flex-shrink-0">
          <p class="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wide">Metode Pembayaran</p>
          <div class="grid grid-cols-2 gap-1.5">
            {PAYMENT_METHODS.map(pm => {
              const Icon = pm.icon;
              const active = paymentMethod === pm.id;
              return (
                <button
                  key={pm.id}
                  onClick={() => setPaymentMethod(pm.id)}
                  class={`p-2 rounded-xl border-2 text-xs font-semibold transition-all flex items-center gap-1.5 ${active ? pm.color + " border-current" : "border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:border-gray-300"}`}
                >
                  <Icon size={14} class="flex-shrink-0" />
                  <span class="truncate">{pm.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Customer selector */}
        <div class="p-3 border-b border-gray-100 dark:border-gray-700 flex-shrink-0">
          <button
            onClick={() => setShowCustomerModal(true)}
            class="w-full flex items-center gap-2 p-2 border border-dashed border-gray-300 dark:border-gray-600 rounded-xl hover:border-primary-400 dark:hover:border-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/10 transition-all text-xs"
          >
            <Icons.User size={14} class="text-gray-400 flex-shrink-0" />
            {customer ? (
              <span class="font-medium text-gray-900 dark:text-gray-100 flex-1 text-left truncate">
                {customer.name} · <Badge color={customer.tier === "gold" ? "yellow" : customer.tier === "silver" ? "gray" : "orange"} size="sm">{customer.tier}</Badge>
              </span>
            ) : (
              <span class="text-gray-400 flex-1 text-left">Pilih Pelanggan [F7]</span>
            )}
            {customer && (
              <button onClick={(e: Event) => { e.stopPropagation(); selectedCustomer.value = null; }} class="text-gray-400 hover:text-red-500 flex-shrink-0">
                <Icons.X size={12} />
              </button>
            )}
          </button>
        </div>

        {/* Voucher */}
        <div class="px-3 py-2 border-b border-gray-100 dark:border-gray-700 flex-shrink-0">
          <div class="flex gap-1.5">
            <input
              value={voucherCode}
              onInput={(e: any) => setVoucherCode(e.target.value.toUpperCase())}
              placeholder="Kode voucher..."
              class="flex-1 px-2 py-1.5 text-xs border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-primary-500"
            />
            <button
              onClick={applyVoucher}
              class="px-2.5 py-1.5 bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 text-xs font-medium rounded-lg hover:bg-primary-200 dark:hover:bg-primary-900/50 transition-colors"
            >
              Pakai
            </button>
          </div>
        </div>

        {/* Financial summary */}
        <div class="flex-1 flex flex-col justify-end p-3">
          <div class="space-y-1.5 mb-3">
            <div class="flex justify-between text-sm text-gray-600 dark:text-gray-400">
              <span>Subtotal</span><span>{formatRupiah(subtotal)}</span>
            </div>
            {discount > 0 && (
              <div class="flex justify-between text-sm text-red-500 items-center">
                <span class="flex items-center gap-1">
                  Diskon
                  <button onClick={() => { orderDiscount.value = 0; }} class="hover:text-red-700">
                    <Icons.X size={11} />
                  </button>
                </span>
                <span>-{formatRupiah(discount)}</span>
              </div>
            )}
            <div class="flex justify-between text-sm text-gray-500 dark:text-gray-400">
              <span>PPN 11%</span><span>{formatRupiah(tax)}</span>
            </div>
            <div class="flex justify-between font-black text-xl text-primary-600 dark:text-primary-400 border-t-2 border-primary-200 dark:border-primary-800 pt-2">
              <span>TOTAL</span><span>{formatRupiah(total)}</span>
            </div>
          </div>

          {/* Cash mode quick amounts */}
          {paymentMethod === "cash" && items.length > 0 && (
            <div class="grid grid-cols-2 gap-1.5 mb-3">
              {[
                Math.ceil(total / 1000) * 1000,
                Math.ceil(total / 10000) * 10000,
                Math.ceil(total / 50000) * 50000,
                Math.ceil(total / 100000) * 100000
              ].filter((v, i, a) => a.indexOf(v) === i && v > 0).slice(0, 4).map(a => (
                <button
                  key={a}
                  onClick={() => { numpadInput.value = a.toString(); numpadMode.value = "cash"; }}
                  class="py-1.5 text-xs font-semibold bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-primary-50 dark:hover:bg-primary-900/20 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
                >
                  {formatRupiah(a)}
                </button>
              ))}
            </div>
          )}

          {/* Pay button */}
          <button
            onClick={() => setShowPaymentModal(true)}
            disabled={items.length === 0}
            class="w-full py-3 bg-primary-500 hover:bg-primary-600 disabled:opacity-40 text-white font-black text-base rounded-2xl transition-colors flex items-center justify-center gap-2 shadow-lg shadow-primary-500/30"
          >
            <Icons.CreditCard size={20} />
            Bayar [F4]
          </button>
        </div>
      </div>

      {/* ── RIGHT COLUMN: Numpad Jumbo ── */}
      <div class="flex flex-col w-[32%] min-w-0 bg-gray-50 dark:bg-gray-900 overflow-hidden">
        <NumpadPanel onPay={handlePay} />
      </div>

      {/* ── MODALS ── */}

      {/* Payment modal */}
      {showPaymentModal && (
        <PaymentModal
          total={total}
          paymentMethod={paymentMethod}
          onMethodChange={setPaymentMethod}
          onPay={handlePay}
          onClose={() => setShowPaymentModal(false)}
        />
      )}

      {/* Customer picker */}
      {showCustomerModal && (
        <CustomerPickerModal
          onSelect={c => { selectedCustomer.value = c; setShowCustomerModal(false); }}
          onClose={() => setShowCustomerModal(false)}
        />
      )}

      {/* Receipt */}
      {completedOrder && (
        <ReceiptModal
          order={completedOrder}
          onClose={() => setCompletedOrder(null)}
          onNewTransaction={() => { setCompletedOrder(null); posService.clearCart(); }}
        />
      )}
    </div>
  );
}

// ── KasRequiredScreen ─────────────────────────────────────────────────────────
function KasRequiredScreen() {
  const [showOpenKas, setShowOpenKas] = useState(false);
  return (
    <div class="flex flex-col items-center justify-center h-full -mx-6 -my-6 bg-gray-50 dark:bg-gray-900">
      <div class="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl p-10 max-w-md text-center border border-gray-100 dark:border-gray-700">
        <div class="w-20 h-20 bg-yellow-100 dark:bg-yellow-900/30 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <Icons.DollarSign size={40} class="text-yellow-600 dark:text-yellow-400" />
        </div>
        <h2 class="text-2xl font-black text-gray-900 dark:text-gray-100 mb-2">Buka Kas Terlebih Dahulu</h2>
        <p class="text-gray-500 dark:text-gray-400 mb-8">Anda harus membuka sesi kas sebelum dapat menggunakan kasir dan menerima pembayaran.</p>
        <button
          onClick={() => setShowOpenKas(true)}
          class="px-8 py-3 bg-green-500 hover:bg-green-600 text-white font-bold text-lg rounded-2xl transition-colors shadow-lg shadow-green-500/30 flex items-center gap-2 mx-auto"
        >
          <Icons.Zap size={20} /> Buka Kas Sekarang
        </button>
      </div>
      {showOpenKas && (
        <OpenKasModal onClose={() => setShowOpenKas(false)} onOpened={() => setShowOpenKas(false)} />
      )}
    </div>
  );
}

// ── PaymentModal ──────────────────────────────────────────────────────────────
interface PaymentModalProps {
  total: number;
  paymentMethod: PaymentMethod;
  onMethodChange: (m: PaymentMethod) => void;
  onPay: (amount: number) => void;
  onClose: () => void;
}

function PaymentModal({ total, paymentMethod, onMethodChange, onPay, onClose }: PaymentModalProps) {
  const [amountPaid, setAmountPaid] = useState(total.toString());
  const paid = parseInt(amountPaid) || 0;
  const change = paid - total;

  const quickAmounts = [
    Math.ceil(total / 1000) * 1000,
    Math.ceil(total / 10000) * 10000,
    Math.ceil(total / 50000) * 50000,
    Math.ceil(total / 100000) * 100000
  ].filter((v, i, a) => a.indexOf(v) === i && v >= total).slice(0, 4);

  return (
    <div class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div class="flex items-center justify-between p-5 border-b border-gray-100 dark:border-gray-700">
          <h3 class="text-xl font-black text-gray-900 dark:text-gray-100">Proses Pembayaran</h3>
          <button onClick={onClose} class="text-gray-400 hover:text-gray-600"><Icons.X size={24} /></button>
        </div>

        <div class="p-5">
          <div class="text-center mb-5 p-4 bg-primary-50 dark:bg-primary-900/20 rounded-2xl">
            <p class="text-sm text-gray-500 mb-1">Total Pembayaran</p>
            <p class="text-4xl font-black text-primary-600 dark:text-primary-400">{formatRupiah(total)}</p>
          </div>

          {/* Method grid */}
          <div class="grid grid-cols-3 gap-2 mb-4">
            {PAYMENT_METHODS.map(pm => {
              const Icon = pm.icon;
              const active = paymentMethod === pm.id;
              return (
                <button
                  key={pm.id}
                  onClick={() => onMethodChange(pm.id)}
                  class={`p-3 rounded-xl border-2 text-xs font-semibold transition-all flex flex-col items-center gap-1 ${active ? "border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400" : "border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:border-gray-300"}`}
                >
                  <Icon size={18} />
                  {pm.label}
                </button>
              );
            })}
          </div>

          {paymentMethod === "cash" && (
            <div class="space-y-3 mb-4">
              <Input
                label="Uang Diterima (Rp)"
                type="number"
                value={amountPaid}
                onInput={(e: any) => setAmountPaid(e.target.value)}
                placeholder="Masukkan jumlah..."
              />
              <div class="grid grid-cols-4 gap-2">
                {quickAmounts.map(a => (
                  <button
                    key={a}
                    onClick={() => setAmountPaid(a.toString())}
                    class="py-2 text-xs font-medium bg-gray-100 dark:bg-gray-700 hover:bg-primary-100 dark:hover:bg-primary-900/30 text-gray-700 dark:text-gray-200 rounded-lg transition-colors"
                  >
                    {formatRupiah(a)}
                  </button>
                ))}
              </div>
              {paid > 0 && (
                <div class={`flex justify-between font-semibold text-sm p-3 rounded-xl ${change >= 0 ? "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400" : "bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400"}`}>
                  <span>Kembalian:</span>
                  <span>{change >= 0 ? formatRupiah(change) : "Kurang " + formatRupiah(-change)}</span>
                </div>
              )}
            </div>
          )}

          <div class="flex gap-3">
            <Button variant="secondary" fullWidth onClick={onClose}>Batal</Button>
            <Button
              variant="primary" fullWidth
              onClick={() => onPay(paymentMethod === "cash" ? paid : total)}
              disabled={paymentMethod === "cash" && paid < total}
            >
              Proses Bayar
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── CustomerPickerModal ───────────────────────────────────────────────────────
function CustomerPickerModal({ onSelect, onClose }: { onSelect: (c: Customer) => void; onClose: () => void }) {
  const [search, setSearch] = useState("");
  const customers = customerService.search(search);
  return (
    <div class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
        <div class="p-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
          <h3 class="font-semibold text-gray-900 dark:text-gray-100">Pilih Pelanggan [F7]</h3>
          <button onClick={onClose} class="text-gray-400 hover:text-gray-600"><Icons.X size={20} /></button>
        </div>
        <div class="p-3">
          <Input value={search} onInput={(e: any) => setSearch(e.target.value)} placeholder="Cari nama / telepon..." icon={<Icons.Search size={14} />} />
        </div>
        <div class="max-h-80 overflow-y-auto scrollbar-thin">
          {customers.map(c => (
            <button
              key={c.id}
              onClick={() => onSelect(c)}
              class="w-full flex items-center gap-3 p-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 border-b border-gray-50 dark:border-gray-700/50 text-left transition-colors"
            >
              <div class="w-9 h-9 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center text-primary-600 dark:text-primary-400 font-bold text-xs flex-shrink-0">
                {c.name.split(" ").map((n: string) => n[0]).join("").slice(0,2)}
              </div>
              <div class="flex-1 min-w-0">
                <p class="font-medium text-gray-900 dark:text-gray-100 text-sm truncate">{c.name}</p>
                <p class="text-xs text-gray-400">{c.phone} · {c.memberCard}</p>
              </div>
              <Badge color={c.tier === "gold" ? "yellow" : c.tier === "silver" ? "gray" : "orange"} size="sm">{c.tier}</Badge>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
