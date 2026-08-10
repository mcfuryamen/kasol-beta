/**
 * Admin Marketing KASIRSOLO — Toast Notifications
 * Simple, accessible toast system
 */

let toastEl = null;
let toastTimer = null;

export function showToast(message, duration = 3000, type = 'info') {
  if (!toastEl) {
    toastEl = document.getElementById('toast');
  }
  if (!toastEl) return;

  clearTimeout(toastTimer);

  toastEl.textContent = message;
  toastEl.className = type ? `show ${type}` : 'show';
  toastEl.style.opacity = '1';

  toastTimer = setTimeout(() => {
    toastEl.style.opacity = '0';
    toastEl.classList.remove('show');
  }, duration);
}

// Global access
window.showToast = showToast;