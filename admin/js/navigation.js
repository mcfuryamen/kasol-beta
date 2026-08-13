/**
 * Admin Marketing KASIRSOLO — Navigation Module
 * Sidebar tab switching, mobile toggle (rosok-style)
 */

import { subscribe } from './app-state.js';

let sidebar = null;
let sidebarOverlay = null;
let navItems = null;
let hamburger = null;
// Module-level state for hash change lock
const navState = { hashChangeLocked: false };

// Page title/subtitle mapping (moved from .page-head to topbar)
const PAGE_META = {
  dashboard: { title: 'Ringkasan', subtitle: 'Performa leads, katalog, dan lisensi secara real-time.' },
  catalog: { title: 'Katalog Aplikasi', subtitle: 'Produk yang tampil di landing page. Sync otomatis ke Supabase.' },
  klien: { title: 'Klien', subtitle: 'Outlet (merchant aktif) & calon pelanggan dari landing. Generate lisensi langsung dari sini.' },
  settings: { title: 'Pengaturan', subtitle: 'Info usaha, konfigurasi landing, dan backup data.' },
};

function setPageMeta(screen) {
  const meta = PAGE_META[screen] || {};
  const pt = document.getElementById('pageTitle');
  const ps = document.getElementById('pageSubtitle');
  if (pt) pt.textContent = meta.title || screen;
  if (ps) ps.textContent = meta.subtitle || '';
}

/**
 * Initialize navigation
 */
export function initNavigation() {
  sidebar = document.querySelector('.sidebar');
  sidebarOverlay = document.getElementById('sidebarOverlay');
  navItems = document.querySelectorAll('.nav-link, .nav-item, .sb-link');

  // Hamburger is already in HTML (topbar-right)
  hamburger = document.querySelector('.menu-toggle, .hamburger');

  // Nav item clicks (both sidebar and bottom nav)
  navItems.forEach(item => {
    item.addEventListener('click', () => {
      const screen = item.dataset.screen;
      const clientView = item.dataset.clientView;
      if (screen) {
        switchScreen(screen, clientView);
      }
    });
  });

  // Accordion: any parent with data-submenu toggles its wrapper
  // Klik induk → buka + pilih submenu pertama di bawahnya
  document.querySelectorAll('.nav-parent').forEach(parent => {
    const wrap = document.getElementById(parent.dataset.submenu);
    if (!wrap) return;
    parent.addEventListener('click', () => {
      const firstSub = wrap.querySelector('.nav-sub');
      if (firstSub) {
        switchScreen(parent.dataset.screen, firstSub.dataset.clientView);
        wrap.classList.add('open');
        parent.classList.add('open');
        parent.setAttribute('aria-expanded', 'true');
      } else {
        // fallback: no submenu, just toggle
        const isOpen = wrap.classList.toggle('open');
        parent.classList.toggle('open', isOpen);
        parent.setAttribute('aria-expanded', String(isOpen));
      }
    });
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

  // Listen for hash changes (URL navigation) — use module-level navState.hashChangeLocked
  window.addEventListener('hashchange', () => {
    if (navState.hashChangeLocked) return;
    handleHashChange();
  });
  // Handle initial hash
  handleHashChange();
}

function handleHashChange() {
  const hash = window.location.hash.slice(1); // Remove '#'
  if (!hash) return;

  // Parse hash like "klien-analitik" or "klien"
  const parts = hash.split('-');
  const screen = parts[0];
  const clientView = parts[1] || null;

  if (screen) {
    switchScreen(screen, clientView);
  }
}

/**
 * Switch active screen
 * @param {string} screen - Screen name (dashboard, leads, catalog, license, settings)
 * @param {string} [clientView] - Client view mode ('analitik' | 'kelola'), only for 'klien' screen
 */
export function switchScreen(screen, clientView) {
  // Update sidebar links — parent and children must be mutually exclusive
  document.querySelectorAll('.nav-link, .sb-link').forEach(link => {
    const ls = link.dataset.screen;
    const lc = link.dataset.clientView;
    let isActive = false;
    if (!lc) {
      // Parent: active only when no clientView AND no child is active
      isActive = ls === screen && !clientView;
    } else {
      // Child: active only when both screen AND clientView match
      isActive = ls === screen && lc === clientView;
    }
    link.classList.toggle('active', isActive);
    if (isActive) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });

  // Update bottom nav (only .nav-item; .nav-link belongs to sidebar and is handled above)
  document.querySelectorAll('.nav-item').forEach(item => {
    item.classList.toggle('active', item.dataset.screen === screen);
  });

  // Update screens
  document.querySelectorAll('.screen').forEach(s => {
    s.classList.toggle('active', s.id === `screen-${screen}`);
  });

  // Accordion: auto-close submenus when leaving their parent screen
  document.querySelectorAll('.nav-sub-wrap').forEach(wrap => {
    const parentScreen = wrap.closest('nav')?.querySelector(`[data-submenu="${wrap.id}"]`)?.dataset.screen;
    const parentBtn = wrap.closest('nav')?.querySelector(`[data-submenu="${wrap.id}"]`);
    if (parentScreen === screen) {
      if (clientView) {
        wrap.classList.add('open');
        parentBtn?.classList.add('open');
        parentBtn?.setAttribute('aria-expanded', 'true');
      }
    } else {
      wrap.classList.remove('open');
      parentBtn?.classList.remove('open');
      parentBtn?.setAttribute('aria-expanded', 'false');
    }
  });

  // Update topbar page title/subtitle
  setPageMeta(screen);

  // Switch client view if provided
  if (screen === 'klien' && clientView) {
    window.switchClientView(clientView);
  }

  // Close sidebar on mobile
  closeSidebar();

  // Update URL hash (use replaceState to avoid triggering hashchange event)
  navState.hashChangeLocked = true;
  if (clientView) {
    history.replaceState(null, '', `#${screen}-${clientView}`);
  } else {
    history.replaceState(null, '', `#${screen}`);
  }
  navState.hashChangeLocked = false;

  // Dispatch custom event for modules that need to react
  window.dispatchEvent(new CustomEvent('screen:change', { detail: { screen, clientView } }));

  // Scroll to top on mobile
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/**
 * Update active screen without switching (for initialization)
 * @param {string} screen
 */
export function updateActiveScreen(screen, clientView) {
  document.querySelectorAll('.nav-link, .sb-link').forEach(link => {
    const isParent = link.dataset.screen === screen && !link.dataset.clientView;
    const isChild = link.dataset.screen === screen && link.dataset.clientView === clientView;
    const isActive = isParent || isChild;
    link.classList.toggle('active', isActive);
    if (isActive) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });
  document.querySelectorAll('.nav-item').forEach(item => {
    const isActive = item.dataset.screen === screen;
    item.classList.toggle('active', isActive);
  });
  document.querySelectorAll('.screen').forEach(s => {
    s.classList.toggle('active', s.id === `screen-${screen}`);
  });
  setPageMeta(screen);

  // Accordion: open parent submenu when a submenu view is active on initial load
  if (clientView) {
    document.querySelectorAll('.nav-sub-wrap').forEach(wrap => {
      const parentBtn = wrap.closest('nav')?.querySelector(`[data-submenu="${wrap.id}"]`);
      if (parentBtn?.dataset.screen === screen) {
        wrap.classList.add('open');
        parentBtn.classList.add('open');
        parentBtn.setAttribute('aria-expanded', 'true');
      }
    });
  }
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
  const activeLink = document.querySelector('.nav-link.active, .sb-link.active, .nav-item.active');
  return activeLink?.dataset.screen || 'dashboard';
}

// Global alias for HTML onclick handlers
window.showScreen = switchScreen;

/**
 * Update sidebar count badges (Katalog, Klien)
 * Dipanggil setelah data selesai dimuat oleh modul terkait.
 */
export function updateSidebarBadges({ catalog, clients } = {}) {
  if (typeof catalog === 'number') {
    const el = document.getElementById('sideCountCatalog');
    if (el) el.textContent = catalog;
  }
  if (typeof clients === 'number') {
    const el = document.getElementById('sideCountClients');
    if (el) el.textContent = clients;
  }
}