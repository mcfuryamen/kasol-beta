// DEV ONLY: auto-unregister service worker saat develop lokal, biar gak
// nabrak cache lama. Dijaga hostname supaya TIDAK jalan di produksi —
// di produksi SW harus tetap terpasang (janji offline-first PWA).
// Fix: cover semua local dev (localhost, 127.0.0.1, 192.168.x, 10.x, *.local, custom domains)
// Dipindah dari inline <script> index.html (2026-08-22): inline script diblokir
// CSP script-src 'self', jadi wajib file eksternal.
(function () {
  var isLocalDev = navigator.serviceWorker && (
    location.protocol === 'http:' && (
      location.hostname === 'localhost' ||
      location.hostname === '127.0.0.1' ||
      location.port === '5173' ||
      location.hostname.startsWith('192.168.') ||
      location.hostname.startsWith('10.') ||
      location.hostname.endsWith('.local') ||
      !location.hostname.includes('.') // custom dev domains tanpa TLD
    )
  );
  if (isLocalDev) {
    navigator.serviceWorker.getRegistrations().then(function (registrations) {
      for (let registration of registrations) {
        registration.unregister();
        console.log('[DEV] Service worker unregistered');
      }
    });
  }
})();
