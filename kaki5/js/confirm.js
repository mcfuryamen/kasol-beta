// ==================== CONFIRM DIALOG (ESM) ====================
let confirmCallback = null;

export function showConfirm(icon, text, btnText, callback) {
  document.getElementById('confirmIcon').textContent = icon;
  document.getElementById('confirmText').textContent = text;
  document.getElementById('confirmYes').textContent = btnText;
  confirmCallback = callback;
  document.getElementById('confirmYes').onclick = () => {
    closeConfirm();
    if (confirmCallback) confirmCallback();
  };
  document.getElementById('confirmDialog').classList.add('show');
}

export function closeConfirm() {
  document.getElementById('confirmDialog').classList.remove('show');
}
