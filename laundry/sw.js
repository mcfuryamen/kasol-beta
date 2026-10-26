const CACHE_VERSION = 'v2';
const CACHE_NAME = `kasir-solo-laundry-${CACHE_VERSION}`;
const CORE_ASSETS = ['./', './index.html', './manifest.json', './assets/logo.svg', './js/version.js', './js/update.js', './js/laundry-license.js', './js/license.logic.js', './js/license.sync.js', './js/license.ui.js', './js/quota.offline.js', './js/db.js', './js/helpers.js', './js/helpers.pure.js', './js/modal.js', './js/purchase.js', './js/region-loader.js', './js/region.js', './js/settings.js', './js/sync.js', './js/supabase-config.js', './js/supabase.min.js'];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(CORE_ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('message', event => { if (event.data === 'SKIP_WAITING') self.skipWaiting(); });
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.pathname.endsWith('/version.json')) {
    event.respondWith(fetch(event.request, { cache: 'no-store' }));
    return;
  }
  event.respondWith(fetch(event.request).then(response => {
    if (response.ok && url.origin === self.location.origin) caches.open(CACHE_NAME).then(c => c.put(event.request, response.clone())).catch(() => {});
    return response;
  }).catch(() => caches.match(event.request).then(r => r || caches.match('./index.html'))));
});
