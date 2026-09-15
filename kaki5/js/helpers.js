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

// ==================== FOCUS TRAP (a11y) ====================
// Traps keyboard focus within a modal/dialog element.
// Usage: const cleanup = trapFocus(modalElement); ... cleanup();
export function trapFocus(container) {
  if (!container) return () => {};
  
  const focusableSelectors = [
    'button:not([disabled]):not([tabindex="-1"])',
    '[href]:not([tabindex="-1"])',
    'input:not([disabled]):not([tabindex="-1"])',
    'select:not([disabled]):not([tabindex="-1"])',
    'textarea:not([disabled]):not([tabindex="-1"])',
    '[tabindex]:not([tabindex="-1"])',
    '[contenteditable="true"]:not([tabindex="-1"])'
  ].join(', ');
  
  let focusableElements = [];
  let firstElement = null;
  let lastElement = null;
  let previousActiveElement = null;
  
  function updateFocusableElements() {
    focusableElements = Array.from(container.querySelectorAll(focusableSelectors))
      .filter(el => el.offsetParent !== null || el === document.activeElement);
    firstElement = focusableElements[0];
    lastElement = focusableElements[focusableElements.length - 1];
  }
  
  function handleKeyDown(e) {
    if (e.key !== 'Tab') return;
    
    updateFocusableElements();
    
    if (focusableElements.length === 0) return;
    
    if (e.shiftKey) {
      // Shift + Tab
      if (document.activeElement === firstElement) {
        e.preventDefault();
        lastElement?.focus();
      }
    } else {
      // Tab
      if (document.activeElement === lastElement) {
        e.preventDefault();
        firstElement?.focus();
      }
    }
  }
  
  // Store previous active element to restore on cleanup
  previousActiveElement = document.activeElement;
  
  // Initial setup
  updateFocusableElements();
  firstElement?.focus();
  
  container.addEventListener('keydown', handleKeyDown);
  
  // Return cleanup function
  return function cleanup() {
    container.removeEventListener('keydown', handleKeyDown);
    if (previousActiveElement && typeof previousActiveElement.focus === 'function') {
      previousActiveElement.focus();
    }
  };
}

// Auto-apply focus trap to all modals with data-focus-trap="true"
// Call this after modal is shown (added to .show class)
export function setupModalFocusTrap(modalOverlay) {
  const modal = modalOverlay.querySelector('.modal, .license-sheet, .confirm-box');
  if (!modal) return () => {};

  // Small delay to ensure modal is rendered
  return new Promise(resolve => {
    requestAnimationFrame(() => {
      const cleanup = trapFocus(modal);
      resolve(cleanup);
    });
  });
}

// ==================== KSR — KEY-VALUE STYLE REGISTRY (P4 2026-08-22) ========
// Framework untuk migrasi inline style → semantic class.
//
// Masalah: ~320 inline style di JS templates (dinamis per-record) & index.html
// (statis) memaksa CSP `unsafe-inline` dan mencegah konsolidasi styling.
//
// Solusi: ksr() = Key Style Registry. Setiap key = satu class CSS di
// css/style.css (section "KSR UTILITIES").
//   1. Definisi key di _KEY_CSS (bawah)
//   2. Kelas CSS sudah ada di style.css (satu-satunya sumber kebenaran)
//   3. Pemanggil di template: class="${ksr('mt16', 'flex-center')}"
//      → class=" kmt16 kflex-center"
//
// Catatan: dynamic style (mengandung ${} atau ternary) TETAP pakai inline.
// ksr() hanya untuk nilai statis.

const _KEY_CSS = {
  // Margins
  mt8:'margin-top:8px',mt10:'margin-top:10px',mt12:'margin-top:12px',mt14:'margin-top:14px',mt16:'margin-top:16px',mt2:'margin-top:2px',
  mb8:'margin-bottom:8px',mb10:'margin-bottom:10px',mb12:'margin-bottom:12px',mb16:'margin-bottom:16px',
  ml20:'margin-left:20px',
  // Paddings
  p10:'padding:10px',p12:'padding:12px',pt12:'padding-top:12px',pl20:'padding-left:20px',
  // Flex
  flex:'display:flex', 'flex-1':'flex:1',
  'flex-center':'display:flex;align-items:center;justify-content:center',
  'flex-between':'display:flex;align-items:center;justify-content:space-between',
  'flex-between-mb12':'display:flex;align-items:center;justify-content:space-between;margin-bottom:12px',
  'flex-gap4':'display:flex;gap:4px',
  'flex-gap10':'display:flex;align-items:center;gap:10px',
  'flex-gap12':'display:flex;gap:12px',
  'flex-col':'display:flex;flex-direction:column',
  'flex-wrap':'display:flex;flex-wrap:wrap',
  'grid-4col':'display:grid;grid-template-columns:repeat(4,1fr);gap:8px',
  'col-span2':'grid-column:1/-1',
  hide:'display:none', center:'text-align:center', right:'text-align:right', left:'text-align:left',
  // Font sizes
  fs11:'font-size:11px',fs12:'font-size:12px',fs13:'font-size:13px',fs14:'font-size:14px',
  fs15:'font-size:15px',fs16:'font-size:16px',fs17:'font-size:17px',fs18:'font-size:18px',
  fs20:'font-size:20px',fs22:'font-size:22px',fs24:'font-size:24px',fs28:'font-size:28px',fs30:'font-size:30px',fs32:'font-size:32px',
  // Font weights
  fw600:'font-weight:600',fw700:'font-weight:700',fw800:'font-weight:800',
  lh18:'line-height:1.8',
  // Colors
  text2:'color:var(--text2)',text3:'color:var(--text3)',
  primary:'color:var(--primary)',green:'color:var(--green)',red:'color:var(--red)',
  'text-blue':'color:var(--blue)','text-white':'color:#fff',
  // Backgrounds
  'bg-green':'background:var(--green-bg)','bg-red':'background:var(--red-bg)',
  'bg-orange':'background:var(--orange-bg)','bg-blue':'background:var(--blue-bg)',
  'bg-green-b':'background:var(--green-bg);border-color:#A5D6A7',
  'bg-red-b':'background:var(--red-bg);border-color:#EF9A9A',
  'bg-blue-b':'background:var(--blue-bg);border-color:#90CAF9',
  // Card-like containers
  'info-card':'background:var(--green-bg);padding:12px;border-radius:8px;margin-top:12px',
  'warn-card':'background:var(--orange-bg);padding:12px;border-radius:8px;margin-top:12px',
  'err-card':'background:var(--red-bg);padding:12px;border-radius:8px;margin-top:12px',
  'dashed-box':'padding:10px;text-align:center;border:1px dashed var(--border);border-radius:12px;color:var(--text2);font-size:13px',
  // Widget sizes
  wh80:'width:80px;height:80px;margin-bottom:8px',
  wh64:'width:64px;height:64px;margin:0 auto 8px;display:block',
  'wh64-round':'width:64px;height:64px;border-radius:12px;box-shadow:0 2px 8px rgba(0,0,0,.1);flex-shrink:0',
  wh44:'width:44px;height:44px;min-height:44px;font-size:16px',
  'btn-icon':'width:44px;height:44px;min-height:44px;font-size:16px',
  dot:'width:12px;height:12px;border-radius:3px',
  'dot-circle':'width:12px;height:12px;background:var(--red-light);border-radius:50%;flex-shrink:0',
  'w-full':'width:100%','w-max300':'width:100%;max-width:300px;border-radius:12px;margin-bottom:12px',
  // Text overflow
  truncate:'flex:1;text-align:center;white-space:nowrap;min-width:0;overflow:hidden;text-overflow:ellipsis;cursor:pointer;user-select:none',
  'tab-label':'flex:1;text-align:center;white-space:nowrap;min-width:0;overflow:hidden;text-overflow:ellipsis;cursor:pointer;user-select:none',
  'date-label':'flex:1;text-align:center;white-space:nowrap;min-width:0;overflow:hidden;text-overflow:ellipsis;cursor:pointer;user-select:none',
};

/**
 * KSR: translate one or more semantic keys to class string.
 * Usage: class="${ksr('mt16', 'flex-center')}"   → " kmt16 kflex-center"
 * @param  {...string} keys
 * @returns {string}
 */
export function ksr(...keys) {
  return keys.map(k => `k${k}`).join(' ');
}

// v173: nominal kartu KPI bisa ratusan juta ("Rp 999.999.999") bahkan miliar —
// font .stat-value dikecilkan otomatis agar muat di kartu tanpa overflow.
// Threshold per jumlah digit: >6 digit (juta+) → stat-sm, >9 digit (miliar) → stat-xs.
export function statSizeClass(text) {
  const digits = String(text).replace(/\D/g, '').length;
  return digits > 9 ? ' stat-xs' : digits > 6 ? ' stat-sm' : '';
}

// Versi DOM-nya (Beranda): set textContent + pasang class ukuran dari statSizeClass.
export function setStatValue(el, text) {
  if (!el) return;
  el.textContent = text;
  el.classList.remove('stat-sm', 'stat-xs');
  const cls = statSizeClass(text).trim();
  if (cls) el.classList.add(cls);
}


