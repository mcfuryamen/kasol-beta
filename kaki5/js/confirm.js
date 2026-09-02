// ==================== CONFIRM DIALOG (ESM) ====================
// Uses centralized app-state for confirm callback
import { confirmCallback, setConfirmCallback, confirmState, setConfirmState } from './app-state.js';
import { openModal, closeModal } from './modal.js';

let _confirmYesHandler = null;

export async function showConfirm(icon, text, btnText, callback, cancelText) {
  setConfirmCallback(callback);
  setConfirmState({ open: true, icon, text, btnText });
  
  document.getElementById('confirmIcon').textContent = icon;
  document.getElementById('confirmText').textContent = text;
  document.getElementById('confirmYes').textContent = btnText;
  // v157 komentar #3: label tombol batal bisa diganti per-dialog (default "Batal").
  document.getElementById('confirmNo').textContent = cancelText || 'Batal';
  
  // Remove previous handler if any
  if (_confirmYesHandler) {
    document.getElementById('confirmYes').removeEventListener('click', _confirmYesHandler);
  }
  _confirmYesHandler = () => {
    // Simpan callback dulu: closeConfirm() me-null-kan confirmCallback
    // (live binding ESM dari app-state), jadi baca sebelum ditimpa —
    // kalau tidak, tombol "Ya" tidak pernah mengeksekusi aksinya
    // (bug: hapus menu/transaksi terlihat mati, audit 2026-08-25).
    const cb = confirmCallback;
    closeConfirm();
    if (cb) cb();
  };
  document.getElementById('confirmYes').addEventListener('click', _confirmYesHandler);
  
  await openModal('confirmDialog', { modalSelector: '.confirm-box' });
}

export function closeConfirm() {
  setConfirmCallback(null);
  setConfirmState({ open: false, icon: '', text: '', btnText: '' });
  if (_confirmYesHandler) {
    document.getElementById('confirmYes').removeEventListener('click', _confirmYesHandler);
    _confirmYesHandler = null;
  }
  closeModal('confirmDialog');
}