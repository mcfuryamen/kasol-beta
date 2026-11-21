// Kasir Solo - Masjid — Service Worker v1.5.8
// Network-first (selalu coba versi terbaru), cache sebagai cadangan offline.
// Versi baru menunggu sampai pengguna menekan OKE pada dialog "Ada Versi Baru".
// v1.5.8: sinkron data ke awan (modul Sync di app.js) — offline-first tetap:
//         data disimpan di perangkat dulu, pengiriman menunggu sinyal.
// v1.5.6: siapan gate fitur berlisensi (CFG.proFeatures, masih kosong) + cek
//         kedaluwarsa lisensi (mendukung skema langganan); badge 🔒 pada menu terkunci.
// v1.5.5: tombol akun header menampilkan foto profil saja; baris akun di
//         Pengaturan membuka app Mitra (kelola data diri, foto, lisensi).
// v1.5.4: tombol akun aktif di header (nama + WA akun yang login) menggantikan
//         chip kuota; modal "Akun Saya" berisi status lisensi + keluar akun.
// v1.5.3: modul zakat fitrah di tab Zakat (pengumpulan + salur, terpisah dari kas),
//         7 sub-jenis zakat mal + panduan nisab/kadar di form kas.
// v1.5.2: Beranda — baris Hari Ini, hitung mundur kegiatan, ringkasan pinjaman,
//         pengingat backup, Menu Cepat 8 tombol, sub-angka kartu, grafik 7 hari.
// v1.5.1: logo.png (logo utama Kasir Solo) ikut di pra-cache — dipakai di layar masuk.
// v1.4.2: admin diserve di /adm/ pada project yang sama dengan website (scope /adm/).
// v1.4.3: branding logo icon.svg (kubah) di semua titik brand; ikon baru masuk cache.
// v1.4.4: modul inventaris — pencatatan pinjam barang (DB.pinjam) + riwayat.
// v1.4.10: tombol hapus/simpan form barang keluar jadi ikon bulat 46px.
// v1.4.9: overlay 'Ada Versi Baru' mengikuti kaki5 (kartu putih + daftar perubahan).
// v1.4.8: catatan barang keluar yang sudah kembali terkunci (tidak bisa diedit).
// v1.4.7: barang keluar Inventaris punya alasan (dipinjam/laundry/diperbaiki/dibawa acara).
// v1.4.6: ikon daftar kas dibedakan (kantong uang = masuk, nota = keluar).
// v1.4.5: jadwal kegiatan bisa diulang (tiap hari/minggu/bulan/tahun) + auto-selesai + website 8 jadwal terdekat.
// v1.5.7: index.html dipecah jadi app.css + app.js (file HTML turun 418 KB → 28 KB).
//         sekaligus perbaikan aksesibilitas P1 (elemen interaktif jadi <button>,
//         role=tab/aria-selected, aria-live pada toast) + P2/P3 (OG/canonical,
//         CSP & header keamanan, pelacak error global).
const CACHE_NAME = 'kasirsolo-masjid-v1.5.9';
const ASSETS = ['./', 'index.html', 'app.css', 'app.js', 'manifest.webmanifest', 'icon.svg', 'icon-192.png', 'icon-512.png', 'logo.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((c) => c.addAll(ASSETS)).catch(() => {}));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith('kasirsolo-masjid-') && k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  event.respondWith(
    fetch(req).then((res) => {
      if (res && res.ok) { const copy = res.clone(); caches.open(CACHE_NAME).then((c) => c.put(req, copy)); }
      return res;
    }).catch(() => caches.match(req).then((hit) => hit || (req.mode === 'navigate' ? caches.match('index.html') : undefined)))
  );
});
