// ==================== HELPERS ADAPTER (laundry) ====================
// Modul lisensi kaki5 mengimpor escapeHtml & showToast dari './helpers.js'.
// Delegasi ke implementasi laundry (escapeHtml identik, toast memakai #toast).

export function escapeHtml(s){
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

export function showToast(msg, type = 'info', duration = 2200){
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.remove('toast-success', 'toast-error', 'toast-warning', 'toast-info');
  t.classList.add('show', 'toast-' + (type || 'info'));
  clearTimeout(window.__toastTimer);
  window.__toastTimer = setTimeout(() => t.classList.remove('show', 'toast-success', 'toast-error', 'toast-warning', 'toast-info'), duration || 2200);
}
