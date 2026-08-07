// ==================== APP STATE (ESM) ====================
// Shared application state. Read-only through imports; ALL mutations go
// through the exported setter functions below. This keeps state changes
// traceable and prevents modules from clobbering each other.
import { todayStr } from './helpers.js';

// --- Cart --- // {menuId: {menu, qty}}
export let cart = {};

// --- Navigation ---
export let currentPage = 'beranda';

// --- POS category filter ---
export let posCat = 'Semua';

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

// ==================== SETTERS ====================
export function setCart(value) {
  cart = value;
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
