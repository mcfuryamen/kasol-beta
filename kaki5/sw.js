// Service Worker for Kasir Solo - Kaki Lima
// Strategi: API calls → network-only, HTML → cache-first (offline navigable),
// static assets → network-first dengan fallback cache.
// Cache version v90 — ubah angka ini setiap swap service worker file.
// v72: konsolidasi P2 — css/style.css jadi satu-satunya stylesheet (13 file
// css/ modular dilebur; rule uniknya sudah dipindah ke style.css).

const CACHE_NAME = 'kasir-solo-kaki5-v90';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  './dexie.min.js',
  './css/style.css',
  './assets/icon.png',
  './assets/icon-48.png',
  './assets/icon-72.png',
  './assets/icon-96.png',
  './assets/icon-144.png',
  './assets/icon-152.png',
  './assets/icon-192.png',
  './assets/icon-384.png',
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

// ── Install: precache shell assets ───────────────────────────────────────────
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

// ── Activate: clean old caches, take control immediately ─────────────────────
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

// ── Fetch: smart strategy per resource type ──────────────────────────────────
self.addEventListener('fetch', event => {
  const { request } = event;

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // ── API calls: network-first, no cache ────────────────────────────────────
  if (request.url.includes('/supabase.co')) {
    event.respondWith(
      fetch(request).catch(() => {
        return new Response(JSON.stringify({ error: 'offline' }), {
          headers: { 'Content-Type': 'application/json' }
        });
      })
    );
    return;
  }

  // ── HTML pages: cache-first for offline navigation ────────────────────────
  if (request.headers.get('accept')?.includes('text/html') ||
      new URL(request.url).pathname.endsWith('/') ||
      new URL(request.url).pathname.match(/^[^ .]+\.(html)?$/)) {
    event.respondWith(
      caches.match(request).then(cached => {
        return cached || fetch(request).then(response => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
          }
          return response;
        }).catch(() => {
          return caches.match('./index.html');
        });
      })
    );
    return;
  }

  // ── Static assets (JS, CSS, images): network-first with cache fallback ───
  event.respondWith(
    fetch(request)
      .then(response => {
        if (response && response.status === 200 && response.type === 'basic') {
          // Abaikan request dengan scheme yang tidak didukung Cache API
          // (mis. chrome-extension:// dari plugin browser)
          try {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
          } catch (e) {
            if (typeof isDev === "function" ? isDev() : (location.hostname==="localhost"||location.hostname==="127.0.0.1")) {
              console.warn('[SW] Cache skip:', request.url, e.message);
            }
          }
        }
        return response;
      })
      .catch(() => caches.match(request))
  );
});

// ── Background sync (optional): retry failed API calls when back online ─────
self.addEventListener('sync', event => {
  if (event.tag === 'sync-pending-requests') {
    event.waitUntil(doSync());
  }
});

async function doSync() {
  console.log('[SW] Background sync triggered');
}
