# Developer Guide — kaki5 (Kasir Solo Kaki Lima)

Panduan teknis untuk pengembang yang ingin memahami, memodifikasi, atau meneruskan pengembangan aplikasi `kaki5`. Baca `README.md` untuk gambaran umum & cara pakai.

---

## 1. Arsitektur

### Model aplikasi
- **SPA frontend-only** — satu `index.html`, perpindahan halaman via JavaScript (tanpa reload).
- **Data 100% lokal** di IndexedDB; tidak ada backend/API.
- **PWA**: Service Worker untuk offline + manifest untuk "installable".

### Alur startup (`js/app.js`) — Updated
Aplikasi memakai **ES modules** (`<script type="module" src="js/app.js">`). Alur:
1. License gate dicek dulu — app diblokir sampai trial dimulai (mulai masa percobaan) atau serial valid diaktifkan.
2. Setelah lolos → `boot()`: `ensureUnitId()` → `loadBeranda()` (dashboard) → `checkOnboarding()` (tampilkan onboarding jika baru) → `setupPWA()` (manifest + SW + install banner).
3. `app.js` adalah satu-satunya jembatan yang me-*re-expose* fungsi ESM ke `window` agar bisa dipanggil dari `onclick`/`oninput` inline HTML (karena module scope bersifat privat).
4. `setInterval(checkLicenseGate, 60000)` mengecek ulang lisensi tiap 60 detik (kunci app saat trial habis).

> **UI/UX Update (v4)**: Header gear icon ⚙️ dihapus; `pengaturan` dipindah ke bottom nav. Tombol bantuan baru di halaman (bantuan.js). Header hanya menampilkan **logo + nama** + **trial chip** (left), fokus ke bottom nav untuk navigasi utama.

### Navigasi (`js/navigation.js`) — Updated
`showPage(page)` menukar kelas `.active` pada elemen `.page` dan memanggil loader per halaman:

| Halaman | Loader | Deskripsi |
|---|---|---|
| `beranda` | `loadBeranda()` | Dashboard: omzet, pengeluaran, laba, carousel |
| `menu` | `renderMenuList()` | Kelola menu (CRUD) |
| `jualan` | `loadPOS()` | POS / Kasir: grid menu, cart, payment |
| `laporan` | `loadReport()` + `loadExpenses()` | **Laporan + Pengeluaran** (integrated satu halaman) |
| `pengaturan` | `loadSettings()` | Pengaturan: profil, printer, backup, lisensi |
| `bantuan` | `initBantuan()` | Bantuan & Tutorial (🆕) |

> **Perubahan v4**: `pengeluaran` halaman dihapus; fitur catat pengeluaran sekarang **integrated di halaman Laporan**. Bottom nav hanya 5 tab sekarang (sebelumnya 6).

### State global (`js/app-state.js`)
State global dikumpulkan di satu file terpusat (ditambah setter untuk tiap variabel agar mudah di-track — ke depan bisa di-upgrade ke reactive store):

```js
let cart = {};
let currentPage = 'beranda';
let posCat = 'Semua';
let expDate = todayStr();
let reportPeriod = 'harian';
let reportDate = todayStr();
let selectedTrxId = null;
let lastSaleId = null;
// Carousel state
let platCurrentSlide = 0;
let platAutoTimer = null;
const PLAT_SCROLL_MS = 4000;
```

> Karena modul adalah **ES modules**, modul scope bersifat privat — state tidak lagi menjadi global `window`; setiap modul me-import state via setter/getter dari `app-state.js`. **Penting:** `app.js` bertanggung jawab me-*re-expose* fungsi ESM ke `window` untuk handler HTML inline.

---

## 2. Database (Dexie/IndexedDB)

Didefinisikan di `js/db.js`:

```js
const db = new Dexie('KasirSoloKakiLima');

db.version(1).stores({
  menu:        '++id, nama, kategori, hargaJual, hargaModal, aktif, urutan',
  penjualan:   '++id, tanggal, items, totalHarga, totalModal, bayar, kembalian, waktu',
  pengeluaran: '++id, tanggal, keterangan, kategori, jumlah, waktu',
  pengaturan:  'key'
});
// v2: + settings (Lapis-1 global: lisensi, identitas, unitId)
// v3: + platformMessages (carousel/banner)
db.version(3).stores({
  menu:              '++id, nama, kategori, hargaJual, hargaModal, aktif, urutan',
  penjualan:         '++id, tanggal, items, totalHarga, totalModal, bayar, kembalian, waktu',
  pengeluaran:       '++id, tanggal, keterangan, kategori, jumlah, waktu',
  pengaturan:        'key',
  settings:          'key',                             // 🆕 Lapis-1 global schema
  platformMessages:  '++id, order, visibleFrom, visibleUntil'  // 🆕 carousel/banner
});
```

- `++id` = auto-increment primary key.
- Kolom setelah koma = **indeks** (bisa di-`where()`/`orderBy`).
- **`tanggal`** disimpan sebagai string `YYYY-MM-DD` (lihat `todayStr()` di `helpers.js`) — konsisten untuk query rentang dengan `db.penjualan.where('tanggal').between(a,b)`.

### Tabel Baru (v3): `platformMessages`
Menyimpan data carousel/banner platform yang ditampilkan di beranda:
```js
{
  id: 1,                    // auto-increment
  order: 0,                 // urutan tampil (ASC)
  title: 'Flash Sale',      // judul banner
  body: 'Potongan harga hari ini',  // deskripsi
  emoji: '📢',              // emoji/ikon opsional
  gradient: 'linear-gradient(...)',   // warna latar opsional
  visibleFrom: '2026-08-05T00:00:00.000Z',  // indeks — filter mulai tampil
  visibleUntil: null        // indeks — null = selalu tampil
}
```
Render dipanggil dari `beranda.js`; jika tabel kosong, dipakai 3 banner demo (`demo1–3`) agar carousel tetap tampil.

### Tabel `settings` — Key-Value (utama) & `pengaturan` (legacy)
Kunci disimpan di **`settings`** tabel (`{ key, value }`, diakses via `getSetting`/`setSetting` di `db.js`):
```js
{
  key: 'namaWarung',      value: 'Warung Maju'
  key: 'namaPemilik',     value: 'Ibu Siti'       // 🆕 Wajib saat onboarding
  key: 'noWhatsapp',      value: '081234567890'   // 🆕 Wajib saat onboarding
  key: 'alamat',          value: 'Jl. Merdeka 1'  // 🆕 Wajib saat onboarding (form pengaturan)
  key: 'unitId',          value: 'K5-0001'        // 🆕 Format untuk cloud sync (roadmap)
  key: 'setupDone',       value: true
  key: 'licenseActivatedAt', value: '2026-08-05T12:00:00Z'
  key: 'deviceCode',      value: 'DEV-XXXX-YYYY'
  key: 'license', ...     // data lisensi
}
```
> Tabel `pengaturan` (legacy, didefinisikan sejak skema v1) masih ada di skema Dexie untuk **backward-compat**, tapi tidak lagi dibaca/tulis oleh kode mana pun (fungsi `getPengaturan`/`setPengaturan` sudah dihapus). Kode baru memakai tabel `settings`.

### Pustaka
- `dexie.min.js` (3.2.4) dimuat **lokal** dari proyek (bukan CDN) agar offline — dideklarasikan di `index.html` **sebelum** `js/db.js`.

---

## 3. Modul Inti — Penjelasan Fungsi Penting

### `helpers.js`
| Fungsi | Fungsi |
|---|---|
| `escapeHtml(s)` | Sanitasi XSS (escape HTML special chars) |
| `buildSafeHtml(strings, ...values)` | Template tag; escape otomatis, raw via `{__raw:true}` |
| `todayStr()` | Tanggal hari ini `YYYY-MM-DD` |
| `formatRp(n)` | Format `Rp 1.234` (locale id-ID) |
| `formatDate / formatTime` | Format tanggal/waktu untuk tampilan |
| `showToast(msg, type)` | Notifikasi toast bottom |
| `showLoading(id, n)` → `{done()}` | Skeleton loading |
| `withPageLoading(id, fn)` | Bungkus loader dgn skeleton + error boundary |
| `getWeekRange / getMonthRange` | Rentang minggu/bulan untuk laporan |

### `carousel.js` — Banner & Platform Messages (🆕)
Modul untuk menampilkan carousel/banner promosi di halaman beranda:
```js
async function renderPlatformCarousel()  // render carousel dinamis dari tabel platformMessages / fallback demo
function platSetSlide(i)                // pindah ke slide i + update dot aktif
function platNext() / platPrev()        // geser slide berikutnya/sebelumnya (swipe & auto)
function platGoTo(i)                    // lompat ke slide i (dipakai tombol dot) + reset auto
function platStartAuto() / platStopAuto() / platResetAuto()  // auto-scroll tiap PLAT_SCROLL_MS
```
- Data disimpan di tabel `platformMessages` (IndexedDB, v3 db.js). Jika kosong → 3 banner demo.
- State: `platCurrentSlide`, `platAutoTimer`, `PLAT_SCROLL_MS` (4000ms) di `app-state.js`.
- Styling: 11 CSS rules `.plat-carousel*` di `style.css`.
- Render: dipanggil dari `beranda.js` (selalu, sebelum blok transaksi kosong).
- Tombol dot di HTML memanggil `window._ksr_platGoTo(i)` yang di-wire di `app.js` → `platGoTo(i)`.

### `pos.js` — Jualan + Keranjang + Persist
Cart dipersist ke `localStorage` agar tahan tutup-buka app (`CART_KEY = 'kaki5-cart'`):

```js
const CART_KEY = 'kaki5-cart';
function saveCart()            { localStorage.setItem(CART_KEY, JSON.stringify(cart)); }
async function loadCart()      { /* parse + re-hydrate menu dari DB utk harga/nama terkini */ }
function clearCartStorage()    { localStorage.removeItem(CART_KEY); }
```

Titik panggil:
- `loadCart()` di awal `loadPOS()` (**di-await** — penting agar keranjang terisi sebelum UI di-render).
- `saveCart()` di `addToCart` & `changeQty`.
- `clearCartStorage()` di `simpanPenjualan` (setelah `cart = {}`).

> ⚠️ **Pitfall yang sudah diperbaiki**: key `localStorage` bertipe string (`"1"`), sedangkan primary key Dexie number (`1`). `loadCart()` wajib mengonversi id ke `Number()` dan **re-hydrate** objek `menu` dari DB, supaya `db.menu.get("1")` tidak mengembalikan `undefined`.

### `laporan.js` — Laporan + Pengeluaran (Integrated, v4)
- **Query batch + group di memory** (bukan N+1): `renderChart(range, period, sales, expenses)` menerima data hasil query tunggal, lalu mengelompokkan per hari/minggu/bulan di memory memakai lookup map `dayIncome`/`dayExpense` → O(n).
- **Navigasi periode** memakai aritmatika bulan yang benar (`new Date(y, m-2, 1)` / `new Date(y, m, 1)`), bukan `addDays(date, 30)` — menangani lintas tahun (Des→Jan, Jan→Des).
- **Loading & error**: `showLoading('reportContent', 6)` + `try/catch/finally` + toast "Gagal memuat laporan".
- **🆕 Pengeluaran terintegrasi**: Halaman laporan sekarang menampilkan:
  - Tab periode (Harian/Mingguan/Bulanan)
  - Statistik omzet + pengeluaran + laba
  - Form catat pengeluaran inline (kategori dropdown, nominal input)
  - List pengeluaran per tanggal
  - Navigasi tanggal di atas form

### `bantuan.js` — Bantuan & Tutorial (🆕 v4)
Modul baru untuk menampilkan panduan cara memakai aplikasi:
```js
export async function initBantuan() {
  // Render tutorial sections: onboarding, POS, laporan, printer, settings, backup
}
```
- Konten bantuan dirender ke elemen `#bantuanContent` (HTML: page-bantuan)
- Setiap section punya judul, ikon, deskripsi, step-by-step guides
- Akses via bottom nav: tab "Bantuan" (🆕)

---

## 3. Modul Inti — Penjelasan Fungsi Penting (Updated)

### `backup.js` — Ekspor/Impor
```js
function validateBackup(data)   // murni & teruji — return null jika valid, else pesan error
async function importData(event) // baca file → validasi → konfirmasi → bulkPut
function exportData()            // simpan semua tabel → JSON
```
Tabel yang dicakup: `menu`, `penjualan`, `pengeluaran`, `pengaturan`, `settings`, dan **`platformMessages`** (agar banner carousel ikut ter-backup/restore). Validasi ketat: objek valid + `version` angka ≥1 + `menu` array + record lain (jika ada) array berisi objek; file backup lama tanpa `platformMessages` tetap valid.

### `app-state.js` — State Terpusat (🆕)
State global yang sebelumnya tersebar di berbagai modul, sekarang dikumpulkan di satu file untuk kemudahan maintenance:
```js
let cart = {};
let currentPage = 'beranda';
let posCat = 'Semua';
let expDate = todayStr();
let reportPeriod = 'harian';
let reportDate = todayStr();
let selectedTrxId = null;
let lastSaleId = null;
// Carousel state
let platCurrentSlide = 0;
let platAutoTimer = null;
const PLAT_SCROLL_MS = 4000;
```
Setter untuk setiap variabel disediakan agar mudah di-track (ke depan bisa di-upgrade ke reactive store).

### `app.js` — Entry Point (🆕)
Entry point sentral; me-*re-expose* seluruh fungsi ESM ke `window` agar bisa dipanggil dari handler inline HTML (`onclick`/`oninput`), lalu menjalankan license gate + `boot()`:
```js
// ... wire window functions ...
setLicenseRefs({...});          // injeksi ref license (hindari circular import)
window.licenseStartTrial = async () => { ... }  // trial → resolveLicenseGate → boot
document.addEventListener('DOMContentLoaded', init);
```
- `init()`: pasang overlay-close listener, cek lisensi → tampilkan gate atau `boot()`.
- `boot()`: `ensureUnitId()` → `loadBeranda()` → `checkOnboarding()` → `setupPWA()`.

### `pwa.js` — PWA
- `setupPWA()` **async**: fetch `assets/icon.png` → data URL → bangun manifest dinamis → pasang `<link rel="manifest">` → daftarkan `sw.js`.
- Install prompt: `beforeinstallprompt` → banner → `installPWA()`.

### `sw.js` — Service Worker (v4)
- **Cache name**: `kasir-solo-kaki5-v4` (bump saat ada perubahan pre-cache).
- `ASSETS_TO_CACHE`: shell + semua asset modular (`index.html`, `dexie.min.js`, `css/style.css`, `assets/icon*.png`, dan 17 modul `js/*.js`). **Catatan**: `bantuan.js` ditambahkan di v4, `carousel.js` sudah include.
- **Strategi**: *network-first, fallback cache* — selalu coba ambil versi terbaru dari network, kalau offline gunakan cache. (Berbeda dari cache-first klasik; ini meminimalkan staleness saat deploy.)
- `activate` membersihkan cache lama.

> **Cache Invalidation**: Setiap kali `sw.js` dimodifikasi atau modul baru ditambahkan, **wajib increment CACHE_NAME** (v3→v4, v4→v5, dll) supaya browser memperbarui SW dan menghapus cache lama. Jika lupa, user bisa mendapatkan versi stale.

---

## 4. Keamanan

- **Semua input pengguna di-escape** sebelum masuk ke `innerHTML` (via `escapeHtml` / `buildSafeHtml`).
- Hanya literal *trusted/hard-coded* yang boleh pakai `{__raw:true}`.
- **Pitfall tooling**: saat menulis string JS berisi `&`/`<` literal, gunakan idiom concat (`'&'+'amp;'`) karena tool patch me-decode HTML entity dan bisa meng-*korup* kode.

---

## 5. Deploy & CI/CD (ekosistem kasol)

- `kaki5` di-deploy sebagai **static site** ke **Vercel** lewat **git integration (auto-detect)** dari repo root `kasol` — project `kasir-kaki5` dengan root directory `kaki5/`.
- GitHub Actions **tidak dipakai** — Vercel auto-deploy setiap push ke branch utama.
- `vercel.json` menyediakan:
  - `cleanUrls: true` — tanpa ekstensi file.
  - SPA rewrite `/(.*) → /index.html` — semua jalur dikembalikan ke shell.
  - Header khusus: `sw.js` (no-cache) & `dexie.min.js` (immutable long cache).

### ⚠️ Pitfall deploy yang krusial
**Aturan `*.min.js` di root `.gitignore`** akan meng-ignore `dexie.min.js` → tidak ter-commit/push → tidak ter-deploy → rewrite SPA mengembalikan HTML untuk `/dexie.min.js` → **seluruh app mati** (`Dexie is not defined`).

**Solusi:** pastikan ada pengecualian di root `.gitignore`:
```gitignore
!kaki5/dexie.min.js
```

---

## 6. Verifikasi & QA

```bash
# Syntax check semua modul
for f in js/*.js; do node --check "$f"; done

# Syntax check gabungan (hapus file sementara setelahnya)
cat js/*.js > _c.js && node --check _c.js && rm _c.js

# Jalankan server uji (wajib http, bukan file://)
python -m http.server 8123 --bind 127.0.0.1   # → http://127.0.0.1:8123/

# Unit test (validasi backup)
node test_validate.js
```

Checksheet smoke test browser:
1. Onboarding tampil & nama warung tersimpan.
2. `0` error di console; semua modul + asset ter-load 200.
3. Cart persist: tambah item → `localStorage` → reload → cart muncul lagi.
4. Simpan penjualan → cart & storage bersih, laporan ter-update.
5. XSS payload `<img onerror>` → render ternetralkan.
6. Laporan harian/mingguan/bulanan + navigasi bulan (termasuk lintas tahun).
7. Printer Bluetooth (jika ada perangkat).

---

## 7. License System (Trial + Serial Activation)

Adopsi fitur lisensi dari Rosok app; implementasi di `js/license.js` (~394 baris).

### Alur Lisensi
```
App dibuka
  ↓
checkLicenseGate() → getLicenseStatus()
  ├─ Jika status = 'active' atau 'trial' → boot() (app berjalan)
  └─ Jika status = 'expired' atau 'unknown' → tampilkan licenseGate overlay
```

### Komponen Utama

**Constants:**
```js
const PRODUCT_PREFIX = 'KK5';
const PRODUCT_SALT = 'KASIRSOLO-KAKI5-HMAC-V2';
const TRIAL_DAYS = 7;
const MAX_EXTENSIONS = 20;     // Share-to-extend: maksimal 20x
const EXTEND_DAYS = 1;         // Setiap extend = +1 hari
```

**Algoritma:**
- **Device ID** — Generate dari hash `installId` (disimpan di settings, stable across sessions)
- **HMAC-SHA256** — Signature validation untuk serial (offline)
- **Trial Clock** — Hitung sisa hari dari `trialStartedAt` setting
- **Share-to-Extend** — Increment counter `trialExtensions` (max 20), tiap share +1 hari

**Fungsi Publik:**
```js
export async function getLicenseStatus()       // Return { status, expiry, daysLeft, extensions, deviceCode }
export async function startTrial()            // Inisialisasi trial 7 hari (sekali saja)
export async function activateSerial(serial)  // Validasi & aktivasi serial
export async function ensureUnitId()          // Generate unitId (K5-XXXX format) jika belum ada
export async function checkLicenseGate()      // Update chip + check expiry + lock app
export async function grantExtension()        // Extend trial +1 hari (share bonus)
```

### License Status Values
- `'unknown'` — App baru (belum start trial)
- `'trial'` — Masa percobaan aktif (< 7 hari)
- `'trial_extended'` — Trial diperpanjang via share (masih aktif)
- `'active'` — Serial resmi diaktifkan
- `'expired'` — Trial/serial habis → lock app

### Validasi Serial (Format KK5-XXXX-XXXX-XX-XXXXXX)
```
KK5-A1B2-C3D4-99-X7K9M2
│   │      │    │  └── HMAC signature (6 char, Base32)
│   │      │    └─────── Expiry code (99=seumur hidup, NN=bulan, ND=hari)
│   │      └──────────── Device Code part 2
│   └─────────────────── Device Code part 1
└─────────────────────── Product Prefix (KK5 unik)
```

### UI Integration
- **Trial Chip** (top-right header) — onclick → buka license sheet
- **License Gate** (overlay saat app tidak aktif) — tombol "Coba 7 Hari" / input serial / contact WA
- **Lock Overlay** (saat trial habis) — info expired + extend via share / activate serial
- **License Sheet** (bottom modal) — status detail, extend button, activate button, device ID

---

## 8. Onboarding & Settings (Profil Pengguna)

### Onboarding (`js/onboarding.js`)
Ditampilkan sekali saja saat first run (jika `namaWarung` belum ada di settings):

```js
export async function checkOnboarding()    // Cek & tampilkan modal jika baru
export async function finishOnboarding()   // Simpan nama/owner/WA → bulkAdd sample menu
```

**Flow:**
1. Show modal (gambar, tagline, 3 input fields)
2. User isi:
   - Nama Usaha (required)
   - Nama Pemilik (required for CRM)
   - Nomor WhatsApp (required for contact)
3. Klik "Mulai Pakai!" → simpan settings → add 8 sample menu items → close modal → load beranda

**Sample Menu (auto-added):**
- Nasi Goreng, Mie Goreng, Bakso, Sate Ayam (Makanan)
- Gorengan (Snack)
- Es Teh, Es Jeruk, Kopi (Minuman)

### Settings / Profil (`js/settings.js`)
Halaman pengaturan menampilkan kartu "📋 Profil Pengguna" dengan 4 editable fields:

| Field | Setting Key | Modal | Validasi | Tujuan |
|---|---|---|---|---|
| Nama Usaha | `namaWarung` | nameModal | Not empty | Display di beranda header |
| Nama Pemilik | `namaPemilik` | ownerModal | Not empty | Push ke Supabase CRM |
| No. WhatsApp | `noWhatsapp` | waModal | Not empty | Contact number |
| Alamat | `alamat` | alamatModal | Not empty | Lokasi unit (cloud sync) |

Setiap field punya:
- Tombol edit (buka modal) → input value → simpan (setSetting) → close modal → refresh tampilan

---

## 9. Catatan Cloud Readiness (CONTEXT.md / CLOUD-ROADMAP.md)

Meski kaki5 saat ini **offline-first**, arsitektur sudah siap untuk cloud sync (Lapisan B, tahap 2):

**Fields yang sudah disiapkan:**
- `unitId` (format K5-XXXX) — DNA untuk agregasi per-unit di dashboard hub
- `namaPemilik`, `noWhatsapp`, `alamat` — CRM-ready untuk Lapisan A (Supabase)
- `platformMessages` tabel — Siap terima banner/promo dari admin

**Roadmap (tidak di-implementasi sekarang):**
- Server-side license validation via Supabase (saat ini offline HMAC)
- Transaction sync ke cloud untuk premium users
- Dashboard Hub read-only untuk monitoring multi-unit

---

## 10. Testing & Debugging

### Syntax Validation
```bash
# Single file check
node --check js/app.js

# All ESM modules
for f in js/*.js; do node --check "$f"; done

# Combined check (concatenate all modules)
cat js/*.js > _temp.js && node --check _temp.js && rm _temp.js
```

### Unit Test (Backup Validation)
```bash
node test_validate.js
```
Runs 14 test cases untuk `validateBackup()` — memastikan import/export data tidak corrupt.

### Browser Testing (Smoke Test)
1. **License gate** — Spawn app, lihat trial overlay, klik "Coba 7 Hari", app unlock
2. **Onboarding** — First run, modal tampil, isi profil, sample menu auto-added
3. **Console** — 0 errors, semua JS load 200
4. **Carousel** — Beranda load, carousel tampil, auto-scroll 4s, swipe/dots work
5. **POS & Cart** — Tambah menu ke cart, persist via localStorage, reload → cart restored
6. **Settings** — Edit nama/owner/WA/alamat, values tersimpan
7. **Laporan** — Harian/mingguan/bulanan, navigasi bulan (cross-year), grafik render
8. **Printer** — Connect BT, cetak test page (jika ada device)
9. **XSS** — Input `<img onerror>` di nama menu → render escaped, tidak execute

### Dev Server
```bash
# Python 3 (recommended)
cd kaki5
python -m http.server 8123 --bind 127.0.0.1
# → http://127.0.0.1:8123/

# Node (alternative)
npx http-server -p 8123
```
**Penting:** Server WAJIB HTTP/HTTPS (tidak `file://`) karena Service Worker & IndexedDB memerlukan secure context.

---

## 11. Common Pitfalls & Troubleshooting

| Pitfall | Gejala | Solusi |
|---|---|---|
| `Dexie is not defined` | App blank, console error | Pastikan `dexie.min.js` dimuat SEBELUM ESM entry (`app.js`), cek `.gitignore` pengecualian `!kaki5/dexie.min.js` |
| Cart tidak persist | Tambah item → reload → cart kosong | Pastikan `loadCart()` di-await di awal `loadPOS()`, check localStorage key `kaki5-cart` |
| Carousel tidak tampil | Beranda load tapi carousel kosong | Cek `platformMessages` table (bisa kosong, pakai fallback demo), lihat console log |
| Module not found | Import error di console | Cek path import relatif (`.js` ext required), urutan import di `app.js` |
| License gate stuck | App forever locked | Clear settings, restart app (startTrial akan run again) |
| Printer tidak connect | Web Bluetooth API tidak tersedia | Chrome/Android saja, tidak support Safari iOS |

---

## 12. Architecture Diagram (Text)

```
┌─────────────────────────────────────────────────────────────┐
│                      index.html (23KB)                       │
│  • Dexie global script (sebelum ESM)                         │
│  • Modal templates (cart, menu, expense, settings, etc)     │
│  • ESM entry: <script type="module" src="js/app.js">        │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
        ┌────────────────────────────────────┐
        │  app.js (ENTRY POINT, ESM)         │
        │  • Import semua modul              │
        │  • Wire functions → window.*       │
        │  • DOMContentLoaded: init()        │
        └────────────────┬───────────────────┘
                         │
        ┌────────────────┴───────────────────────────────┐
        │                                                │
        ▼                                                ▼
   ┌─────────┐                                  ┌──────────────┐
   │License  │                                  │boot() flow   │
   │Gate     │                                  │              │
   │Overlay  │                                  ├─ensureUnitId()
   │(HMAC)   │                                  ├─loadBeranda()
   └────────┬┘                                  ├─checkOnboarding()
            │                                   └─setupPWA()
            └─────────────────┬──────────────────────┘
                              │
        ┌─────────────────────┴─────────────────────┐
        │                                           │
        ▼                                           ▼
   ┌────────────┐                         ┌──────────────────┐
   │ IndexedDB  │                         │ Service Worker   │
   │ (Dexie)    │                         │ (sw.js v3)       │
   │            │                         │                  │
   │ v3 schema: │                         │ • Pre-cache      │
   │ • menu     │                         │ • Network-first  │
   │ • penjualan│                         │ • Offline fallback
   │ • pengeluaran                        └──────────────────┘
   │ • pengaturan
   │ • settings │
   │ • platformMessages
   └────────────┘
```

---

*Dokumentasi terbaru: Scan kode ESM modular (20260805), License system + Onboarding integrated.*
*Untuk pertanyaan/kontribusi: lihat README.md (kontak developer).*
