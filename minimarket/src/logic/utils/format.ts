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

/**
 * Kunci tanggal "YYYY-MM-DD" menurut zona waktu LOKAL toko, bukan UTC.
 *
 * Penting: `toISOString()` memakai UTC. Untuk toko di WIB (UTC+7), penjualan
 * antara 00:00–07:00 waktu lokal akan ter-tagged tanggal sebelumnya, sehingga
 * ringkasan penjualan, rekap kas, dan grafik laporan harian bergeser 7 jam
 * dan tutup kas akan terlihat ada selisih yang tidak ada. Selalu pakai helper
 * ini untuk membandingkan `createdAt` dengan "hari ini".
 */
export function localDateKey(d: Date = new Date()): string {
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("-");
}

const todayKey = () => localDateKey().replace(/-/g, "");

/**
 * Apakah timestamp ISO (yang disimpan dalam format UTC) jatuh pada hari lokal
 * yang sama dengan `dateKey` (default: hari ini).
 *
 * PENTING: jangan pernah membandingkan `iso.startsWith(localDateKey())`.
 * `createdAt` disimpan sebagai UTC ("2026-09-30T17:45:00.000Z") sedangkan
 * `localDateKey()` menghasilkan tanggal lokal ("2026-10-01"). Untuk toko WIB,
 * seluruh penjualan jam 00:00–07:00 punya awalan UTC "hari sebelumnya" dan
 * TIDAK AKAN PERNAH cocok dengan perbandingan string —omzet jam buka hilang.
 * Karena itu harus konversi instant-nya lebih dulu.
 */
export function isLocalDay(iso: string, dateKey: string = localDateKey()): boolean {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return false;
  return localDateKey(d) === dateKey;
}

/** Convenience: apakah timestamp ini terjadi hari ini (waktu lokal toko)? */
export function isToday(iso: string): boolean {
  return isLocalDay(iso, localDateKey());
}

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

export function truncate(str: string, len: number): string {
  return str.length > len ? str.slice(0, len) + "..." : str;
}

export function parseRupiah(str: string): number {
  return parseInt(str.replace(/[^0-9]/g, ""), 10) || 0;
}
