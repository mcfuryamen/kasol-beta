/**
 * Atom: Card
 * Container card
 */
export function Card({ id, class: cls, children, onclick }) {
  const attrs = { id, class: 'card' + (cls ? ' ' + cls : '') };
  if (onclick) attrs.onclick = onclick;
  const card = el('div', attrs);
  if (typeof children === 'string') card.innerHTML = children;
  else if (Array.isArray(children)) children.forEach(c => { if (c) card.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
  else if (children) card.appendChild(children);
  return card;
}

export function CardHeader({ title, class: cls, actions }) {
  const hdr = el('div', { class: 'card-header' + (cls ? ' ' + cls : '') });
  const t = el('h3', { class: 'card-title' });
  t.textContent = title;
  hdr.appendChild(t);
  if (actions) {
    if (typeof actions === 'string') hdr.innerHTML += actions;
    else if (Array.isArray(actions)) actions.forEach(a => { if (a) hdr.appendChild(a); });
    else hdr.appendChild(actions);
  }
  return hdr;
}

export function CardBody({ children, class: cls }) {
  const body = el('div', { class: 'card-body' + (cls ? ' ' + cls : '') });
  if (typeof children === 'string') body.innerHTML = children;
  else if (Array.isArray(children)) children.forEach(c => { if (c) body.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
  else if (children) body.appendChild(children);
  return body;
}

export function CardFooter({ children, class: cls }) {
  const ftr = el('div', { class: 'card-footer' + (cls ? ' ' + cls : '') });
  if (typeof children === 'string') ftr.innerHTML = children;
  else if (Array.isArray(children)) children.forEach(c => { if (c) ftr.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
  else if (children) ftr.appendChild(children);
  return ftr;
}
