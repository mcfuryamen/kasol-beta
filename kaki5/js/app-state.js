// ==================== APP STATE (ESM) ====================
// Shared application state. Read-only through imports; ALL mutations go
// through the exported setter functions below. This keeps state changes
// traceable and prevents modules from clobbering each other.
import { todayStr } from './helpers.js';

// --- Cart --- // {menuId: {menu, qty, selectedToppings[], toppingQtys{}, orderType}}
export let cart = {};

// --- Held order yang SEDANG DIBUKA di cart (v154) --- //
// Model baru: buka pesanan ditahan TIDAK menghapus row-nya — row tetap 'held'
// sampai dibayar (payHeldSync → nomor TRX asli) atau ditahan ulang
// (updateHeldSync → data row diperbarui). null = cart manual/bukan hasil buka.
export let resumedHeldId = null;

// --- Order type: dine-in | takeaway | ojol
export let orderType = 'dine-in';

export function setOrderType(value) {
  orderType = value;
}

// --- Navigation ---
export let currentPage = 'beranda';

// --- POS category filter ---
export let posCat = 'Semua';

// --- Kas / shift (v161, adopsi rosok) --- //
// Baris `kasShift` yang sedang berstatus 'buka', atau null. Hanya CACHE untuk
// membaca cepat di gerbang POS; sumber kebenaran tetap IndexedDB. Setiap kali
// status kas berubah, modul kas.js memanggil refreshShiftCache() lalu setter ini.
export let openShift = null;

export function setOpenShift(value) {
  openShift = value || null;
}

// --- Pengeluaran date navigation ---
export let expDate = todayStr();

// --- Laporan period + date ---
export let reportPeriod = 'harian';
export let reportDate = todayStr();
// Custom period range (default: 1 s/d tanggal hari ini bulan berjalan)
const _cd = new Date();
const _cdM = String(_cd.getMonth()+1).padStart(2,'0');
export let customStart = _cd.getFullYear() + '-' + _cdM + '-01';
export let customEnd = _cd.getFullYear() + '-' + _cdM + '-' + String(_cd.getDate()).padStart(2,'0');

export function setReportDate(value) {
  reportDate = value;
}
export function setCustomStart(value) {
  customStart = value;
}
export function setCustomEnd(value) {
  customEnd = value;
}

// --- Trx detail (shared with printer) ---
export let selectedTrxId = null;

// --- Last sale id (set by POS, used by printer "cetak nota terakhir") ---
export let lastSaleId = null;

// --- Platform carousel state ---
export let platCurrentSlide = 0;
export let platAutoTimer = null;
export const PLAT_SCROLL_MS = 4000; // Auto-advance every 4 seconds

// --- Confirm dialog state ---
export let confirmCallback = null;
export let confirmState = { open: false, icon: '', text: '', btnText: '' };

// ==================== SETTERS ====================
export function setCart(value) {
  cart = value;
}

export function setResumedHeldId(value) {
  resumedHeldId = (value === null || value === undefined || value === '') ? null : Number(value);
}
export function getResumedHeldId() {
  return resumedHeldId;
}

export function setCurrentPage(value) {
  currentPage = value;
}

export function setPosCat(value) {
  posCat = value;
}

export function setReportPeriod(value) {
  reportPeriod = value;
  // Reset ke hari ini saat ganti periode — cegah tanggal "bocor" dari mode lain
  // (mis. geser bulan di Bulanan lalu pindah ke Harian jadi tampil "1 bulan lalu").
  const d = new Date();
  reportDate = d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
}

export function setSelectedTrxId(value) {
  selectedTrxId = value;
}

export function setLastSaleId(value) {
  lastSaleId = value;
}

export function setPlatCurrentSlide(value) {
  platCurrentSlide = value;
}

export function setPlatAutoTimer(value) {
  platAutoTimer = value;
}

// --- Confirm dialog setters ---
export function setConfirmCallback(value) {
  confirmCallback = value;
}

export function setConfirmState(value) {
  confirmState = value;
}
