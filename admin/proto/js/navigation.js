/**
 * Admin Marketing KASIRSOLO — Navigation Module
 * Handles screen switching, sidebar, bottom nav, and URL routing
 */

import { getState, setState, subscribe } from './app-state.js';

const SCREENS = ['dashboard', 'catalog', 'license', 'klien', 'leads', 'settings'];

export function initNavigation() {
  // Sidebar toggle
  window.toggleSidebar = toggleSidebar;
  window.closeSidebar = closeSidebar;
  window.showScreen = showScreen;
  window.closeSheet = closeSheet;

  // Bottom nav & sidebar links
  document.querySelectorAll('[data-screen]').forEach(el => {
    el.addEventListener('click', () => showScreen(el.dataset.screen));
  });

  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeAllModals();
    }
    // Ctrl+1..6 for screens
    if (e.ctrlKey && e.key >= '1' && e.key <= '6') {
      const idx = parseInt(e.key) - 1;
      if (SCREENS[idx]) showScreen(SCREENS[idx]);
    }
  });

  // Handle hash routing
  window.addEventListener('hashchange', () => {
    const screen = location.hash.slice(1);
    if (SCREENS.includes(screen)) showScreen(screen);
  });

  // Initial screen from hash
  if (location.hash) {
    const screen = location.hash.slice(1);
    if (SCREENS.includes(screen)) showScreen(screen);
  }
}

function showScreen(screenName) {
  if (!SCREENS.includes(screenName)) return;

  // Update main content
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const screenEl = document.getElementById(`screen-${screenName}`);
  if (screenEl) screenEl.classList.add('active');

  // Update sidebar
  document.querySelectorAll('.sb-link').forEach(l => l.classList.toggle('active', l.dataset.screen === screenName));

  // Update bottom nav
  document.querySelectorAll('.nav-item').forEach(n => n.classList.toggle('active', n.dataset.screen === screenName));

  // Update URL hash (without scroll)
  history.replaceState(null, '', `#${screenName}`);

  // Close sidebar on mobile
  closeSidebar();

  // Update state
  setState('currentScreen', screenName);

  // Emit event for screen-specific initialization
  window.dispatchEvent(new CustomEvent('screen:change', { detail: { screen: screenName } }));
}

function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebarOverlay');
  const hamburger = document.querySelector('.hamburger');
  const isOpen = sidebar.classList.toggle('open');
  overlay.classList.toggle('open', isOpen);
  hamburger.setAttribute('aria-expanded', isOpen);
  setState('sidebarOpen', isOpen);
}

function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebarOverlay').classList.remove('open');
  document.querySelector('.hamburger').setAttribute('aria-expanded', 'false');
  setState('sidebarOpen', false);
}

function closeSheet(sheetId) {
  document.getElementById(sheetId).classList.remove('open');
}

function closeAllModals() {
  document.querySelectorAll('.overlay.open').forEach(o => o.classList.remove('open'));
  closeSidebar();
}