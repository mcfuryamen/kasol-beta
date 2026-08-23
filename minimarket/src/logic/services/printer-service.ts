import { signal } from "@preact/signals";
import { printerConfig } from "@/logic/state/app-state";
import type { PrintJob, PrinterConfig } from "@/data/types/printer";
import type { Order } from "@/data/types/order";
import { generateId, formatDateTime, formatRupiah } from "@/logic/utils/format";
import { storeSettings } from "@/logic/state/app-state";

export const printerConnected = signal(false);
export const printQueue = signal<PrintJob[]>([]);
export const lastPrintJob = signal<PrintJob | null>(null);

const paymentLabels: Record<string, string> = {
  cash: "Tunai", qris: "QRIS", debit: "Kartu Debit",
  credit: "Kartu Kredit", ewallet: "E-Wallet", tempo: "Tempo"
};

class PrinterService {
  updateConfig(cfg: Partial<PrinterConfig>) {
    printerConfig.value = { ...printerConfig.value, ...cfg };
  }

  buildReceiptText(order: Order): string {
    const settings = storeSettings.value;
    const cfg = printerConfig.value;
    const width = cfg.paperSize === "58mm" ? 32 : 48;
    const line = "=".repeat(width);
    const dashes = "-".repeat(width);

    const center = (text: string) => {
      const pad = Math.max(0, Math.floor((width - text.length) / 2));
      return " ".repeat(pad) + text;
    };

    const row = (left: string, right: string) => {
      const maxLeft = width - right.length - 1;
      const l = left.length > maxLeft ? left.slice(0, maxLeft) : left;
      return l + " ".repeat(width - l.length - right.length) + right;
    };

    let lines: string[] = [];
    lines.push(center(settings.name));
    lines.push(center(settings.address));
    lines.push(center(settings.phone));
    lines.push(line);
    lines.push(row("No:", order.orderNumber));
    lines.push(row("Tgl:", formatDateTime(order.createdAt)));
    lines.push(row("Kasir:", order.cashierName));
    if (order.customerName) lines.push(row("Member:", order.customerName));
    lines.push(line);

    order.items.forEach(item => {
      lines.push(item.productName.slice(0, width));
      lines.push(row(`  ${item.qty} x ${formatRupiah(item.sellPrice)}`, formatRupiah(item.subtotal)));
      if (item.discount > 0) lines.push(row("  Diskon item:", `-${formatRupiah(item.discount * item.qty)}`));
    });

    lines.push(line);
    lines.push(row("Subtotal:", formatRupiah(order.subtotal)));
    if (order.discount > 0) lines.push(row("Diskon:", `-${formatRupiah(order.discount)}`));
    lines.push(row("PPN 11%:", formatRupiah(order.tax)));
    lines.push(dashes);
    lines.push(row("TOTAL:", formatRupiah(order.total)));
    lines.push(row(paymentLabels[order.paymentMethod] + ":", formatRupiah(order.amountPaid)));
    if (order.change > 0) lines.push(row("Kembalian:", formatRupiah(order.change)));
    lines.push(line);
    lines.push(center(cfg.footerText || settings.receiptFooter));
    lines.push(center("Powered by Kasir Solo"));
    lines.push("");

    return lines.join("\n");
  }

  printReceipt(order: Order): PrintJob {
    const content = this.buildReceiptText(order);
    const job: PrintJob = {
      id: generateId(), type: "receipt", status: "pending",
      content, createdAt: new Date().toISOString()
    };
    printQueue.value = [...printQueue.value, job];

    // Simulate browser print
    setTimeout(() => {
      this.browserPrint(content, order);
      this.completejob(job.id);
    }, 100);

    return job;
  }

  browserPrint(text: string, order: Order) {
    const content = document.getElementById("receipt-content");
    if (!content) return;
    const w = window.open("", "", "width=400,height=700");
    if (!w) return;
    w.document.write(`<html><head><title>Struk</title><style>
      body{font-family:'Courier New',monospace;font-size:12px;margin:20px;max-width:300px;}
      .center{text-align:center;} .right{text-align:right;}
      hr{border:none;border-top:1px dashed #000;}
      @media print{button{display:none;}}
    </style></head><body>${content.innerHTML}
    <br><button onclick="window.print()">Cetak</button>
    </body></html>`);
    w.document.close();
    const cfg = printerConfig.value;
    if (cfg.autoPrint) { w.print(); w.close(); }
  }

  printTest(): PrintJob {
    const text = "== TEST PRINT ==\nKasir Solo - Minimarket\nPrinter OK!\n================";
    const job: PrintJob = {
      id: generateId(), type: "test", status: "done",
      content: text, createdAt: new Date().toISOString(), completedAt: new Date().toISOString()
    };
    printQueue.value = [...printQueue.value, job];
    lastPrintJob.value = job;
    alert("Test print: " + text);
    return job;
  }

  completejob(id: string) {
    printQueue.value = printQueue.value.map(j =>
      j.id === id ? { ...j, status: "done", completedAt: new Date().toISOString() } : j
    );
    const done = printQueue.value.find(j => j.id === id);
    if (done) lastPrintJob.value = done;
  }

  setConnected(v: boolean) { printerConnected.value = v; }
}

export const printerService = new PrinterService();
