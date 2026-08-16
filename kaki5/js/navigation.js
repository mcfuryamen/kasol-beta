// ==================== NAVIGATION ROUTER (ESM) ====================
// URL hash-based router with history management.
// Uses History API for SPA navigation.
// PERFORMANCE: Dynamic imports for page modules to enable code splitting.

import { setCurrentPage, currentPage } from './app-state.js';
import { initPage, cleanupPage } from './templates.js';
import { checkProfileNotification } from './settings.ui.js';

// Lazy-loaded page modules (loaded on first navigation)
const PAGE_MODULES = {
  beranda: () => import('./beranda.js'),
  jualan:  () => import('./pos.js'),
  menu:    () => import('./menu.js'),
  laporan: () => import('./laporan.js'),
  pengaturan: () => import('./settings.js'),
  bantuan: () => import('./bantuan.js')
};

// Preload frequently accessed pages on idle
function preloadCriticalPages() {
  if (!('requestIdleCallback' in window)) return;
  requestIdleCallback(() => {
    PAGE_MODULES.beranda();
    PAGE_MODULES.jualan();
    PAGE_MODULES.menu();
  }, { timeout: 2000 });
}

// Page-to-loader mapping (resolved lazily)
const PAGE_LOADERS = {};
const PAGE_INITIALIZED = new Set();

async function ensurePageLoaded(page) {
  if (!PAGE_LOADERS[page]) {
    const mod = await PAGE_MODULES[page]();
    PAGE_LOADERS[page] = mod;
    PAGE_INITIALIZED.add(page);
  }
  return PAGE_LOADERS[page];
}

// Resolve page from hash or default to beranda
function getPageFromHash() {
  const hash = window.location.hash.slice(1);
  return ['beranda', 'jualan', 'menu', 'laporan', 'pengaturan', 'bantuan'].includes(hash) ? hash : 'beranda';
}

// Set URL hash without triggering navigation
function setHashSilent(page) {
  if (window.location.hash === '#' + page) return;
  history.replaceState(null, '', '#' + page);
}

// Navigate to page (updates URL + renders)
export async function navigateTo(page) {
  if (!['beranda', 'jualan', 'menu', 'laporan', 'pengaturan', 'bantuan'].includes(page)) {
    console.warn('[NAV] Unknown page:', page);
    return;
  }

  // Pindah halaman / klik navbar -> tutup semua modal yang terbuka.
  // (lockOverlay = hard lock gate; dijaga supaya gak bisa ditutup via navigasi.)
  document.querySelectorAll('.modal-overlay.show').forEach((o) => {
    if (o.id !== 'lockOverlay') o.classList.remove('show');
  });

  const prev = currentPage;
  setCurrentPage(page);

  // Update URL hash
  history.pushState({ page }, '', '#' + page);

  // Update nav active state
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const navBtn = document.querySelector(`.nav-item[data-page="${page}"]`);
  if (navBtn) navBtn.classList.add('active');

  // Update page visibility
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const pageEl = document.getElementById('page-' + page);
  if (pageEl) pageEl.classList.add('active');

  // Banner "lengkapi profil": tampil di semua halaman kecuali pengaturan
  // (di pengaturan user mengisi profil, jadi banner disembunyikan agar tidak
  // menutupi form — banner akan muncul lagi saat pindah halaman lain).
  const profBanner = document.getElementById('profileBanner');
  if (profBanner) {
    if (page === 'pengaturan') {
      profBanner.classList.remove('show');
    } else {
      await checkProfileNotification();
    }
  }

  // Cleanup previous page
  if (prev && prev !== page) {
    await cleanupPage(prev);
  }

  // Lazy load page module if needed, then init
  const mod = await ensurePageLoaded(page);
  await initPage(page, mod);
}

// Back navigation
export function goBack() {
  history.back();
}

// Forward navigation
export function goForward() {
  history.forward();
}

// Initialize router on page load
export async function initRouter() {
  // Listen for hash changes
  window.addEventListener('hashchange', async () => {
    const page = getPageFromHash();
    if (currentPage !== page) {
      await navigateTo(page);
    }
  });

  // Listen for popstate (back/forward buttons)
  window.addEventListener('popstate', async (e) => {
    const page = e.state?.page || getPageFromHash();
    if (currentPage !== page) {
      await navigateTo(page);
    }
  });

  // Preload critical pages
  preloadCriticalPages();

  // Initial page load
  const initialPage = getPageFromHash();
  await navigateTo(initialPage);
}

// Redirect to page (for non-SPA navigation)
export function redirect(page) {
  window.location.hash = page;
}

// Get current page from state
export function getCurrentPage() {
  return currentPage;
}

// Check if page is active
export function isPageActive(page) {
  return currentPage === page;
}
