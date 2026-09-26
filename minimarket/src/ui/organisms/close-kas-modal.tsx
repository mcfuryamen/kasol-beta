import { useState } from "preact/hooks";
import { financeService } from "@/logic/services/finance-service";
import { currentUser, activeShift } from "@/logic/state/app-state";
import { ordersSignal } from "@/logic/services/pos-service";
import { showToast } from "@/ui/molecules/toast";
import { Icons } from "@/ui/atoms/icon";
import { Button } from "@/ui/atoms/button";
import { formatRupiah, formatDateTime } from "@/logic/utils/format";
import { DENOMINATIONS } from "@/data/types/finance";
import type { Denomination } from "@/data/types/finance";

interface CloseKasModalProps {
  onClose: () => void;
  onClosed: () => void;
}

export function CloseKasModal({ onClose, onClosed }: CloseKasModalProps) {
  const [actualCash, setActualCash] = useState("0");
  const [notes, setNotes] = useState("");
  const [showDenomination, setShowDenomination] = useState(false);
  const [denominations, setDenominations] = useState<Denomination[]>(DENOMINATIONS.map(d => ({ ...d })));
  const user = currentUser.value;
  const shift = activeShift.value;

  if (!shift) return null;

  const cashFlow = financeService.getDailyCashFlow();
  const expectedCash = shift.openingBalance + cashFlow.cashIn - cashFlow.cashOut;
  const today = new Date().toISOString().slice(0, 10);
  const todayOrders = ordersSignal.value.filter(o => o.createdAt.startsWith(today) && o.status === "completed");
  const totalSales = todayOrders.reduce((sum, o) => sum + o.total, 0);

  const denominationTotal = denominations.reduce((sum, d) => sum + d.value * d.count, 0);
  const numericActual = showDenomination ? denominationTotal : (parseInt(actualCash.replace(/[^0-9]/g, "")) || 0);
  const difference = numericActual - expectedCash;

  const appendDigit = (d: string) => {
    if (actualCash === "0") setActualCash(d);
    else setActualCash(actualCash + d);
  };
  const backspace = () => setActualCash(actualCash.slice(0, -1) || "0");

  const updateDenomination = (idx: number, count: number) => {
    setDenominations(denominations.map((d, i) => i === idx ? { ...d, count: Math.max(0, count) } : d));
  };

  const handleClose = () => {
    if (!user) return;
    financeService.closeShift(numericActual, notes || undefined);
    showToast("Kas berhasil ditutup!", "success");
    onClosed();
  };

  return (
    <div class="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4">
      <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div class="bg-gradient-to-r from-red-500 to-red-600 p-5 text-white flex-shrink-0">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                <Icons.X size={22} />
              </div>
              <div>
                <h2 class="text-xl font-black">Tutup Kas</h2>
                <p class="text-red-100 text-xs">Dibuka: {formatDateTime(shift.openedAt)}</p>
              </div>
            </div>
            <button onClick={onClose} class="text-white/70 hover:text-white"><Icons.X size={24} /></button>
          </div>
        </div>

        <div class="overflow-y-auto flex-1 p-5 space-y-4 scrollbar-thin">
          {/* Summary */}
          <div class="grid grid-cols-2 gap-3">
            <div class="bg-gray-50 dark:bg-gray-900 rounded-xl p-3">
              <p class="text-xs text-gray-500 dark:text-gray-400">Modal Awal</p>
              <p class="font-bold text-gray-900 dark:text-gray-100">{formatRupiah(shift.openingBalance)}</p>
            </div>
            <div class="bg-green-50 dark:bg-green-900/20 rounded-xl p-3">
              <p class="text-xs text-gray-500 dark:text-gray-400">Total Penjualan</p>
              <p class="font-bold text-green-700 dark:text-green-400">{formatRupiah(totalSales)}</p>
            </div>
            <div class="bg-red-50 dark:bg-red-900/20 rounded-xl p-3">
              <p class="text-xs text-gray-500 dark:text-gray-400">Pengeluaran Kas</p>
              <p class="font-bold text-red-600 dark:text-red-400">-{formatRupiah(cashFlow.cashOut)}</p>
            </div>
            <div class="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-3">
              <p class="text-xs text-gray-500 dark:text-gray-400">Ekspektasi Kas</p>
              <p class="font-bold text-blue-700 dark:text-blue-400">{formatRupiah(expectedCash)}</p>
            </div>
          </div>

          {/* Denomination toggle */}
          <div class="flex items-center justify-between">
            <p class="text-sm font-medium text-gray-700 dark:text-gray-300">Hitung Denominasi</p>
            <button
              onClick={() => setShowDenomination(!showDenomination)}
              class={`px-3 py-1 text-xs rounded-full font-medium transition-colors ${showDenomination ? "bg-primary-500 text-white" : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300"}`}
            >
              {showDenomination ? "Aktif" : "Nonaktif"}
            </button>
          </div>

          {showDenomination ? (
            <div class="space-y-2">
              {denominations.map((d, i) => (
                <div key={d.value} class="flex items-center gap-3">
                  <span class="text-sm font-medium text-gray-700 dark:text-gray-300 w-24 flex-shrink-0">Rp {d.label}</span>
                  <div class="flex items-center gap-2 flex-1">
                    <button onClick={() => updateDenomination(i, d.count - 1)} class="w-7 h-7 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center hover:bg-gray-200 dark:hover:bg-gray-600">
                      <Icons.Minus size={12} />
                    </button>
                    <input
                      type="number" value={d.count} min="0"
                      onInput={(e: any) => updateDenomination(i, parseInt(e.target.value) || 0)}
                      class="flex-1 text-center text-sm border border-gray-200 dark:border-gray-600 rounded-lg py-1 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-primary-500"
                    />
                    <button onClick={() => updateDenomination(i, d.count + 1)} class="w-7 h-7 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center hover:bg-gray-200 dark:hover:bg-gray-600">
                      <Icons.Plus size={12} />
                    </button>
                    <span class="text-sm text-gray-500 w-24 text-right flex-shrink-0">{formatRupiah(d.value * d.count)}</span>
                  </div>
                </div>
              ))}
              <div class="border-t border-gray-200 dark:border-gray-600 pt-2 flex justify-between font-bold">
                <span class="text-sm text-gray-700 dark:text-gray-300">Total Denominasi</span>
                <span class="text-primary-600 dark:text-primary-400">{formatRupiah(denominationTotal)}</span>
              </div>
            </div>
          ) : (
            <div>
              <p class="text-sm text-gray-700 dark:text-gray-300 mb-2">Kas Aktual di Laci (Rp)</p>
              <div class="bg-gray-50 dark:bg-gray-900 rounded-xl p-3 text-center border-2 border-gray-200 dark:border-gray-700 mb-3">
                <p class="text-2xl font-black text-gray-900 dark:text-gray-100">{formatRupiah(parseInt(actualCash.replace(/[^0-9]/g,"")) || 0)}</p>
              </div>
              <div class="grid grid-cols-3 gap-2">
                {["7","8","9","4","5","6","1","2","3","0","00"].map(d => (
                  <button key={d} onClick={() => appendDigit(d)}
                    class="h-10 text-lg font-bold bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-600 text-gray-900 dark:text-gray-100 transition-colors active:scale-95">
                    {d}
                  </button>
                ))}
                <button onClick={backspace}
                  class="h-10 text-lg font-bold bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 text-red-500 rounded-xl hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors active:scale-95">
                  ⌫
                </button>
              </div>
            </div>
          )}

          {/* Difference display */}
          <div class={`p-3 rounded-xl border font-bold flex justify-between ${difference === 0 ? "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-700 dark:text-green-400" : difference > 0 ? "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-400" : "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-600 dark:text-red-400"}`}>
            <span>Selisih: {difference > 0 ? "Surplus" : difference < 0 ? "Defisit" : "Sesuai"}</span>
            <span>{difference >= 0 ? "+" : ""}{formatRupiah(difference)}</span>
          </div>

          {/* Notes */}
          <textarea
            value={notes}
            onInput={(e: any) => setNotes(e.target.value)}
            placeholder="Catatan penutupan kas (opsional)..."
            rows={2}
            class="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
          />
        </div>

        <div class="p-5 border-t border-gray-100 dark:border-gray-700 flex gap-3 flex-shrink-0">
          <Button variant="secondary" fullWidth onClick={onClose}>Batal</Button>
          <Button variant="danger" fullWidth onClick={handleClose} icon={<Icons.X size={16} />}>
            Tutup Kas
          </Button>
        </div>
      </div>
    </div>
  );
}
