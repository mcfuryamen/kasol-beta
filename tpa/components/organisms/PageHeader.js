/**
 * Organism: PageHeader
 * Judul halaman + breadcrumb + actions
 */
import { el } from '../../db/init.js';

export function PageHeader({ title, subtitle = '', breadcrumb = [], actions = null }) {
  const hdr = el('div', { class: 'page-header flex items-center justify-between mb-4' });
  const left = el('div');

  if (breadcrumb.length > 0) {
    const bc = el('nav', { class: 'breadcrumb text-xs text-gray-400 mb-1' });
    bc.innerHTML = breadcrumb.map((b, i) => {
      const sep = i < breadcrumb.length - 1 ? ' <span class="mx-1">/</span> ' : '';
      return (b.href ? '<a href="' + b.href + '" class="hover:underline">' + b.label + '</a>' : b.label) + sep;
    }).join('');
    left.appendChild(bc);
  }

  const ttl = el('h2', { class: 'page-title text-xl font-bold text-gray-800' });
  ttl.textContent = title;
  left.appendChild(ttl);

  if (subtitle) {
    const sub = el('p', { class: 'page-subtitle text-sm text-gray-500 mt-0.5' });
    sub.textContent = subtitle;
    left.appendChild(sub);
  }

  hdr.appendChild(left);
  if (actions) {
    const right = el('div', { class: 'flex gap-2' });
    if (typeof actions === 'string') right.innerHTML = actions;
    else if (Array.isArray(actions)) actions.forEach(a => { if (a) right.appendChild(typeof a === 'string' ? document.createTextNode(a) : a); });
    else right.appendChild(actions);
    hdr.appendChild(right);
  }
  return hdr;
}
