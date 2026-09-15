import { h } from 'preact';
import { useState, useEffect, useCallback } from 'preact/hooks';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastData {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
}

const typeStyles: Record<ToastType, string> = {
  success: 'bg-green-50 text-green-800 border-green-200',
  error: 'bg-red-50 text-red-800 border-red-200',
  info: 'bg-blue-50 text-blue-800 border-blue-200',
  warning: 'bg-yellow-50 text-yellow-800 border-yellow-200',
};

const typeIcons: Record<ToastType, string> = {
  success: '✅',
  error: '❌',
  info: 'ℹ️',
  warning: '⚠️',
};

// Simple global toast state
let toastListeners: Array<(toasts: ToastData[]) => void> = [];
let toasts: ToastData[] = [];

function notifyListeners() {
  toastListeners.forEach(l => l([...toasts]));
}

export function showToast(type: ToastType, message: string, duration = 4000) {
  const id = Date.now().toString(36);
  toasts.push({ id, type, message, duration });
  notifyListeners();
  if (duration > 0) {
    setTimeout(() => {
      toasts = toasts.filter(t => t.id !== id);
      notifyListeners();
    }, duration);
  }
}

export function ToastContainer() {
  const [items, setItems] = useState<ToastData[]>([]);

  useEffect(() => {
    toastListeners.push(setItems);
    return () => { toastListeners = toastListeners.filter(l => l !== setItems); };
  }, []);

  if (items.length === 0) return null;

  return (
    <div class="fixed top-4 right-4 z-[100] space-y-2 max-w-sm">
      {items.map(toast => (
        <div
          key={toast.id}
          class={`flex items-center gap-2 px-4 py-3 rounded-lg border shadow-lg animate-slide-in ${typeStyles[toast.type]}`}
        >
          <span>{typeIcons[toast.type]}</span>
          <p class="text-sm flex-1">{toast.message}</p>
          <button
            onClick={() => {
              toasts = toasts.filter(t => t.id !== toast.id);
              notifyListeners();
            }}
            class="text-current opacity-50 hover:opacity-100"
          >
            &times;
          </button>
        </div>
      ))}
    </div>
  );
}
