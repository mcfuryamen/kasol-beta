/**
 * Admin Marketing KASIRSOLO — Navigation Module
 * Sidebar tab switching, mobile toggle (rosok-style)
 */

import { subscribe } from './app-state.js';

let sidebar = null;
let sidebarOverlay = null;
let navItems = null;
let hamburger = null;

/**
 * Initialize navigation
 */
export function initNavigation() {
  sidebar = document.querySelector('.sidebar');
  sidebarOverlay = document.getElementById('sidebarOverlay');
  navItems = document.querySelectorAll('.nav-item, .sb-link');

  // Hamburger is already in HTML (topbar-right)
  hamburger = document.querySelector('.hamburger');

  // Nav item clicks (both sidebar and bottom nav)
  navItems.forEach(item => {
    item.addEventListener('click', () => switchScreen(item.dataset.screen));
  });

  // Hamburger click
  hamburger?.addEventListener('click', toggleSidebar);

  // Overlay click closes sidebar
  sidebarOverlay?.addEventListener('click', closeSidebar);

  // Escape key closes sidebar
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeSidebar();
  });

  // Subscribe to loading state for sync status
  subscribe('isLoading', (loading) => {
    const syncStatus = document.getElementById('syncStatus');
    if (syncStatus) {
      syncStatus.textContent = loading ? 'Memuat data…' : `Tersinkron • ${new Date().toLocaleTimeString('id-ID')}`;
    }
  });

  // Listen for app:ready event
  window.addEventListener('app:ready', () => {
    updateActiveScreen('dashboard');
  });
}

/**
 * Switch active screen
 * @param {string} screen - Screen name (dashboard, leads, catalog, license, settings)
 */
export function switchScreen(screen) {
  // Update sidebar links
  document.querySelectorAll('.sb-link').forEach(link => {
    link.classList.toggle('active', link.dataset.screen === screen);
  });

  // Update bottom nav
  document.querySelectorAll('.nav-item').forEach(item => {
    item.classList.toggle('active', item.dataset.screen === screen);
  });

  // Update screens
  document.querySelectorAll('.screen').forEach(s => {
    s.classList.toggle('active', s.id === `screen-${screen}`);
  });

  // Close sidebar on mobile
  closeSidebar();

  // Update URL hash
  window.location.hash = screen;

  // Dispatch custom event for modules that need to react
  window.dispatchEvent(new CustomEvent('screen:change', { detail: { screen } }));

  // Scroll to top on mobile
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/**
 * Update active screen without switching (for initialization)
 * @param {string} screen
 */
export function updateActiveScreen(screen) {
  document.querySelectorAll('.sb-link').forEach(link => {
    link.classList.toggle('active', link.dataset.screen === screen);
  });
  document.querySelectorAll('.nav-item').forEach(item => {
    item.classList.toggle('active', item.dataset.screen === screen);
  });
  document.querySelectorAll('.screen').forEach(s => {
    s.classList.toggle('active', s.id === `screen-${screen}`);
  });
}

/**
 * Toggle sidebar on mobile
 */
function toggleSidebar() {
  if (!sidebar) return;
  const isOpen = sidebar.classList.toggle('open');
  sidebarOverlay?.classList.toggle('show', isOpen);
  hamburger?.setAttribute('aria-label', isOpen ? 'Tutup menu' : 'Buka menu');
  hamburger?.setAttribute('aria-expanded', isOpen);
}

/**
 * Close sidebar
 */
function closeSidebar() {
  sidebar?.classList.remove('open');
  sidebarOverlay?.classList.remove('show');
  hamburger?.setAttribute('aria-label', 'Buka menu');
  hamburger?.setAttribute('aria-expanded', 'false');
}

/**
 * Get current active screen
 * @returns {string}
 */
export function getCurrentScreen() {
  const activeLink = document.querySelector('.sb-link.active, .nav-item.active');
  return activeLink?.dataset.screen || 'dashboard';
}

// Global alias for HTML onclick handlers
window.showScreen = switchScreen;