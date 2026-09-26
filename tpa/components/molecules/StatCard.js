/**
 * Molecule: StatCard
 * Card statistik dengan ikon dan warna
 */
import { el } from '../../db/init.js';

export function StatCard({ title, value, icon, color = 'blue', subtitle = '' }) {
  const colorMap = {
    blue: 'bg-blue-50 text-blue-600 border-blue-100',
    green: 'bg-green-50 text-green-600 border-green-100',
    red: 'bg-red-50 text-red-600 border-red-100',
    yellow: 'bg-yellow-50 text-yellow-600 border-yellow-100',
    purple: 'bg-purple-50 text-purple-600 border-purple-100',
    gray: 'bg-gray-50 text-gray-600 border-gray-100'
  };
  const c = colorMap[color] || colorMap.blue;
  const card = el('div', { class: 'stat-card card border ' + c });
  const inner = el('div', { class: 'flex items-center gap-3' });
  const iconWrap = el('div', {
    class: 'w-12 h-12 rounded-full flex items-center justify-center text-2xl',
    html: icon || '&#128200;'
  });
  inner.appendChild(iconWrap);
  const texts = el('div');
  const val = el('div', { class: 'text-2xl font-bold' });
  val.textContent = value;
  const ttl = el('div', { class: 'text-xs opacity-80 capitalize' });
  ttl.textContent = title;
  texts.appendChild(val);
  texts.appendChild(ttl);
  if (subtitle) {
    const sub = el('div', { class: 'text-xs opacity-60 mt-1' });
    sub.textContent = subtitle;
    texts.appendChild(sub);
  }
  inner.appendChild(texts);
  card.appendChild(inner);
  return card;
}

export function StatCardGrid({ stats = [] }) {
  const grid = el('div', { class: 'grid grid-cols-2 md:grid-cols-4 gap-3' });
  stats.forEach(s => grid.appendChild(StatCard(s)));
  return grid;
}
