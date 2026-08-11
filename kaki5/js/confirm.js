// ==================== CONFIRM DIALOG (ESM) ====================
// Uses centralized app-state for confirm callback
import { confirmCallback, setConfirmCallback, confirmState, setConfirmState } from './app-state.js';

export function showConfirm(icon, text, btnText, callback) {
  setConfirmCallback(callback);
  setConfirmState({ open: true, icon, text, btnText });
  
  document.getElementById('confirmIcon').textContent = icon;
  document.getElementById('confirmText').textContent = text;
  document.getElementById('confirmYes').textContent = btnText;
  document.getElementById('confirmYes').onclick = () => {
    closeConfirm();
    if (confirmCallback) confirmCallback();
  };
  document.getElementById('confirmDialog').classList.add('show');
}

export function closeConfirm() {
  setConfirmCallback(null);
  setConfirmState({ open: false, icon: '', text: '', btnText: '' });
  document.getElementById('confirmDialog').classList.remove('show');
}
