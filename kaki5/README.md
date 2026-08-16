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
| **Logo aplikasi** | Orange gradient (logo baru, 1254x1254 PNG) |
| **Logo versi lama** | PT Mesin Kasir Solo (di kartu versi halaman Pengaturan) |
| **Deploy** | Static hosting (Vercel) via monorepo CI/CD |

---

## 📁 Struktur Proyek (Modular-Atomic 3-Layer)

Proyek ini **telah direfactor menjadi arsitektur modular-atomic** dengan pemisahan 3-layer (DATA, LOGIC, UI) untuk maintainability dan scalability. Setiap modul besar (POS, License, Settings) dipecah menjadi 3 file terpisah.

**Total: 35+ files** (naik dari 24 files monolitik)

```
kaki5/
├── index.html          ← Shell HTML (modular CSS + ESM lazy loading)
├── server.js           ← HTTP server dev port 8086 (no-cache)
├── dexie.min.js        ← Library Dexie 3.2.4
├── sw.js               ← Service Worker v35 (modular cache)
├── vercel.json         ← Konfigurasi Vercel
├── css/
│   ├── base.css        ← Variables, reset, typography
│   ├── components.css  ← Buttons, cards, forms, nav
│   ├── components-stat.css
│   ├── components-modal.css
│   ├── components-banner.css
│   ├── components-tabs.css
│   ├── components-license.css
│   ├── components-carousel.css
│   ├── components-menu.css
│   ├── components-cart.css
│   ├── components-trx.css
│   ├── components-report.css
│   └── components-settings.css
├── assets/
│   └── icon.png, icon-192.png, icon-512.png
├── docs/
│   └── DEVELOPER.md
└── js/
    ├── app.js          ← ENTRY POINT: lazy loading + window globals (305L)
    ├── app-state.js    ← Centralized state
    ├── navigation.js   ← URL hash router + History API
    ├── confirm.js      ← Confirmation dialog
    ├── helpers.pure.js ← Pure utilities (format, validate, debounce)
    ├── templates.js    ← Page templates + lifecycle hooks
    │
    ├── pos.js          ← POS coordinator
    │   ├── pos.logic.js ← Cart operations (pure)
    │   ├── pos.ui.js    ← Menu & cart rendering
    │   └── pos.sync.js  ← Save sale to DB
    │
    ├── license.js      ← License coordinator
    │   ├── license.logic.js ← HMAC validation
    │   ├── license.ui.js    ← License sheet rendering
    │   └── license.sync.js  ← Supabase activation
    │
    ├── settings.js     ← Settings coordinator
    │   ├── settings.logic.js ← Validation + calculations
    │   ├── settings.ui.js    ← Address & settings rendering
    │   └── settings.sync.js  ← Region data fetching
    │
    ├── beranda.js      ← Dashboard page
    ├── menu.js         ← Menu management (debounce search)
    ├── laporan.js      ← Reports
    ├── bantuan.js      ← Help & tutorial
    ├── pengeluaran.js  ← Expense tracking
    ├── printer.js      ← Bluetooth printer
    └── sync.js         ← Profile sync to Supabase
```

**UI/UX Changes (v5):**
- ✅ **Modular-Atomic 3-Layer**: POS, License, Settings dipecah jadi Logic + UI + Sync
- ✅ **CSS Modular**: 1 file → 13 files (base + 12 component files)
- ✅ **Lazy Loading**: Critical modules (POS, Beranda) pre-wire, others load on demand
- ✅ **Debounce Search**: POS dan Menu search di-debounce 300ms
- ✅ **Router System**: URL hash-based navigation dengan History API
- ✅ **Service Worker v35**: Modular cache dengan no-cache headers

**Arsitektur baru (v5):**
1. `<script src="dexie.min.js">` (global)
2. `<script type="module" src="js/app.js?v=58">` (ESM entry - lazy loading)

`app.js` melakukan:
- Pre-wire critical modules (pos, beranda)
- Lazy-wire page modules saat navigasi
- Wire window globals untuk HTML onclick
- Check license → boot aplikasi

---

## 🚀 Cara Menjalankan

### Mode pengembangan / uji lokal

Aplikasi ini **menolak dibuka lewat `file://`** (Service Worker & IndexedDB butuh konteks HTTP). Gunakan server statis sederhana:

```bash
cd kaki5
# PORT RESMI app ini = 8086 (lihat Port Registry: kasol/CONTEXT.md)
python -m http.server 8086 --bind 127.0.0.1
# buka → http://127.0.0.1:8086/
```

Cara lain (Node):

```bash
npx serve .
# atau
npx http-server -p 8086
```

### Deploy produksi

Deploy otomatis lewat **Vercel git integration (auto-detect)** dari monorepo `kasol` — project `kasir-kaki5` dengan root directory `kaki5/`. **GitHub Actions tidak dipakai lagi.** Lihat bagian **Catatan Ekosistem** di bawah.

---

## 🗄️ Skema Database (IndexedDB / Dexie)

Didefinisikan di `js/db.js`. Semua data disimpan **lokal di perangkat** (IndexedDB, bukan server).

| Tabel | Skema (indeks dipisah koma) | Isi |
|---|---|---|
| **`menu`** | `++id, nama, kategori, hargaJual, hargaModal, aktif, urutan` | Daftar produk/menu |
| **`penjualan`** | `++id, tanggal, items, totalHarga, totalModal, bayar, kembalian, waktu` | Riwayat transaksi penjualan |
| **`pengeluaran`** | `++id, tanggal, keterangan, kategori, jumlah, waktu` | Catatan pengeluaran usaha |
| **`settings`** | `key` | Pengaturan utama (profil, lisensi, unitId) — akses via `getSetting`/`setSetting` |
| **`platformMessages`** | `++id, order, visibleFrom, visibleUntil` | Banner/promo carousel (v3) |
| **`pengaturan`** *(legacy)* | `key` | Dipertahankan di skema v1 untuk backward-compat; tidak lagi dibaca/tulis oleh kode |

Nama database: **`KasirSoloKakiLima`**.

> ⚠️ **Data lokal bukan cloud.** Karena tidak ada backend, data hanya hidup di perangkat tempat aplikasi dipasang. Gunakan fitur **Simpan Cadangan (export JSON)** untuk memindahkan/backup data (lihat bagian Backup).

---

## 🧩 Fitur Utama

### 1. 🏠 Beranda (Dashboard)
- **Carousel banner/promosi** (🆕) — ditampilkan di atas dashboard, auto-scroll, data dari tabel `platformMessages`.
- Ringkasan hari ini: **omzet**, **pengeluaran**, **keuntungan bersih**, **jumlah transaksi**, **porsi terjual**.
- Daftar **transaksi terakhir**.

### 2. 🍽️ Menu
- CRUD menu: nama, kategori (Makanan/Minuman/Snack/Lainnya), harga jual, harga modal/bahan.
- Pencarian daftar menu.
- Tombol **Tambah Menu** (FAB).

### 3. 🛒 Jualan (POS)
- Grid menu dengan **pencarian** dan **filter kategori**.
- Keranjang floating → atur qty → preset button (numeric only, tanpa "Rp") → input uang diterima → hitung **kembalian otomatis** → **Simpan penjualan**.
- **Persist cart**: keranjang disimpan ke `localStorage` (`kaki5-cart`), sehingga tidak hilang saat aplikasi ditutup/dibuka ulang.
- **Cetak nota** setelah transaksi selesai.

### 4. 📊 Laporan (+ Pengeluaran)
- **Integrasi Laporan & Pengeluaran**: Laporan sekarang include pengeluaran di satu halaman.
- Tiga periode: **Harian / Mingguan / Bulanan**.
- Kartu statistik (omzet, pengeluaran, untung bersih) + **grafik batang**.
- **Navigasi periode yang benar** (aritmatika bulan, bukan sekadar +30 hari) — termasuk lintas tahun (Des → Jan).
- **Loading skeleton + error boundary** (toast bila gagal).
- **Catat pengeluaran** langsung dari halaman laporan (navigasi tanggal, kategori dropdown).

### 5. ⚙️ Pengaturan (Profil)
Onboarding **2-langkah (smart gate)**: 
1. **Step 1** — Input Nama Usaha → tombol "Lanjutkan"
2. **Step 2** — Modal **Syarat & Ketentuan** (Batal/Setuju) → "Mulai Masa Percobaan"

Setelah masuk, bila profil belum lengkap muncul **banner "📝 Lengkapi profil usahamu"** di beranda dengan tombol menuju Pengaturan. Halaman pengaturan menampilkan kartu **"📋 Info Usaha"** dengan field:
- **Nama Usaha** (diisi saat onboarding, boleh diubah)
- **Nama Pemilik** (diisi di sini → didorong ke Supabase per unitId untuk CRM)
- **Nomor WhatsApp** (diisi di sini → untuk kontak/push)
- **Alamat** (region picker 4-level: Provinsi → Kota/Kab → Kecamatan → Desa/Kelurahan + detail — cloud sync ke lapisan CRM)
- Setiap perubahan profil otomatis **menyinkronkan ulang ke Supabase** (`js/sync.js`).

Fitur lain:
- **Simpan cadangan (export JSON)** & **Pulihkan data (import JSON)** dengan **validasi struktur ketat**.
- **Hapus semua data** (dengan konfirmasi).
- **Printer Bluetooth** (hubungkan / cetak tes / putuskan).
- Info kontak developer + versi.
- **🎫 Kelola Lisensi** — tombol akses license sheet (status, extend, activate).

### 6. ❓ Bantuan (Help & Tutorial)
- Panduan singkat cara memakai Kasir Solo - Kaki Lima.
- Tutorial untuk setiap fitur (onboarding, POS, laporan, printer, etc).
- Konten bantuan dirender dari modul `js/bantuan.js`.

### 7. 📲 PWA & Offline
- Service Worker eksternal (`sw.js`) dengan **cache-first + fallback offline**.
- **Installable** ke layar utama HP (prompt "Pasang di HP").
- Ikon & manifest dihasilkan dinamis dari `assets/icon.png`.

### 8. 🖨️ Cetak Nota
- Dukungan **printer thermal Bluetooth** (mendukung `format` ESC/POS untuk lebar 58/80mm).
- Cetak nota langsung, dari detail transaksi, atau nota transaksi terakhir.

### 9. ☁️ Sinkronisasi Profil (CRM → Admin)
- Mengirim **profil identitas outlet** (nama usaha, pemilik, WhatsApp, **wilayah**,
  device code) ke Supabase tabel `clients` → ditampilkan & dikelola di Admin (tab **Klien**).
- **Offline-first**: app tetap jalan tanpa internet; sync dicoba saat online.
- **Backfill otomatis**: user lama yang datanya cuma lokal ikut tersinkron di boot berikutnya.
- **Wilayah Indonesia** (Provinsi → Kota/Kab → Kecamatan → Desa) dari API **emsifa** (`js/region.js`).
- Keamanan: **Supabase Anonymous Auth + RLS** — tiap perangkat cuma bisa mengubah
  barisnya sendiri (profil antar-outlet terpisah).
- **Upsert ke 2 tabel**: `clients` (profil) + `leads` (CRM marketing, opsional).
- Modul: `js/sync.js`, `js/region.js`, `js/supabase-config.js`, `js/supabase.min.js` (self-host, agar offline-cache-able — lihat AUDIT-REPORT §12).

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

### Modular-Atomic 3-Layer Pattern

Setiap modul besar dipecah menjadi 3 layer terpisah:

```
┌─────────────────────────────────────────┐
│         COORDINATOR (*.js)               │
│  Menyatukan Logic + UI + Sync           │
├─────────────────────────────────────────┤
│  LOGIC (*.logic.js)  │  UI (*.ui.js)    │
│  Pure functions      │  DOM operations  │
│  Business logic      │  Rendering       │
│  Validation          │  Event handling  │
├─────────────────────────────────────────┤
│         DATA (*.data.js/sync.js)         │
│  Database ops, API calls, Sync          │
└─────────────────────────────────────────┘
```

**Keuntungan:**
- ✅ **Testable**: Logic pure bisa di-test tanpa DOM
- ✅ **Reusable**: UI components bisa dipakai di page lain
- ✅ **Maintainable**: Fix bug di satu layer tidak ganggu layer lain
- ✅ **Scalable**: Tambah fitur baru cukup tambahkan layer

### Application Flow (v5)

```
[index.html dimuat]
    ↓
[<script src="dexie.min.js">] ← Dexie global tersedia
    ↓
[<script type="module" src="js/app.js?v=58">] ← ESM entry point
    ↓
[app.js: Lazy load critical modules first]
    ├─ pos.js (PRE-WIRE)
    └─ beranda.js (PRE-WIRE)
    ↓
[app.js: Lazy load lainnya saat navigasi]
    ├─ menu.js
    ├─ laporan.js
    ├─ settings.js
    ├─ bantuan.js
    └─ pengeluaran.js
    ↓
[Wire semua window globals untuk HTML onclick]
    ↓
[init() → checkLicenseGate() → boot()]
    ├─ ensureUnitId()
    ├─ loadBeranda()
    ├─ checkOnboarding()
    └─ setupPWA()
```

### Navigation Router

```javascript
// URL-based routing dengan History API
const ROUTES = {
  '#beranda': { module: 'beranda', init: loadBeranda },
  '#jualan': { module: 'pos', init: loadPOS },
  '#menu': { module: 'menu', init: loadMenu },
  '#laporan': { module: 'laporan', init: loadLaporan },
  '#pengaturan': { module: 'settings', init: loadSettings },
  '#bantuan': { module: 'bantuan', init: loadBantuan }
};

// Lifecycle hooks
init()    → saat page pertama kali dibuka
cleanup() → saat pindah ke page lain
```

### Komponen Teknis

| Komponen | Teknologi | Keterangan |
|---|---|---|
| **UI** | HTML + CSS murni | Tanpa framework, mobile-first responsive |
| **State & rendering** | Vanilla JS (ESM modules) | Per-modul functions; state centralized di `app-state.js` |
| **Database lokal** | **Dexie.js 3.2.4** di atas IndexedDB | 5 tabel aktif: menu, penjualan, pengeluaran, settings, platformMessages (v3) + 1 legacy `pengaturan` |
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

## 🚀 Pengembangan & Kontribusi

### Refactor Roadmap (5 Fase) - SELESAI ✅

| Phase | Task | Status | Hours |
|-------|------|--------|-------|
| **Phase 1** | Extract Pure Helpers + Consolidate State | ✅ Done | 6h |
| **Phase 2** | Module Split (Settings, License, POS → 3-layer) | ✅ Done | 18h |
| **Phase 3** | Page Templates + Navigation Router | ✅ Done | 12h |
| **Phase 4** | CSS Architecture + Unit Tests | ✅ Done | 14h |
| **Phase 5** | Performance (Lazy Load + Debounce) | ✅ Done | 6h |
| **TOTAL** | | | **56h** |

### Test
```bash
# Unit test validasi backup
node test_validate.js

# Jalankan dev server
npx server.js
# atau
python -m http.server 8086
```

### Dev Server
- **Local**: http://localhost:8086/
- **LAN**: http://192.168.22.112:8086/
- No-cache headers untuk development

### Catatan Ekosistem (monorepo kasol)
- `kaki5` hidup di repo root `kasol` bersama `rosok/`, `gerobak/`, `landing/`, dan `retail` (direncanakan).
- **Saat men-deploy, ingat**: file `.min.js` yang dibutuhkan aplikasi (mis. `dexie.min.js`) harus diberi pengecualian di root `.gitignore` (`!kaki5/dexie.min.js`), karena aturan global `*.min.js` akan meng-ignore-nya dan membuat app mati (Dexie undefined) setelah deploy.
- `kaki5` di-deploy otomatis ke Vercel lewat **git integration (auto-detect)** — project `kasir-kaki5` dengan root directory `kaki5/`. **GitHub Actions tidak dipakai lagi** (semua workflow sudah dihapus).

---

## 📮 Dukungan / Kontak

- **WhatsApp:** 0881-6566-935
- **Website:** [kasirsolo.app](https://kasirsolo.app)
- **Pengembang:** PT Mesin Kasir Solo

---

*Dokumentasi ini disusun berdasarkan kondisi kode terkini proyek `kaki5` (struktur modular-atomic 3-layer pasca-refactor Phase 1-5).*

