// ==================== PURE HELPERS (ESM) ====================
// Pure utility functions with NO DOM access. Can be tested in isolation.
// All DOM operations should be in a separate helpers-ui.js module.

// XSS sanitization: escape HTML special characters in user-controlled strings
export function escapeHtml(s) {
  if (s === null || s === undefined) return '';
  const AMP = '&' + 'amp;';
  const MAP = {
    '&': AMP,
    '<': '&' + 'lt;',
    '>': '&' + 'gt;',
    '"': '&' + 'quot;',
    "'": '&' + '#39;'
  };
  return String(s).replace(/[&<>"']/g, c => MAP[c]);
}

// Allow only simple text in HTML; for richer markup use buildSafeHtml helper
export function buildSafeHtml(strings, ...values) {
  let out = '';
  strings.forEach((str, i) => {
    out += str;
    if (i < values.length) {
      const v = values[i];
      if (v === null || v === undefined) return;
      if (typeof v === 'object' && v.__raw === true) {
        out += v.html;
      } else {
        out += escapeHtml(v);
      }
    }
  });
  return out;
}

export function todayStr() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
}

export function formatRp(n) {
  if (n === undefined || n === null || isNaN(n)) return 'Rp 0';
  return 'Rp ' + Math.round(n).toLocaleString('id-ID');
}

export function formatDate(str) {
  if (!str) return '';
  const [y,m,d] = str.split('-');
  const months = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
  return parseInt(d) + ' ' + months[parseInt(m)-1] + ' ' + y;
}

export function formatTime(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  return String(d.getHours()).padStart(2,'0') + ':' + String(d.getMinutes()).padStart(2,'0');
}

export function dayName(str) {
  const days = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'];
  return days[new Date(str+'T00:00:00').getDay()];
}

export function getGreeting() {
  const h = new Date().getHours();
  if (h < 11) return 'Selamat pagi! ☀️';
  if (h < 15) return 'Selamat siang! 🌤️';
  if (h < 18) return 'Selamat sore! 🌅';
  return 'Selamat malam! 🌙';
}

export function addDays(dateStr, n) {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
}

export function getWeekRange(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  const day = d.getDay();
  const mon = new Date(d); mon.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
  const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
  const fmt = dt => dt.getFullYear() + '-' + String(dt.getMonth()+1).padStart(2,'0') + '-' + String(dt.getDate()).padStart(2,'0');
  return { start: fmt(mon), end: fmt(sun) };
}

export function getMonthRange(dateStr) {
  const [y,m] = dateStr.split('-');
  const start = y + '-' + m + '-01';
  const last = new Date(parseInt(y), parseInt(m), 0).getDate();
  const end = y + '-' + m + '-' + String(last).padStart(2,'0');
  return { start, end };
}

// Debounce: returns a function that throttles calls to fn by delay ms
export function debounce(fn, delay = 300) {
  let timer = null;
  return function(...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}

// Throttle: returns a function that limits calls to once per ms
export function throttle(fn, ms = 100) {
  let last = 0;
  return function(...args) {
    const now = Date.now();
    if (now - last >= ms) {
      last = now;
      fn.apply(this, args);
    }
  };
}

// ==================== PHONE / WHATSAPP VALIDATION ====================
export function sanitizePhoneInput(raw) {
  if (!raw) return '';
  return String(raw).replace(/[^\d+\s-]/g, '');
}

export function validatePhone(raw) {
  const cleaned = sanitizePhoneInput(raw).replace(/[\s-]/g, '');
  if (!cleaned) return { valid: false, normalized: '', message: 'Nomor WhatsApp tidak boleh kosong!' };

  let digits;
  if (cleaned.startsWith('+62')) {
    digits = '62' + cleaned.slice(3);
  } else if (cleaned.startsWith('62') && cleaned.length > 2 && cleaned[2] !== '0') {
    digits = cleaned;
  } else if (cleaned.startsWith('0')) {
    digits = '62' + cleaned.slice(1);
  } else {
    return { valid: false, normalized: '', message: 'Nomor harus diawali 08 (lokal) atau +62 / 62 (internasional).' };
  }

  if (!/^\d+$/.test(digits)) {
    return { valid: false, normalized: '', message: 'Nomor hanya boleh berisi angka, +, spasi, dan tanda hubung.' };
  }

  const body = digits.slice(2);
  if (body.length < 9 || body.length > 13) {
    return { valid: false, normalized: '', message: 'Panjang nomor tidak valid (harus 10–15 digit termasuk kode negara).' };
  }
  if (body[0] !== '8') {
    return { valid: false, normalized: '', message: 'Bukan nomor HP/WhatsApp Indonesia yang valid (harus diawali 08…).' };
  }

  return { valid: true, normalized: digits, message: '' };
}

export function formatPhoneDisplay(normalized) {
  if (!normalized || !normalized.startsWith('62')) return normalized || '—';
  return '0' + normalized.slice(2);
}

// ==================== CART LOGIC (PURE) ====================
export function addToCart(cart, menuId, menu) {
  const existing = cart[menuId];
  if (existing) {
    return { ...cart, [menuId]: { ...existing, qty: existing.qty + 1 } };
  }
  return { ...cart, [menuId]: { menu, qty: 1 } };
}

export function removeFromCart(cart, menuId) {
  const { [menuId]: _, ...rest } = cart;
  return rest;
}

export function changeQty(cart, menuId, delta) {
  const item = cart[menuId];
  if (!item) return cart;
  const newQty = item.qty + delta;
  if (newQty <= 0) {
    return removeFromCart(cart, menuId);
  }
  return { ...cart, [menuId]: { ...item, qty: newQty } };
}

export function calculateTotal(cart) {
  return Object.values(cart).reduce((sum, item) => sum + (item.menu.hargaJual * item.qty), 0);
}

export function calculateModal(cart) {
  return Object.values(cart).reduce((sum, item) => sum + (item.menu.hargaModal * item.qty), 0);
}

export function countItems(cart) {
  return Object.values(cart).reduce((sum, item) => sum + item.qty, 0);
}

// ==================== SALE VALIDATION (PURE) ====================
export function validateSale(sale) {
  if (!sale.items || Object.keys(sale.items).length === 0) {
    return { valid: false, message: 'Cart kosong!' };
  }
  if (!sale.totalHarga || sale.totalHarga <= 0) {
    return { valid: false, message: 'Total harga tidak valid!' };
  }
  if (!sale.bayar || sale.bayar < sale.totalHarga) {
    return { valid: false, message: 'Nominal bayar kurang!' };
  }
  return { valid: true };
}

export function hitungKembalian(total, bayar) {
  return Math.max(0, bayar - total);
}

// ==================== REPORT CALCULATIONS (PURE) ====================
export function filterByDate(items, dateStr) {
  return items.filter(item => item.tanggal === dateStr);
}

export function sumByField(items, field) {
  return items.reduce((sum, item) => sum + (item[field] || 0), 0);
}

export function groupByDate(items) {
  const groups = {};
  items.forEach(item => {
    const date = item.tanggal;
    if (!groups[date]) groups[date] = [];
    groups[date].push(item);
  });
  return groups;
}
