// Service Worker for Kasir Solo - Kaki Lima
// Cache-first strategy with network fallback for offline support

const CACHE_NAME = 'kasir-solo-kaki5-v30';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  './dexie.min.js',
  './css/style.css',
  './assets/icon.png',
  './assets/icon-192.png',
  './assets/icon-512.png',
  './js/helpers.js',
  './js/db.js',
  './js/app-state.js',
  './js/license.js',
  './js/confirm.js',
  './js/navigation.js',
  './js/beranda.js',
  './js/pos.js',
  './js/menu.js',
  './js/pengeluaran.js',
  './js/laporan.js',
  './js/trxdetail.js',
  './js/settings.js',
  './js/backup.js',
  './js/onboarding.js',
  './js/printer.js',
  './js/pwa.js',
  './js/carousel.js',
  './js/bantuan.js',
  './js/expensedetail.js',
  './js/app.js',
  './js/purchase.js'
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
