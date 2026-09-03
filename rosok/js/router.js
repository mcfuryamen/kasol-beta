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
  '/riwayat': 'riwayat', '/laporan': 'laporan', '/pengaturan': 'pengaturan'
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

export function navigateTo(path, push = true) {
  const route = resolveRoute(path);
  if (push && path !== currentRoute) history.pushState({ screen: route, path }, '', path);
  currentRoute = path;
  showScreen(route);
}

export function handleInitialRoute() {
  const path = normalizePath(window.location.pathname + window.location.search);
  const screen = resolveRoute(path);
  currentRoute = path;
  if (isAppReady) showScreen(screen);
  else window.addEventListener('router:ready', () => showScreen(screen), { once: true });
}

export function markReady() { isAppReady = true; handleInitialRoute(); }
export function getRoute() { return currentRoute; }

window.addEventListener('popstate', () => {
  const path = normalizePath(window.location.pathname + window.location.search);
  currentRoute = path;
  showScreen(resolveRoute(path));
});

window._ksr_navigateTo = navigateTo;
window._ksr_getRoute = getRoute;
