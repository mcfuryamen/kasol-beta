// Service Worker for Kasir Solo - Kaki Lima
// Strategi fetch: NETWORK-FIRST dengan fallback ke cache (lihat handler fetch
// di bawah — komentar lama salah menyebut cache-first). HTML selalu segar saat
// online; cache precache di bawah menjamin app tetap jalan offline penuh.

const CACHE_NAME = 'kasir-solo-kaki5-v63';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  './dexie.min.js',
  './css/base.css',
  './css/components.css',
  './css/components-stat.css',
  './css/components-modal.css',
  './css/components-banner.css',
  './css/components-tabs.css',
  './css/components-license.css',
  './css/components-carousel.css',
  './css/components-menu.css',
  './css/components-cart.css',
  './css/components-trx.css',
  './css/components-report.css',
  './css/components-settings.css',
  './css/style.css',
  './assets/icon.png',
  './assets/icon-192.png',
  './assets/icon-512.png',
  './js/helpers.js',
  './js/helpers.pure.js',
  './js/db.js',
  './js/app-state.js',
  './js/app.js',
  './js/navigation.js',
  './js/templates.js',
  './js/confirm.js',
  './js/onboarding.js',
  './js/region.js',
  './js/supabase-config.js',
  './js/supabase.min.js',
  './js/sync.js',
  './js/sync.health.js',
  './js/pwa.js',
  './js/backup.js',
  './js/printer.js',
  './js/carousel.js',
  './js/bantuan.js',
  './js/beranda.js',
  './js/menu.js',
  './js/pengeluaran.js',
  './js/trxdetail.js',
  './js/expensedetail.js',
  './js/laporan.js',
  './js/purchase.js',
  './js/license.js',
  './js/license.logic.js',
  './js/license.ui.js',
  './js/license.sync.js',
  './js/pos.js',
  './js/pos.logic.js',
  './js/pos.ui.js',
  './js/pos.sync.js',
  './js/settings.js',
  './js/settings.logic.js',
  './js/settings.ui.js',
  './js/settings.sync.js',
  './js/version.js',
  './js/version.json',
  './js/update.js'
];

// Install: cache shell assets
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(ASSETS_TO_CACHE).catch(err => {
        console.warn('[SW] Cache addAll failed (partial):', err);
      });
    })
  );
  self.skipWaiting();
});

// Activate: clean old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// Fetch: cache-first, fall back to network, then cache the response
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    fetch(event.request)
      .then(response => {
        if (response && response.status === 200 && response.type === 'basic') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
