/**
 * Molecule: Toast notification
 * Standalone toast (bukan dari init.js)
 */
import { el } from '../../db/init.js';

let toastContainer = null;

function getContainer() {
  if (!toastContainer) {
    toastContainer = el('div', { id: 'toast-container', style: 'position:fixed;top:16px;right:16px;z-index:9999;display:flex;flex-direction:column;gap:8px;max-width:320px;' });
    document.body.appendChild(toastContainer);
  }
  return toastContainer;
}

const ICONS = { ok: '&#10003;', err: '&#10007;', info: '&#8505;', warn: '&#9888;' };
const COLORS = {
  ok: 'border-green-500 bg-green-50 text-green-800',
  err: 'border-red-500 bg-red-50 text-red-800',
  info: 'border-blue-500 bg-blue-50 text-blue-800',
  warn: 'border-yellow-500 bg-yellow-50 text-yellow-800'
};

export function toast(type = 'info', message, duration = 3500) {
  const c = getContainer();
  const t = el('div', {
    class: 'toast-item ' + COLORS[type] + ' border-l-4 rounded-lg px-4 py-3 shadow-md flex items-center gap-2 text-sm animate-slide-in',
    style: 'animation: slideIn 0.3s ease'
  });
  t.innerHTML = '<span style="flex-shrink:0">' + (ICONS[type] || ICONS.info) + '</span><span>' + message + '</span>';
  c.appendChild(t);
  setTimeout(() => {
    t.style.opacity = '0';
    t.style.transform = 'translateX(100%)';
    t.style.transition = 'all 0.3s';
    setTimeout(() => t.remove(), 300);
  }, duration);
}

// Inject animation
if (!document.getElementById('toast-anim')) {
  const style = document.createElement('style');
  style.id = 'toast-anim';
  style.textContent = `
    @keyframes slideIn { from { opacity:0; transform:translateX(100%); } to { opacity:1; transform:translateX(0); } }
    .toast-item { border-left-width: 4px; }
  `;
  document.head.appendChild(style);
}
