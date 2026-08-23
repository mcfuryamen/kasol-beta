import { useState } from "preact/hooks";
import { financeService } from "@/logic/services/finance-service";
import { currentUser } from "@/logic/state/app-state";
import { showToast } from "@/ui/molecules/toast";
import { Icons } from "@/ui/atoms/icon";
import { Button } from "@/ui/atoms/button";
import { formatRupiah } from "@/logic/utils/format";

interface OpenKasModalProps {
  onClose: () => void;
  onOpened: () => void;
}

const quickAmounts = [100000, 200000, 300000, 500000, 1000000];

export function OpenKasModal({ onClose, onOpened }: OpenKasModalProps) {
  const [amount, setAmount] = useState("0");
  const [notes, setNotes] = useState("");
  const user = currentUser.value;

  const numericAmount = parseInt(amount.replace(/[^0-9]/g, "")) || 0;

  const appendDigit = (d: string) => {
    if (amount === "0") setAmount(d);
    else setAmount(amount + d);
  };
  const backspace = () => setAmount(amount.slice(0, -1) || "0");
  const clear = () => setAmount("0");

  const handleOpen = () => {
    if (!user) { showToast("Tidak ada pengguna aktif", "error"); return; }
    financeService.openShift(numericAmount, notes || undefined);
    showToast("Kas berhasil dibuka!", "success");
    onOpened();
  };

  return (
    <div class="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4">
      <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div class="bg-gradient-to-r from-green-500 to-green-600 p-6 text-white">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                <Icons.DollarSign size={24} />
              </div>
              <div>
                <h2 class="text-xl font-black">Buka Kas</h2>
                <p class="text-green-100 text-sm">Masukkan modal awal kasir</p>
              </div>
            </div>
            <button onClick={onClose} class="text-white/70 hover:text-white">
              <Icons.X size={24} />
            </button>
          </div>
        </div>

        <div class="p-6 space-y-4">
          {/* Amount display */}
          <div class="bg-gray-50 dark:bg-gray-900 rounded-xl p-4 text-center border-2 border-gray-200 dark:border-gray-700">
            <p class="text-sm text-gray-500 dark:text-gray-400 mb-1">Modal Awal</p>
            <p class="text-3xl font-black text-gray-900 dark:text-gray-100">{formatRupiah(numericAmount)}</p>
          </div>

          {/* Quick amounts */}
          <div class="grid grid-cols-5 gap-1.5">
            {quickAmounts.map(a => (
              <button key={a} onClick={() => setAmount(a.toString())}
                class="py-1.5 text-xs font-semibold bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 rounded-lg hover:bg-green-100 dark:hover:bg-green-900/40 transition-colors">
                {formatRupiah(a)}
              </button>
            ))}
          </div>

          {/* Numpad */}
          <div class="grid grid-cols-3 gap-2">
            {["7","8","9","4","5","6","1","2","3"].map(d => (
              <button key={d} onClick={() => appendDigit(d)}
                class="h-12 text-xl font-bold bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-600 text-gray-900 dark:text-gray-100 transition-colors active:scale-95">
                {d}
              </button>
            ))}
            <button onClick={() => appendDigit("0")}
              class="h-12 text-xl font-bold bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-600 text-gray-900 dark:text-gray-100 transition-colors active:scale-95">
              0
            </button>
            <button onClick={() => appendDigit("00")}
              class="h-12 text-xl font-bold bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-600 text-gray-900 dark:text-gray-100 transition-colors active:scale-95">
              00
            </button>
            <button onClick={backspace}
              class="h-12 text-xl font-bold bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 text-red-500 rounded-xl hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors active:scale-95">
              ⌫
            </button>
          </div>

          {/* Notes */}
          <textarea
            value={notes}
            onInput={(e: any) => setNotes(e.target.value)}
            placeholder="Catatan (opsional)..."
            rows={2}
            class="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
          />

          {/* Actions */}
          <div class="flex gap-3">
            <Button variant="secondary" fullWidth onClick={onClose}>Batal</Button>
            <Button variant="success" fullWidth onClick={handleOpen}
              icon={<Icons.Zap size={16} />}>
              Buka Kas
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
