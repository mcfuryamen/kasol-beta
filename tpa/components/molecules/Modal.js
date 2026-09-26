/**
 * Molecule: Modal / BottomSheet
 * Using the existing bottom-sheet pattern from the original HTML
 */
import { el, $id, openSheet, closeSheet } from '../../db/init.js';

export { openSheet, closeSheet };

export function Modal({ title, body, footer, onClose }) {
  const titleEl = $id('bs-title');
  const bodyEl = $id('bs-body');
  const footEl = $id('bs-foot');
  if (titleEl) titleEl.textContent = title;
  if (bodyEl) {
    bodyEl.innerHTML = '';
    if (typeof body === 'string') bodyEl.innerHTML = body;
    else if (body) bodyEl.appendChild(body);
  }
  if (footEl) {
    footEl.innerHTML = '';
    if (footer) {
      if (typeof footer === 'string') footEl.innerHTML = footer;
      else if (footer) footEl.appendChild(footer);
      footEl.classList.remove('hidden');
    } else {
      footEl.classList.add('hidden');
    }
  }
  const overlay = $id('bs-ov');
  const sheet = $id('bs');
  if (overlay) overlay.classList.add('show');
  if (sheet) sheet.classList.add('show');
  return sheet;
}

export function ModalForm({ title, fields = [], onSubmit, onCancel, submitText = 'Simpan' }) {
  // fields: [{id, name, label, type, required, options?, placeholder?}]
  const form = el('form', { id: 'mol-form', class: 'flex flex-col gap-3' });
  fields.forEach(f => {
    const grp = el('div', { class: 'input-group' });
    const lbl = el('label', { for: f.id, class: 'input-label' });
    lbl.textContent = (f.label || f.name) + (f.required ? ' *' : '');
    grp.appendChild(lbl);

    if (f.type === 'select') {
      const sel = el('select', { id: f.id, name: f.name, required: f.required || false, class: 'input' });
      if (f.placeholder) {
        const opt = el('option', { value: '' }); opt.textContent = f.placeholder; sel.appendChild(opt);
      }
      (f.options || []).forEach(o => {
        const opt = el('option', { value: o.value !== undefined ? o.value : o.id });
        opt.textContent = o.label || o.name;
        sel.appendChild(opt);
      });
      grp.appendChild(sel);
    } else if (f.type === 'textarea') {
      const ta = el('textarea', { id: f.id, name: f.name, required: f.required || false, placeholder: f.placeholder || '', rows: f.rows || 3, class: 'input' });
      grp.appendChild(ta);
    } else if (f.type === 'checkbox') {
      const cb = el('input', { id: f.id, name: f.name, type: 'checkbox', class: 'input-checkbox' });
      const cblbl = el('label', { for: f.id, class: 'inline-flex items-center gap-2 cursor-pointer' });
      cblbl.appendChild(cb);
      cblbl.appendChild(document.createTextNode(' ' + (f.label || f.name)));
      grp.innerHTML = '';
      grp.appendChild(cblbl);
    } else {
      const inp = el('input', { id: f.id, name: f.name, type: f.type || 'text', required: f.required || false, placeholder: f.placeholder || '', value: f.value || '', class: 'input' });
      grp.appendChild(inp);
    }
    form.appendChild(grp);
  });

  const btnRow = el('div', { class: 'flex gap-2 justify-end mt-2' });
  const cancelBtn = el('button', { type: 'button', class: 'btn btn-secondary', onclick: () => { closeSheet(); if (onCancel) onCancel(); } });
  cancelBtn.textContent = 'Batal';
  const submitBtn = el('button', { type: 'submit', class: 'btn btn-primary' });
  submitBtn.textContent = submitText;
  btnRow.appendChild(cancelBtn);
  btnRow.appendChild(submitBtn);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const data = Object.fromEntries(fd.entries());
    if (onSubmit) await onSubmit(data);
  });

  return { body: form, footer: btnRow };
}
