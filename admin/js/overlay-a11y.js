/**
 * Admin Marketing KASIRSOLO — overlay-a11y.js
 * Aksesibilitas global utk SEMUA sheet/modal (.overlay.open):
 *  - Fokus trap: Tab/Shift+Tab tidak bisa kabur dari overlay yang terbuka
 *  - Esc menutup overlay aktif (dan memulihkan scroll + fokus)
 *  - Fokus dikembalikan ke elemen pemicu saat overlay ditutup
 * Dipakai sebagai side-effect import di app.js.
 */

const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

let lastTrigger = null;

function activeOverlay() {
  return document.querySelector('.overlay.open');
}

function closeOpenOverlay(ov) {
  ov.classList.remove('open');
  document.body.style.overflow = '';
  if (lastTrigger && lastTrigger.isConnected) lastTrigger.focus();
  lastTrigger = null;
}

// Tutup sheet/modal berdasarkan id (dipanggil dari inline onclick di index.html)
window.closeSheet = function (id) {
  const overlay = document.getElementById(id);
  if (overlay) overlay.classList.remove('open');
};

document.addEventListener('keydown', (e) => {
  const ov = activeOverlay();
  if (!ov) return;

  if (e.key === 'Escape') {
    // Biarkan emoji picker menutup lebih dulu jika sedang terbuka
    if (document.querySelector('.emoji-picker-grid.show')) return;
    e.preventDefault();
    closeOpenOverlay(ov);
    return;
  }

  if (e.key !== 'Tab') return;

  const items = [...ov.querySelectorAll(FOCUSABLE)].filter((el) => el.getClientRects().length > 0);
  if (items.length === 0) return;
  const first = items[0];
  const last = items[items.length - 1];
  const inside = ov.contains(document.activeElement);

  if (e.shiftKey && (!inside || document.activeElement === first)) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && (!inside || document.activeElement === last)) {
    e.preventDefault();
    first.focus();
  }
});

// Rekam elemen pemicu saat overlay dibuka (untuk restorasi fokus saat ditutup)
const mo = new MutationObserver((muts) => {
  for (const m of muts) {
    if (m.type === 'attributes' && m.attributeName === 'class' && m.target.classList.contains('open')) {
      lastTrigger = document.activeElement;
    }
  }
});
document.querySelectorAll('.overlay').forEach((ov) =>
  mo.observe(ov, { attributes: true, attributeFilter: ['class'] })
);