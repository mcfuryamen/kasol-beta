/* ==========================================================================
   TPA Al-Hikmah - Service Worker (PWA Offline-First)
   Cache: HTML asli (self-contained) + Dexie CDN + Google Fonts
   ========================================================================== */

const CACHE_NAME = "tpa-alhikmah-v9";

// HTML pages (self-contained, inline CSS+JS)
const HTML_ASSETS = [
  "/",
  "/index.html",
  "/login.html",
  "/admin.html",
  "/guru.html",
  "/wali.html",
];

// PWA assets
const PWA_ASSETS = [
  "/manifest.webmanifest",
  "/icon-192.png",
  "/icon-512.png",
  "/favicon.ico",
];

// ESM modules (db layer + page modules) — cache for offline
const ESM_ASSETS = [
  "/vendor/dexie.mjs",
  "/db/dexie.js",
  "/db/init.js",
  "/db/seed.js",
  "/pages/landing/login.js",
  "/pages/landing/index.js",
  "/pages/wali/wali.js",
  "/pages/guru/guru.js",
  "/pages/admin/admin.js",
];

// Install: cache HTML + PWA + ESM assets
self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache =>
      cache.addAll([...HTML_ASSETS, ...PWA_ASSETS, ...ESM_ASSETS])
    )
  );
  self.skipWaiting();
});

// Activate: clean old caches
self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch handler
self.addEventListener("fetch", event => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== "GET") return;

  // 1. HTML pages: network-first (fresh content), fallback to cache
  if (request.destination === "document") {
    event.respondWith(
      fetch(request)
        .then(response => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
          return response;
        })
        .catch(() => caches.match(request).then(r => r || caches.match("/index.html")))
    );
    return;
  }

  // 2. Dexie CDN: cache-first (critical for offline)
  if (url.hostname.includes("unpkg.com") || url.hostname.includes("jsdelivr.net")) {
    event.respondWith(
      caches.match(request).then(cached => {
        if (cached) return cached;
        return fetch(request).then(response => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
          return response;
        });
      })
    );
    return;
  }

  // 3. Google Fonts: cache-first
  if (url.hostname.includes("fonts.googleapis.com") || url.hostname.includes("fonts.gstatic.com")) {
    event.respondWith(
      caches.match(request).then(cached => {
        if (cached) return cached;
        return fetch(request).then(response => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
          return response;
        });
      })
    );
    return;
  }

  // 4. Same-origin static assets: cache-first
  if (url.origin === location.origin) {
    event.respondWith(
      caches.match(request).then(cached => {
        if (cached) return cached;
        return fetch(request).then(response => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
          return response;
        });
      })
    );
    return;
  }
});

// Handle messages from main thread
self.addEventListener("message", event => {
  if (event.data === "skipWaiting") self.skipWaiting();
});
