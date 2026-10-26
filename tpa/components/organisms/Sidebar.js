/**
 * Organism: Sidebar
 * Side navigation untuk admin
 */
import { el } from '../../db/init.js';
import { getCurrentUser } from '../../services/auth.js';

const ADMIN_MENU = [
  { icon: '&#127968;', label: 'Dashboard', href: 'admin.html' },
  { icon: '&#128100;', label: 'Santri', href: 'admin.html#santri' },
  { icon: '&#128104;', label: 'Ustadz', href: 'admin.html#ustadz' },
  { icon: '&#128102;', label: 'Wali', href: 'admin.html#wali' },
  { icon: '&#127891;', label: 'Kelas', href: 'admin.html#kelas' },
  { icon: '&#128197;', label: 'Jadwal', href: 'admin.html#jadwal' },
  { icon: '&#9745;', label: 'Absensi', href: 'admin.html#absensi' },
  { icon: '&#128214;', label: 'Hafalan', href: 'admin.html#hafalan' },
  { icon: '&#128176;', label: 'SPP', href: 'admin.html#spp' },
  { icon: '&#128200;', label: 'Kas', href: 'admin.html#kas' },
  { icon: '&#9881;', label: 'Pengaturan', href: 'admin.html#settings' }
];

const TEACHER_MENU = [
  { icon: '&#127968;', label: 'Dashboard', href: 'guru.html' },
  { icon: '&#127891;', label: 'Kelas Saya', href: 'guru.html#kelas' },
  { icon: '&#9745;', label: 'Absensi', href: 'guru.html#absensi' },
  { icon: '&#128214;', label: 'Hafalan', href: 'guru.html#hafalan' },
  { icon: '&#128179;', label: 'SPP', href: 'guru.html#spp' }
];

const WALI_MENU = [
  { icon: '&#127968;', label: 'Dashboard', href: 'wali.html' },
  { icon: '&#128100;', label: 'Anak Saya', href: 'wali.html#anak' },
  { icon: '&#128214;', label: 'Hafalan', href: 'wali.html#hafalan' },
  { icon: '&#128179;', label: 'Pembayaran', href: 'wali.html#pembayaran' }
];

export function Sidebar({ activeHref = '' }) {
  const user = getCurrentUser();
  const role = user ? user.role : 'admin';
  const menuItems = role === 'ustadz' ? TEACHER_MENU : role === 'wali' ? WALI_MENU : ADMIN_MENU;

  const sidebar = el('aside', { id: 'sidebar', class: 'app-sidebar' });
  const loc = el('div', { class: 'sidebar-location' });
  loc.innerHTML = '<span class="text-xs text-gray-400">LOKASI</span><strong class="text-sm">' + (user ? user.locationName : 'TPA') + '</strong>';
  sidebar.appendChild(loc);

  const nav = el('nav', { class: 'sidebar-nav' });
  menuItems.forEach(item => {
    const isActive = activeHref === item.href || window.location.href.includes(item.href.split('#')[0]);
    const a = el('a', {
      href: item.href,
      class: 'sidebar-link' + (isActive ? ' active' : '')
    });
    a.innerHTML = '<span class="sidebar-icon">' + item.icon + '</span><span>' + item.label + '</span>';
    nav.appendChild(a);
  });
  sidebar.appendChild(nav);

  const footer = el('div', { class: 'sidebar-footer' });
  footer.innerHTML = '<button onclick="logout()" class="sidebar-link text-red-500"><span class="sidebar-icon">&#128682;</span><span>Keluar</span></button>';
  sidebar.appendChild(footer);

  return sidebar;
}

export function initSidebar() {
  // Toggle sidebar on mobile
  const menuToggle = document.getElementById('menu-toggle');
  if (menuToggle) {
    menuToggle.addEventListener('click', () => {
      const sidebar = document.getElementById('sidebar');
      if (sidebar) sidebar.classList.toggle('open');
    });
  }
  // Close sidebar when clicking outside
  document.addEventListener('click', (e) => {
    const sidebar = document.getElementById('sidebar');
    if (sidebar && sidebar.classList.contains('open')) {
      if (!sidebar.contains(e.target) && !document.getElementById('menu-toggle')?.contains(e.target)) {
        sidebar.classList.remove('open');
      }
    }
  });
}
