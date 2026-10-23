/**
 * Atom: Select
 * Standardized dropdown select
 */
export function Select({ id, name, options = [], value = '', placeholder = '-- Pilih --', required = false, class: cls, onchange }) {
  // options: [{value, label}] or [{id, name}] or simple array
  const attrs = {
    id, name, required,
    class: 'input' + (cls ? ' ' + cls : ''),
    onchange
  };
  const sel = el('select', attrs);

  if (placeholder) {
    const opt = el('option', { value: '' });
    opt.textContent = placeholder;
    sel.appendChild(opt);
  }

  options.forEach(opt => {
    const o = el('option', { value: opt.value !== undefined ? opt.value : opt.id });
    o.textContent = opt.label || opt.name;
    if (String(value) === String(o.value)) o.selected = true;
    sel.appendChild(o);
  });

  return sel;
}

export function SelectGroup({ label, id, children }) {
  const wrapper = el('div', { class: 'input-group' });
  if (label) {
    const lbl = el('label', { for: id, class: 'input-label' });
    lbl.textContent = label;
    wrapper.appendChild(lbl);
  }
  if (children) wrapper.appendChild(typeof children === 'string' ? document.createTextNode(children) : children);
  return wrapper;
}
