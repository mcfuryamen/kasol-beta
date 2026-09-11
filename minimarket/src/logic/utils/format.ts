export function formatRupiah(amount: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency", currency: "IDR",
    minimumFractionDigits: 0, maximumFractionDigits: 0
  }).format(amount);
}

export function formatNumber(n: number): string {
  return new Intl.NumberFormat("id-ID").format(n);
}

export function formatDate(dateStr: string, opts?: Intl.DateTimeFormatOptions): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("id-ID", opts || { day: "2-digit", month: "short", year: "numeric" });
}

export function formatDateTime(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleString("id-ID", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function formatTime(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
}

/** ID unik aman-collision (UUID v4; fallback deterministik untuk browser lama). */
export function generateId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  const bytes = new Uint8Array(16);
  (crypto.getRandomValues ? crypto.getRandomValues(bytes) : null) ||
    (() => { for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256); })();
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, b => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

const todayKey = () => {
  const now = new Date();
  const dateStr = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("");
  return dateStr;
};

/**
 * Nomor dokumen sekuensial harian: INV-YYYYMMDD-0001 / PO-YYYYMMDD-001.
 * Counter dijaga via counterProvider (dipreload dari IndexedDB saat boot)
 * sehingga bebas collision dan tetap benar walau offline berhari-hari.
 */
type CounterProvider = () => Promise<number>;
const counterProviders = new Map<string, CounterProvider>();

export function setCounterProvider(prefix: string, fn: CounterProvider) {
  counterProviders.set(prefix, fn);
}

export function setOrderCounterProvider(fn: CounterProvider) {
  setCounterProvider("INV", fn);
}

async function nextDocNumber(prefix: string, pad: number): Promise<string> {
  const provider = counterProviders.get(prefix);
  const seq = provider ? await provider() : 1;
  return `${prefix}-${todayKey()}-${String(seq).padStart(pad, "0")}`;
}

export async function nextOrderNumber(): Promise<string> {
  return nextDocNumber("INV", 4);
}

export async function nextPONumber(): Promise<string> {
  return nextDocNumber("PO", 3);
}

export function generatePONumber(): string {
  const rand = Math.floor(Math.random() * 999) + 1;
  return `PO-${todayKey()}-${String(rand).padStart(3, "0")}`;
}

export function truncate(str: string, len: number): string {
  return str.length > len ? str.slice(0, len) + "..." : str;
}

export function parseRupiah(str: string): number {
  return parseInt(str.replace(/[^0-9]/g, ""), 10) || 0;
}
