# CONTEXT — KASIRSOLO Ecosystem Standards

> **File ini dibaca oleh setiap AI agent** sebelum membangun atau mengedit aplikasi klien KASIRSOLO.
> Semua aplikasi klien HARUS mengikuti standar di bawah ini.

---

## 🏛️ Peta Ekosistem

```
  ┌─────────────────┐
  │   LANDING PAGE  │  Marketing, funnel, lead gen
  │   (landing/)    │
  └────────┬────────┘
           │ reads catalog/settings, writes clients pipeline/stats
           ▼
  ┌─────────────────┐         ┌──────────────────────┐
  │  ADMIN DASHBOARD│────────►│   SUPABASE (cloud)   │
  │  (admin/)       │  write  │   [rencana tahap 2]   │
  └────────┬────────┘         └──────────┬───────────┘
           │ generate licenses           │ validate
           ▼                              ▼
  ┌─────────────────────────────────────────────────┐
  │           APPLICATION CLIENTS                   │
  │  rosok/  gerobak/  retail/  [baru...]           │
  │                                                 │
  │  ┌───────────────────────────────────────────┐  │
  │  │  Dexie.js (IndexedDB) — Full Offline       │  │
  │  │  Transaksi, produk, pelanggan, laporan     │  │
  │  └───────────────────────────────────────────┘  │
  │                                                 │
  │  ┌───────────────────────────────────────────┐  │
  │  │  License: HMAC-SHA256 device-bound         │  │
  │  │  Prefix unik per produk + salt rahasia     │  │
  │  └───────────────────────────────────────────┘  │
  └─────────────────────────────────────────────────┘
```

### 🚪 Port Dev Server (REGISTRY — SUMBER KEBENARAN)

**Setiap app klien & ekosistem punya PORT tetap yang TIDAK BOLEH diubah-ubah** oleh agent.
Sebelum jalanin preview/dev server, SELALU pakai port dari tabel ini. **Jangan ngacak / nebak port.**

| App | Folder | Port | Kategori |
|-----|--------|------|----------|
| Landing | `landing/` | **8081** | ekosistem |
| Admin | `admin/` | **8082** | ekosistem (bukan app klien) |
| Gerobak | `gerobak/` | **8083** | app klien |
| Rosok | `rosok/` | **8084** | app klien (flagship) |
| Retail | `retail/` | **8085** | app klien |
|| Kaki5 | `kaki5/` | **8086** | app klien |
|| Grosir | `grosir/` | **8089** | app klien |

**Aturan penomoran app klien baru:** aplikasi selanjutnya meneruskan urutan dari 8087,
8088, dst (urutan app klien). Ekosistem (landing/admin) memegang 8081–8082 secara permanen.

**Contoh pemicu port**: `python -m http.server 8086`, `npx serve -l 8084`, `php -S localhost:8083`.

---

## 🎯 Keputusan Strategis Saat Ini (WAJIB DIHORMATI AGENT)

> Keputusan strategis pemilik projekt. Agent **harus** baca & patuhi sebelum kerja.
> Ini SUMBER KEBENARAN untuk scope kerja (per 2026-08-10).

### 🚦 Aturan Rilis — Seluruh Ekosistem Kasol (WAJIB, untuk SEMUA agent)
**Aturan pemilik; sudah lama berlaku secara lisan, ditulis eksplisit 2026-09-06
agar memaksa kepatuhan agent mana pun (ZCode maupun di luar ZCode).**

1. **Default = commit + rilis BETA saja** (mirror `GitHub/kasol-beta` → domain
   beta `*.vercel.app`). Fix yang sudah disetujui pemilik → beta boleh langsung.
2. **Rilis LIVE (mirror `GitHub/kasol` → domain produksi: `kasirsolo.com`,
   `kaki5.kasirsolo.com`, `rosok.kasirsolo.com`, dll.) WAJIB perintah EKSPLISIT
   pemilik, PER RILIS.** Approval "gas"/"gaskeun" atas permintaan fix BUKAN izin
   rilis live — hanya perintah eksplisit semacam "rilis live"/"push live" yang sah.
3. **Jangan improve sendiri di luar permintaan.** Eksekusi persis yang diminta;
   temuan lain = SARAN tertulis untuk dipilih pemilik — jangan sekalian dikerjakan.
4. Pelanggaran tercatat 2026-09-06: diminta naikkan batas qty → agent ikut rilis
   live tanpa diminta. Jangan diulang.

### Fokus kerja (Prioritas)
Hanya **3 aplikasi** yang dikerjakan & diaudit dulu sampai robust:
`landing/`, `admin/`, `kaki5/`. **Semua app klien lain (rosok, gerobak, retail, dst)
DI-SKIP untuk sekarang** — jangan disentuh sampai landing/admin/kaki5 solid.

- **`kaki5/` = REFERENSI ARSITEKTUR aplikasi klien** (sumber kebenaran pola code,
  smart gate, sync profil, offline-first). App klien lain nanti meniru kaki5.

### Lisensi — Konsep Hybrid (KONTROL PENUH via Admin)
- **Konsep lama**: offline HMAC murni, generate dari `generator-lisensi-universal.html` publik.
- **Konsep baru (HYBRID)** — sesuai kebutuhan operasional-offline klien:
  1. **Operasional = offline total** (Dexie/IndexedDB). Transaksi TIDAK pernah ke server.
  2. **Lisensi + profil klien = di server (platform Kasir Solo)** sebagai database
     platform — `clients` + `licenses` di Supabase.
  3. **Admin `admin/` = satu-satunya SUMBER KEBENARAN** untuk generate, aktivasi,
     revoke, blacklist lisensi SEMUA app klien (kecuali landing & admin sendiri).
  4. App klien tetap validasi offline pakai HMAC (operasional jalan tanpa internet),
     lalu **kawal/sync status lisensi + blacklist ke server** saat online.
- HTTPS: `generate-license` / `activate-license` edge function dipindah jadi
  **backend otoritatif admin**, bukan helper publik.

### Arah Sinkronisasi — Cloud = Sumber Kebenaran (ATURAN PEMILIK, 2026-08-29)
- **Supabase = satu-satunya sumber kebenaran untuk lisensi & profil klien.**
  Data lokal (IndexedDB) TIDAK BOLEH menimpa cloud — **kecuali** tulisan
  eksplisit user dari **form profil** (jalur user-intent).
- **Saat app dibuka / refresh / setelah update overlay**: cek Supabase dulu
  (boot fase 1: sync lisensi → pull profil → push backfill), baru render UI.
- **Internet mati / cloud gagal dihubungi**: lisensi & profil tetap memakai
  data lokal (offline-first) — error network TIDAK boleh mengubah/menghapus
  state lokal (revoke dari ketidakpastian = dilarang).
- Implementasi di kaki5 (app klien lain meniru): `syncLicenseStatus()`
  menangani SEMUA `license_status` cloud (`aktif` → persist; `batal`/
  `nonaktif`/`revoked` → revoke; `belum`/kosong → downgrade aktif→trial
  berjangkar `first_seen`); `ensureSynced()` push otomatis = **backfill-only**
  (baris ada → jangan sentuh), penimpaan hanya via `force` (form profil,
  tombol sinkron, retry pending).

### Skip sementara: Password Admin
- Password admin **`admin123`** (hardcoded di `admin/js/auth.js`) **sengaja DI-SKIP
  dulu** sampai pemilik beresin manual (karena menyangkut auth Supabase + RLS).
- **Agent JANGAN mengubah / "memperbaiki"** admin password / auth gate admin.
  Catat sebagai item, jangan dikerjakan, sampai pemilik setuju.
- Konteks: JWT secret sudah di-*tanem* di env hermes (`C:\Users\Admin\AppData\Local\hermes\.env`)
  sebagai `JWT_SECRET` — dipakai nanti untuk auth admin.

---

## 🎨 Design System (Dari Rosok.zip)

### Color Palette

```css
--brand:        #F5821F    /* Primary orange */
--brand-dark:   #D6501C    /* Dark orange (gradient end) */
--brand-light:  #FDBA5C   /* Light orange (gradient start) */
--grad:         linear-gradient(135deg, var(--brand-light), var(--brand), var(--brand-dark))
--ink:          #2B2420    /* Text primary */
--ink-soft:     #6B5F54    /* Text secondary */
--paper:        #FBF6EF    /* Page background */
--surface:      #FFFFFF   /* Card background */
--line:         #ECE1D3   /* Border */
--green:        #3F8C52   /* Success */
--green-soft:   #E7F3E9   /* Success bg */
--red:          #D2483A   /* Danger */
--red-soft:     #FBEAE7   /* Danger bg */
```

### Typography

| Element | Font | Weight |
|---------|------|--------|
| Heading | Plus Jakarta Sans | 700-800 |
| Body | Inter | 400-600 |
| Monospace (serial) | Space Mono | 700 |

### UI Components

| Component | Style |
|-----------|-------|
| Topbar | Gradient background, fixed top, brand badge + trial chip + settings btn |
| Bottom Nav | Fixed bottom, 5 tabs (Dashboard, Kasir, Stok, Riwayat, Laporan) |
| Card | White bg, border `--line`, radius 20px, padding 16px, shadow |
| Stat Card | Color-coded (kas=orange, stok=teal, beli=red, jual=green, laba=yellow) |
| Button Primary | Gradient bg, white text, radius 14px, shadow |
| Button Outline | White bg, border, ink text |
| Button Danger | Red-soft bg, red text |
| Sheet/Overlay | Full-screen bottom sheet, rounded top, handle bar |
| Input | Border `--line`, radius 12px, focus orange border |
| Tab Button | Small pill, active = orange gradient |

### Layout Pattern

```
┌──────────────────────┐
│  TOPBAR (fixed)      │  ← gradient bg, brand + trial + settings
├──────────────────────┤
│                      │
│  SCREEN CONTENT      │  ← max-width 560px, margin auto
│  (scrollable)        │
│                      │
├──────────────────────┤
│  BOTTOM NAV (fixed)  │  ← 5 tabs: Dash│Kasir│Stok│Riwayat│Laporan
└──────────────────────┘

Sheets overlay everything when opened:
┌──────────────────────┐
│  OVERLAY (dim)       │
├──────────────────────┤
│  BOTTOM SHEET        │  ← rounded top, handle, title, form, buttons
└──────────────────────┘
```

---

## 🗂️ Struktur File Aplikasi Klien

### Pola Single-HTML (Referensi dari rosok.zip)

```
nama-aplikasi/
├── index.html              # Single file (~250-400KB)
│                           #   - Dexie.js embedded inline
│                           #   - CSS inline di <style>
│                           #   - JS inline di <script>
├── assets/
│   ├── logo.png            # 256x256
│   ├── icon-192.png        # 192x192 (maskable)
│   ├── icon-512.png        # 512x512 (maskable)
│   ├── favicon-16.png
│   ├── favicon-32.png
│   └── splash-1028.png     # iOS splash screen
├── manifest.json           # PWA manifest
├── sw.js                   # Service Worker
├── vercel.json             # Vercel config
└── .vercelignore           # Files to ignore
```

### Pola Modular (Rencana, TIDAK JADI REFERENSI SEKARANG)

```
nama-aplikasi/
├── index.html              # HTML shell only
├── style.css               # CSS terpisah
├── dexie.min.js            # Library eksternal
├── assets/
├── manifest.json
├── sw.js
├── vercel.json
├── .vercelignore
└── js/
    ├── app.js              # Entry point
    ├── db.js               # Dexie setup
    ├── license.js          # License logic
    └── ...
```

---

## 🔐 Sistem Lisensi (WAJIB)

Semua aplikasi klien HARUS memiliki validasi lisensi di onboard.
**Konsep 2026-08-10: HYBRID** — offline HMAC + kontrol penuh via admin/server.
Detail: lihat section "🎯 Keputusan Strategis Saat Ini" di atas. Intinya:
- Operasional offline (Dexie), **transaksi tidak pernah ke server**.
- Lisensi & profil klien disimpan di server (Supabase) sebagai **database platform**.
- `admin/` = satu-satunya sumber kebenaran generate/aktif/revoke/blacklist.
- App klien validasi offline (HMAC) → kawal sync status+blacklist saat online.

### Konstanta yang Harus Diganti per Aplikasi

```javascript
// DI dalam <script> index.html — GANTI untuk setiap aplikasi baru:
const PRODUCT_SALT = "KASIRSOLO-ROSOK-HMAC-V2";  // ← GANTI salt
const TRIAL_DAYS = 7;
const MAX_EXTENSIONS = 20;
const EXTEND_DAYS = 1;
```

### Format Serial

```
KSR-A1B2-C3D4-99-X7K9M2
│   │      │    │  └── HMAC signature (6 char, Base32)
│   │      │    └─────── Expiry code (99=seumur hidup, NN=bulan, ND=hari)
│   │      └──────────── Device Code part 2
│   └─────────────────── Device Code part 1
└─────────────────────── Product Prefix (3-5 huruf kapital)
```

### Algoritma (Copy-Paste dari rosok.zip)

Kode license module lengkap ada di baris ~1056-1170 `rosok/index.html`.
Copy paste dan ganti `PRODUCT_SALT` untuk aplikasi baru.

### Flow Onboarding — SMART GATE (STANDAR semua app klien)

Satu overlay gate (`#licenseGate`) yang **dual-mode** menangani 3 state, sehingga
onboarding, trial jalan, dan trial-habis konsisten di semua app (referensi: kaki5,
`js/app.js` + `js/license.js`).

```
State (getLicenseStatus):
  none     → user baru        → mode ONBOARDING
  trial    → trial jalan      → SKIP gate, langsung masuk app
  active   → lisensi aktif    → SKIP gate, langsung masuk app
  expired  → trial/lisensi habis → mode LISENSI (input serial)
```

**Mode ONBOARDING — 2-LANGKAH (tanpa checkbox)** (`#gateOnboarding`) — untuk `status = none`:
- **Langkah 1**: Input **Nama Usaha** (wajib) → tombol **"🚀 Mulai Masa Percobaan"**
  (`#trialBtn`, handler `_ksr_proceedToTC`). **Trial BELUM dimulai** di sini.
- **Langkah 2**: Modal `#tcModal` (Syarat & Ketentuan) tersaji dengan **2 tombol**:
  **🔙 Batal** (`_ksr_cancelTC` → kembali ke Langkah 1, nama tetap tersimpan)
  / **✓ Setuju & Lanjut** (`_ksr_acceptTC`).
- **Trial mulai DI Langkah 2** (`_ksr_acceptTC` → `startTrial()`), lalu tutup gate + `boot()`.
- Tombol **Batal aman** karena trial belum dimulai — desain ini menggantikan checkbox
  S&K lama (dihapus total karena berulang bikin bug & kurang ramah user gaptek).

**Mode LISENSI** (`#gateLicenseBlock`, di-render dinamis `gateLicenseHtml()`) — untuk `status = expired`:
- Teks "Masa Coba / Lisensi Habis" + input kode lisensi.
- Tombol: **💬 Beli** → `contactViaWA()` · **🔓 Aktifkan** → `activateSerial()`.
- **"Perpanjang masa coba (+1 hari)"** sebagai TEKS link di bawah (share-to-extend, maks `MAX_EXTENSIONS`x) + counter `x/20`.
- Sembarang berhasil → tutup gate + `boot()`.

**Kontrak struktur (index.html):**
```html
<div id="licenseGate">                <!-- overlay full-screen -->
  <div id="gateOnboarding">…</div>    <!-- static: nama usaha + S&K + trial btn -->
  <div id="gateLicenseBlock"></div>   <!-- static: diisi dinamis saat expired -->
</div>
<div class="modal-overlay" id="tcModal">…Syarat & Ketentuan…</div>
```

**Kontrak fungsi (app.js):** `renderGate(status)` pilih mode; `gateLicenseHtml(status)`
render mode lisensi; handler onboarding `_ksr_proceedToTC/_ksr_cancelTC/_ksr_acceptTC`,
mode lisensi `_ksr_buyGate/_ksr_activateGate/_ksr_extendGate`, `resolveLicenseGate()`.
**`init()`**: active/trial → `boot()`; else → `renderGate` + tampilkan gate.

**Aturan anti-double-overlay:** `checkLicenseGate()` (license.js) **skip** `#lockOverlay`
selama `#licenseGate` terlihat (`display !== 'none'`). Aktivasi/perpanjang dari gate
harus memanggil `boot()`.

> Template & catatan adaptasi per app: skill `kasol-ecosystem-apps` → `references/smart-gate.md`.

---

## ✨ Fitur Standar Global (UX & Anti-Gaptek) — WAJIB Semua App Klien

Selain arsitektur & lisensi, ada **standar fitur/UUX** yang wajib diadopsi semua app klien
(referensi & sumber kebenaran implementasi: `kaki5/`). Prinsip inti: **1 layar = 1 keputusan,
narasi ramah, fungsi tersembunyi di balik tombol akses** — targetnya pengguna non-teknis.

| # | Fitur Standar | Kontrak / Detail |
|---|---------------|------------------|
| 1 | **Onboarding 2-langkah tanpa checkbox** | Step1 **Nomor WhatsApp** (tervalidasi strict ID) → Step2 modal S&K (Batal/Setuju); trial mulai di Step2. Nama Usaha diisi belakangan via profil/banner. Lihat section Smart Gate di atas. |
| 2 | **Profil tersruktur (region picker)** | 4 field inti: Nama Usaha, Nama Pemilik, No WhatsApp, Alamat. Alamat pakai rantai dropdown **Provinsi → Kota/Kab → Kecamatan → Desa** (API emsifa, `js/region.js`) + detail. `id` + `nama` disimpan untuk CRM analitik. WAJIB izin `https://raw.githubusercontent.com` di CSP `connect-src`. |
| 3 | **Auto-sync profil (background)** | Tiap simpan profil panggil `ensureSynced()` (di semua handler save). Offline-first tetap — retry saat online. JANGAN tampilkan kartu "Sinkronisasi" di layar (fungsi jalan otomatis). |
| 4 | **Banner "Lengkapi Profil" (center-large immersive)** | `#profileBanner` `position:fixed;inset:0;z-index:520` + backdrop blur, kartu ~420px. Muncul saat profil belum lengkap (`!namaPemilik || !noWhatsapp || (!kabkota && !alamat)`). CTA → halaman Pengaturan; dismiss "Nanti Saja"/✕/klik backdrop. |
| 5 | **Kontrak z-index** | `header 100 < bottom-nav 350 < gate #licenseGate 500 < banner profil 520 < modal-overlay 600 < confirm-overlay 610 < toast 620 < sheet pembelian 640 < #updateOverlay 800` (force-update overlay menutup SEMUA). Modal SESUATU berada DI ATAS gate (jangan sampai tertutup). |
| 6 | **Copy benefit-driven (non-teknis)** | Narasi berfokus KEUNTUNGAN user (bantuan lebih cepat, tips sesuai daerah), bukan teknis (sinkronisasi, statistik, akurasi). Bahasa sederhana, ga pakai jargonya sistem. |
| 7 | **Akorodion tutorial/Bantuan auto-close** | Halaman Bantuan pakai akordeon yang **hanya satu terbuka** (`toggleTutorial` menutup panel lain). Isi tutorial harus **akurat berdasar kode asli** (bukan karangan/perkiraan visual). |
| 8 | **Pengaturan ramping** | Jangan penuhi layar pengaturan dengan kartu/fitur. Fungsi tersembunyi di balik **satu tombol akses** — mis. semua urusan lisensi (status/masa coba/kode/aktifkan/beli) cukup lewat **1 tombol "🎫 Kelola Lisensi"**. Item "🩺 Diagnosa Sinkronisasi" wajib ada di kartu Data & Cadangan (referensi `kaki5/js/sync.health.js`). |
| 9 | **PWA Install Detection** | Deteksi otomatis kalau PWA sudah terinstal (standalone display-mode, iOS standalone, SW controlling, localStorage flag). Tidak tampilkan banner install jika sudah terpasang. Persist flag ke localStorage, listen `display-mode` change. Update versi: **overlay force-update full-screen** (`#updateOverlay`) dengan catatan rilis dari `version.json.notes` + tombol OKE → `performForceUpdate()` (SW update → reload → profil tersinkron). Referensi: `kaki5/js/pwa.js`, `kaki5/js/update.js`. |

**Pola kode wajib (dari kaki5):**
- `settings.js` → `saveOwner/saveWa/saveAlamat/saveNamaUsaha` semua akhiri dengan `ensureSynced(); checkProfileNotification();`.
- `sync.js` → `ensureSynced({force,silent})`; `isSyncConfigured()`.
- `region.js` → `setupRegionPicker({provSel,kabSel,kecSel,desaSel,state})`, state membaca `.provinsi_id/.provinsi/.../.desa_id/.desa`.
- `index.html` → banner `#profileBanner` + kelas `.prof-banner-*`; halaman Bantuan `#bantuanContent`.
- `pwa.js` → `checkPWAInstalled()`, `isPWAInstalled`, `setupPWA()` initial check + `matchMedia` listener.

**Template adaptasi per app:** skill `kasol-ecosystem-apps` → `references/smart-gate.md`
(+ pola banner profil & akordeon bantuan di bagian catatan adaptasi).

---

## 🗄️ Database Schema (Dexie.js)

### Pola Dasar (Copy dari rosok.zip)

```javascript
const db = new Dexie("NamaAplikasiDB");

db.version(1).stores({
  settings: 'key',
  // tabel dasar
});

db.version(2).stores({
  // tabel v1 + tabel baru
});
```

### Tabel Standar yang Harus Ada

| Tabel | Primary Key | Index | Fungsi |
|-------|-------------|-------|--------|
| `settings` | `key` (PK) | — | Pengaturan: bizName, setupDone, trialStart, licenseActivatedAt, deviceCode |
| `transaksi` | `++id` | `tipe, tanggal` | Catatan transaksi |
| `transaksiItem` | `++id` | `transaksiId` | Item per transaksi |

### Tabel Opsional (sesuai kebutuhan aplikasi)

| Tabel | Fungsi |
|-------|--------|
| `kategori` | Kategori barang/produk |
| `produk` | Daftar produk dengan harga |
| `pelanggan` | Data pelanggan |
| `kas` | Catatan kas masuk/keluar |
| `kasShift` | Buka/tutup kas shift |
| `supplier` | Data supplier |

---

## ☁️ Sinkronisasi Profil Klien (CRM → Supabase)

App klien mengirim **profil identitas outlet** (bukan transaksi) ke tabel `clients`
di Supabase, lalu ditampilkan & dikelola di repo `admin/` (tab **Klien**). Detail
arsitektur: [`CLOUD-ROADMAP.md`](./CLOUD-ROADMAP.md) (Lapisan A).

### Tabel `clients` (1 baris per outlet)
Kunci natural = `unit_id`. Kolom: `unit_id, app_type, device_code, install_id,`
`nama_usaha, nama_pemilik, no_whatsapp,`
`provinsi_id/provinsi, kabkota_id/kabkota, kecamatan_id/kecamatan, desa_id/desa, alamat_detail,`
`first_seen, last_seen, user_id`.

- **Wilayah tersruktur** (`id` + `nama`) — supaya agregasi analitik (per provinsi/kabupaten)
  akurat, bukan free-text. Data wilayah dari API **emsifa** (`js/region.js`).
- SQL DDL: `supabase/migration-clients.sql`.

### Keamanan — Anonymous Auth + RLS
- Setiap perangkat pakai **anonymous sign-in** (`signInAnonymously`); baris punya
  `user_id = auth.uid()`.
- RLS `clients own select/insert/update` → tiap device cuma bisa ubah barisnya sendiri.
- Admin baca/ubah **semua** baris via **service_role** key (bypass RLS).
- Syarat: Anonymous Auth **harus diaktifkan** di project (config auth
  `external_anonymous_users_enabled=true`).

### Pola modul `sync.js` (contoh: kaki5)
- `ensureSynced()`: `signInAnonymously()` → claim `device_known` RPC →
  **baris belum ada = insert; baris sudah ada = update HANYA lewat jalur
  user-intent (`force`)**. Push otomatis (boot/retry latar) **backfill-only**
  — cloud tidak pernah ditimpa data lokal (aturan pemilik 2026-08-29,
  lihat bagian "Arah Sinkronisasi" di atas).
- **Dua skenario**: user baru push saat onboarding/aktivasi; user lama di-**backfill
  otomatis** sekali di boot lewat flag lokal `sync` (`none`/`pending`/`synced`),
  retry saat online. **Offline-first tetap dijaga.**
- Arah sebaliknya: `pullCloudProfileIfOnline()` / `pullCloudProfileTo()` pull
  profil cloud → lokal di tiap boot (fase 1b), SEBELUM render UI. Nilai kosong
  dari cloud sengaja ikut menimpa lokal (C2v2 — admin bisa membersihkan buffer).
- Konfig (URL + anon key) di `js/supabase-config.js` (anon = public, aman untuk browser);
  fallback anon key di `api/supabase-config.js` WAJIB identik dengan klien
  (insiden `******` 2026-08-29: placeholder menimpa kunci valid → sync mati diam-diam).

### Catatan lisensi
- Prefix produk kaki5 = **`KK5`** (bukan `K5`) — admin product registry wajib
  `KK5` agar serial yang digenerate diterima app. (`KSR/GBK/RTL` sesuai app.)
- **Status (2026-08-08):** ke-4 app klien memakai skema **HMAC-V2** dan
  memvalidasi serial yang di-generate admin — prefix `KSR`(rosok),
  `KK5`(kaki5), `GBK`(gerobak), `RTL`(retail), salt masing-masing
  `KASIRSOLO-{APP}-HMAC-V2`. Device-match memakai `normalizeDeviceCode(deviceId)`
  (uppercase, buang non-alfanumerik, 8 karakter pertama, pad `X`).
- **Enum `license_status` di `clients`** (sumber kebenaran) & perlakuannya di
  `syncLicenseStatus()` (kaki5, sejak 2026-08-29/v102):
  * `aktif` (+ serial) → persist ke lokal + pull profil.
  * `batal` / `nonaktif` / `revoked` → revoke lokal (app terkunci, offline tetap terkunci).
  * `belum` / kosong → lokal `active` diturunkan ke **trial berjangkar `first_seen`** (T12);
    trial/none lokal dibiarkan. Bukan revoke.
  * Error network / baris tak terbaca → JANGAN ubah state lokal (anti revoke palsu, H3).

**Kredensial Supabase** disimpan di env hermes (`C:\Users\Admin\AppData\Local\hermes\.env`):
`SUPABASE_PROJECT_REF`, `SUPABASE_ACCESS_TOKEN`, `SUPABASE_SERVICE_ROLE_KEY`,
`SUPABASE_URL`, `SUPABASE_ANON_KEY`, **`JWT_SECRET`** (kunci JWT admin, sudah ditanam pemilik).

### Supabase Access Token (Hermes Env)

**Access Token Supabase sudah disimpan di Hermes environment** (`C:\Users\Admin\AppData\Local\hermes\.env`):

```bash
SUPABASE_PROJECT_REF=hhywrvedlwljawgxzpkq
SUPABASE_ACCESS_TOKEN=sbp_xxx...  # Personal Access Token dengan scope admin
```

### Kegunaan
Agent/assistant (Hermes) **bisa eksekusi migration SQL langsung** via Supabase Management API tanpa manual ke dashboard:

```bash
# Contoh: Jalankan migration via Management API
curl -X POST "https://api.supabase.com/v1/projects/${SUPABASE_PROJECT_REF}/database/query" \
  -H "Authorization: Bearer ${SUPABASE_ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"query": "CREATE TABLE ..."}'
```

### Workflow Migration (Otomatis)
1. **Agent baca file SQL** dari `supabase/migration-*.sql`
2. **Agent POST ke Management API** pakai `SUPABASE_ACCESS_TOKEN`
3. **Supabase eksekusi query** → return hasil
4. **Agent verifikasi** → update checklist/docs

> **Tidak perlu manual** buka Supabase Dashboard → SQL Editor → paste query. Agent handle end-to-end.

## 🌐 PWA

### manifest.json Template

```json
{
  "name": "Kasir Solo - NamaAplikasi",
  "short_name": "NamaAplikasi",
  "description": "Deskripsi singkat aplikasi.",
  "start_url": "./index.html",
  "display": "standalone",
  "background_color": "#FFF8EF",
  "theme_color": "#E85D1F",
  "orientation": "portrait-primary",
  "lang": "id",
  "icons": [
    { "src": "icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

### Service Worker (sw.js)

Network-first untuk HTML, cache-first untuk aset statis.
Naikkan versi **5 titik serentak** tiap rilis: `APP_VERSION`+`CACHE_BUST` (`js/version.js`),
`version`+`cacheBust`+`notes` (`js/version.json` — `notes` = catatan rilis untuk
overlay force-update), `CACHE_NAME` (`sw.js`), `?v=` (`index.html` & README).

---

## 🚀 Deploy

### vercel.json Template

```json
{
  "name": "kasir-nama-aplikasi",
  "buildCommand": null,
  "outputDirectory": ".",
  "framework": null,
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }],
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "X-Frame-Options", "value": "DENY" },
        { "key": "X-XSS-Protection", "value": "1; mode=block" }
      ]
    }
  ]
}
```

### Deployment — Alur 2-Mirror (Vercel Git Integration, tanpa GitHub Actions)

> GitHub Actions **tidak dipakai** lagi. Semua `.github/workflows/*` sudah dihapus. Deploy otomatis lewat **Vercel git integration** (auto-detect).

**Folder kerja TIDAK pernah push langsung ke GitHub.** Setiap app punya **2 proyek Vercel** (dua environment) yang terhubung ke repo GitHub berbeda:

1. **BETA** — mirror `kasol-beta` → push GitHub BETA main → deploy `<app>.vercel.app`. Dijalankan dari folder kerja via `.\push-beta.ps1` (sync worktree, squash 1 commit snapshot, push).
2. **LIVE** — mirror `kasol` → push GitHub LIVE main → deploy `<app>.kasirsolo.com`. Dijalankan dari mirror beta via `.\push-live.ps1` (fetch beta main, sync, squash, push) — hanya dari beta yang **stabil**.
3. Ada error di URL beta? → kembali ke folder kerja, perbaiki, rilis beta lagi (langkah 1) sampai stabil, baru rilis live.

Tidak ada secrets CI (`VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID_*`).

| App | Vercel Project | Root Directory | Build Command |
|-----|----------------|----------------|---------------|
| rosok | `kasir-rosok` | `rosok/` | (kosong) |
| gerobak | `kasir-gerobak` | `gerobak/` | (kosong) |
| retail | `kasir-retail` | `retail/` | (kosong) |
| landing | `kasir-solo-landing` | `landing/` | (kosong) |
| kaki5 | `kasir-kaki5` | `kaki5/` | (kosong) |
| admin | `kasir-admin` | `admin/` | `node scripts/build-env-loader.mjs` |

Env var per project (mis. `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` untuk admin) diatur di dashboard Vercel / konektor Vercel+Supabase — **tidak di-commit**.

**Wajib per app:** jika app PWA meng-load `dexie.min.js`, file itu harus ter-track git. Root `.gitignore` meng-ignore `*.min.js` sehingga tiap app butuh pengecualian `!<app>/dexie.min.js`; kalau tidak → deploy = `Dexie is not defined` (app mati).

---

## 📝 Naming Convention

| Elemen | Convention | Contoh |
|--------|-----------|--------|
| Folder | lowercase, tanpa spasi | `rosok/`, `konveksi/` |
| Database Dexie | PascalCase + "DB" | `KasirSoloRosokDB` |
| Product Prefix | 3-5 huruf kapital UNIK | `KSR`, `KKN`, `KSL` |
| Product Salt | `KASIRSOLO-{APP}-HMAC-V2` | `KASIRSOLO-GEROBAK-HMAC-V2` |
| Vercel project | `kasir-nama-aplikasi` | `kasir-konveksi` |

---

## 📚 Dokumentasi Terkait

| Dokumen | Lokasi |
|---------|--------|
| Ekosistem overview | `landing/docs/00-ekosistem.md` |
| Arsitektur landing | `landing/docs/02-architecture.md` |
| Arsitektur admin | `admin/docs/02-architecture.md` |
| Sistem lisensi | `admin/docs/04-license-system.md` |
| **Cloud & Dashboard Hub (roadmap)** | **`CLOUD-ROADMAP.md`** |
| Rosok spesifik | `rosok/AGENTS.md` |
| Gerobak spesifik | `gerobak/AGENTS.md` |
| Retail spesifik | `retail/AGENTS.md` |
| Kaki5 spesifik | `kaki5/AGENTS.md`, `kaki5/README.md`, `kaki5/docs/DEVELOPER.md`, `kaki5/docs/REGRESSION-CHECKLIST.md`, `kaki5/DESIGN.md` |

---

*CONTEXT.md — KASIRSOLO Ecosystem Standards*
*PT Mesin Kasir Solo — Agustus 2026*
*Referensi utama: rosok.zip (single HTML production build)*
