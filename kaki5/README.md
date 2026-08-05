# Kasir Solo — Kaki Lima Edition (kaki5)

> Aplikasi **kasir gratis untuk pedagang kaki lima (PKL)** — catat jualan, pantau pengeluaran, dan lihat untung tiap hari langsung dari HP.
>
> `kaki5` adalah salah satu aplikasi klien dalam **ekosistem kasirsolo POS** (monorepo `kasol`), berdampingan dengan `rosok`, `gerobak`, `landing`, dan `retail` (direncanakan).

---

## ✨ Ringkasan

Aplikasi ini adalah **Progressive Web App (PWA)** berarsitektur **single-page (SPA)** yang berjalan sepenuhnya di perangkat — tanpa server backend. Semua data tersimpan **lokal di HP** pengguna melalui **IndexedDB** (Dexie.js). Tersedia dukungan **offline** lewat Service Worker, **installable** ke layar utama HP, dan **cetak nota** via printer thermal Bluetooth.

| Aspek | Nilai |
|---|---|
| **Nama aplikasi** | Kasir Solo — Kaki Lima Edition |
| **Arsitektur** | SPA frontend-only (lokal), PWA offline |
| **Penyimpanan data** | IndexedDB via Dexie.js 3.2.4 (lokal di perangkat) |
| **Keranjang (cart)** | localStorage (persisten lintas buka-tutup aplikasi) |
| **Bahasa** | UI Bahasa Indonesia |
| **Target pengguna** | Pedagang kaki lima / warung kecil |
| **Deploy** | Static hosting (Vercel) via monorepo CI/CD |

---

## 📁 Struktur Proyek (ESM Modular)

Proyek ini **telah direfactor menjadi ES modules (ESM)** agar mudah dipelihara dan scalable. JavaScript dimuat sebagai modul di folder `js/`, bukan disematkan di `index.html`. **Dexie.js diload global** (sebelum ESM entry) agar tersedia sebagai `window.Dexie`.

```
kaki5/
├── index.html          ← Shell HTML (modal templates + ESM script type="module")  ≈ 23KB
├── IDEA.md             ← Catatan singkat: kaki5 klien ekosistem kasirsolo POS
├── dexie.min.js        ← Library Dexie 3.2.4 (global script, bukan modul)
├── sw.js               ← Service Worker v2 (pre-cache offline)
├── vercel.json         ← Konfigurasi Vercel (SPA rewrite + cache headers)
├── css/
│   └── style.css       ← Styling + skeleton loading + carousel styles      ≈ 26KB
├── assets/
│   └── icon.png        ← Logo aplikasi (600×600 PNG)
├── docs/
│   └── DEVELOPER.md     ← Panduan teknis untuk developer
└── js/                 ← 23 modul ESM
    ├── app.js          ── ENTRY POINT: inisialisasi app + wire window globals
    ├── app-state.js    ── State terpusat (cart, nav, report, carousel state + setters)
    ├── db.js           ── Dexie setup (v1 legacy, v2 settings, v3 platformMessages)
    ├── helpers.js      ── Pure utilities: escapeHtml, formatRp, todayStr, toast, loading
    ├── navigation.js   ── Router (showPage, bottom-nav, page switching)
    ├── beranda.js      ── Dashboard: omzet, pengeluaran, untung, carousel, recent trx
    ├── pos.js          ── POS: menu grid, search, filter, cart, payment
    ├── menu.js         ── Menu CRUD: tambah, edit, hapus, toggle aktif
    ├── pengeluaran.js  ── Expense tracking: catat, navigasi tanggal
    ├── laporan.js      ── Reports: harian/mingguan/bulanan + grafik + period nav
    ├── trxdetail.js    ── Transaction detail + print + delete
    ├── confirm.js      ── Reusable confirm dialog (hapus, clear all, dll)
    ├── settings.js     ── Settings page: profil (nama, owner, WA, alamat) + printer + backup
    ├── backup.js       ── Export/import data (JSON) + validasi ketat
    ├── onboarding.js   ── Welcome screen + sample menu + profil capture
    ├── license.js      ── Trial (7 hari) + share-to-extend (20x) + serial activation
    ├── carousel.js     ── Platform carousel: render, auto-scroll (4s), swipe, dots
    ├── printer.js      ── Bluetooth printer: connect, test print, disconnect
    ├── pwa.js          ── PWA: manifest dinamis + install prompt
    └── test_validate.js── Unit test: validateBackup() — jalankan: node test_validate.js
```

**Urutan load penting**:
1. `<script src="dexie.min.js">` (global, before ESM)
2. `<script type="module" src="js/app.js">` (ESM entry point)

Saat `app.js` dimuat:
- Impor semua modul (ESM handles dependency order otomatis)
- Wire semua fungsi ke `window.*` agar HTML onclick handlers bisa akses
- Run `DOMContentLoaded` listener: cek lisensi → boot aplikasi

---

## 🚀 Cara Menjalankan

### Mode pengembangan / uji lokal

Aplikasi ini **menolak dibuka lewat `file://`** (Service Worker & IndexedDB butuh konteks HTTP). Gunakan server statis sederhana:

```bash
cd kaki5
python -m http.server 8123 --bind 127.0.0.1
# buka → http://127.0.0.1:8123/
```

Cara lain (Node):

```bash
npx serve .
# atau
npx http-server -p 8123
```

### Deploy produksi

Deploy dilakukan lewat **monorepo kasol git** → **GitHub Actions** → **Vercel** (bukan auto-detect Vercel). Lihat bagian **Deploy & CI/CD** di bawah.

---

## 🗄️ Skema Database (IndexedDB / Dexie)

Didefinisikan di `js/db.js`. Semua data disimpan **lokal di perangkat** (IndexedDB, bukan server).

| Tabel | Skema (indeks dipisah koma) | Isi |
|---|---|---|
| **`menu`** | `++id, nama, kategori, hargaJual, hargaModal, aktif, urutan` | Daftar produk/menu |
| **`penjualan`** | `++id, tanggal, items, totalHarga, totalModal, bayar, kembalian, waktu` | Riwayat transaksi penjualan |
| **`pengeluaran`** | `++id, tanggal, keterangan, kategori, jumlah, waktu` | Catatan pengeluaran usaha |
| **`pengaturan`** | `key` | Pengaturan aplikasi (nama warung, dll.) |

Nama database: **`KasirSoloKakiLima`**.

> ⚠️ **Data lokal bukan cloud.** Karena tidak ada backend, data hanya hidup di perangkat tempat aplikasi dipasang. Gunakan fitur **Simpan Cadangan (export JSON)** untuk memindahkan/backup data (lihat bagian Backup).

---

## 🧩 Fitur Utama

### 1. 🏠 Beranda (Dashboard)
- **Carousel banner/promosi** (🆕) — ditampilkan di atas dashboard, auto-scroll, data dari tabel `platformMessages`.
- Ringkasan hari ini: **omzet**, **pengeluaran**, **keuntungan bersih**, **jumlah transaksi**, **porsi terjual**.
- Daftar **transaksi terakhir**.

### 2. 🛒 Jualan (POS)
- Grid menu dengan **pencarian** dan **filter kategori**.
- Keranjang floating → atur qty → preset button (🆕, numeric only, tanpa "Rp") → input uang diterima → hitung **kembalian otomatis** → **Simpan penjualan**.
- **Persist cart**: keranjang disimpan ke `localStorage` (`kaki5-cart`), sehingga tidak hilang saat aplikasi ditutup/dibuka ulang.
- **Cetak nota** setelah transaksi selesai.
- Bottom nav z-index di-upgrade ke 350 (di atas modal overlay 300) agar tetap klickable.

### 3. 🍽️ Menu
- CRUD menu: nama, kategori (Makanan/Minuman/Snack/Lainnya), harga jual, harga modal/bahan.
- Pencarian daftar menu.

### 4. 💸 Pengeluaran
- Catat pengeluaran per tanggal dengan kategori (Bahan Baku, Gas & BBM, Sewa Tempat, Peralatan, Lainnya).
- Navigasi tanggal, tampil total pengeluaran.

### 5. 📊 Laporan
- Tiga periode: **Harian / Mingguan / Bulanan**.
- Kartu statistik (omzet, pengeluaran, untung bersih) + **grafik batang**.
- **Navigasi periode yang benar** (aritmatika bulan, bukan sekadar +30 hari) — termasuk lintas tahun (Des → Jan).
- 🆕 **Loading skeleton + error boundary** (toast bila gagal).

### 6. ⚙️ Pengaturan (Profil)
Halaman pengaturan (sekarang bernama "📋 Profil") menampilkan kartu **"📋 Info Usaha"** dengan field:
- **Nama Usaha** (diperlukan saat onboarding, boleh diubah)
- **Nama Pemilik** (diperlukan saat onboarding, ditampilkan di kartu — akan didorong ke Supabase per unitId untuk CRM)
- **Nomor WhatsApp** (diperlukan saat onboarding, akan digunakan untuk kontak pelanggan/push notification)
- **Alamat** (diperlukan di form pengaturan, untuk cloud sync ke lapisan CRM)

Fitur lain:
- **Simpan cadangan (export JSON)** & **Pulihkan data (import JSON)** dengan **validasi struktur ketat**.
- **Hapus semua data** (dengan konfirmasi).
- **Printer Bluetooth** (hubungkan / cetak tes / putuskan).
- Info kontak developer + versi.

### 7. 📲 PWA & Offline
- Service Worker eksternal (`sw.js`) dengan **cache-first + fallback offline**.
- **Installable** ke layar utama HP (prompt "Pasang di HP").
- Ikon & manifest dihasilkan dinamis dari `assets/icon.png`.

### 8. 🖨️ Cetak Nota
- Dukungan **printer thermal Bluetooth** (mendukung `format` ESC/POS untuk lebar 58/80mm).
- Cetak nota langsung, dari detail transaksi, atau nota transaksi terakhir.

---

## 🔒 Keamanan (XSS Sanitization)

Karena banyak konten di-render dari input pengguna (nama menu, keterangan pengeluaran, nama warung), semua nilai dinamis **di-sanitasi** sebelum ditampilkan. Ini mencegah serangan **XSS (Cross-Site Scripting)**.

- `escapeHtml(s)` — escape `<`, `>`, `&`, `"`, `'`.
- `buildSafeHtml(strings, ...values)` — template tag; nilai otomatis di-escape, HTML mentah hanya lewat `{__raw:true}` untuk literal yang dipercaya (hard-coded).
- **13+ titik render** di seluruh modul sudah di-escape (beranda, POS, menu, cart, pengeluaran, laporan, detail transaksi, nota).

> Catatan internal: string berisi literal `&`/`<` harus ditulis dengan idiom concat (`'&'+'amp;'`) karena tool patch me-decode entity HTML.

---

## 💾 Backup & Pemulihan Data

- **Export**: `exportData()` membuat file JSON berisi `{ version, menu, penjualan, pengeluaran, pengaturan }`.
- **Import**: `importData(event)` membaca file → **`validateBackup(data)`** (fungsi murni, teruji) memvalidasi struktur ketat sebelum menimpa data → konfirmasi → pulihkan.
- Validasi mencakup: objek valid, `version` angka ≥ 1, `menu` harus array, dan record lain (jika ada) harus array berisi objek.
- **`test_validate.js`**: unit test (14 kasus) untuk `validateBackup` — jalankan dengan `node test_validate.js`.

---

## ⚙️ Cara Kerja Teknis & Arsitektur

### Application Flow

```
[index.html dimuat]
    ↓
[<script src="dexie.min.js">] ← Dexie global tersedia
    ↓
[<script type="module" src="js/app.js">] ← ESM entry point
    ↓
[app.js imports semua modul]
    ↓
[Wire semua fungsi ke window.* untuk HTML onclick handlers]
    ↓
[DOMContentLoaded event listener] ← app.js:169
    ├─ checkLicenseGate() ← License gate (trial/serial validation)
    ├─ boot() if status = 'active' or 'trial'
    │   ├─ ensureUnitId() ← Generate/retrieve device ID (cloud-ready)
    │   ├─ loadBeranda() ← Load dashboard
    │   ├─ checkOnboarding() ← Show profil form if first run
    │   └─ setupPWA() ← Register Service Worker
    └─ Show licenseGate overlay if status != active/trial
```

### Module Dependency Graph (ESM)

```
app.js (ENTRY)
  ├── imports: navigation, beranda, carousel, pos, menu, pengeluaran, laporan, trxdetail, settings, confirm, backup, onboarding, printer, pwa, license
  │
  ├── db.js
  │   └── imports: helpers.js (showToast)
  │
  ├── app-state.js
  │   └── imports: helpers.js (todayStr)
  │
  ├── helpers.js (LEAF — no imports)
  │   exports: escapeHtml, formatRp, todayStr, formatDate, showToast, showLoading, getGreeting, dayName, etc.
  │
  ├── license.js
  │   ├── imports: db.js, helpers.js
  │   └── exports: getLicenseStatus, activateSerial, startTrial, ensureUnitId, checkLicenseGate, etc.
  │
  ├── onboarding.js
  │   ├── imports: db.js, helpers.js, license.js, beranda.js
  │   └── exports: checkOnboarding, finishOnboarding
  │
  ├── carousel.js
  │   ├── imports: db.js, app-state.js, helpers.js
  │   └── exports: renderPlatformCarousel, platGoTo, platNext, platPrev, etc.
  │
  ├── beranda.js
  │   ├── imports: db.js, helpers.js, carousel.js
  │   └── exports: loadBeranda
  │
  └── [other page modules: pos, menu, pengeluaran, laporan, etc.]
      └── import: db.js, helpers.js, app-state.js (as needed)
```

### ESM + Window Globals Bridge

Karena HTML inline handlers (`onclick="..."`) tidak bisa akses ESM module scope, `app.js` wires **semua public functions** ke `window.*`:

```js
// app.js: ~40-100 lines of wiring
window.showPage           = showPage;
window.renderPOSMenu      = renderPOSMenu;
window.addToCart          = addToCart;
// ... dst
window._ksr_platGoTo = (slideIdx) => { platGoTo(slideIdx); };
```

**Keuntungan**:
- ESM scope tetap private (mencegah name collision)
- HTML handlers bisa dipanggil (backward compatible)
- Mudah audit: semua public functions terdaftar di `app.js`

### Komponen Teknis

| Komponen | Teknologi | Keterangan |
|---|---|---|
| **UI** | HTML + CSS murni | Tanpa framework, mobile-first responsive |
| **State & rendering** | Vanilla JS (ESM modules) | Per-modul functions; state centralized di `app-state.js` |
| **Database lokal** | **Dexie.js 3.2.4** di atas IndexedDB | 4 tabel: menu, penjualan, pengeluaran, settings, platformMessages (v3) |
| **Persist sementara** | Web Storage API (`localStorage`) | Cart persisted ke kaki5-cart |
| **Offline/PWA** | Service Worker (`sw.js`) + manifest | Cache-first asset, network-first HTML |
| **Printer** | Web Bluetooth API | ESC/POS 58/80mm thermal |
| **License** | HMAC-SHA256 (offline) | Trial 7 hari + share-extend (20x) + serial (KK5 prefix) |
| **Cloud (future)** | Supabase (tahap 2) | Validasi lisensi + sync transaksi (roadmap) |

---

## ⚠️ Kendala & Hal yang Perlu Diketahui

1. **Data tersimpan lokal** — tidak ada sinkronisasi cloud; backup manual dianjurkan.
2. **Butuh konteks HTTPS/HTTP** — tidak berjalan via `file://` (SW & IndexedDB).
3. **Branding belum 100% konsisten** — muncul beberapa variasi: *"Kasir Solo - Kaki Lima"*, *"Kasir Solo Kaki Lima Edition"*, nama DB `KasirSoloKakiLima`. Bisa dirapikan bila diinginkan.
4. **Kontak developer di-hard-coded** di 3+ tempat (WhatsApp 0881-6566-935, kasirsolo.app, PT Mesin Kasir Solo) — perlu dipindah ke tabel `pengaturan` bila ingin dikelola dinamis.
5. **Printer Bluetooth** bergantung pada dukungan browser (Web Bluetooth; umumnya Chrome/Android).

---

## 🚦 Pengembangan & Kontribusi

Pola kerja yang dipakai dalam proyek ini (bisa jadi acuan):

- **Modular split via script line-range** (`_extract.js`/`_rebuild.js`) — bukan copy manual — untuk menjaga fidelitas saat memecah single-file. (Skrip sementara sudah dihapus setelah refactor.)
- **Verifikasi**: `node --check` per-file & gabungan; serve via `python -m http.server`; smoke test browser; **unit test** untuk logika murni (mis. `validateBackup`).
- Network error / tool quirk: pakai Node untuk download, `grep -n` sebagai fallback `search_files`, dan hindari string literal berisi `&`/`<` saat patch.

### Test
```bash
node test_validate.js        # unit test validasi backup (14 kasus)
```

### Catatan Ekosistem (monorepo kasol)
- `kaki5` hidup di repo root `kasol` bersama `rosok/`, `gerobak/`, `landing/`, dan `retail` (direncanakan).
- **Saat men-deploy, ingat**: file `.min.js` yang dibutuhkan aplikasi (mis. `dexie.min.js`) harus diberi pengecualian di root `.gitignore` (`!kaki5/dexie.min.js`), karena aturan global `*.min.js` akan meng-ignore-nya dan membuat app mati (Dexie undefined) setelah deploy.
- Deploy ke Vercel didorong oleh GitHub Actions dengan **path filter per-app**; bukan Vercel auto-detect.

---

## 📮 Dukungan / Kontak

- **WhatsApp:** 0881-6566-935
- **Website:** [kasirsolo.app](https://kasirsolo.app)
- **Pengembang:** PT Mesin Kasir Solo

---

*Dokumentasi ini disusun berdasarkan kondisi kode terkini proyek `kaki5` (struktur modular pasca-refactor P1–P3).*
