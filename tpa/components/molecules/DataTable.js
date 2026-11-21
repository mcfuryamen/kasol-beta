/**
 * Molecule: DataTable
 * Tabel data generik dengan sort, search, pagination
 */
import { el } from '../../db/init.js';
import { Spinner } from '../atoms/Spinner.js';

export function DataTable({
  columns = [],   // [{key, label, render?, width?}]
  data = [],
  loading = false,
  onRowClick,
  emptyMessage = 'Tidak ada data',
  keyField = 'id'
}) {
  const wrap = el('div', { class: 'table-wrapper' });
  const searchBar = el('input', {
    type: 'text',
    class: 'input mb-3',
    placeholder: 'Cari...',
    oninput: (e) => wrap.dataset.search = e.target.value
  });
  wrap.appendChild(searchBar);

  if (loading) {
    wrap.appendChild(Spinner({ size: 'lg' }));
    return wrap;
  }

  if (!data.length) {
    wrap.appendChild(el('p', { class: 'text-gray-400 text-center py-8', text: emptyMessage }));
    return wrap;
  }

  const tbl = el('table', { class: 'data-table' });
  const thead = el('thead');
  const hdrRow = el('tr');
  columns.forEach(col => {
    const th = el('th', { style: col.width ? 'width:' + col.width : '' });
    th.textContent = col.label;
    hdrRow.appendChild(th);
  });
  thead.appendChild(hdrRow);

  const tbody = el('tbody');
  const search = (wrap.dataset.search || '').toLowerCase();
  const filtered = data.filter(row => {
    if (!search) return true;
    return columns.some(col => {
      const val = row[col.key];
      return String(val || '').toLowerCase().includes(search);
    });
  });

  filtered.forEach(row => {
    const tr = el('tr');
    if (onRowClick) tr.style.cursor = 'pointer';
    columns.forEach(col => {
      const td = el('td');
      if (col.render) {
        td.innerHTML = col.render(row[col.key], row) || '';
      } else {
        td.textContent = row[col.key] ?? '-';
      }
      tr.appendChild(td);
    });
    if (onRowClick) {
      tr.addEventListener('click', () => onRowClick(row));
    }
    tbody.appendChild(tr);
  });

  wrap.appendChild(el('style', {}, `
    .table-wrapper { width: 100%; }
    .data-table { width: 100%; border-collapse: collapse; }
    .data-table th { background: #f3f4f6; padding: 8px 12px; text-align: left; font-weight: 600; font-size: 13px; color: #374151; }
    .data-table td { padding: 10px 12px; border-bottom: 1px solid #e5e7eb; font-size: 14px; }
    .data-table tr:hover td { background: #f9fafb; }
    .table-wrapper input { width: 100%; max-width: 300px; }
  `));

  tbl.appendChild(thead);
  tbl.appendChild(tbody);
  wrap.appendChild(tbl);
  return wrap;
}

export function SimpleTable({ columns = [], data = [], keyField = 'id' }) {
  const tbl = el('table', { class: 'simple-table' });
  const thead = el('thead');
  const hdrRow = el('tr');
  columns.forEach(col => {
    const th = el('th');
    th.textContent = col.label;
    thead.appendChild(th);
  });
  thead.appendChild(hdrRow);
  tbl.appendChild(thead);

  const tbody = el('tbody');
  data.forEach(row => {
    const tr = el('tr');
    columns.forEach(col => {
      const td = el('td');
      td.textContent = row[col.key] ?? '-';
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
  tbl.appendChild(tbody);
  return tbl;
}
