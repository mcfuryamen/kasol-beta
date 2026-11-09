/**
 * Control Center Kasir Solo — Navigation Module
 * Sidebar tab switching, mobile toggle (rosok-style)
 */

import { subscribe } from './app-state.js';

let sidebar = null;
let sidebarOverlay = null;
let navItems = null;
let hamburger = null;
// Module-level state for hash change lock
const navState = { hashChangeLocked: false };

// Halaman sekunder — dicapai via sheet "Lainnya" (bottom nav mobile);
// tab Lainnya menyala & header mobile menampilkan tombol kembali.
// 'mitra' & 'klien' lama melebur ke modul CRM (primary, merge 2026-10-28).
// 'social' & 'kalender' lama melebur ke modul Grow Up (2026-10-28).
// 'content' & 'growup' naik jadi menu langsung bottom-nav (6 item, 2026-10-28)
// — bukan sekunder lagi, jadi item bnav-nya sendiri yang menyala.
const SECONDARY_SCREENS = ['content', 'agents', 'settings'];
let lastPrimaryScreen = 'dashboard';

// Page title/subtitle mapping (moved from .page-head to topbar)
const PAGE_META = {
  dashboard: { title: 'Ringkasan', subtitle: 'Performa leads, katalog, dan lisensi secara real-time.' },
  catalog: { title: 'Katalog Aplikasi', subtitle: 'Produk yang tampil di landing page. Sync otomatis ke Supabase.' },
  content: { title: 'Konten Website', subtitle: 'Editor data situs kasirsolo.com (company). Simpan = tersinkron ke Supabase; situs menariknya saat build.' },
  crm: { title: 'CRM', subtitle: 'Kontak, Klien, Mitra & Outreach dalam satu papan — follow-up, lisensi, komisi, kampanye.' },
  agents: { title: 'Agent AI', subtitle: 'Draft hasil agent lokal (runner + Omniroute). Review: setujui, tolak, tandai dipakai.' },
  growup: { title: 'Grow Up', subtitle: 'Mesin konten: antrian posting sosmed (AI + Facebook) & kalender konten manual per bulan.' },
  settings: { title: 'Pengaturan', subtitle: 'Info usaha, konfigurasi landing, dan backup data.' },
};

function setPageMeta(screen) {
  const meta = PAGE_META[screen] || {};
  const pt = document.getElementById('pageTitle');
  const ptMobile = document.getElementById('pageTitle-mobile');
  if (pt) pt.textContent = meta.title || screen;
  if (ptMobile) ptMobile.textContent = meta.title || screen;
  // Tombol kembali hanya di halaman sekunder (mobile header)
  const backBtn = document.getElementById('mhBackBtn');
  if (backBtn) backBtn.hidden = !SECONDARY_SCREENS.includes(screen);
}

/**
 * Initialize navigation
 */
export function initNavigation({ processInitialHash = true } = {}) {
  sidebar = document.querySelector('.sidebar');
  sidebarOverlay = document.getElementById('sidebarOverlay');
  navItems = document.querySelectorAll('.nav-link, .nav-item, .sb-link, .bnav-item:not(#bnavMore)');

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

  // Tombol kembali di mobile header (halaman sekunder → halaman utama terakhir)
  document.getElementById('mhBackBtn')?.addEventListener('click', goBack);

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
  // Handle initial hash after merged tab modules have registered their APIs.
  if (processInitialHash) handleHashChange();
}

window.handleInitialNavigation = function () {
  handleHashChange();
};

function handleHashChange() {
  const hash = window.location.hash.slice(1); // Remove '#'
  if (!hash) return;

  // Deep-link tabs: CRM, Grow Up, and Agent.
  // CRM: "#crm?tab=klien|mitra|kontak"

  const qIdx = hash.indexOf('?');
  const base = qIdx >= 0 ? hash.slice(0, qIdx) : hash;
  let tab = null;
  if (qIdx >= 0) {
    try { tab = new URLSearchParams(hash.slice(qIdx + 1)).get('tab'); } catch { tab = null; }
  }

  // Deep-link lama: #klien / #mitra → modul CRM dengan tab yang sesuai
  if (base === 'klien' || base === 'mitra') {
    switchScreen('crm');
    window.setCrmTab?.(base);
    return;
  }

  // Parse hash like "klien-analitik" (legacy) or "dashboard"
  const parts = base.split('-');
  const screen = parts[0];
  const clientView = parts[1] || null;

  if (screen) switchScreen(screen, clientView);
  // switchScreen menulis hash "#crm" (replaceState) → tab dipulihkan setelahnya
  if (screen === 'crm' && tab) window.setCrmTab?.(tab);
  if (screen === 'growup' && tab) window.setGrowupTab?.(tab);
  if (screen === 'agents' && tab) window.setAgentTab?.(tab);
}

/**
 * Switch active screen
 * @param {string} screen - Screen name (dashboard, catalog, crm, outreach, settings, ...)
 * @param {string} [clientView] - Legacy view param (usang, dibuang setelah redirect CRM)
 */
export function switchScreen(screen, clientView) {
  // Legacy: 'klien' & 'mitra' kini jadi TAB di modul CRM — arahkan tanpa error
  // (dipanggil dari dashboard.js / clients.js / onclick lama).
  let crmTab = null;
  if (screen === 'klien' || screen === 'mitra') {
    crmTab = screen;
    screen = 'crm';
    clientView = null;
  }
  // Legacy: 'outreach' kini tab ke-4 CRM (2026-10-28) — semua pemanggil lama
  // (dashboard CTA, openOutreachWaFor, hash #outreach) otomatis diarahkan.
  if (screen === 'outreach') {
    crmTab = 'outreach';
    screen = 'crm';
    clientView = null;
  }
  // Legacy: 'social' & 'kalender' kini TAB modul Grow Up (2026-10-28) — semua
  // pemanggil lama (openKalender, sheet Lainnya lama, hash #social/#kalender)
  // otomatis diarahkan ke tab yang sesuai.
  let growupTab = null;
  if (screen === 'social') {
    growupTab = 'social';
    screen = 'growup';
    clientView = null;
  } else if (screen === 'kalender') {
    growupTab = 'kalender';
    screen = 'growup';
    clientView = null;
  }
  const isSecondary = SECONDARY_SCREENS.includes(screen);
  if (!isSecondary) lastPrimaryScreen = screen;
  // Update sidebar links + bottom nav — semua nav item pakai logika yang sama
  document.querySelectorAll('.nav-link, .sb-link, .bnav-item').forEach(link => {
    const ls = link.dataset.screen;
    const lc = link.dataset.clientView;
    // Tab "Lainnya" (tanpa data-screen) menyala saat halaman sekunder aktif
    if (!ls) {
      const isMoreTab = link.id === 'bnavMore';
      link.classList.toggle('active', isMoreTab && isSecondary);
      if (isMoreTab && isSecondary) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
      return;
    }
    let isActive = false;
    if (!lc) {
      // Item tanpa clientView (Dashboard, Katalog, Pengaturan): aktif hanya saat screen cocok
      isActive = ls === screen && !clientView;
    } else {
      // Item dengan clientView (Analitik, Kelola): aktif hanya saat screen + view cocok
      isActive = ls === screen && lc === clientView;
    }
    link.classList.toggle('active', isActive);
    if (isActive) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
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

  // Terapkan tab CRM yang diminta (redirect legacy klien/mitra) — SETELAH hash
  // `#crm` ditulis, supaya setCrmTab menulis hash final `#crm?tab=...`.
  // window.setCrmTab (crm.js) memicu re-render tab Klien via switchClientView.
  if (crmTab) window.setCrmTab?.(crmTab);

  // Terapkan tab Grow Up yang diminta (redirect legacy social/kalender) — SETELAH
  // hash `#growup` ditulis, supaya setGrowupTab menulis hash final `#growup?tab=...`.
  if (growupTab) window.setGrowupTab?.(growupTab);

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
  const isSecondary = SECONDARY_SCREENS.includes(screen);
  if (!isSecondary) lastPrimaryScreen = screen;
  document.querySelectorAll('.nav-link, .sb-link').forEach(link => {
    const isParent = link.dataset.screen === screen && !link.dataset.clientView;
    const isChild = link.dataset.screen === screen && link.dataset.clientView === clientView;
    const isActive = isParent || isChild;
    link.classList.toggle('active', isActive);
    if (isActive) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });
  document.querySelectorAll('.bnav-item').forEach(item => {
    // Tab "Lainnya" menyala saat halaman sekunder aktif (init via hash)
    const isActive = item.dataset.screen === screen || (item.id === 'bnavMore' && isSecondary);
    item.classList.toggle('active', isActive);
    item.setAttribute('aria-current', isActive ? 'page' : 'false');
  });
  document.querySelectorAll('.screen').forEach(s => {
    s.classList.toggle('active', s.id === `screen-${screen}`);
  });
  setPageMeta(screen);

  // Accordion: open parent submenu when a submenu view is active on initial load
  if (clientView) {    document.querySelectorAll('.nav-sub-wrap').forEach(wrap => {
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

/**
 * Kembali dari halaman sekunder ke halaman utama terakhir (tombol ‹ mobile header).
 * Placeholder state — jika belum pernah pindah halaman (deep-link langsung ke
 * sekunder), fallback ke Dashboard.
 */
function goBack() {
  const target = SECONDARY_SCREENS.includes(lastPrimaryScreen) ? 'dashboard' : lastPrimaryScreen;
  switchScreen(target);
}

// Global alias for HTML onclick handlers
window.showScreen = switchScreen;

/**
 * Update sidebar count badges (Katalog, Klien)
 * Dipanggil setelah data selesai dimuat oleh modul terkait.
 */
export function updateSidebarBadges({ catalog, clients, outreach, agents } = {}) {
  if (typeof catalog === 'number') {
    const el = document.getElementById('sideCountCatalog');
    if (el) el.textContent = catalog;
  }
  if (typeof clients === 'number') {
    const el = document.getElementById('sideCountClients');
    if (el) el.textContent = clients;
  }
  if (typeof outreach === 'number') {
    const el = document.getElementById('sideCountOutreach');
    if (el) el.textContent = outreach;
  }
  if (typeof agents === 'number') {
    const el = document.getElementById('sideCountAgents');
    if (el) el.textContent = agents;
  }
}