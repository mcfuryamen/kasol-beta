/**
 * minimarket/src/logic/services/license/modal.tsx
 * Centralized modal management for Minimarket
 * Handles focus trap, overlay click close, hard gate lock
 */
import { JSX } from 'preact';
import { useEffect, useRef } from 'preact/hooks';

// ─── Global modal state ──────────────────────────────────────────────────────
let _hardGateActive = false;
const _listeners = new Set<() => void>();

export function onHardGateChange(fn: () => void): () => void {
  _listeners.add(fn);
  return () => _listeners.delete(fn);
}

function _notifyHardGate() {
  _listeners.forEach(fn => fn());
}

/** Activate hard gate — blocks entire app behind a full-screen lock */
export function setHardGate(active: boolean): void {
  _hardGateActive = active;
  _notifyHardGate();
}

export function isHardGateActive(): boolean {
  return _hardGateActive;
}

// ─── Focus trap ─────────────────────────────────────────────────────────────
function _trapFocus(root: HTMLElement) {
  const focusable = root.querySelectorAll<HTMLElement>(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  );
  const first = focusable[0];
  const last = focusable[focusable.length - 1];

  function handleKey(e: KeyboardEvent) {
    if (e.key !== 'Tab') return;
    if (e.shiftKey) {
      if (document.activeElement === first) { e.preventDefault(); last?.focus(); }
    } else {
      if (document.activeElement === last) { e.preventDefault(); first?.focus(); }
    }
  }

  root.addEventListener('keydown', handleKey);
  first?.focus();
  return () => root.removeEventListener('keydown', handleKey);
}

// ─── openModal / closeModal ───────────────────────────────────────────────────
let _openCount = 0;

export interface ModalOptions {
  onClose?: () => void;
  overlayClose?: boolean;
  showClose?: boolean;
  title?: string;
}

export function openModal(content: JSX.Element, opts: ModalOptions = {}): string {
  const id = `modal-${++_openCount}`;

  // Remove existing overlay if any
  const existing = document.getElementById('mm-modal-overlay');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.id = 'mm-modal-overlay';
  overlay.setAttribute('data-testid', 'modal-overlay');
  overlay.style.cssText = `
    position: fixed; inset: 0; z-index: 9999;
    background: rgba(0,0,0,0.5);
    display: flex; align-items: center; justify-content: center;
    padding: 1rem;
    animation: mm-fadein 0.15s ease;
  `.replace(/\s+/g, ' ');

  const card = document.createElement('div');
  card.id = id;
  card.style.cssText = `
    background: white; border-radius: 1rem;
    max-width: 480px; width: 100%; max-height: 90vh; overflow-y: auto;
    box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25);
    position: relative;
  `.replace(/\s+/g, ' ');

  // Inject styles if not present
  if (!document.getElementById('mm-modal-styles')) {
    const style = document.createElement('style');
    style.id = 'mm-modal-styles';
    style.textContent = `
      @keyframes mm-fadein { from { opacity: 0 } to { opacity: 1 } }
      .mm-modal-enter { animation: mm-fadein 0.15s ease }
    `;
    document.head.appendChild(style);
  }

  if (opts.overlayClose !== false) {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) { closeModal(id); opts.onClose?.(); }
    });
  }

  card.innerHTML = `
    ${opts.title ? `<div style="padding:1.25rem 1.5rem 0;border-bottom:1px solid #e5e7eb;display:flex;align-items:center;justify-content:space-between;">
      <h3 style="font-weight:700;font-size:1.125rem;color:#111827;margin:0;">${opts.title}</h3>
      ${opts.showClose !== false ? `<button id="${id}-close" aria-label="Tutup" style="background:none;border:none;cursor:pointer;font-size:1.5rem;line-height:1;color:#9ca3af;padding:0;width:2rem;height:2rem;display:flex;align-items:center;justify-content:center;border-radius:0.5rem;">&times;</button>` : ''}
    </div>` : ''}
    <div id="${id}-body" style="padding:1.5rem;"></div>
  `;

  document.body.appendChild(overlay);
  overlay.appendChild(card);

  const bodyEl = document.getElementById(`${id}-body`)!;
  // Render Preact JSX into the modal body using a temporary render approach
  renderJsxIntoElement(bodyEl, content);

  const cleanup = _trapFocus(card);

  const closeBtn = document.getElementById(`${id}-close`);
  if (closeBtn) closeBtn.addEventListener('click', () => { closeModal(id); opts.onClose?.(); });

  // Store cleanup on element
  (card as HTMLElement & { _cleanup?: () => void })._cleanup = () => {
    cleanup();
    closeBtn?.removeEventListener('click', () => {});
  };

  return id;
}

export function closeModal(id: string): void {
  const card = document.getElementById(id);
  if (!card) return;
  (card as HTMLElement & { _cleanup?: () => void })._cleanup?.();
  const overlay = document.getElementById('mm-modal-overlay');
  overlay?.remove();
}

export function closeAllModals(): void {
  const overlay = document.getElementById('mm-modal-overlay');
  overlay?.remove();
}

/** Render JSX element into a DOM element (Preact render) */
function renderJsxIntoElement(el: HTMLElement, content: JSX.Element): void {
  // Dynamic import to avoid circular issues
  import('preact').then(({ render }) => {
    render(content, el);
  });
}
