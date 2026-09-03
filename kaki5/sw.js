// Service Worker for Kasir Solo - Kaki Lima
// Strategi: API calls → network-only, HTML → cache-first (offline navigable),
// static assets → network-first dengan fallback cache.
// Cache version v166 — ubah angka INI juga setiap swap (harus sama dengan
// CACHE_NAME di bawah; baris ini tertinggal di v119 selama belasan rilis
// dan bikin salah baca seolah CACHE_NAME tidak di-bump).
// v165 (poin 6 + komentar browser #1-#7): form Catat Pengeluaran/Pemasukan kini
//       punya pemilih TANGGAL dan bisa MENGUBAH catatan lama. `waktu` (ms) ikut
//       tanggal yang dipilih, bukan waktu klik — kalau tidak, catatan "kemarin"
//       ikut menggeser laci shift hari ini (dataShift menyaring lewat `waktu`).
//       Nomor BLJ/MSK dihitung ulang hanya saat tanggalnya pindah hari.
//       Label metode diganti jadi "Ambil dari?" / "Masuk ke?", teks isian modal
//       diturunkan ke 16px, dan kartu "Tutup Buku Tahunan" dipindah ke paling
//       bawah Laporan (bloknya dipecah: kasReportBlocksHtml + kasTutupBukuBlockHtml).
// v164: SATU JALUR PENCATATAN UANG (permintaan pemilik). Modal "Catat Kas
//       Manual" dihapus — tombol Catat Kas di Beranda kini membuka form
//       Pengeluaran/Pemasukan Laporan. Tiap catatan membawa metodeBayar
//       (tunai laci / QRIS / transfer) dan hanya tunai yang menggeser kas
//       sistem; kategori Modal Tambahan & Setor Bank / Prive dikecualikan dari
//       Laba lewat hitungLaba() yang kini dipakai Beranda, Laporan, dan tutup
//       buku bersama. IndexedDB naik ke version 8: baris tabel `kas` lama
//       dipindahkan ke `pengeluaran` saat upgrade (tabelnya dibiarkan sebagai
//       arsip kosong, tidak di-drop). Backup payload naik ke version 4.
// v163: REVISI modal "Versi Baru Tersedia" (permintaan pemilik, lihat gambar):
//       logo dihapus dari header, kalimat "Data jualanmu aman, tidak ada yang
//       hilang." pindah ke paragraf intro header, hint di bawah tombol OKE
//       dihapus (rule .update-hint & .update-logo ikut dibuang), dan
//       .update-body dapat min-height:0 supaya area catatan tetap bisa
//       menggulir walau daftarnya panjang — tanpa mendorong footer keluar
//       layar.
// v162: MODAL "Versi Baru Tersedia" dipecah jadi 3 zona (komentar browser #1-#7):
//       .update-head sticky di atas (logo, judul, badge versi, intro, label
//       "Yang baru"), .update-body satu-satunya bagian yang menggulir (daftar
//       catatan), .update-foot sticky di bawah (tombol OKE + hint). Sebelumnya
//       tombol OKE pakai position:sticky + shadow putih yang "menyamarkan" teks
//       catatan di belakangnya. Sekaligus menghapus case 'open-sync-diag' dobel
//       di app.js (yang kedua tidak pernah jalan karena switch berhenti di
//       match pertama).
// v161: ADOPSI FITUR KAS dari Kasir Solo Rosok — buka/tutup kas (shift laci),
//       catat kas manual, riwayat shift di Laporan, dan tutup buku tahunan.
//       Tiga tabel Dexie baru (kasShift, kas, tutupBuku) + gerbang transaksi:
//       penjualan ditolak selama kas belum dibuka. "Kas sistem" dihitung dari
//       data yang sudah ada (modal awal + penjualan tunai − pengeluaran
//       + pemasukan ± kas manual), bukan buku besar kas terpisah. Ketiga tabel
//       ikut backup/restore/reset (di rosok lupa dicadangkan).
//       Sekaligus memperbaiki daftar precache: ./js/onboarding.js (file tidak
//       ada → membuat cache.addAll() gagal total) diganti ./js/modal.js,
//       ./js/nomor.js, ./js/app-link.js yang selama ini tidak ikut diprecache.
// v160: AUDIT FITUR PEMASUKAN + grafik harian per jam.
//       (1) Beranda memisahkan baris jenis:'pemasukan' dari total pengeluaran;
//           Laba Hari Ini = omzet - modal - pengeluaran + pemasukan, sama seperti
//           Laporan (dulu mencatat pemasukan justru MEMOTONG laba Beranda). Ada
//           hint "+ pemasukan lain Rp X" di kartu Laba saat nilainya di atas 0.
//       (2) Kartu "💰 Rincian Pemasukan" baru di Laporan (akordeon per kategori,
//           reuse toggleExpenseCat) — sebelumnya pemasukan cuma jadi satu angka
//           statistik tanpa daftar, sehingga salah catat tak bisa dikoreksi.
//       (3) Modal detail catatan jadi jenis-sadar (judul/emoji/warna/tanda +-)
//           dan dapat tombol 🗑️ Hapus (data-action="delete-expense", id dari
//           data-id baris) untuk pengeluaran & pemasukan.
//       (4) Periode Harian kini punya "📊 Grafik Harian · Per Jam" (omzet vs
//           pengeluaran per jam dari field waktu; sumbu X dipangkas ke rentang
//           jam aktif, digeser mendatar bila lebar) mengisi slot yang dulu kosong.
//       (5) Bar kuota transaksi gratis: isi hijau di atas track oranye
//           (komentar browser #1 & #2; sebelumnya oranye brand di atas krem).
// v159: nota cetak TIDAK lagi melampirkan foto bukti pembayaran QRIS/Transfer
//       (permintaan pemilik). Foto tetap tersimpan di record penjualan dan tetap
//       tampil di halaman detail transaksi; jalur printer thermal memang teks
//       saja jadi tidak pernah menyertakan foto.
// v158: FIX harga per tipe pesanan — Dine-in & Take-away SELALU pakai harga
//       jual, Ojol SELALU pakai harga ojol. Tipe pesanan aktif jadi satu-satunya
//       sumber kebenaran: item yang masuk saat mode Ojol tidak lagi terbawa
//       harga ojol ke pesanan Dine-in (cart bar, total keranjang, & total
//       tersimpan), pesanan ojol hasil buka-tahan tidak lagi dihitung dengan
//       harga jual, dan detail transaksi ojol menampilkan harga ojol per baris.
// v157: gelombang komentar keenam — kartu held: baris catatan ganda DIHAPUS
//       (judul sudah memuatnya) & total sejajar vertikal tombol hapus; dialog
//       cetak nota: "Batal" → "Tidak" (cancelText per-dialog di showConfirm);
//       riwayat laporan: isi catatan pindah ke baris sendiri.
// v156: FIX laporan — row status 'held' (pesanan ditahan) tidak lagi ikut
//       terhitung sebagai penjualan di Laporan (omzet/transaksi/porsi/riwayat/
//       titipan), ringkasan Beranda, daftar transaksi terakhir, dan retur
//       konsinyasi.
// v155: modal input catatan "Tahan" DIHAPUS — tombol Tahan di footer keranjang
//       auto size & langsung menyimpan pesanan ditahan memakai catatan yang
//       sudah terisi (kosong → toast peringatan); "Bayar" mengisi sisa lebar
//       sehingga lebih panjang dari "Tahan".
// v154: MODEL BARU pesanan ditahan — buka held TIDAK menghapus row-nya; pindah
//       antar held = ganti cart OTOMATIS (peringatan hanya utk cart manual);
//       bayar memakai nomor TRX asli (payHeldSync); tahan ulang = perbarui row
//       yang sama (updateHeldSync). Tombol tutup daftar held jadi "Kembali"
//       oranye.
// v153: gelombang komentar browser ketiga — tombol "Tahan" di cart bar bawah
//       DIHAPUS (aksi tahan cukup dari footer modal keranjang sejak v152);
//       #cartBar wrapper tetap, .cart-bar-inner flex:1 sehingga keranjang
//       kembali melebar penuh.
// v152: gelombang komentar browser kedua — footer modal keranjang dirombak:
//       tombol utama jadi "Tahan" (aksi hold-cart; tombol Tahan header
//       v151 dihapus karena rangkap) dan "Bayar" menyimpan transaksi lalu
//       MENANYAKAN cetak nota atau tidak (tidak → selesai & kembali ke
//       katalog; ya → flow printLastNota). Klik kartu Pesanan Ditahan
//       membuka modal keranjang berisi produk pesanan (sudah ada v151,
//       diverifikasi ulang).
// v151: polish UI — "Cek Data Online" ke kartu Perangkat; bar kuota oranye;
//       pencarian live + kartu clickable + hapus lingkaran merah di Pesanan
//       Ditahan; default bayar Tunai (QRIS hanya ojol); resume bawa catatan;
//       warning simpan-dulu saat ganti pesanan.
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

const CACHE_NAME = 'kasir-solo-kaki5-v166';
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
  './js/modal.js',
  './js/nomor.js',
  './js/app-link.js',
  './js/kas.js',
  './js/kas.logic.js',
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
