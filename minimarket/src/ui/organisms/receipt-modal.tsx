import type { Order } from "@/data/types/order";
import { formatRupiah, formatDateTime } from "@/logic/utils/format";
import { storeSettings } from "@/logic/state/app-state";
import { printerService } from "@/logic/services/printer-service";
import { printerConfig } from "@/logic/state/app-state";
import { Button } from "@/ui/atoms/button";
import { Icons } from "@/ui/atoms/icon";

const paymentLabels: Record<string, string> = {
  cash: "Tunai", qris: "QRIS", debit: "Kartu Debit",
  credit: "Kartu Kredit", ewallet: "E-Wallet", tempo: "Tempo"
};

interface ReceiptModalProps {
  order: Order;
  onClose: () => void;
  onNewTransaction: () => void;
}

export function ReceiptModal({ order, onClose, onNewTransaction }: ReceiptModalProps) {
  const settings = storeSettings.value;
  const cfg = printerConfig.value;

  const handlePrint = () => {
    if (cfg.enabled) {
      printerService.printReceipt(order);
    } else {
      const content = document.getElementById("receipt-content");
      if (!content) return;
      const w = window.open("", "", "width=400,height=700");
      if (!w) return;
      w.document.write(`<html><head><title>Struk #${order.orderNumber}</title>
        <style>body{font-family:'Courier New',monospace;font-size:12px;margin:20px;max-width:280px;}
        hr{border:none;border-top:1px dashed #000;}.center{text-align:center;}
        @media print{.no-print{display:none;}}</style></head>
        <body>${content.innerHTML}
        <br><button class="no-print" onclick="window.print()">Cetak Struk</button>
        </body></html>`);
      w.document.close();
    }
  };

  return (
    <div class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-sm overflow-hidden">
        <div class="p-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
          <h3 class="font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <Icons.Receipt size={18} class="text-primary-500" /> Struk Pembayaran
          </h3>
          <button onClick={onClose} class="text-gray-400 hover:text-gray-600"><Icons.X size={20} /></button>
        </div>

        {/* Success indicator */}
        <div class="p-4 bg-green-50 dark:bg-green-900/20 flex items-center gap-3 border-b border-green-100 dark:border-green-800">
          <div class="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center text-white font-bold text-lg flex-shrink-0">✓</div>
          <div>
            <p class="font-bold text-green-800 dark:text-green-300">Pembayaran Berhasil!</p>
            <p class="text-xs text-green-600 dark:text-green-400">{order.orderNumber}</p>
          </div>
        </div>

        <div class="p-4 max-h-[50vh] overflow-y-auto scrollbar-thin">
          <div id="receipt-content" class="thermal-receipt text-gray-900 dark:text-gray-100">
            <div class="text-center mb-3">
              <p class="font-bold text-sm">{settings.name}</p>
              <p class="text-xs">{settings.address}</p>
              <p class="text-xs">{settings.phone}</p>
              <p class="text-xs mt-1">================================</p>
            </div>
            <div class="text-xs mb-3 space-y-0.5">
              <div class="flex justify-between"><span>No:</span><span class="font-medium">{order.orderNumber}</span></div>
              <div class="flex justify-between"><span>Tgl:</span><span>{formatDateTime(order.createdAt)}</span></div>
              <div class="flex justify-between"><span>Kasir:</span><span>{order.cashierName}</span></div>
              {order.customerName && <div class="flex justify-between"><span>Member:</span><span>{order.customerName}</span></div>}
            </div>
            <p class="text-xs">================================</p>
            <div class="my-3 space-y-2">
              {order.items.map(item => (
                <div key={item.id} class="text-xs">
                  <p class="font-medium truncate">{item.productName}</p>
                  <div class="flex justify-between text-gray-600 dark:text-gray-400">
                    <span>{item.qty} x {formatRupiah(item.sellPrice)}</span>
                    <span class="font-medium">{formatRupiah(item.subtotal)}</span>
                  </div>
                  {item.discount > 0 && <p class="text-red-500 text-[10px]">Diskon: -{formatRupiah(item.discount * item.qty)}</p>}
                </div>
              ))}
            </div>
            <p class="text-xs">================================</p>
            <div class="my-2 text-xs space-y-1">
              <div class="flex justify-between"><span>Subtotal:</span><span>{formatRupiah(order.subtotal)}</span></div>
              {order.discount > 0 && <div class="flex justify-between text-red-500"><span>Diskon:</span><span>-{formatRupiah(order.discount)}</span></div>}
              <div class="flex justify-between"><span>PPN 11%:</span><span>{formatRupiah(order.tax)}</span></div>
              <div class="flex justify-between font-bold text-sm border-t border-gray-300 dark:border-gray-600 pt-1">
                <span>TOTAL:</span><span>{formatRupiah(order.total)}</span>
              </div>
              <div class="flex justify-between mt-1">
                <span>{paymentLabels[order.paymentMethod]}:</span>
                <span>{formatRupiah(order.amountPaid)}</span>
              </div>
              {order.change > 0 && (
                <div class="flex justify-between font-semibold text-green-700 dark:text-green-400">
                  <span>Kembalian:</span><span>{formatRupiah(order.change)}</span>
                </div>
              )}
            </div>
            <p class="text-xs">================================</p>
            <p class="text-center text-xs mt-2">{settings.receiptFooter}</p>
            <p class="text-center text-[10px] text-gray-400 mt-1">Powered by Kasir Solo - Minimarket</p>
          </div>
        </div>

        <div class="p-4 border-t border-gray-100 dark:border-gray-700 flex gap-2">
          <Button variant="outline" size="sm" onClick={handlePrint} icon={<Icons.Print size={15} />} class="flex-1">
            Cetak
          </Button>
          <Button variant="primary" size="sm" onClick={onNewTransaction} class="flex-1">
            Transaksi Baru
          </Button>
        </div>
      </div>
    </div>
  );
}
