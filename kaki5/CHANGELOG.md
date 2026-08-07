# Changelog — Kasir Solo Kaki Lima (kaki5)

Semua perubahan dicatat per tanggal, versi terbaru di atas.

## 2026-08-07 (Riwayat Transaksi di-Group per Hari & Tanggal)

Di halaman Laporan, daftar transaksi kini **dipisahkan/di-group per hari & tanggal**:
- Header per hari: `📅 {Hari}, {Tanggal}` + subtotal hari itu & jumlah transaksi.
- Transaksi di dalamnya diurutkan terbaru dulu (pakai jam `formatTime`).
- Kini tampil di **semua periode** (Harian / Mingguan / Bulanan) — sebelumnya cuma di Harian
  dan flat tanpa grup.
- Terverifikasi di browser: 3 transaksi lintas 3 tanggal → 3 grup (Rabu 5 Agu, Kamis 6 Agu, Jumat 7 Agu 2026) @ mingguan.
- SW cache `v20` → `v21`.

## 2026-08-07 (Fix Sync Profil — "sinkronisasi belum dikonfigurasi")

Akar masalah: `js/supabase-config.js` anon key masih **placeholder `'PASTE_ANON_KEY_DISINI'`**,
sehingga `sync.js` `getClient()` balik `null` → setiap simpan profil memunculkan notif
"sinkronisasi belum dikonfigurasi (isip anon key)".
- Embed **anon key asli** (publik, aman di browser) ke `supabase-config.js` (ganti placeholder).
- Rapikan komentar header (buang instruksi "tempel anon key" yang usang).
- Terverifikasi di browser: `anonPlaceholder:false`, `anonLen:208`, `supabaseLib:true`
  → sinkronisasi profil ke Supabase kini aktif.
- SW cache `v19` → `v20`.

## 2026-08-07 (Fix API Wilayah KO — notif "gagal memuat wilayah")

Akar masalah: endpoint lama `https://www.emsifa.com/api-wilayah-indonesia/api/...`
mengembalikan **404** (bukan karena internet), sehingga dropdown provinsi gagal →
notif "Gagal memuat wilayah (cek internet)".
- Ganti `js/region.js` ke raw GitHub `master/static/api` yang valid:
  - `provinces.json` (34 provinsi)
  - `regencies/{provId}.json` (kota/kab)
  - `districts/{kabId}.json` (kecamatan)
- Terverifikasi end-to-end (34 provinsi, kabupaten prov-11 = 23, kecamatan kab-1101 = 10).
- SW cache `v18` → `v19`.

## 2026-08-07 (Tutorial Disesuaikan dengan Kode Asli)

Semua isi tutorial **ditulis ulang berdasar kode aplikasi yang sebenarnya**
(dibaca dari `js/menu.js`, `pos.js`, `laporan.js`, `pengeluaran.js`, `printer.js`,
`backup.js`, `settings.js`, `sync.js`, `license.js`, `onboarding.js`), bukan perkiraan
visual. Isi sekarang 11 topik yang akurat dengan label & langkah nyata:
- 🚀 Memulai Pakai (onboarding 2-langkah + pengingat profil)
- 🍽️ Atur Menu (kategori dropdown Makanan/Minuman/Snack/Lainnya, harga jual/ modal, ✏️ ⏸️ 🗑️)
- 🛒 Catat Penjualan (keranjang, bilah hijau bayar, preset nominal, kembalian otomatis)
- 💸 Catat Pengeluaran (jenis: Bahan Baku/Gas & BBM/Sewa Tempat/Peralatan/Lainnya)
- 📊 Lihat Laporan (periode Harian/Mingguan/Bulanan, ringkasan, margin, menu laris)
- 🖨️ Cetak Struk (printer Bluetooth + fallback print browser)
- 💾 Simpan & Pulihkan Data (cadangan .json, pulihkan, hapus semua)
- 👤 Profil & Data Usaha (region picker provinsi/kab/kec)
- 📲 Pasang & Offline (PWA)
- 🎟️ Lisensi, Masa Coba & Aktivasi
- ❓ FAQ
- Perbaiki akurasi: onboarding = Nama Usaha → "Mulai Masa Percobaan" → "Setuju & Lanjut";
  kategori = dropdown tetap (bukan ketik bebas); tombol bayar = bilah hijau keranjang.
- SW cache `v17` → `v18`.

## 2026-08-07 (Halaman Tutorial/Bantuan Ditingkatkan)

- **Akordeon auto-tutup**: saat satu tutorial dibuka, tutorial lain otomatis tertutup
  (hanya satu panel terbuka — `toggleTutorial` sekarang menutup semua panel lain).
- **Materi lebih komprehensif**: tutorial bertambah dari 8 → 12 dengan 4 topik baru:
  📲 Pasang Aplikasi di Layar Utama & Mode Offline, 🎟️ Memahami Lisensi & Masa Coba,
  🏷️ Mengelompokkan Menu dengan Kategori, ❓ Pertanyaan yang Sering Diajukan (FAQ).
- SW cache `v16` → `v17`.

## 2026-08-07 (Halaman Pengaturan Dirapikan)

- **Hapus kartu "☁️ Sinkronisasi Profil"** (visual saja; fungsi tetap). Sinkronisasi
  tetap berjalan **otomatis di background** tiap profil diupdate (nama, pemilik,
  WhatsApp, alamat via `ensureSynced()`).
- **Kartu versi dikembalikan seperti semula**: hapus kartu "Masa Coba Gratis",
  field kode lisensi, tombol Beli Lisensi & tombol Aktifkan dari halaman pengaturan.
  Semua itu tetap diakses lewat tombol **"🎫 Kelola Lisensi"** (sheet status +
  perpanjangan + aktivasi).
- SW cache `v15` → `v16`.

## 2026-08-07 (Narasi Profil → Fokus Keuntungan User)

Narasi kartu profil dirombak jadi **benefit-driven & non-teknis** (buang kata "sinkron/statistik/akurat"):
- Judul: "Lengkapi Profil Tokomu".
- Sub: pengalaman makin nyaman, bantuan lebih cepat, info promo &amp; tips yang pas.
- Poin: 👤 nama & WhatsApp → bantuan lebih cepat; 📍 alamat toko → tips sesuai daerah.
- SW cache `v14` → `v15`.

## 2026-08-07 (Banner Profil → Kartu Besar di Tengah, Immersif)

Notifikasi "Lengkapi Profil" menjadi **kartu besar di tengah layar** (modal-like, immersif):
- `position:fixed` tengah (flex, `inset:0`, `z-index:520`) + **backdrop peredup blur** di belakang.
- Kartu lebar `max-width:420px`, radius 28px, gradient oranye, animasi pop.
- Konten: emoji besar, judul "Lengkapi Profil Toko Kamu", narasi + 2 poin manfaat
  (kontak/WhatsApp, alamat/wilayah), CTA "Isi Profil Sekarang" (ke Pengaturan),
  dismiss "Nanti Saja" + ✕ + klik backdrop. (poin "sinkronisasi" dihapus per permintaan)
- `checkProfileNotification` kini toggle class `.show`. CSS `.prof-banner-*`.
- SW cache `v12` → `v13`.

## 2026-08-07 (Onboarding 2-STEP: nama usaha → Syarat & Ketentuan)

Transisi gate onboarding lebih mulus buat user gaptek: **2 langkah, tanpa checkbox**.
- **STEP 1** (`gateOnboarding`): isi Nama Usaha → tombol "🚀 Mulai Masa Percobaan".
  Klik → validasi nama, simpan `namaWarung`, buka modal S&K. **Trial BELUM mulai.**
- **STEP 2** (modal `tcModal`): Syarat & Ketentuan + label "Terakhir diperbarui v1.1".
  - **🔙 Batal** → tutup modal, balik ke STEP 1 (nama tetap keisi).
  - **✓ Setuju & Lanjut** → `startTrial()` + masuk aplikasi.
- Checkbox S&K **DIHAPUS** (beserta handler `_ksr_tcClick`/`_ksr_lastTcClick`) — menghilangkan
  semua cacat logika checkbox sebelumnya. Handler baru: `_ksr_proceedToTC`, `_ksr_cancelTC`.
- **Terverifikasi end-to-end**: validasi nama kosong → error; Batal → balik step 1;
  Setuju → trial mulai + gate hilang.
- SW cache `v10` → `v11`.

## 2026-08-07 (Audit & Fix Bulletproof Checkbox S&K)

**Akar kacau**: handler `onclick` di `<input type="checkbox">` tidak andal dipicu klik
(terutama dengan label membungkus / event forwarding), dan klik kadang kena span
"Syarat & Ketentuan" → perilaku tidak deterministik ("perlu 2 klik" / "buka modal saat uncheck").
- **Fix**: pindahkan handler ke **row `<div onclick="window._ksr_tcClick(event)">`** yang pasti
  menerima klik; checkbox `pointer-events:none` (klik selalu kena row); span "Syarat &
  Ketentuan" `onclick="event.stopPropagation(); window._ksr_openTC()"` (buka modal saja,
  tidak ikut state checkbox).
- **Terverifikasi end-to-end (real event)**: unchecked→1 klik buka modal (box tetap unchecked,
  tombol disabled); accept→centang+enable; checked→1 klik uncheck+disable, tanpa modal.
- SW cache `v8` → `v9`.

## 2026-08-07 (Fix Double-Fire Checkbox S&K)

**Akar**: `<label for="tcCheckbox">` yang membungkus checkbox-nya sendiri memicu **double-fire klik** di Chrome → butuh 2 klik untuk buka modal; tetap buka modal saat mau uncheck.
- **Fix**: hapus `for` dari label (checkbox bisa klik langsung / via label tanpa double-fire).
- **Handler `_ksr_tcClick` dirombak jadi deterministik**: `preventDefault()` + `stopPropagation()` selalu, **manual toggle**, + **guard timestamp 250ms** (kolaps double-event). unchecked→1 klik buka modal; checked→1 klik uncheck + tombol disabled (tanpa modal).
- SW cache `v7` → `v8`.

## 2026-08-07 (Revisi Logika Klik Checkbox S&K)

Klik checkbox kini **kondisional** via `_ksr_tcClick(event)`:
- **Belum centang** → klik membuka modal Syarat & Ketentuan (box tetap unchecked, tombol disabled).
- **Sudah centang** → klik **langsung uncheck** (tanpa modal) + tombol "Mulai Masa Percobaan" kembali disabled.
- SW cache `v6` → `v7`.

## 2026-08-07 (Revisi Tombol Trial & Narasi)

- **Tombol "Mulai Masa Percobaan"**: saat `disabled` → abu-abu (`#d9d9d9`) + teks `#9c9c9c` +
  `pointer-events:none` (tidak bisa di-hover); saat checkbox S&K aktif → kembali hijau normal.
- **Narasi**: hapus kata "gratis" di meta `description` & narasi onboarding
  ("Aplikasi kasir buat pedagang kaki lima…").
- SW cache `v5` → `v6`.

## 2026-08-07 (Fix Modal S&K Tertutup Gate Onboarding)

### 🎭 Akar masalah: z-index (bukan checkbox)
Klik checkbox **sudah membuka modal S&K**, tapi modal (`.modal-overlay` z-index 200)
ter-render **DI BELAKANG gate onboarding `#licenseGate` (z-index 500)** yang menutup layar —
jadi modal tidak terlihat sama sekali.
- **Fix**: naikkan layering semua overlay di atas gate — `.modal-overlay` 200→**600**,
  `.confirm-overlay` 300→**610**, `.toast` 400→**620** (di `css/style.css`).
- **Terverifikasi**: setelah klik checkbox, modal display `flex` dengan z-index 600 > gate 500.

## 2026-08-07 (Fix Checkbox Syarat & Ketentuan)

### ☑️ Klik checkbox kini membuka modal Syarat & Ketentuan
- **Bug**: checkbox `tcCheckbox` ter-hardcode `disabled` → klik tidak merespon (perbaikan tahap 1).
- **Tahap 2**: klik checkbox kini **langsung membuka modal S&K** (`onclick="event.preventDefault();
  window._ksr_openTC()"`), TIDAK langsung nyentang. Baru setelah user klik "✓ Saya Setuju & Lanjut"
  → checkbox tercentang + tombol **"Mulai Masa Percobaan"** aktif.
- Tombol trial tetap **disabled** selama checkbox belum tercentang.
- **Terverifikasi** di browser (server 8086): klik checkbox → modal terbuka (box belum centang,
  tombol disabled) → setuju → box centang + tombol enable.

## 2026-08-07 (Smart Gate: Onboarding ↔ Trial Habis)

### 🚦 Gate cerdas (3 mode di satu overlay)
- **User baru** (`none`): onboarding (Nama Usaha + Syarat & Ketentuan → Mulai Masa Percobaan).
- **Trial jalan / lisensi aktif**: gate **di-skip**, langsung masuk aplikasi.
- **Trial habis / lisensi kedaluwarsa**: gate **berubah fungsi jadi input lisensi** —
  teks "Masa Coba Gratis Habis" + input kode + tombol **💬 Beli**, **🔓 Aktifkan**,
  dan **Perpanjang masa coba (+1 hari)** sebagai teks di bawah + counter `x/20`.
  Berhasil (aktifkan / perpanjang) → gate ditutup + app lanjut.

### 🛡️ Perbaikan double-overlay
- `checkLicenseGate()` kini **skip** `lockOverlay` saat gate full-screen tampil →
  tidak ada lagi dua layar numpuk saat trial habis + buka ulang app.
- Aktivasi/perpanjang dari gate kini **memanggil `boot()`** → user expired bisa masuk
  dengan bersih (sebelumnya tidak).

## 2026-08-07 (Onboarding Single-Step + Syarat & Ketentuan)

### 🔤 Onboarding
- Digabung jadi **satu langkah** di layar gate: input **Nama Usaha** + persetujuan
  **Syarat & Ketentuan** → tombol **"Mulai Masa Percobaan"** → langsung mulai trial.
- **Hapus** step-2 onboarding (overlay terpisah) dan **hapus field & tombol aksi**
  lisensi dari layar onboarding (aktivasi lisensi tetap ada di menu Lisensi / sheet).
- Tombol "Mulai Masa Percobaan" **aktif hanya setelah** user membaca & menyetujui
  S&K (checkbox dipicu lewat modal S&K).

### 📜 Modal Syarat & Ketentuan
- **Baru** `tcModal` — konten S&K (layanan, data profil/sinkronisasi, lisensi,
  penggunaan wajar, perubahan). Tombol **"Saya Setuju & Lanjut"** mengaktifkan checkbox + tombol trial.

### ⚙️
- Nama usaha yang sudah tersimpan otomatis terisi ulang saat gate tampil (mis. user yang masa cobanya habis).

## 2026-08-07 (Onboarding Ringkas + Notifikasi Lengkapi Profil)

### 🔤 Onboarding
- Kini **hanya isi Nama Usaha**; profil lengkap (pemilik, WhatsApp, alamat/wilayah) diisi belakangan di Pengaturan.

### 🔔 Notifikasi lengkapi profil
- **Banner** di halaman beranda muncul bila profil belum lengkap (pemilik / WA / alamat kosong), dengan tombol **"Isi Profil"** → menu Pengaturan.
- Banner otomatis hilang setelah profil lengkap.

### ⚙️ Alur Profil (arsitektur baru)
- Setiap perubahan profil (nama usaha, pemilik, WhatsApp, alamat + wilayah) otomatis **menyinkronkan ulang ke Supabase** (`sync.js`).

## 2026-08-07 (Sinkronisasi Profil Klien → CRM Admin)

### ☁️ Sinkronisasi CRM
- **Baru**: `js/sync.js` — push profil identitas outlet ke Supabase tabel `clients`
  (nama usaha, pemilik, WhatsApp, **wilayah**, device code) via **Anonymous Auth**
  (supabase-js v2; anon auth **diaktifkan** di project).
- **Offline-first**: app tetap jalan tanpa internet; sync dicoba saat online
  (flag lokal `sync` = `none`/`pending`/`synced`).
- **Backfill otomatis** untuk user lama (data cuma lokal) di boot berikutnya.
- `js/supabase-config.js` — config URL + anon key (anon = public, aman); sudah terisi.

### 🗺️ Wilayah Indonesia
- **Baru**: `js/region.js` — region picker Provinsi → Kota/Kab → Kecamatan dari API
  **emsifa** (dengan cache). Masuk di onboarding & form Alamat.
- Setting baru: `provinsiId/provinsi`, `kabkotaId/kabkota`, `kecamatanId/kecamatan`.

### ⚙️ UI
- Kartu **☁️ Sinkronisasi Profil** + tombol **Sinkron Sekarang** di halaman Pengaturan.

## [Unreleased] — 2026-08

### ✨ UI / Navigasi
- **Pengeluaran** dipindahkan ke modul **Laporan** (rincian pengeluaran tampil di ringkasan laporan).
- Menu **Pengaturan** dipindah ke **bottom navigation** agar lebih mudah diakses.

### 📲 PWA / Installability
- **Manifest statis** (`manifest.json`) — browser menolak manifest dari `blob:` URL untuk installability; dijaga sebagai file statis + ikon 192/512 + `<link rel="manifest">` + SW precache.
- Cache Service Worker dibump (cache name `kasir-solo-kaki5-v*`) saat SW diubah.
- `dexie.min.js` diberi pengecualian di root `.gitignore` (`!kaki5/dexie.min.js`) — kalau tidak, file tidak ter-deploy dan app mati (`Dexie is not defined`).

### 🚀 Deploy
- **GitHub Actions tidak dipakai lagi** (semua `.github/workflows/*` dihapus). Deploy via **Vercel git integration (auto-detect)** — project `kasir-kaki5`, Root Directory `kaki5/`.

---

## 2026-08-05 (Onboarding Awal)
- Setup PWA penuh: manifest statis, ikon, service worker, offline-first (Dexie/IndexedDB).
- Sistem lisensi offline (HMAC-SHA256) + onboarding (nama warung, pemilik, WhatsApp, unitId `K5-XXXX`).
- Carousel/banner platform di halaman beranda.
