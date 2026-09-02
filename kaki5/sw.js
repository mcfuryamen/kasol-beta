// Service Worker for Kasir Solo - Kaki Lima
// Strategi: API calls → network-only, HTML → cache-first (offline navigable),
// static assets → network-first dengan fallback cache.
// Cache version v151 — ubah angka INI juga setiap swap (harus sama dengan
// CACHE_NAME di bawah; baris ini tertinggal di v119 selama belasan rilis
// dan bikin salah baca seolah CACHE_NAME tidak di-bump).
// v151: polish UI dari komentar browser — baris "Cek Data Online" pindah ke
//       kartu Perangkat di Pengaturan; bar kuota lisensi jadi oranye brand
//       (hapus override hijau inline); modal Pesanan Ditahan dapat kotak
//       PENCARIAN live (catatan/nomor/menu/tipe); tombol "Buka" dihapus —
//       seluruh kartu held yang diklik untuk membuka pesanan; tombol hapus
//       held jadi lingkaran outline merah; tombol Tahan ditambah di header
//       modal keranjang (kiri tombol kosongkan, aksi hold-cart, modal
//       keranjang ditutup dulu); label "Simpan"/"Simpan & Cetak" jadi
//       "Bayar"/"Bayar & Cetak"; default bayar Tunai utk dine-in/take-away
//       (QRIS otomatis hanya ojol); resume held menampilkan catatan yang
//       sudah diinput (orderNote || heldName); konfirmasi buka held saat
//       cart terisi kini mengingatkan SIMPAN/TAHAN dulu.
// v150: PENOMORAN TRANSAKSI — tiap transaksi (penjualan/held=TRX, pemasukan=MSK,
//       pengeluaran=BLJ) dapat nomor PREFIX-YYYYMMDD-NNN, urut harian, dihitung
//       dari data tersimpan (modul baru nomor.js). Tampil di nota (thermal &
//       browser), daftar Riwayat Laporan, detail transaksi/pengeluaran, & daftar
//       held. Backfill sekali-jalan untuk transaksi lama saat boot.
// v149: fitur "Tahan" (hold order) — tombol 🤚 Tahan dipisah KELUAR dari
//       kontainer hijau cart bar, jadi tombol berdiri sendiri di SEBELAH KIRI,
//       sejajar vertikal dengan keranjang (permintaan komentar browser). Kontainer
//       hijau (.cart-bar-inner) tetap tombol buka keranjang. Resume held kembali
//       ke halaman Jualan (bukan langsung buka keranjang). DB v6 status='held'.
// v146: laporan konsinyasi — saldo & status Lunas dihitung sejak awal (tidak
//       lagi berubah saat filter tanggal digeser, dulu suplayer bertagihan bisa
//       tampil "Lunas" di hari tanpa penjualan); tipe pesanan Ojol otomatis
//       memilih metode bayar QRIS; harga satuan pindah ke baris nama menu di
//       modal pilih menu; ✕ batal keranjang jadi lingkaran merah; tombol
//       "＋ Tambah baris"/"＋ Tambah Topping" jadi outline putus-putus hijau.
// v145: fix cetak nota saat popup diblokir (fallback iframe tersembunyi,
//       sebelumnya TypeError null di printer.js:436 pada perangkat beta) +
//       lepas fokus sebelum overlay aria-hidden (warning Chromium hilang).
// v143: keranjang — catatan global vs catatan per menu, harga satuan di kiri
//       tombol minus, label tipe + app ojol dibesarkan, tombol +/− lingkaran,
//       metode bayar QRIS & Transfer.
// v142: fix UI jualan (search center, ojol picker seragam) + blokir produk habis.
// v103: panel accordion menu in-flow (bukan melayang).
// v102: fix arah sinkron lisensi/profil (cloud = sumber kebenaran; cabang
// 'belum' + push otomatis backfill-only).
// v101: re-align cache version dengan version.json (insiden v100: sw.js bump
// sendiri tanpa version files → overlay update mati & cache HTML tak valid).
// v72: konsolidasi P2 — css/style.css jadi satu-satunya stylesheet (13 file
// css/ modular dilebur; rule uniknya sudah dipindah ke style.css).

const CACHE_NAME = 'kasir-solo-kaki5-v151';
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
            caches.open(CACHE_NAME).then(cache => cache.put(request, clone)).catch(() => {});
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
          // (mis. chrome-extension:// dari plugin browser) — tangkap rejection
          // agar tidak terjadi "Uncaught (in promise)" di console.
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, clone)).catch(() => {});
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
