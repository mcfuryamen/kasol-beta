import { numpadInput, numpadMode, cartItems, orderDiscount, cartTotal, selectedCartItemId } from "@/logic/state/app-state";
import type { NumpadMode } from "@/logic/state/app-state";
import { posService } from "@/logic/services/pos-service";
import { NumpadKey } from "@/ui/atoms/numpad-key";
import { Icons } from "@/ui/atoms/icon";
import { formatRupiah } from "@/logic/utils/format";

interface NumpadPanelProps {
  onPay: (amount: number) => void;
  onModeChange?: (mode: NumpadMode) => void;
}

const modeLabels: Record<NumpadMode, string> = {
  cash: "BAYAR", qty: "QTY", disc: "DISKON", price: "HARGA"
};
const modeColors: Record<NumpadMode, string> = {
  cash: "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 border-green-300 dark:border-green-700",
  qty:  "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border-blue-300 dark:border-blue-700",
  disc: "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 border-red-300 dark:border-red-700",
  price:"bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 border-purple-300 dark:border-purple-700"
};

export function NumpadPanel({ onPay, onModeChange }: NumpadPanelProps) {
  const mode = numpadMode.value;
  const input = numpadInput.value;
  const total = cartTotal.value;
  const numericInput = parseFloat(input) || 0;

  const appendDigit = (d: string) => {
    if (d === "." && input.includes(".")) return;
    if (input === "0" && d !== ".") { numpadInput.value = d; return; }
    numpadInput.value = input + d;
  };

  const backspace = () => {
    numpadInput.value = input.slice(0, -1) || "0";
  };

  const clear = () => {
    numpadInput.value = "0";
  };

  const applyInput = () => {
    const val = parseFloat(input) || 0;
    const itemId = selectedCartItemId.value;

    if (mode === "cash") {
      onPay(val);
    } else if (mode === "qty" && itemId) {
      posService.updateQty(itemId, Math.round(val));
      numpadInput.value = "0";
    } else if (mode === "disc" && itemId) {
      posService.setItemDiscount(itemId, val);
      numpadInput.value = "0";
    } else if (mode === "disc" && !itemId) {
      orderDiscount.value = val;
      numpadInput.value = "0";
    }
  };

  const cycleModes: NumpadMode[] = ["cash", "qty", "disc", "price"];
  const nextMode = () => {
    const idx = cycleModes.indexOf(mode);
    const next = cycleModes[(idx + 1) % cycleModes.length];
    numpadMode.value = next;
    numpadInput.value = "0";
    onModeChange?.(next);
  };

  const quickCashAmounts = [total > 0 ? Math.ceil(total / 1000) * 1000 : 0, 50000, 100000, 200000]
    .filter(a => a > 0 && a >= total)
    .slice(0, 3);

  return (
    <div class="flex flex-col h-full gap-2 p-3">
      {/* Mode indicator + display */}
      <div class={`rounded-xl border p-3 ${modeColors[mode]}`}>
        <div class="flex items-center justify-between mb-1">
          <button
            onClick={nextMode}
            class="text-xs font-bold px-2 py-0.5 rounded-full bg-current/10 hover:bg-current/20 transition-colors"
            title="Toggle mode (F6)"
          >
            {modeLabels[mode]} MODE
          </button>
          <span class="text-[10px] opacity-60">F6 untuk ganti</span>
        </div>
        <div class="text-right">
          <p class="text-2xl font-black font-mono tracking-wider">
            {mode === "cash" ? formatRupiah(numericInput) : input || "0"}
          </p>
          {mode === "cash" && total > 0 && numericInput >= total && (
            <p class="text-xs opacity-70">Kembalian: {formatRupiah(numericInput - total)}</p>
          )}
        </div>
      </div>

      {/* Quick cash amounts (only in cash mode) */}
      {mode === "cash" && total > 0 && (
        <div class="grid grid-cols-3 gap-1.5">
          {[
            Math.ceil(total / 1000) * 1000,
            Math.ceil(total / 10000) * 10000,
            Math.ceil(total / 50000) * 50000
          ].filter((v, i, a) => a.indexOf(v) === i).slice(0, 3).map(a => (
            <button
              key={a}
              onClick={() => { numpadInput.value = a.toString(); }}
              class="py-1 text-xs font-medium bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400 rounded-lg hover:bg-primary-100 dark:hover:bg-primary-900/40 transition-colors"
            >
              {formatRupiah(a)}
            </button>
          ))}
        </div>
      )}

      {/* Numpad grid */}
      <div class="flex-1 grid grid-cols-3 gap-2" style="grid-template-rows: repeat(5, 1fr)">
        {/* Row 1: 7 8 9 */}
        <NumpadKey label="7" onClick={() => appendDigit("7")} class="h-full min-h-[3.5rem] text-xl" />
        <NumpadKey label="8" onClick={() => appendDigit("8")} class="h-full min-h-[3.5rem] text-xl" />
        <NumpadKey label="9" onClick={() => appendDigit("9")} class="h-full min-h-[3.5rem] text-xl" />

        {/* Row 2: 4 5 6 */}
        <NumpadKey label="4" onClick={() => appendDigit("4")} class="h-full min-h-[3.5rem] text-xl" />
        <NumpadKey label="5" onClick={() => appendDigit("5")} class="h-full min-h-[3.5rem] text-xl" />
        <NumpadKey label="6" onClick={() => appendDigit("6")} class="h-full min-h-[3.5rem] text-xl" />

        {/* Row 3: 1 2 3 */}
        <NumpadKey label="1" onClick={() => appendDigit("1")} class="h-full min-h-[3.5rem] text-xl" />
        <NumpadKey label="2" onClick={() => appendDigit("2")} class="h-full min-h-[3.5rem] text-xl" />
        <NumpadKey label="3" onClick={() => appendDigit("3")} class="h-full min-h-[3.5rem] text-xl" />

        {/* Row 4: 0 00 . */}
        <NumpadKey label="0" onClick={() => appendDigit("0")} class="h-full min-h-[3.5rem] text-xl" />
        <NumpadKey label="00" onClick={() => appendDigit("00")} class="h-full min-h-[3.5rem] text-lg" />
        <NumpadKey label="⌫" onClick={backspace} variant="danger" class="h-full min-h-[3.5rem] text-xl" />

        {/* Row 5: C, Apply/Pay */}
        <NumpadKey label="C" onClick={clear} variant="action" class="h-full min-h-[3.5rem] text-base" sublabel="Clear" />
        <NumpadKey
          label={mode === "cash" ? "BAYAR [F4]" : "TERAPKAN"}
          onClick={applyInput}
          variant="pay"
          class="col-span-2 h-full min-h-[3.5rem] text-base font-black"
          sublabel={mode === "cash" ? formatRupiah(total) : undefined}
        />
      </div>
    </div>
  );
}
