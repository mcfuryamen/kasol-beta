/**
 * minimarket/src/logic/services/license/helpers.ts
 * Pure utility functions — no external dependencies
 */

/** Escape HTML special characters to prevent XSS */
export function escapeHtml(str: string): string {
  const map: Record<string, string> = {
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  };
  return str.replace(/[&<>"']/g, c => map[c]);
}

/** Simple rate limiter using a timestamp-based sliding window */
interface RateLimitEntry { count: number; resetAt: number; }
const _rlStore = new Map<string, RateLimitEntry>();

export function isRateLimited(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const entry = _rlStore.get(key);
  if (!entry || now > entry.resetAt) {
    _rlStore.set(key, { count: 1, resetAt: now + windowMs });
    return false;
  }
  if (entry.count >= limit) return true;
  entry.count++;
  return false;
}

/** Throttle — fires at most once per `wait` ms */
export function throttle<T extends (...args: unknown[]) => unknown>(
  fn: T,
  wait: number
): (...args: Parameters<T>) => void {
  let last = 0;
  return (...args: Parameters<T>) => {
    const now = Date.now();
    if (now - last >= wait) { last = now; fn(...args); }
  };
}

/** Debounce — fires after `wait` ms of silence */
export function debounce<T extends (...args: unknown[]) => unknown>(
  fn: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timer: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), wait);
  };
}

export function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

export function randomHex(bytes = 16): string {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

/** Format number as Indonesian Rupiah */
export function formatRp(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount);
}

/** Validate phone number (Indonesian) */
export function isValidPhone(phone: string): boolean {
  const cleaned = phone.replace(/\D/g, '');
  return /^(0|62|\+62)[8][1-9]\d{7,10}$/.test(cleaned);
}

/** Normalize phone to 62-prefix format */
export function normalizePhone(phone: string): string {
  let cleaned = phone.replace(/\D/g, '');
  if (cleaned.startsWith('0')) cleaned = '62' + cleaned.slice(1);
  else if (cleaned.startsWith('+62')) cleaned = cleaned.slice(1);
  return cleaned;
}

/** Calculate cart total from items */
export interface CartItem { qty: number; price: number; discount?: number; }
export function calcCartTotal(items: CartItem[]): number {
  return items.reduce((sum, item) => {
    const disc = item.discount ?? 0;
    return sum + item.qty * Math.max(0, item.price - disc);
  }, 0);
}

/** Calculate total quantity in cart */
export function calcCartQty(items: CartItem[]): number {
  return items.reduce((sum, item) => sum + item.qty, 0);
}
