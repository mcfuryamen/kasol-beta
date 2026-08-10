/**
 * Admin Console — Navigation Module
 * Sidebar screen switching (permanent desktop / drawer mobile), menu toggle, scrim.
 */

import { subscribe } from './app-state.js';

let sidebar, scrim, menuToggle, navLinks;

const TITLES = {
  dashboard: ['Dashboard', 'Ringkasan performa bisnis'],
  catalog:   ['Katalog', 'Produk yang tampil di landing page'],
  license:   ['Lisensi', 'Generate, verifikasi & kelola referral'],
  klien:     ['Klien', 'Merchant aktif & generate lisensi'],
  leads:     ['Leads', 'Calon pelanggan dari landing page'],
  settings:  ['Pengaturan', 'Info usaha, landing & backup']
};

export function initNavigation() {
  sidebar = document.querySelector('.sidebar');
  scrim = document.getElementById('sidebarOverlay');
  menuToggle = document.querySelector('.menu-toggle');
  navLinks = document.querySelectorAll('.nav-link');

  navLinks.forEach(link => link.addEventListener('click', () => switchScreen(link.dataset.screen)));
  menuToggle?.addEventListener('click', toggleSidebar);
  scrim?.addEventListener('click', closeSidebar);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeSidebar(); });

  subscribe('isLoading', loading => {
    const s = document.getElementById('syncStatus');
    if (s) s.textContent = loading ? 'Memuat…' : 'Tersinkron';
  });

  window.addEventListener('app:ready', () => updateActiveScreen('dashboard'));
}

export function switchScreen(screen) {
  document.querySelectorAll('.nav-link').forEach(l => {
    const on = l.dataset.screen === screen;
    l.classList.toggle('active', on);
    if (on) l.setAttribute('aria-current', 'page'); else l.removeAttribute('aria-current');
  });
  document.querySelectorAll('.screen').forEach(s => s.classList.toggle('active', s.id === `screen-${screen}`));
  closeSidebar();
  window.location.hash = screen;
  const [t, sub] = TITLES[screen] || [screen, ''];
  const pt = document.getElementById('pageTitle'); if (pt) pt.textContent = t;
  const ps = document.getElementById('pageSubtitle'); if (ps) ps.textContent = sub;
  window.dispatchEvent(new CustomEvent('screen:change', { detail: { screen } }));
  window.scrollTo({ top: 0 });
}

export function updateActiveScreen(screen) {
  document.querySelectorAll('.nav-link').forEach(l => l.classList.toggle('active', l.dataset.screen === screen));
  document.querySelectorAll('.screen').forEach(s => s.classList.toggle('active', s.id === `screen-${screen}`));
  const [t, sub] = TITLES[screen] || [screen, ''];
  const pt = document.getElementById('pageTitle'); if (pt) pt.textContent = t;
  const ps = document.getElementById('pageSubtitle'); if (ps) ps.textContent = sub;
}

function toggleSidebar() {
  if (!sidebar) return;
  const open = sidebar.classList.toggle('open');
  scrim?.classList.toggle('show', open);
  menuToggle?.setAttribute('aria-expanded', open);
}
function closeSidebar() {
  sidebar?.classList.remove('open');
  scrim?.classList.remove('show');
  menuToggle?.setAttribute('aria-expanded', 'false');
}

export function getCurrentScreen() {
  const a = document.querySelector('.nav-link.active');
  return a?.dataset.screen || 'dashboard';
}

window.showScreen = switchScreen;
