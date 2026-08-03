/* =========================================================================
   KASIR SOLO - ROSOK
   Service Worker v12 — SPA fallback + stale-while-revalidate (auto-update)
   ========================================================================= */
const CACHE_VERSION = 'v12';
const CACHE_NAME = `kasir-solo-rosok-${CACHE_VERSION}`;
const CORE_ASSETS = [
  "./", "./index.html", "./style.css", "./dexie.min.js",
  "./js/app.js", "./js/db.js", "./js/app-state.js", "./js/utils.js",
  "./js/router.js", "./js/nav.js", "./js/pos.js", "./js/kategori.js",
  "./js/riwayat.js", "./js/laporan.js", "./js/kas.js",
  "./js/carousel.js", "./js/license.js", "./js/onboard.js",
  "./js/dashboard.js",
  "./manifest.json",
  "./assets/logo.png", "./assets/icon-192.png", "./assets/icon-512.png",
  "./assets/favicon-16.png", "./assets/favicon-32.png", "./assets/splash-1028.png"
];

self.addEventListener("install", e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(c => 
      c.addAll(CORE_ASSETS).catch(err => {
        console.error('[SW Install] Cache addAll failed, continuing anyway:', err);
        return c.addAll(CORE_ASSETS.filter(a => !a.includes("icon") && !a.includes("splash") && !a.includes("favicon")));
      })
    )
  );
  self.skipWaiting();
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k!==CACHE_NAME).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("message", e => { if(e.data && e.data.type==="SKIP_WAITING") self.skipWaiting(); });

function isHTML(req) {
  return req.mode === "navigate" || req.destination === "document" || (req.headers.get("accept")||"").includes("text/html");
}

self.addEventListener("fetch", e => {
  if(e.request.method !== "GET") return;
  if(!new URL(e.request.url).origin.includes(self.location.origin)) return;

  if(isHTML(e.request)){
    e.respondWith(
      fetch(e.request)
        .then(r => {
          if(!r || !r.ok) return r;
          const clone = r.clone();
          caches.open(CACHE_NAME).then(c => c.put(e.request, clone)).catch(() => {});
          return r;
        })
        .catch(() => caches.match(e.request).then(c => c || caches.match("./index.html")))
    );
    return;
  }

  e.respondWith(
    caches.match(e.request)
      .then(cached => {
        // Stale-While-Revalidate: sajikan cache instan, lalu refresh dari jaringan
        const network = fetch(e.request)
          .then(r => {
            if(r && r.ok){
              const clone = r.clone();
              caches.open(CACHE_NAME).then(c => c.put(e.request, clone)).catch(() => {});
            }
            return r;
          })
          .catch(() => cached);
        return cached || network;
      })
  );
});
