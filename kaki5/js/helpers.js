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






export function showToast(msg, type='success', opts) {
  const t = document.getElementById('toast');
  if (!t) return;
  // Backward compat: param ke-3 bisa angka (durasi ms) seperti pemanggil lama.
  let duration = 2500;
  if (typeof opts === 'number') duration = opts;
  else if (opts && typeof opts === 'object') duration = opts.duration ?? 2500;

  clearTimeout(t._toastTimer);

  if (opts && typeof opts === 'object' && opts.actionLabel) {
    // Toast dengan tombol aksi (mis. tombol "Refresh" saat ada update baru).
    t.innerHTML = '<span></span><button class="toast-action" type="button"></button>';
    t.firstElementChild.textContent = msg;
    const btn = t.querySelector('.toast-action');
    btn.textContent = opts.actionLabel;
    btn.onclick = () => {
      t.className = 'toast';
      if (typeof opts.onAction === 'function') opts.onAction();
    };
    if (duration !== Infinity) {
      t._toastTimer = setTimeout(() => t.className = 'toast', duration);
    }
  } else {
    t.textContent = msg;
    t._toastTimer = setTimeout(() => t.className = 'toast', duration);
  }
  t.className = 'toast show ' + type;
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





import { todayStr, formatRp, formatDate, formatTime, dayName, getGreeting, addDays, getWeekRange, getMonthRange, sanitizePhoneInput, validatePhone, formatPhoneDisplay } from './helpers.pure.js';

// Re-export fungsi pure agar konsumen `import ... from './helpers.js'` tetap
// valid (dipindah ke helpers.pure.js saat dedupe — tanpa baris ini 19 modul
// gagal load: "does not provide an export named 'todayStr'").
// Definisi lokal eksplisit (escapeHtml, buildSafeHtml) menang atas nama
// serupa dari star-export, jadi tidak konflik.
export * from './helpers.pure.js';

// ---- Deteksi tipe browser & jenis perangkat (utk CRM / detail klien) ----
// Ramah offline: murni parse navigator.userAgent, tanpa dependensi eksternal.
export function getDeviceInfo() {
  const ua = String(navigator.userAgent || '');
  const uaLower = ua.toLowerCase();

  // --- Browser ---
  let browser = 'Lainnya';
  if (ua.includes('Edg/') || uaLower.includes('edg/')) browser = 'Edge';
  else if (ua.includes('OPR/') || uaLower.includes('opr/')) browser = 'Opera';
  else if (ua.includes('SamsungBrowser')) browser = 'Samsung Internet';
  else if (uaLower.includes('firefox')) browser = 'Firefox';
  else if (ua.includes('CriOS') || uaLower.includes('crios')) browser = 'Chrome (iOS)';
  else if (ua.includes('Chrome/')) browser = 'Chrome';
  else if (ua.includes('Safari/') && !uaLower.includes('chrome')) browser = 'Safari';
  else if (ua.includes('wv') || uaLower.includes('webview')) browser = 'WebView';

  // --- OS / platform ---
  let os = 'Lainnya';
  if (/windows nt/i.test(ua)) os = 'Windows';
  else if (/android/i.test(ua)) os = 'Android';
  else if (/iphone|ipad|ipod/i.test(ua)) os = 'iOS';
  else if (/mac os x/i.test(ua)) os = 'macOS';
  else if (/linux/i.test(ua)) os = 'Linux';

  // --- Jenis perangkat ---
  const isTablet = /ipad/i.test(ua) ||
    (/android/i.test(ua) && !/mobile/i.test(ua)) ||
    (navigator.maxTouchPoints > 1 && /tablet/i.test(ua)) ||
    (ua.includes('Macintosh') && navigator.maxTouchPoints > 1 && typeof window.orientation !== 'undefined');
  const isMobile = !isTablet && (
    /mobile/i.test(ua) ||
    /iphone|ipod|android.*mobile|iemobile|blackberry|opera mini/i.test(uaLower)
  );
  const deviceType = isTablet ? 'tablet' : (isMobile ? 'mobile' : 'desktop');

  return {
    browser,
    os,
    deviceType,
    userAgent: ua.slice(0, 500)
  };
}


