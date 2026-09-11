/* =========================================================================
   KASIR SOLO - ROSOK
   Service Worker — SPA fallback + network-first untuk semua aset
   ========================================================================= */
const CACHE_VERSION = 'v70';
const CACHE_NAME = `kasir-solo-rosok-${CACHE_VERSION}`;
const CORE_ASSETS = [
  "./", "./index.html", "./style.css?v=70", "./dexie.min.js",
  "./js/supabase.min.js", "./js/supabase-config.js",
  "./js/app.js?v=70", "./js/confirm.js", "./js/db.js", "./js/app-state.js", "./js/utils.js",
  "./js/version.js", "./js/update.js",
  "./js/router.js", "./js/nav.js", "./js/pos.js", "./js/kategori.js",
  "./js/riwayat.js", "./js/laporan.js", "./js/kas.js",
  "./js/carousel.js", "./js/license.js", "./js/license.sync.js", "./js/onboard.js",
  "./js/region.js", "./assets/region/provinces.json",
  "./js/settings-x.js", "./js/app-link.js", "./js/printer.js", "./js/backup.js", "./js/purchase.js",
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

  // version.json TIDAK PERNAH di-cache: file ini adalah sinyal rilis —
  // menyajikan versi basi dari cache membuat overlay update tidak pernah
  // muncul (atau muncul palsu). Network murni; offline → reject → update.js
  // menelan diam (cek berikutnya saat online/foreground).
  if(new URL(e.request.url).pathname.endsWith("/js/version.json")){
    e.respondWith(fetch(e.request));
    return;
  }

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

  // JS/CSS/aset: NETWORK-FIRST (aman-dev). Offline → fallback cache.
  // Dulu stale-while-revalidate: tab sering menyajikan salinan lama sehingga
  // edit/fix baru "tidak muncul" dan bug parse menyamar sampai reload kedua.
  e.respondWith(
    fetch(e.request)
      .then(r => {
        if(r && r.ok){
          const clone = r.clone();
          caches.open(CACHE_NAME).then(c => c.put(e.request, clone)).catch(() => {});
        }
        return r;
      })
      .catch(() => caches.match(e.request).then(c => c || caches.match("./index.html")))
  );
});
