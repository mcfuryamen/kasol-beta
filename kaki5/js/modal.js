// ==================== MODAL MANAGEMENT (ESM) ====================
// Centralized modal open/close with automatic focus trap (a11y)
// All modals/overlays should use these functions instead of directly manipulating classList

import { trapFocus } from './helpers.js';

// Selector default untuk konten modal (elemen yang di-focus-trap).
const DEFAULT_MODAL_SELECTOR =
  '.modal, .license-sheet, .confirm-box, .update-card, .prof-banner-card';

// Overlay ID -> selector kustom (didaftarkan lewat registerModalSelector).
// DIDEKLARASIKAN DI ATAS openModal karena openModal memanggil
// getModalSelector() saat runtime — dulu registry ini ada di bawah dan
// openModal tidak pernah membacanya, jadi registerModalSelector() praktis
// dead code dan lockOverlay/tcModal tidak dapat focus trap.
const customSelectors = new Map();

/**
 * Registers a custom modal selector for an overlay ID.
 * Use this for modals that don't use standard selectors.
 * @param {string} overlayId - The ID of the overlay element
 * @param {string} modalSelector - CSS selector for the modal content
 */
export function registerModalSelector(overlayId, modalSelector) {
  customSelectors.set(overlayId, modalSelector);
}

export function getModalSelector(overlayId) {
  return customSelectors.get(overlayId) || DEFAULT_MODAL_SELECTOR;
}

// Registry of active modal cleanups
const activeModals = new Map();

// Overlay HARD GATE: tidak boleh ditutup dari UI lewat jalur apa pun — Escape
// (di bawah), klik backdrop + klik navbar (app.js), dan navigasi (navigation.js)
// semuanya menyapu daftar yang sama ini. Satu sumber kebenaran supaya jalur
// tutup tidak bisa saling bertentangan.
//   • lockOverlay   = gate lisensi (hard gate lama)
//   • updateOverlay = force update, user wajib tekan OKE lalu reload
//   • bukaKasModal  = (v180) TIDAK lagi hard gate — permintaan pemilik: gerbang
//     kas hanya mengunci halaman Jualan, halaman lain bebas dinavigasi.
//     Escape/backdrop/navigasi kini bisa menutupnya, dan kas.js menegakkan
//     ulang gerbang selama masih di Jualan tanpa shift terbuka.
// CATATAN: ini hanya melarang penutupan DARI LUAR. `closeModal()` sendiri tetap
// bebas dipanggil modul, dan itu jalur yang dipakai `bukaKas()` setelah shift
// tersimpan — kalau tidak, kas yang sudah terbuka tidak bisa menutup modalnya.
export const HARD_GATE_OVERLAYS = new Set(['lockOverlay', 'updateOverlay']);

let _escListenerInstalled = false;
function ensureEscapeListener() {
  if (_escListenerInstalled) return;
  _escListenerInstalled = true;
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    // Tutup overlay ter-atas yang boleh ditutup (urutan insert = urutan buka).
    const closable = [...activeModals.keys()].filter(id => !HARD_GATE_OVERLAYS.has(id));
    if (closable.length === 0) return;
    closeModal(closable[closable.length - 1]);
  });
}

// Scroll-lock: hentikan scroll .main-content selama ada overlay terbuka.
// Scroller utama halaman adalah .main-content (bukan body), jadi kunci di situ.
// Rule CSS: body.modal-open .main-content{overflow:hidden} (components-modal.css).
function refreshScrollLock() {
  const anyOpen = document.querySelector(
    '.modal-overlay.show, .confirm-overlay.show, #updateOverlay.show'
  );
  document.body.classList.toggle('modal-open', !!anyOpen);
}

/**
 * Opens a modal/overlay by ID and applies focus trap.
 * @param {string} overlayId - The ID of the overlay element (e.g., 'cartModal', 'sheetLicense')
 * @param {Object} options - Optional configuration
 * @param {string} options.modalSelector - Override selector for the modal content
 *   (default: selector terdaftar untuk overlayId, atau DEFAULT_MODAL_SELECTOR)
 * @param {boolean} options.focusFirst - Whether to focus first focusable element (default: true)
 * @returns {Promise<void>}
 */
export async function openModal(overlayId, options = {}) {
  const {
    modalSelector = getModalSelector(overlayId),
    focusFirst = true
  } = options;

  const overlay = document.getElementById(overlayId);
  if (!overlay) {
    console.warn(`[Modal] Overlay not found: ${overlayId}`);
    return;
  }

  // If already open, don't re-apply
  if (overlay.classList.contains('show')) return;

  overlay.classList.add('show');
  overlay.setAttribute('aria-hidden', 'false');
  ensureEscapeListener();
  refreshScrollLock();

  // Apply focus trap after render
  const modal = overlay.querySelector(modalSelector);
  if (modal) {
    // Catatan a11y: role="dialog"/aria-modal SUDAH ada di elemen overlay di
    // index.html. Jangan tambahkan role dialog ke elemen konten (child) —
    // itu membuat dialog bersarang dan membingungkan screen reader.

    // Wait for animation/render
    await new Promise(resolve => requestAnimationFrame(resolve));

    const cleanup = trapFocus(modal);
    activeModals.set(overlayId, cleanup);

    // Focus first focusable element
    if (focusFirst) {
      const focusable = modal.querySelector(
        'button:not([disabled]):not([tabindex="-1"]), [href]:not([tabindex="-1"]), input:not([disabled]):not([tabindex="-1"]), select:not([disabled]):not([tabindex="-1"]), textarea:not([disabled]):not([tabindex="-1"]), [tabindex]:not([tabindex="-1"]), [contenteditable="true"]:not([tabindex="-1"])'
      );
      if (focusable) focusable.focus();
    }
  }
}

/**
 * Closes a modal/overlay by ID and cleans up focus trap.
 * @param {string} overlayId - The ID of the overlay element
 * @returns {void}
 */
export function closeModal(overlayId) {
  const overlay = document.getElementById(overlayId);
  if (!overlay) return;

  overlay.classList.remove('show');
  // v145: lepas fokus dulu bila masih tertinggal di dalam overlay.
  // Chromium memblokir aria-hidden pada elemen yang turunannya masih fokus
  // (warning "Blocked aria-hidden ..." di log beta saat tutup modal menu/keranjang).
  if (overlay.contains(document.activeElement)) {
    try { document.activeElement.blur(); } catch (e) { /* noop */ }
  }
  overlay.setAttribute('aria-hidden', 'true');
  refreshScrollLock();

  // Cleanup focus trap
  const cleanup = activeModals.get(overlayId);
  if (cleanup) {
    cleanup();
    activeModals.delete(overlayId);
  }
}

/**
 * Closes all open modals/overlays.
 * Menyapu SEMUA overlay yang sedang `.show` di DOM — bukan hanya yang ada di
 * activeModals — karena overlay tanpa konten yang cocok selector tidak pernah
 * masuk registry dan dulu ikut tertinggal terbuka.
 * @param {Object} options
 * @param {string[]} options.except - Overlay ID tambahan yang tidak boleh ditutup
 *   (mis. saat pindah halaman). HARD_GATE_OVERLAYS selalu dikecualikan sendiri,
 *   jadi pemanggil tidak perlu mengingat daftar gate-nya satu per satu.
 * @returns {void}
 */
export function closeAllModals(options = {}) {
  const { except = [] } = options;
  const skip = new Set([...HARD_GATE_OVERLAYS, ...except]);

  const ids = new Set(activeModals.keys());
  document
    .querySelectorAll('.modal-overlay.show, .confirm-overlay.show, .show[id]')
    .forEach((el) => { if (el.id) ids.add(el.id); });

  for (const overlayId of ids) {
    if (skip.has(overlayId)) continue;
    closeModal(overlayId);
  }
}

/**
 * Checks if a modal is currently open.
 * @param {string} overlayId - The ID of the overlay element
 * @returns {boolean}
 */
export function isModalOpen(overlayId) {
  const overlay = document.getElementById(overlayId);
  return overlay?.classList.contains('show') ?? false;
}

/**
 * Toggles a modal open/closed.
 * @param {string} overlayId - The ID of the overlay element
 * @param {Object} options - Same as openModal options
 * @returns {Promise<void>}
 */
export async function toggleModal(overlayId, options) {
  if (isModalOpen(overlayId)) {
    closeModal(overlayId);
  } else {
    await openModal(overlayId, options);
  }
}

// Export trapFocus for direct use if needed
export { trapFocus } from './helpers.js';