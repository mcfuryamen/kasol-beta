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
  if (toastTimeout) clearTimeout(toastTimeout);

  // Set icon based on type
  const icons = {
    info: 'ℹ️',
    success: '✅',
    error: '❌',
    warning: '⚠️'
  };

  toastEl.innerHTML = `<span>${icons[type] || icons.info}</span><span>${message}</span>`;
  toastEl.classList.add('show');

  toastTimeout = setTimeout(() => {
    toastEl.classList.remove('show');
  }, duration);
}

/**
 * Hide toast
 */
export function hideToast() {
  if (toastEl) toastEl.classList.remove('show');
  if (toastTimeout) clearTimeout(toastTimeout);
}