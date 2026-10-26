import { signal } from "@preact/signals";
import { Button } from "@/ui/atoms/button";

interface ConfirmState {
  open: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel?: () => void;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

export const confirmState = signal<ConfirmState>({
  open: false, title: "", message: "", onConfirm: () => {}
});

export function showConfirm(opts: Omit<ConfirmState, "open">) {
  confirmState.value = { ...opts, open: true };
}

export function ConfirmDialog() {
  const s = confirmState.value;
  if (!s.open) return null;

  const close = () => { confirmState.value = { ...s, open: false }; };

  return (
    <div class="fixed inset-0 bg-black/50 z-[200] flex items-center justify-center p-4">
      <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-sm p-6">
        <h3 class="font-bold text-lg text-gray-900 dark:text-gray-100 mb-2">{s.title}</h3>
        <p class="text-sm text-gray-600 dark:text-gray-400 mb-6">{s.message}</p>
        <div class="flex gap-3">
          <Button variant="secondary" fullWidth onClick={() => { s.onCancel?.(); close(); }}>
            {s.cancelLabel || "Batal"}
          </Button>
          <Button variant={s.danger ? "danger" : "primary"} fullWidth onClick={() => { s.onConfirm(); close(); }}>
            {s.confirmLabel || "Ya"}
          </Button>
        </div>
      </div>
    </div>
  );
}
