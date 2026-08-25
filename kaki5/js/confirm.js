// ==================== CONFIRM DIALOG (ESM) ====================
// Uses centralized app-state for confirm callback
import { confirmCallback, setConfirmCallback, confirmState, setConfirmState } from './app-state.js';
import { openModal, closeModal } from './modal.js';

let _confirmYesHandler = null;

export async function showConfirm(icon, text, btnText, callback) {
  setConfirmCallback(callback);
  setConfirmState({ open: true, icon, text, btnText });
  
  document.getElementById('confirmIcon').textContent = icon;
  document.getElementById('confirmText').textContent = text;
  document.getElementById('confirmYes').textContent = btnText;
  
  // Remove previous handler if any
  if (_confirmYesHandler) {
    document.getElementById('confirmYes').removeEventListener('click', _confirmYesHandler);
  }
  _confirmYesHandler = () => {
    closeConfirm();
    if (confirmCallback) confirmCallback();
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