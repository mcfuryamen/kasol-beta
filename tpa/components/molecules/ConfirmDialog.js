/**
 * Molecule: ConfirmDialog
 */
import { el, $id, closeSheet } from '../../db/init.js';

export function confirm(message, onOk, onCancel) {
  const title = 'Konfirmasi';
  const body = el('div', { class: 'flex flex-col gap-3' });
  const iconWrap = el('div', {
    class: 'flex justify-center mb-2',
    html: '<span style="font-size:48px;line-height:1">&#128275;</span>'
  });
  body.appendChild(iconWrap);
  const msg = el('p', { class: 'text-center text-gray-700' });
  msg.textContent = message;
  body.appendChild(msg);

  const btnRow = el('div', { class: 'flex gap-2 justify-center mt-2' });
  const cancelBtn = el('button', {
    type: 'button', class: 'btn btn-secondary px-6',
    onclick: () => { closeSheet(); if (onCancel) onCancel(); }
  });
  cancelBtn.textContent = 'Batal';
  const okBtn = el('button', {
    type: 'button', class: 'btn btn-danger px-6',
    onclick: () => { closeSheet(); if (onOk) onOk(); }
  });
  okBtn.textContent = 'Ya, Hapus';

  btnRow.appendChild(cancelBtn);
  btnRow.appendChild(okBtn);

  const titleEl = $id('bs-title');
  const bodyEl = $id('bs-body');
  const footEl = $id('bs-foot');
  if (titleEl) titleEl.textContent = title;
  if (bodyEl) { bodyEl.innerHTML = ''; bodyEl.appendChild(body); }
  if (footEl) { footEl.innerHTML = ''; footEl.classList.add('hidden'); }
  const overlay = $id('bs-ov');
  const sheet = $id('bs');
  if (overlay) overlay.classList.add('show');
  if (sheet) sheet.classList.add('show');
}
