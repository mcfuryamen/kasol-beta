/**
 * Admin Marketing KASIRSOLO — Toast Notifications
 * Simple toast system
 */

let toastEl = null;
let toastTimeout = null;

/**
 * Initialize toast element
 */
export function initToast() {
  toastEl = document.getElementById('toast');
}

/**
 * Show toast notification
 * @param {string} message
 * @param {number} duration - Duration in ms (default 2400)
 * @param {string} type - 'info' | 'success' | 'error' | 'warning'
 */
export function showToast(message, duration = 2400, type = 'info') {
  if (!toastEl) initToast();
  if (!toastEl) return;

  // Clear existing timeout
  if (toastTimeout) { clearTimeout(toastTimeout); toastTimeout = null; }

  // Set icon based on type
  const icons = {
    info: 'ℹ️',
    success: '✅',
    error: '❌',
    warning: '⚠️'
  };

  // Render SATU elemen .toast di dalam .toast-host (CSS aktif lewat .toast/.toast.show)
  toastEl.innerHTML = `<div class="toast ${type} show"><span>${icons[type] || icons.info}</span><span>${message}</span></div>`;

  toastTimeout = setTimeout(() => {
    const t = toastEl.querySelector('.toast');
    if (t) t.classList.remove('show');
    toastTimeout = null;
  }, duration);
}

/**
 * Hide toast
 */
export function hideToast() {
  if (toastEl) {
    const t = toastEl.querySelector('.toast');
    if (t) t.classList.remove('show');
  }
  if (toastTimeout) { clearTimeout(toastTimeout); toastTimeout = null; }
}