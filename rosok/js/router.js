/* =========================================================================
   KASIR SOLO - ROSOK
   router.js — SPA Routing (pushState, popstate, deep links)
   ========================================================================= */
import { showScreen } from './nav.js';

const ROUTES = {
  '/': 'dashboard', '/dashboard': 'dashboard',
  '/transaksi': 'transaksi', '/transaksi/beli': 'transaksi', '/transaksi/jual': 'transaksi',
  '/stok': 'stok',
  // Riwayat tergabung ke halaman laporan (tab) — deep link lama tetap jalan.
  // AUDIT 2026-11-08 (P1): nilai peta = NAMA LAYAR tanpa slash ('laporan'),
  // sebab showScreen mencari id `screen-<nama>`. Sebelumnya '/laporan' →
  // getElementById('screen-/laporan') = null → TypeError SETELAH semua .screen
  // di-deactivate (layar kosong) dan initApp berhenti sebelum startUpdateWatcher().
  '/riwayat': 'laporan', '/laporan': 'laporan', '/pengaturan': 'pengaturan',
  '/bantuan': 'bantuan'
};
const DEFAULT_ROUTE = '/';

let currentRoute = DEFAULT_ROUTE;
let isAppReady = false;

function resolveRoute(path) {
  if (ROUTES[path]) return ROUTES[path];
  for (const key of Object.keys(ROUTES)) {
    if (path.startsWith(key)) return ROUTES[key];
  }
  return 'dashboard';
}

function normalizePath(path) {
  return path.split('?')[0].split('#')[0] || '/';
}

// Tampilkan layar TANPA membiarkan kegagalan routing mematikan pemanggil.
// (Audit 2026-11-08: showScreen yang melempar dulu menghentikan initApp →
// watcher update tak pernah start.)
function safeShow(screen) {
  try { showScreen(screen); }
  catch (e) { console.error('[ROUTER] gagal menampilkan layar "' + screen + '":', e); }
}

export function navigateTo(path, push = true) {
  const route = resolveRoute(path);
  if (push && path !== currentRoute) history.pushState({ screen: route, path }, '', path);
  currentRoute = path;
  safeShow(route);
}

export function handleInitialRoute() {
  const path = normalizePath(window.location.pathname + window.location.search);
  const screen = resolveRoute(path);
  currentRoute = path;
  if (isAppReady) safeShow(screen);
  else window.addEventListener('router:ready', () => safeShow(screen), { once: true });
}

export function markReady() { isAppReady = true; handleInitialRoute(); }
export function getRoute() { return currentRoute; }

window.addEventListener('popstate', () => {
  const path = normalizePath(window.location.pathname + window.location.search);
  currentRoute = path;
  safeShow(resolveRoute(path));
});

window._ksr_navigateTo = navigateTo;
window._ksr_getRoute = getRoute;
