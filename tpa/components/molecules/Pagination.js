/**
 * Molecule: Pagination
 */
import { el } from '../../db/init.js';

export function Pagination({ page = 1, totalPages = 1, onPageChange }) {
  if (totalPages <= 1) return el('div');

  const wrap = el('div', { class: 'pagination' });
  const btn = (label, p, disabled = false) => {
    const b = el('button', {
      class: 'btn btn-secondary btn-sm' + (p === page ? ' active' : ''),
      disabled,
      onclick: () => { if (!disabled && onPageChange) onPageChange(p); }
    });
    b.textContent = label;
    return b;
  };

  wrap.appendChild(btn('&laquo;', 1, page <= 1));
  wrap.appendChild(btn('&lsaquo;', page - 1, page <= 1));

  // Page numbers
  const range = [];
  for (let i = 1; i <= totalPages; i++) range.push(i);
  range.forEach(p => {
    wrap.appendChild(btn(String(p), p, false));
  });

  wrap.appendChild(btn('&rsaquo;', page + 1, page >= totalPages));
  wrap.appendChild(btn('&raquo;', totalPages, page >= totalPages));

  return wrap;
}

export function PaginationControls({ page, perPage, total, onPageChange, onPerPageChange }) {
  const totalPages = Math.ceil(total / perPage);
  const wrap = el('div', { class: 'flex items-center justify-between px-2 py-2' });
  const info = el('span', { class: 'text-xs text-gray-500' });
  info.textContent = `Menampilkan ${(page - 1) * perPage + 1}–${Math.min(page * perPage, total)} dari ${total}`;
  wrap.appendChild(info);
  const right = el('div', { class: 'flex gap-2 items-center' });
  if (onPerPageChange) {
    const sel = el('select', {
      class: 'input input-sm w-auto',
      onchange: (e) => onPerPageChange(Number(e.target.value))
    });
    [10, 25, 50, 100].forEach(n => {
      const o = el('option', { value: n }); o.textContent = n + '/hal'; if (n === perPage) o.selected = true; sel.appendChild(o);
    });
    right.appendChild(sel);
  }
  right.appendChild(Pagination({ page, totalPages, onPageChange }));
  wrap.appendChild(right);
  return wrap;
}
