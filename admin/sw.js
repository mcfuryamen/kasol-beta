// Service Worker for Admin Marketing KASIRSOLO
// Version: v1.0.0 - Update this when changing cached assets
// v7: Removed license card from settings page, added skipWaiting + claim
// v8: Fix unresolved Response (return valid fallback instead of undefined) so SW
//     doesn't throw "Failed to convert value to 'Response'" when fetch fails offline.

const CACHE_NAME = 'kasir-admin-v21';
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
  '/js/license-core.js'
];

// Install - cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[SW] Caching static assets');
        return cache.addAll(STATIC_ASSETS.map(url => new Request(url, { credentials: 'same-origin' })));
      })
      .then(() => self.skipWaiting())
  );
});

// Activate - clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => name !== CACHE_NAME)
            .map((name) => {
              console.log('[SW] Deleting old cache:', name);
              return caches.delete(name);
            })
        );
      })
      .then(() => self.clients.claim())
  );
});

// Fetch - network first for HTML, cache first for static assets
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // Skip cross-origin requests
  if (url.origin !== location.origin) return;

  // HTML - network first, fallback to cache
  if (request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Cache successful responses
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => caches.match(request))
        .then((response) => response || new Response('', { status: 503, statusText: 'Service Unavailable' }))
    );
    return;
  }

  // JS/CSS/JSON - cache first, fallback to network
  if (url.pathname.startsWith('/js/') ||
      url.pathname.endsWith('.css') ||
      url.pathname.endsWith('.json') ||
      url.pathname.endsWith('.js')) {
    event.respondWith(
      caches.match(request)
        .then((cached) => {
          if (cached) return cached;
          return fetch(request)
            .then((response) => {
              if (response.ok) {
                const clone = response.clone();
                caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
              }
              return response;
            })
            .catch(() => new Response('', { status: 503, statusText: 'Service Unavailable' }));
        })
    );
    return;
  }

  // Default - network first, fallback ke cache, lalu Response fallback valid
  event.respondWith(
    fetch(request)
      .catch(() => caches.match(request))
      .then((response) => response || new Response('', { status: 404, statusText: 'Not Found' }))
  );
});

// Handle messages from clients
self.addEventListener('message', (event) => {
  if (event.data === 'skipWaiting') {
    self.skipWaiting();
  }
});