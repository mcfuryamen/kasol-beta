/**
 * Atom: Input
 * Standardized input field
 */
export function Input({ id, name, type = 'text', placeholder = '', value = '', required = false, readonly = false, class: cls, oninput, onchange }) {
  const attrs = {
    id, name, type, placeholder, value, required,
    class: 'input' + (cls ? ' ' + cls : ''),
    autocomplete: 'off'
  };
  if (readonly) attrs.readonly = true;
  if (oninput) attrs.oninput = oninput;
  if (onchange) attrs.onchange = onchange;
  return el('input', attrs);
}

export function Textarea({ id, name, placeholder = '', value = '', rows = 3, required = false, class: cls, oninput }) {
  const attrs = {
    id, name, placeholder, rows, required,
    class: 'input' + (cls ? ' ' + cls : ''),
    autocomplete: 'off'
  };
  if (oninput) attrs.oninput = oninput;
  return el('textarea', attrs, value || '');
}

export function InputGroup({ label, id, children }) {
  const wrapper = el('div', { class: 'input-group' });
  if (label) {
    const lbl = el('label', { for: id, class: 'input-label' });
    lbl.textContent = label;
    wrapper.appendChild(lbl);
  }
  if (children) wrapper.appendChild(typeof children === 'string' ? document.createTextNode(children) : children);
  return wrapper;
}
