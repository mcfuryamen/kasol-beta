/**
 * Organism: Navbar (Landing Page)
 * Navigasi untuk halaman landing publik
 */
import { el } from '../../db/init.js';
import { Avatar } from '../atoms/Avatar.js';
import { getCurrentUser } from '../../services/auth.js';

export function Navbar({ transparent = false }) {
  const user = getCurrentUser();
  const nav = el('nav', { class: 'landing-nav' + (transparent ? ' transparent' : '') });

  const inner = el('div', { class: 'nav-inner' });
  const brand = el('a', { href: 'index.html', class: 'nav-brand' });
  brand.innerHTML = '&#127774; <span>TPA Al-Hikmah</span>';
  inner.appendChild(brand);

  const links = el('div', { class: 'nav-links' });
  const menuItems = [
    { label: 'Masuk', href: 'index.html' },
    { label: 'Daftar', href: 'index.html#register' }
  ];
  menuItems.forEach(item => {
    const a = el('a', { href: item.href, class: 'nav-link' });
    a.textContent = item.label;
    links.appendChild(a);
  });
  inner.appendChild(links);

  const auth = el('div', { class: 'nav-auth flex items-center gap-2' });
  if (user) {
    auth.appendChild(Avatar({ name: user.name, size: 'sm' }));
    const roleLabel = el('span', { class: 'text-sm text-gray-600 capitalize' });
    roleLabel.textContent = user.role;
    auth.appendChild(roleLabel);
    const dashLink = el('a', { href: user.role === 'admin' ? 'admin.html' : user.role === 'ustadz' ? 'guru.html' : 'wali.html', class: 'btn btn-primary btn-sm' });
    dashLink.textContent = 'Dashboard';
    auth.appendChild(dashLink);
  } else {
    const loginBtn = el('a', { href: 'index.html', class: 'btn btn-ghost btn-sm' });
    loginBtn.textContent = 'Masuk';
    auth.appendChild(loginBtn);
    const registerBtn = el('a', { href: 'index.html#register', class: 'btn btn-primary btn-sm' });
    registerBtn.textContent = 'Daftar';
    auth.appendChild(registerBtn);
  }
  inner.appendChild(auth);

  nav.appendChild(inner);
  return nav;
}
