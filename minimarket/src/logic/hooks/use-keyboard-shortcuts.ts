import { useEffect } from "preact/hooks";
import { showShortcutHelp, posFullscreen, numpadMode } from "@/logic/state/app-state";

export interface ShortcutHandlers {
  onF1?: () => void;  // Focus barcode input
  onF2?: () => void;  // Hold order
  onF3?: () => void;  // Show held orders
  onF4?: () => void;  // Open/process payment
  onF5?: () => void;  // Clear cart
  onF6?: () => void;  // Toggle numpad mode
  onF7?: () => void;  // Select customer
  onF8?: () => void;  // Open cash drawer
  onF9?: () => void;  // Print last receipt
  onF10?: () => void; // Void last item
  onF12?: () => void; // Toggle fullscreen
  onEsc?: () => void; // Close modal
  onEnter?: () => void; // Confirm
  onPlus?: () => void;  // Increase qty
  onMinus?: () => void; // Decrease qty
  onDelete?: () => void; // Remove item
}

export function useKeyboardShortcuts(handlers: ShortcutHandlers, active = true) {
  useEffect(() => {
    if (!active) return;

    const handle = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      const isInput = tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";

      // Allow F-keys even in inputs, but block others
      if (e.key === "?" && !isInput) {
        e.preventDefault();
        showShortcutHelp.value = !showShortcutHelp.value;
        return;
      }

      switch (e.key) {
        case "F1":  e.preventDefault(); handlers.onF1?.(); break;
        case "F2":  e.preventDefault(); handlers.onF2?.(); break;
        case "F3":  e.preventDefault(); handlers.onF3?.(); break;
        case "F4":  e.preventDefault(); handlers.onF4?.(); break;
        case "F5":  e.preventDefault(); handlers.onF5?.(); break;
        case "F6":  e.preventDefault(); handlers.onF6?.(); break;
        case "F7":  e.preventDefault(); handlers.onF7?.(); break;
        case "F8":  e.preventDefault(); handlers.onF8?.(); break;
        case "F9":  e.preventDefault(); handlers.onF9?.(); break;
        case "F10": e.preventDefault(); handlers.onF10?.(); break;
        case "F12":
          e.preventDefault();
          handlers.onF12?.();
          if (!handlers.onF12) {
            posFullscreen.value = !posFullscreen.value;
            if (posFullscreen.value) document.documentElement.requestFullscreen?.();
            else document.exitFullscreen?.();
          }
          break;
        case "Escape": handlers.onEsc?.(); break;
        case "Enter":
          if (!isInput) { e.preventDefault(); handlers.onEnter?.(); }
          break;
        case "+":
          if (!isInput) { e.preventDefault(); handlers.onPlus?.(); }
          break;
        case "-":
          if (!isInput) { e.preventDefault(); handlers.onMinus?.(); }
          break;
        case "Delete":
          if (!isInput) { e.preventDefault(); handlers.onDelete?.(); }
          break;
      }
    };

    window.addEventListener("keydown", handle);
    return () => window.removeEventListener("keydown", handle);
  }, [active, handlers]);
}
