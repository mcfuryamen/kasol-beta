/**
 * Organism: Header
 * Top navigation header untuk admin & guru
 */
import { el } from '../../db/init.js';
import { Avatar } from '../atoms/Avatar.js';
import { getCurrentUser } from '../../services/auth.js';

export function Header({ title = '', subtitle = '' }) {
  const user = getCurrentUser();
  const hdr = el('header', { class: 'app-header' });
  const inner = el('div', { class: 'header-inner' });

  // Left: hamburger + title
  const left = el('div', { class: 'header-left flex items-center gap-3' });
  const menuBtn = el('button', {
    id: 'menu-toggle',
    class: 'btn btn-ghost text-xl',
    onclick: () => {
      const sidebar = document.getElementById('sidebar');
      if (sidebar) sidebar.classList.toggle('open');
    }
  });
  menuBtn.innerHTML = '&#9776;';
  left.appendChild(menuBtn);

  const titleWrap = el('div');
  const ttl = el('h1', { class: 'header-title' });
  ttl.textContent = title || 'TPA Admin';
  const sub = el('span', { class: 'header-subtitle' });
  sub.textContent = subtitle || '';
  titleWrap.appendChild(ttl);
  if (subtitle) titleWrap.appendChild(sub);
  left.appendChild(titleWrap);
  inner.appendChild(left);

  // Right: notifications + user
  const right = el('div', { class: 'header-right flex items-center gap-3' });
  const notifBtn = el('button', {
    id: 'notif-btn',
    class: 'btn btn-ghost text-xl',
    title: 'Notifikasi',
    onclick: () => window.location.href = 'notifications.html'
  });
  notifBtn.innerHTML = '&#128276;';
  right.appendChild(notifBtn);

  const userWrap = el('div', { class: 'flex items-center gap-2 cursor-pointer', onclick: () => window.location.href = 'profile.html' });
  userWrap.appendChild(Avatar({ name: user ? user.name : 'User', size: 'sm' }));
  const userInfo = el('div', { class: 'flex flex-col' });
  const userName = el('span', { class: 'text-sm font-semibold' });
  userName.textContent = user ? user.name : 'User';
  const userRole = el('span', { class: 'text-xs text-gray-500 capitalize' });
  userRole.textContent = user ? user.role : '';
  userInfo.appendChild(userName);
  userInfo.appendChild(userRole);
  userWrap.appendChild(userInfo);
  right.appendChild(userWrap);

  inner.appendChild(right);
  hdr.appendChild(inner);
  return hdr;
}
