import { signal } from "@preact/signals";
import { useEffect } from "preact/hooks";
import { generateId } from "@/logic/utils/format";

type ToastType = "success" | "error" | "info" | "warning";

interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

export const toastsSignal = signal<Toast[]>([]);

export function showToast(message: string, type: ToastType = "info", duration = 3000) {
  const id = generateId();
  toastsSignal.value = [...toastsSignal.value, { id, message, type }];
  setTimeout(() => {
    toastsSignal.value = toastsSignal.value.filter(t => t.id !== id);
  }, duration);
}

const colors: Record<ToastType, string> = {
  success: "bg-green-500",
  error:   "bg-red-500",
  info:    "bg-blue-500",
  warning: "bg-yellow-500"
};

const icons: Record<ToastType, string> = {
  success: "✓", error: "✕", info: "ℹ", warning: "⚠"
};

export function ToastContainer() {
  const toasts = toastsSignal.value;
  return (
    <div class="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
      {toasts.map(t => (
        <div
          key={t.id}
          class={`${colors[t.type]} text-white px-4 py-3 rounded-xl shadow-lg flex items-center gap-2 text-sm font-medium pointer-events-auto max-w-sm animate-[slideIn_0.2s_ease]`}
        >
          <span class="flex-shrink-0 w-5 h-5 rounded-full bg-white/20 flex items-center justify-center text-xs font-bold">
            {icons[t.type]}
          </span>
          {t.message}
        </div>
      ))}
    </div>
  );
}
