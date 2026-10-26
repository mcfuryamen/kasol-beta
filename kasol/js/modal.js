/**
 * kasol/js/modal.js
 * Centralized modal management
 * Didasarkan dari kaki5/js/modal.js
 */

// Track all modal state
let _stack = [];         // Stack of active modal ids
let _hardGate = false;   // If true, all close buttons gated behind confirmation

/** Get the top modal id */
export function getCurrentModal() {
  return _stack[_stack.length - 1] || null;
}

/** Check if any modal is open */
export function isModalOpen() {
  return _stack.length > 0;
}

/**
 * Open a modal by id
 * @param {string} modalId
 */
export function openModal(modalId) {
  const el = document.getElementById(modalId);
  if (!el) return;

  // Add to stack
  _stack.push(modalId);
  el.classList.remove('hidden');

  // Focus first focusable element
  const focusable = el.querySelectorAll(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  );
  if (focusable.length) focusable[0].focus();

  // Trap focus within modal
  el.addEventListener('keydown', _trapFocus);

  // Prevent body scroll
  document.body.style.overflow = 'hidden';
}

/**
 * Close a modal by id (or top of stack if no id given)
 * @param {string} [modalId]
 */
export function closeModal(modalId = null) {
  const targetId = modalId || _stack[_stack.length - 1];
  if (!targetId) return;

  const el = document.getElementById(targetId);
  if (el) {
    el.classList.add('hidden');
    el.removeEventListener('keydown', _trapFocus);
  }

  // Remove from stack
  _stack = _stack.filter(id => id !== targetId);

  // Restore body scroll if no modals left
  if (_stack.length === 0) {
    document.body.style.overflow = '';
  }

  // Restore focus to trigger element (stored by trap)
  const prev = document.activeElement;
  if (prev && typeof prev.focus === 'function') prev.focus();
}

/**
 * Close ALL modals
 */
export function closeAllModals() {
  [..._stack].forEach(id => closeModal(id));
}

/** Set hard gate — all close actions require confirmation */
export function setHardGate(enabled) {
  _hardGate = !!enabled;
}

export function isHardGate() {
  return _hardGate;
}

// ── Focus Trap ───────────────────────────────────────────────────────────────
function _trapFocus(e) {
  if (e.key !== 'Tab') return;

  const modal = e.currentTarget;
  const focusable = modal.querySelectorAll(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  );
  if (!focusable.length) return;

  const first = focusable[0];
  const last = focusable[focusable.length - 1];

  if (e.shiftKey) {
    if (document.activeElement === first) {
      e.preventDefault();
      last.focus();
    }
  } else {
    if (document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }
}

// ── Overlay click to close ────────────────────────────────────────────────────
/**
 * Call this on modal wrapper click — closes if clicking the overlay (not the inner content)
 * @param {MouseEvent} e
 * @param {string} modalId
 */
export function overlayClickClose(e, modalId) {
  if (e.target === e.currentTarget) {
    closeModal(modalId);
  }
}
