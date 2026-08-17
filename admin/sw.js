// Service Worker for Admin Marketing KASIRSOLO
// v23: Network-first untuk SEMUA aset — versi baru selalu muncul cepat dan
// cache lama tidak pernah menghalangi update (penting untuk env-loader.js
// yang digenerate ulang tiap build).

const CACHE_NAME = 'kasir-admin-v23';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/style.css',
  '/manifest.json',
  '/js/app.js',
  '/js/app-state.js',
  '/js/storage.js',
  '/js/utils.js',
  '/js/toast.js',
  '/js/auth.js',
  '/js/navigation.js',
  '/js/dashboard.js',
  '/js/catalog.js',
  '/js/clients.js',
  '/js/emoji-picker.js',
  '/js/overlay-a11y.js',
  '/js/settings.js',
  '/js/api.js',
  '/js/env-loader.js',
  '/js/license-core.js'
];

// Install - precache static assets (offline-ready)
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(STATIC_ASSETS.map(url => new Request(url, { credentials: 'same-origin' }))))
      .then(() => self.skipWaiting())
  );
});

// Activate - clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      ))
      .then(() => self.clients.claim())
  );
});

// Fetch - network first, fallback ke cache (offline), fallback Response valid
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // Skip cross-origin requests
  if (url.origin !== location.origin) return;

  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      })
      .catch(() => caches.match(request)
        .then((cached) => cached || new Response('', { status: 503, statusText: 'Offline' })))
  );
});

// Handle messages from clients
self.addEventListener('message', (event) => {
  if (event.data === 'skipWaiting') {
    self.skipWaiting();
  }
});
