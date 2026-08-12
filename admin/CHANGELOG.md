# Changelog â€” Admin Marketing KASIRSOLO

Semua perubahan dicatat per tanggal, versi terbaru di atas.


## [1.4.8] - (Kartu Kanban Kontekstual per Status)

### 🎨 Tampilan kartu klien dinamis sesuai konteks status
- **Aksen warna halus per status:** tint latar tipis (bukan border tebal) —
  biru=Baru, oranye=Dihubungi, amber=Tertarik, teal=Verifikasi, hijau=Aktif,
  merah=Batal.
- **Baris konteks status** di tiap kartu:
  - `baru` → "🆕 Lead baru — belum dihubungi"
  - `dihubungi` → "📞 Sudah dihubungi"
  - `tertarik` → "💡 Tertarik — siap ditawarkan"
  - `menunggu_verifikasi` → tombol "🧾 Lihat Bukti" (jika ada bukti) atau
    "⏳ Menunggu verifikasi"
  - `aktif` → status Online/Offline (berdasar `last_seen`) + cuplikan serial
  - `batal` → "❌ Batal — lisensi nonaktif"
- **Tombol utama kontekstual** menggantikan tombol "Buka":
  - Baru→📞 Hubungi, Dihubungi→💡 Tawarkan, Tertarik→⏳ Minta Verifikasi
    (semua maju ke tahap berikutnya)
  - Verifikasi→🔍 Verifikasi, Aktif→⚙️ Kelola, Batal→↩️ Pulihkan (buka detail)
- **Kartu `batal` diredupkan** (opacity .62) sebagai tanda nonaktif.
- Klik kartu masih buka detail; tombol ‹ › tetap ada.
- SW cache `v18`.

---

## [1.4.7] - (Responsive Layout Detail Klien & Kanban)

### 📱 Responsif: HP, tablet, dan desktop
- **Detail klien:** form `.field-grid` kini 2 kolom di tablet/desktop
  (`min-width:768px`), tetap 1 kolom di HP. Field lebar (`.field-span-2`)
  tetap memenuhi baris penuh.
- **HP (≤640px):**
  - Baris tombol (`.btn-block-row`) ditumpuk vertikal, tombol selebar kontainer
    (Generate/Copy/Kirim WA & Kembali/Simpan/Hapus).
  - Header detail (`.cd-head`) jadi kolom, elemen sejajar kiri.
  - Input/select/textarea pakai `font-size:16px` untuk hindari auto-zoom iOS.
  - Toolbar klien: input search & filter pilih memenuhi baris penuh.
- SW cache `v17`.

---

## [1.4.6] - 2026-08-11 (Fix Detail "Salah Tempat" — hidden dihormati)

### 🐞 Detail klien muncul di bawah board, bukan menggantikan
- **Akar masalah:** `.kanban-board { display: flex }` menimpa atribut `hidden`
  sehingga `board.hidden = true` tidak menyembunyikan board. Akibatnya detail
  `#clientDetailBody` tampil **di bawah** board, bukan menggantikan seluruh
  tampilan panel kanban.
- **Fix:** tambah rule global `[hidden] { display:none !important; }` di
  `style.css` agar atribut `hidden` selalu mengalahkan rule `display` manapun.
- Sekarang klik kartu / tombol **Buka** → board + head benar-benar diganti
  oleh form detail di kontainer yang sama; **← Kembali** mengembalikan board.
- SW cache `v16`.

---

## [1.4.5] - 2026-08-11 (Detail Klien Inline di Panel Kanban)

### 🖥️ Detail kartu klien tampil inline (bukan layar penuh)
- Detail klien kini render **di dalam panel `#kanbanView`** itu sendiri, bukan
  pindah ke layar terpisah `screen-klien-detail` (section tersebut dihapus dari
  `index.html`).
- Saat klik **Buka** di kartu kanban: head + board kanban disembunyikan, dan
  form detail muncul menggantikan di kontainer panel yang sama.
- Tombol **← Kembali** (di bawah form) menampilkan ulang board kanban via
  `backFromClient()` → `renderKanban()` (tanpa `showScreen('klien')`).
- `#clientDetailBody` dipindah ke dalam `#kanbanView`; `#kanbanViewHead` diberi
  id untuk togglable.
- **Trigger detail = klik kartu ATAU tombol Buka.** Klik di area kartu kanban
  (di luar tombol aksi) kini membuka detail; tombol `‹ ›`, `🧾 Bukti`, dan
  `Buka` diabaikan supaya tidak trigger ganda.
- Terverifikasi: `detailInsideKanban: true`, board/head togglable, kembali
  restore 11 kartu, 0 error console. SW cache `v15`.

---

## [1.4.4] - 2026-08-11 (Smart Refresh Button + Cleanup KPI/Muat)

### 🔁 Tombol refresh jadi smart button
- Ikon `⟳` di topbar (`#refreshBtn`) kini berfungsi di **semua** halaman dan
  menyesuaikan aksi berdasarkan halaman aktif: Dashboard → `refreshDashboard`,
  Klien → `refreshClients`, Katalog → `refreshCatalog`, Pengaturan → reload.
- Dispatch lewat `window.refreshCurrentScreen()` di `app.js` (memakai
  `getCurrentScreen()`), dengan spinner sementara + toast bersih.
- Modul mengekspos fn via global: `window.refreshDashboard`,
  `window.refreshClients`, `window.refreshCatalog`.

### 🧹 Tombol refresh dalam konten dihapus
- Tombol `⟳ Segarkan` (dashboard) dihapus — cukup pakai smart button topbar.
- Tombol `⟳ Muat` (toolbar klien) dihapus — smart button yang nangani.
- Duplikat `#clientStatCards` di-rapikan + fix `</div>` dobel di page-head klien.

### 🗑️ Dead code
- `renderStats()` + 3 pemanggilnya dihapus dari `clients.js` (target
  `#clientStatCards` sudah tidak ada).
- Binding `refreshClientsBtn` & `refreshBtn` lama dibersihkan dari
  `clients.js` / `dashboard.js`.

> Terverifikasi: klik smart button di Dashboard, Klien, dan Katalog semuanya
> memunculkan `✅ Data diperbarui` dengan 0 error console. SW cache `v13`.

---

## [1.4.3] - 2026-08-11 (Login di-bypass + Halaman Klien: Analitik & Kelola Klien)

### 🔓 Login di-bypass
- Halaman login (`#loginScreen`) tidak lagi ditampilkan — `initAuth()` langsung
  `showApp()`. Logout tidak kembali ke layar login. (Checkpoint menunjuk ke
  BACKLOG modul kredensial di `audit-admin-kasirsolo.md`.)

### 📊 Halaman Klien → 2 mode: Analitik & Kelola Klien
- Tombol tampilan dirombak: ~~List~~ → **Analitik**, ~~Kanban~~ → **Kelola Klien**.
- Kartu "Daftar Klien" (list) dihapus total.
- View **Analitik** = dashboard analitik khusus klien: stat ringkas (Total,
  Aktif/Deal, Aktif 30 hari, Potensial Revenue) + panel bar Pipeline per Status,
  Klien per Aplikasi, dan Sebaran Wilayah. Menghormati filter cari & aplikasi.
- View **Kelola Klien** = kanban pipeline (tab per status, geser kartu ‹ ›).
- KPI cards (`#clientStatCards`) pindah ke bawah deskripsi halaman, di atas
  tombol mode tampilan.


## [1.4.2] - 2026-08-11 (Detail Klien → Halaman Penuh + Redesign Kartu)

### 🖥️ Detail klien jadi halaman penuh (bukan modal)
- `#sheetClient` (modal/sheet) dihapus dari `index.html`.
- Detail klien kini render ke section baru `screen-klien-detail` (halaman penuh)
  dengan **tombol kembali** (`#backFromClient` di atas + `← Kembali` di bawah
  form). Navigasi balik lewat `window.backFromClient()` → `showScreen('klien')`.
- `openClient()` menulis ke `#clientDetailBody` lalu `showScreen('klien-detail')`.
- `closeClientSheet()` menjadi alias dari `backFromClient()` (tetap dipakai
  `saveClient`/`deleteClient`).

### 🎨 Redesign kartu klien
- Kartu **List**: hierarki diperjelas — nama warung besar, badge status di kanan,
  baris kontak (`👤 pemilik`, `💬 WA`, `📍 wilayah`) terpisah, footer memuat
  waktu terakhir terhubung + dropdown status + tombol bukti (bila verifikasi).
- Kartu **Kanban**: ikon waktu `🕒` di footer, chip kontak lebih ringkas.
- Styling baru: `.client-card-head`, `.client-contact`, `.cc`, `.client-foot`,
  `.status-select`, `.cd-head`, `.cd-title` di `style.css`.


## [1.4.1] - 2026-08-11 (Konsolidasi Modul Lisensi → Klien & Katalog)

### 🔀 Modul Lisensi dihapus (digabung)
- Menu sidebar **Lisensi** dihapus; `js/license-ui.js` dilepas (dead code).
- **Verifikasi Serial** dipindah ke sheet Klien (`js/clients.js`): blok
  `🔎 Verifikasi Serial` di bawah `⚡ Generate Lisensi`, fungsi
  `window.verifyClientSerial` via `/api/license` (HMAC server-side).
  `formatExpiry` diambil dari `js/license-core.js` (tetap dipertahankan).
- **Kelola Produk** sudah penuh di modul **Katalog** (`products`), jadi registry
  & form produk lisensi dihilangkan.
- Fitur **Referral** & **Backup/Restore** lisensi di-drop.
- Header `#licenseChip`, `#sheetProduct`, `#sheetLicense`, `#screen-license`
  dihapus dari `index.html`; import/init `initLicense` dihapus dari `app.js`.
- `closeSheet` dipindah dari license-ui ke `js/overlay-a11y.js` (dipakai
  sheetOnboarding & sheetLeadDetail yang masih ada).
- `sw.js`: cache bump `v9`, hapus `/js/license-ui.js` dari static assets.


## [1.4.0] - 2026-08-11 (Pipeline Satu-Tabel `clients` + UI List/Kanban)

### 🔀 Pipeline konsolidasi: `leads` & `pembelian` dihapus
- Tabel **`leads`** dan **`pembelian`** DROPPED dari Supabase (lewat Management API).
  Seluruh pipeline marketing kini digarap di **satu tabel `clients`**
  (baru → dihubungi → tertarik → menunggu_verifikasi → aktif/batal).
  Data lama (2 leads + 1 pembelian) sudah dikonsolidasi & diverifikasi di `clients`.
- Whitelist proxy di `api/rest.js` disempitkan:
  `ALLOWED_REST_TABLES = ['clients', 'products']` (leads/pembelian tidak lagi diizinkan).
- `js/pembelian.js` dihapus (dead code) — app klien (`kaki5/js/purchase.js`)
  juga sudah menulis pipeline ke `clients`, bukan `pembelian`.

### 🗂 UI Klien rombak: List + Kanban
- Layar **Klien** kini punya 2 mode tampilan via toggle: **List** (kartu + filter)
  dan **Kanban** (6 kolom pipeline, drag-drop status).
- `js/clients.js`: `PIPELINE_STAGES`, `renderKanban()`, `switchClientView()`,
  `updateClientStatus()` — konsisten untuk List & Kanban (via `/api/rest`).
- Dashboard KPI & "aktivitas terbaru" mengikuti pipeline `clients`.

## [1.3.6] - 2026-08-10 (Landing Product Status: live/ready/maintenance/development)

- Kolom `status` baru di tabel `products` (default NULL = auto-derive). Logika
  status saling terhubung dipakai konsisten di admin & landing:
  - Link live & vercel keduanya kosong -> otomatis **development** (fallback).
  - Status `live` / auto-derive -> **live** jika store_url ada, **ready** bila
    cuma vercel_url terisi.
  - Status `ready`/`maintenance` -> dipertahankan selama ada link.
- Admin `js/catalog.js`: dropdown Status di sheet produk, chip status di kartu,
  kirim `status` saat create/update (via proxy `/api/rest`).
- Landing `index.html`: badge status (LIVE/READY/MAINTENANCE/DEVELOPMENT),
  tombol "Buka Aplikasi" pakai actionUrl (live -> store_url; ready/maintenance
  -> store_url, fallback vercel), "Konsultasi" saat development.
- Migration SQL: `admin/scripts/migration-product-status.sql`.

## [1.3.5] - Dev Server Vercel CLI

- Setup dev lokal pakai Vercel CLI (`vercel dev`, port 8082) — API routes
  `/api/rest` & `/api/license` sekarang jalan di lokal (sebelumnya 501 karena
  Python http.server cuma static).
- Catatan setup: project rootDirectory = `admin`; `vercel dev` harus jalan
  dari root repo `kasol/`. Env dibaca dari `.env` di root repo.
- `.env.local` lokal ditambah `ADMIN_API_KEY` (dev-only) biar gate fail-closed
  lolos di dev. Jangan commit `.env*` — berisi service role key.

## [1.3.4] - 2026-08-10 (Bug Fix - Service Worker selalu return Response)

### sw.js tidak lempar "Failed to convert value to 'Response'" / "Failed to fetch"
- Branch JS/CSS (fetch fallback) & branch default (network-first) sebelumnya bisa
  menghasilkan nilai undefined saat fetch gagal offline & tidak ada cache, sehingga
  browser melempar error SW tadi. Sekarang selalu fallback ke Response valid
  (503/404) -- tidak pernah espondWith(undefined).
- Cache name di-bump ke kasir-admin-v8 supaya browser meng-install SW baru dan
  membersihkan cache lama yang rusak.
## [1.3.3] - 2026-08-10 (Security Fix C3 - Closing remaining stored XSS)

### Stored XSS ditutup di kartu Pembelian (C3)
- **`js/clients.js`** - `pembelianCardHtml()` (duplikat dari `js/pembelian.js`) masih
  menginterpolasi data merchant TANPA escape: `status`, `bukti_url`, `id`, `unit_id`,
  `app_type`, `serial`. Karena data pembelian dibuat oleh merchant/klien (untrusted),
  buka tab Klien = stored XSS aktif. Sekarang semua field user-controlled ke-`escapeHtml()`-kan,
  konsisten dengan implementasi di `js/pembelian.js` yang sudah aman.
- `escapeHtml()` (C2) sudah diverifikasi: 9 payload XSS (`<img onerror>`, `<script>`,
  atribut-breakout `\" autofocus`, dsb) semuanya ter-escape; guard null/undefined tidak
  menjatuhkan nilai 0.
- Verifikasi behavior render card: 6/6 cek PASS, tidak ada raw `<img>`/`<script>` bocor.
## [1.3.2] - 2026-08-10 (Security Fix H1 - Gate endpoint fail-closed)

### Gate /api/rest & /api/license di-hardening (H1)
- **`api/_gate.js` (baru)** - helper gate bersama: **fail-closed** + **constant-time**
  (`timingSafeEqual`). Kalau `ADMIN_API_KEY` TIDAK diset di env, kedua endpoint
  return **503 `server_not_configured`** (sebelumnya kebypass / terbuka total).
- **`api/rest.js`** - pakai `checkAdminGate()`; perbandingan header `x-admin-key`
  sekarang constant-time (anti timing-side-channel), ganti dari `!==` string.
- **`api/license.js`** - penerapan gate yang sama (konsisten dgn rest).
- **`.env.example`** - `ADMIN_API_KEY` kini di-tag WAJIB (fail-closed).
- Catatan: login admin resmi tetap **DITUNDA** (lihat `../CONTEXT.md`). Ini bukan
  pengganti auth, hanya pematokan gate eksisting biar tidak terbuka.

## [1.3.1] - 2026-08-10 (Security Fix C1 â€” Lisensi server-side)

### ðŸ”’ Lisensi dipindah ke server-side (tidak bisa dipalsukan offline)
- **`api/license.js` (baru)** â€” Vercel Serverless yang memegang HMAC salt
  **server-side only** (env `LICENSE_SALT_*` / `LICENSE_SALTS`, fallback konstanta
  di file). Endpoint `generate` & `verify` dilindungi gate `ADMIN_API_KEY`
  (sama seperti `/api/rest`).
- **Hapus salt dari client:** `js/clients.js` (`APP_META`) dan `js/license-ui.js`
  (`FALLBACK_REGISTRY`, `loadProductsFromSupabase`) tidak lagi menyimpan/menampilkan
  salt produk resmi. Tab Lisensi & tombol "Generate di kartu Klien" kini call
  `/api/license` via `licenseApi()` (helper baru di `js/api.js`).
- Sebelumnya salt di-hardcode di bundle client & serial bisa digenerate offline
  oleh siapa pun tanpa bayar â€” sekarang salt & crypto cuma ada di server.
- UI registry menampilkan "ðŸ”’ Salt di server" (tidak menampilkan salt lagi).
- Produk kustom tetap didukung: salt override dikirim per-request (tidak di-bundle).
- **`.env.example`** didokumentasikan dengan var salt server-side.
- `escapeHtml` di `utils.js` diperbaiki (no-op â†’ escape sebenarnya), menutup XSS.

## [1.3.0] - 2026-08-08 (Leadsâ†’Klien + Lisensi HMAC-V2 universal)

### ðŸ“‡ Leads digabung ke Klien
- Screen & menu **"Leads" terpisah dihapus** â†’ leads kini **tab "Leads"** di dalam
  layar **Klien** (`screen-klien`, `.tab-bar` Outlet/Leads).
- `js/clients.js` kini menangani keduanya: `loadClients` (tabel `clients`) +
  `loadLeads` (tabel `leads` â†’ `STATE.leads` sehingga dashboard overview tetap terisi),
  `renderLeadsTable`, status update, delete, `exportLeadsCSV`, `openLeadDetail`.
- Tab wiring `switchKlienTab` di `initClients`. **`js/leads.js` dihapus.**

### ðŸ”‘ Lisensi HMAC-V2 universal (gerobak & retail kini valid)
- Gerobak (`gerobak/index.html`) di-port ke **GBK** HMAC-V2
  (`KASIRSOLO-GEROBAK-HMAC-V2`); retail (`retail/index.html`) di-port ke **RTL**
  HMAC-V2 (`KASIRSOLO-RETAIL-HMAC-V2`); keduanya backward-compatible dengan
  skema lama masing-masing.
- Kini **ke-4 salt admin** (KSR/KK5/GBK/RTL) cocok dengan app klien â†’
  semua serial yang di-generate admin bisa diaktivasi (diverifikasi end-to-end).

### ðŸ§¹ Hygiene
- `manifest.json` `theme_color` disinkronkan ke `#EA5129` (== `--brand` produksi).
- `.vercelignore` mengecualikan `proto/`, `proto2/`, `.pre-proto2-backup/`,
  `prototype-redesign.html`, `*.backup*` dari deploy.
- Naming convention salt diperbarui ke `KASIRSOLO-{APP}-HMAC-V2`.

---

## [1.2.0] - 2026-08-07 (CRM Klien + Sinkronisasi Profil)

### ðŸ“‡ Tab Klien (CRM) â€” baru
- `js/clients.js` + nav/halaman **Klien**: analitik (total outlet, aktif 30 hari,
  per app), daftar klien (cari + filter), detail/edit/delete.
- Data dari Supabase tabel **`clients`** (profil outlet yang dikirim app klien via
  `sync.js`) â€” akses via **service_role**.

### âš¡ Generate lisensi langsung dari kartu klien
- Dari kartu klien bisa **generate serial** (produk + device code otomatis terisi)
  + **Copy** + **Kirim via WhatsApp** ke nomor merchant â€” tanpa pindah menu.
- **Fix bug**: prefix produk kaki5 `K5` â†’ **`KK5`** (selama ini serial kaki5 yang
  digenerate admin DITOLAK app karena regex kaki5 pakai `KK5`). Registry + ikon ikut berubah.

### ðŸ—ºï¸ Analitik wilayah
- Kolom wilayah tersruktur (`provinsi/kabkota/kecamatan`) di `clients` â†’ fondasi
  agregasi analitik per daerah yang akurat.

---

## [1.1.0] - 2026-08-07 (Audit Menyeluruh + Deploy Model Baru)

### ðŸ” Lisensi
- **Salt disamakan ke salt asli app klien** â€” `PRODUCT_REGISTRY` memakai `KASIRSOLO-ROSOK-HMAC-V2` / `KASIRSOLO-KAKI5-HMAC-V2` (dulu `-SALT-2024`, salah). Dampak: serial yang di-generate admin kini **valid & bisa diaktifkan** di app rosok/kaki5 (diverifikasi end-to-end dengan meniru logika `validateLicenseKeyV2`).
- Field "Unit ID" ðŸ’¬ diganti **"Device Code (dari app klien)"** + hint â€” serial terikat ke device code, bukan unitId toko.

### âš™ï¸ Tombol / handler yang sebelumnya mati â†’ aktif
- `exportLeadsCSV()` (Export CSV Leads)
- `openLeadDetail(id)` (klik aktivitas terbaru di dashboard)
- `openLicenseSheet()` (chip LICENSE di header)
- `finishAdminOnboarding()` (tombol onboarding)
- `exportLicenseBackup()` / `importLicenseBackup()` (backup & restore lisensi)

### ðŸ› Bug
- Status lead tersimpan sebagai **label emoji** (`ðŸ†• Baru`) bukan kunci (`baru`) â†’ `<option value="key">`. Dashboard/filter/statistik kini benar.
- KPI **"Aplikasi Aktif" selalu 0** â†’ filter `c.visible !== false` (sebelumnya `c.active`).

### ðŸ’¾ Storage
- `storage.js` kini punya **fallback ke `window.localStorage`** â€” data persist di browser produksi biasa (dulu hanya jalan di environment yang inject `window.storage`).

### â˜ï¸ Supabase
- **Wiring dipulihkan:** `js/env-loader.js` + `js/supabase-client.js` + tag script di `index.html` (file sempat tidak ada di produksi).
- **Build step baru:** `scripts/build-env-loader.mjs` menulis `js/env-loader.js` dari **Vercel environment variables / konektor Supabase** saat deploy â€” key **tidak pernah di-commit**. Fail-safe (exit 0 jika env kosong).

### ðŸ§¹ Pembersihan
- Buang unused import (catalog, license-ui, navigation, settings), dedupe `escapeHtml` di dashboard (import dari utils).
- Manifest shortcut `/#overview` â†’ `/#dashboard`; SW cache `v1` â†’ `v2`; `.vercelignore` kecualikan `migrate-catalog-to-supabase.html` & `run-migration.html`.

### ðŸš€ Deploy
- **GitHub Actions tidak dipakai lagi** (semua `.github/workflows/*` dihapus). Deploy via **Vercel git integration (auto-detect)** â€” project `kasir-admin`, Root Directory `admin/`, build command `node scripts/build-env-loader.mjs`.

---

## [1.0.0] - 2026-08-06 (Modular ESM Refactor)

- Refactor ke modular ESM (`js/app-state.js`, `js/*.js`, entry `js/app.js`), hapus inline single-file.
- Katalog, Settings, Leads, License, Dashboard sebagai module terpisah dengan storage abstraction.
- CSS class contract & empty-state; backup/import admin.
