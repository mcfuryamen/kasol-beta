// ==================== HELPERS (ESM) ====================
// Pure utility/UI helpers. No imports, no side effects.

// XSS sanitization: escape HTML special characters in user-controlled strings
export function escapeHtml(s) {
  if (s === null || s === undefined) return '';
  const AMP = '&' + 'amp;';  // avoid literal entity in source (HTML-parse safe)
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
        // opt-in to raw HTML only for trusted server-side / hard-coded literals
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

export function showToast(msg, type='success') {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.className = 'toast show ' + type;
  setTimeout(() => t.className = 'toast', 2500);
}

// ---- Loading state + error boundary helpers (P3) ----
// Show a skeleton/spinner inside a container while an async task runs.
// Returns { done() } — call done() when finished (or in finally).
export function showLoading(containerId, skeletonLines = 3) {
  const el = document.getElementById(containerId);
  if (!el) return { done(){} };
  let cells = '';
  for (let i = 0; i < skeletonLines; i++) {
    cells += '<div class="skeleton-line" style="animation-delay:' + (i*0.15) + 's"></div>';
  }
  el.innerHTML = '<div class="skeleton">' + cells + '</div>';
  let finished = false;
  return {
    done() {
      if (finished) return;
      finished = true;
    }
  };
}

// Wrap an async page-loader with a skeleton + error boundary (toast on failure).
export function withPageLoading(containerId, fn, skeletonLines) {
  return async function (...args) {
    const load = showLoading(containerId, skeletonLines);
    try {
      await fn.apply(this, args);
    } catch (err) {
      console.error('[' + containerId + '] load error:', err);
      showToast('Terjadi kesalahan saat memuat. Coba lagi.', 'error');
    } finally {
      load.done();
    }
  };
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
