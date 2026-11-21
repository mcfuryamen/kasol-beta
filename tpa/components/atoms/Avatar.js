/**
 * Atom: Avatar
 * Inisial nama + warna random
 */
import { el } from '../../db/init.js';

export function Avatar({ name, size = 'md', class: cls }) {
  const colors = [
    'bg-blue-500', 'bg-green-500', 'bg-purple-500',
    'bg-orange-500', 'bg-pink-500', 'bg-teal-500'
  ];
  const idx = (name || '?').charCodeAt(0) % colors.length;
  const bg = colors[idx];
  const initials = (name || '?').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
  const sizeMap = { sm: 'w-8 h-8 text-xs', md: 'w-10 h-10 text-sm', lg: 'w-14 h-14 text-lg' };
  return el('div', {
    class: 'avatar ' + (sizeMap[size] || sizeMap.md) + ' ' + bg + ' text-white rounded-full flex items-center justify-center font-bold' + (cls ? ' ' + cls : '')
  }, initials);
}

export function AvatarGroup({ names = [], size = 'md', max = 4 }) {
  const shown = names.slice(0, max);
  const extra = names.length - max;
  const container = el('div', { class: 'flex -space-x-2' });
  shown.forEach(n => {
    const av = Avatar({ name: n, size });
    container.appendChild(av);
  });
  if (extra > 0) {
    const more = el('div', {
      class: (sizeMap[size] || sizeMap.md) + ' bg-gray-200 text-gray-600 rounded-full flex items-center justify-center text-xs font-bold'
    });
    more.textContent = '+' + extra;
    container.appendChild(more);
  }
  return container;
}
