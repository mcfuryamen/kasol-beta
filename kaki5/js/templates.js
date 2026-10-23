// ==================== PAGE LIFECYCLE (ESM) ====================
// initPage/cleanupPage: lifecycle hooks per halaman (dipakai navigation.js).
// Objek TEMPLATES (salinan HTML statis + onclick legacy) dihapus 2026-08-22:
// tidak pernah di-inject ke DOM (markup hidup ada di index.html) dan
// mengandung pola onclick lama yang bisa menyesatkan.

// ---- PAGE-LIFECYCLE TRACKING ----
const _pageCleanupFns = new Map();  // pageId → array of cleanup callbacks

/**
 * Register a cleanup callback for a page. Called automatically by cleanupPage().
 * Useful for timers, event listeners, or state that must be torn down when leaving a page.
 * @param {string} pageId
 * @param {Function} fn
 */
export function registerCleanup(pageId, fn) {
  if (!fn) return;
  let arr = _pageCleanupFns.get(pageId);
  if (!arr) { arr = []; _pageCleanupFns.set(pageId, arr); }
  arr.push(fn);
}

/**
 * Called when a page becomes active (after its DOM is visible).
 * Hydrates the page by running the page-specific loader function.
 * For pages whose HTML is already in index.html, this only runs the JS loader.
 * For dynamically-rendered content, the loader writes into the container elements.
 *
 * @param {string} pageId - one of: 'beranda','jualan','menu','laporan','pengaturan','bantuan'
 */
export async function initPage(pageId, module) {
  // Clean up any previous cleanup fns for this page (idempotent re-init)
  if (_pageCleanupFns.has(pageId)) {
    for (const fn of _pageCleanupFns.get(pageId)) {
      try { fn(); } catch (e) { console.warn(`[initPage] cleanup fn error:`, e); }
    }
    _pageCleanupFns.delete(pageId);
  }

  // module is the dynamically imported module for this page
  const mod = module || {};

  switch (pageId) {
    case 'beranda': {
      // loadBeranda is imported from beranda.js and wired to window by app.js
      if (typeof mod.loadBeranda === 'function') await mod.loadBeranda();
      break;
    }
    case 'jualan': {
      if (typeof mod.loadPOS === 'function') await mod.loadPOS();
      break;
    }
    case 'menu': {
      if (typeof mod.renderMenuList === 'function') await mod.renderMenuList();
      break;
    }
    case 'laporan': {
      if (typeof mod.loadReport === 'function') await mod.loadReport();
      break;
    }
    case 'pengaturan': {
      if (typeof mod.loadSettings === 'function') await mod.loadSettings();
      break;
    }
    case 'bantuan': {
      if (typeof mod.initBantuan === 'function') mod.initBantuan();
      break;
    }
    default:
      console.warn(`[initPage] unknown page: ${pageId}`);
  }
}

/**
 * Called when a page becomes inactive (user navigates away).
 * Tears down timers, event listeners, and stale state associated with the page.
 *
 * @param {string} pageId
 */
export function cleanupPage(pageId) {
  const fns = _pageCleanupFns.get(pageId);
  if (!fns) return;
  for (const fn of fns) {
    try { fn(); } catch (e) { console.warn(`[cleanupPage] error:`, e); }
  }
  _pageCleanupFns.delete(pageId);

  // Page-specific cleanup
  switch (pageId) {
    case 'jualan': {
      // Cart bar is managed by updateCartBar() — no cleanup needed unless
      // we had extra listeners registered via registerCleanup().
      break;
    }
    case 'laporan': {
      // reportPeriod / reportDate are managed by app-state.js setters.
      break;
    }
    case 'bantuan': {
      // Accordion state is inline in DOM; no cleanup needed.
      break;
    }
  }
}
