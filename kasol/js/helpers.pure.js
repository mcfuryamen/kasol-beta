/**
 * kasol/js/helpers.pure.js
 * Pure utilities — tidak ada side effect, tidak ada DOM
 * Didasarkan dari kaki5/js/helpers.pure.js
 */

/** Escape HTML special chars */
export function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ── Rate Limiters ─────────────────────────────────────────────────────────────
const _limiters = new Map();

/**
 * Simple in-memory rate limiter
 * @param {string} key
 * @param {number} maxHits
 * @param {number} windowMs
 * @returns {boolean} true = allowed, false = blocked
 */
export function rateLimit(key, maxHits, windowMs) {
  const now = Date.now();
  const entry = _limiters.get(key);

  if (!entry || now - entry.start > windowMs) {
    _limiters.set(key, { start: now, hits: 1 });
    return true;
  }

  if (entry.hits >= maxHits) return false;
  entry.hits++;
  return true;
}

/**
 * Check if key is rate-limited without consuming a hit
 * @param {string} key
 * @param {number} maxHits
 * @param {number} windowMs
 * @returns {boolean}
 */
export function isRateLimited(key, maxHits, windowMs) {
  const now = Date.now();
  const entry = _limiters.get(key);
  if (!entry || now - entry.start > windowMs) return false;
  return entry.hits >= maxHits;
}

// ── Format Mata Uang ─────────────────────────────────────────────────────────
/**
 * Format angka jadi string Rupiah
 * @param {number|string} amount
 * @returns {string}
 */
export function formatRp(amount) {
  const num = parseFloat(amount) || 0;
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(num);
}

// ── Phone Validation ─────────────────────────────────────────────────────────
const PHONE_RE = /^[+]?[(]?[0-9]{1,4}[)]?[-\s./0-9]*$/;

/**
 * @param {string} phone
 * @returns {boolean}
 */
export function isValidPhone(phone) {
  if (!phone) return false;
  const digits = phone.replace(/\D/g, '');
  return digits.length >= 10 && digits.length <= 15 && PHONE_RE.test(phone);
}

/**
 * Normalize phone to 08xx format
 * @param {string} phone
 * @returns {string}
 */
export function normalizePhone(phone) {
  if (!phone) return '';
  let digits = phone.replace(/\D/g, '');
  if (digits.startsWith('62')) digits = '0' + digits.slice(2);
  if (digits.startsWith('+62')) digits = '0' + digits.slice(3);
  return digits;
}

// ── Cart Helpers ─────────────────────────────────────────────────────────────
/**
 * @param {Array<{price:number, qty:number}>} items
 * @returns {number}
 */
export function calcCartTotal(items) {
  return (items || []).reduce((sum, item) => sum + (parseFloat(item.price) * (parseInt(item.qty) || 1)), 0);
}

/**
 * @param {Array<any>} items
 * @returns {number}
 */
export function calcCartQty(items) {
  return (items || []).reduce((sum, item) => sum + (parseInt(item.qty) || 1), 0);
}

// ── Misc ─────────────────────────────────────────────────────────────────────
/** Debounce function */
export function debounce(fn, delayMs) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delayMs);
  };
}

/** Throttle function */
export function throttle(fn, limitMs) {
  let lastCall = 0;
  return (...args) => {
    const now = Date.now();
    if (now - lastCall >= limitMs) {
      lastCall = now;
      fn(...args);
    }
  };
}

/** Sleep promise */
export function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/** Generate random hex string */
export function randomHex(length = 8) {
  const arr = new Uint8Array(length);
  crypto.getRandomValues(arr);
  return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
}

/** Clamp number between min and max */
export function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

/** Deep clone plain object */
export function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}
