/**
 * Admin Marketing KASIRSOLO — Utils
 * Shared helper functions (no state, no side effects)
 */

// --- Number Formatting ---
/**
 * Format number as Indonesian Rupiah
 * @param {number|string} n - Number to format
 * @returns {string} Formatted string (e.g., "Rp250.000")
 */
export function formatRupiah(n) {
  if (n === null || n === undefined || n === '') return 'Rp0';
  const num = Number(n);
  if (isNaN(num)) return 'Rp0';
  return 'Rp' + num.toLocaleString('id-ID');
}

/**
 * Parse Indonesian Rupiah string back to number
 * @param {string} str - String like "Rp250.000"
 * @returns {number}
 */
export function unformatRupiah(str) {
  if (!str) return 0;
  return Number(String(str).replace(/[^0-9]/g, '')) || 0;
}

/**
 * Format number with Indonesian locale (no currency symbol)
 * @param {number} n
 * @returns {string}
 */
export function formatNumber(n) {
  return Number(n || 0).toLocaleString('id-ID');
}

// --- Date Formatting ---
/**
 * Format ISO date string to Indonesian locale
 * @param {string} iso - ISO date string
 * @returns {string} Formatted date (e.g., "15 Jan 2024 14:30")
 */
export function formatDate(iso) {
  if (!iso) return '-';
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleDateString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    }) + ' ' + d.toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return iso;
  }
}

/**
 * Format relative time (e.g., "2 jam yang lalu")
 * @param {string} iso - ISO date string
 * @returns {string}
 */
export function formatRelativeTime(iso) {
  if (!iso) return '-';
  try {
    const diff = Date.now() - new Date(iso).getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Baru saja';
    if (minutes < 60) return `${minutes} menit lalu`;
    if (hours < 24) return `${hours} jam lalu`;
    if (days < 7) return `${days} hari lalu`;
    return formatDate(iso);
  } catch {
    return iso;
  }
}

// --- String Utilities ---
/**
 * Escape HTML to prevent XSS
 * @param {string} str
 * @returns {string}
 */
export function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Truncate string with ellipsis
 * @param {string} str
 * @param {number} maxLength
 * @returns {string}
 */
export function truncate(str, maxLength = 50) {
  if (!str || str.length <= maxLength) return str || '';
  return str.slice(0, maxLength - 1) + '…';
}

/**
 * Generate unique ID
 * @returns {string}
 */
export function generateId(prefix = 'id') {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Debounce function
 * @param {Function} fn
 * @param {number} ms
 * @returns {Function}
 */
export function debounce(fn, ms = 300) {
  let timeoutId;
  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), ms);
  };
}

/**
 * Throttle function
 * @param {Function} fn
 * @param {number} ms
 * @returns {Function}
 */
export function throttle(fn, ms = 300) {
  let lastCall = 0;
  return (...args) => {
    const now = Date.now();
    if (now - lastCall >= ms) {
      lastCall = now;
      fn(...args);
    }
  };
}

// --- DOM Utilities ---
/**
 * Create element with attributes and children
 * @param {string} tag
 * @param {Object} attrs
 * @param {Array|string|Node} children
 * @returns {HTMLElement}
 */
export function createElement(tag, attrs = {}, children = []) {
  const el = document.createElement(tag);
  Object.entries(attrs).forEach(([key, value]) => {
    if (key === 'class') el.className = value;
    else if (key === 'dataset') Object.entries(value).forEach(([k, v]) => el.dataset[k] = v);
    else if (key.startsWith('on') && typeof value === 'function') el.addEventListener(key.slice(2).toLowerCase(), value);
    else el.setAttribute(key, value);
  });
  (Array.isArray(children) ? children : [children]).forEach(child => {
    if (child instanceof Node) el.appendChild(child);
    else if (child != null) el.appendChild(document.createTextNode(String(child)));
  });
  return el;
}

/**
 * Safe query selector
 * @param {string} selector
 * @param {Element} context
 * @returns {Element|null}
 */
export function $(selector, context = document) {
  return context.querySelector(selector);
}

/**
 * Safe query selector all
 * @param {string} selector
 * @param {Element} context
 * @returns {NodeList}
 */
export function $$(selector, context = document) {
  return context.querySelectorAll(selector);
}

// --- Validation ---
/**
 * Validate Indonesian phone number (62xxxx)
 * @param {string} phone
 * @returns {boolean}
 */
export function validatePhone(phone) {
  return /^62[0-9]{8,13}$/.test(String(phone).replace(/\D/g, ''));
}

/**
 * Validate email
 * @param {string} email
 * @returns {boolean}
 */
export function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * Normalize phone to 62xxxx format
 * @param {string} phone
 * @returns {string}
 */
export function normalizePhone(phone) {
  return String(phone).replace(/\D/g, '').replace(/^0/, '62').replace(/^6262/, '62');
}

// --- Array/Object Utilities ---
/**
 * Group array by key
 * @param {Array} arr
 * @param {string|Function} key
 * @returns {Object}
 */
export function groupBy(arr, key) {
  return arr.reduce((acc, item) => {
    const k = typeof key === 'function' ? key(item) : item[key];
    if (!acc[k]) acc[k] = [];
    acc[k].push(item);
    return acc;
  }, {});
}

/**
 * Sort array by key (descending by default)
 * @param {Array} arr
 * @param {string} key
 * @param {boolean} desc
 * @returns {Array}
 */
export function sortBy(arr, key, desc = true) {
  return [...arr].sort((a, b) => {
    const av = a[key];
    const bv = b[key];
    if (av < bv) return desc ? 1 : -1;
    if (av > bv) return desc ? -1 : 1;
    return 0;
  });
}

/**
 * Unique array by key
 * @param {Array} arr
 * @param {string|Function} key
 * @returns {Array}
 */
export function uniqueBy(arr, key) {
  const seen = new Set();
  return arr.filter(item => {
    const k = typeof key === 'function' ? key(item) : item[key];
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}