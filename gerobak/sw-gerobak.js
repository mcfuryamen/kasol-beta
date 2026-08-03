/* Kasir Solo - Gerobak — Service Worker
   Strategi: network-first untuk dokumen HTML (biar update langsung kepakai),
   cache-first untuk aset statis lain. Naikkan CACHE_VERSION setiap rilis. */
const CACHE_VERSION = "v2";
const CACHE_NAME = "kasirsolo-gerobak-" + CACHE_VERSION;
const CORE_ASSETS = ["./", "./index.html"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      try {
        const cache = await caches.open(CACHE_NAME);
        await cache.addAll(CORE_ASSETS);
      } catch (e) {
        console.error('[SW Install Error]', e);
      }
      self.skipWaiting();
    })()
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      try {
        const keys = await caches.keys();
        await Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)));
      } catch (e) {
        console.error('[SW Activate Error]', e);
      }
      self.clients.claim();
    })()
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting();
});

function isDocumentRequest(request) {
  return request.mode === "navigate" ||
    request.destination === "document" ||
    (request.headers.get("accept") || "").includes("text/html");
}

async function putInCache(request, response) {
  if (!response || !response.ok || response.type === "opaque") return;
  try {
    const cache = await caches.open(CACHE_NAME);
    await cache.put(request, response.clone());
  } catch (e) {
    console.error('[SW Cache.put failed]', e);
  }
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  if (new URL(request.url).origin !== self.location.origin) return;

  if (isDocumentRequest(request)) {
    // Network-first: HTML baru langsung dipakai, cache hanya untuk offline.
    event.respondWith(
      (async () => {
        try {
          const response = await fetch(request);
          await putInCache(request, response);
          return response;
        } catch (e) {
          const cached = await caches.match(request);
          return cached || (await caches.match("./index.html")) ||
            new Response("Offline", { status: 503 });
        }
      })()
    );
    return;
  }

  event.respondWith(
    (async () => {
      const cached = await caches.match(request);
      if (cached) return cached;
      try {
        const response = await fetch(request);
        await putInCache(request, response);
        return response;
      } catch (e) {
        return new Response("Offline", { status: 503 });
      }
    })()
  );
});
