# Changelog — Admin Marketing KASIRSOLO

Semua perubahan dicatat per tanggal, versi terbaru di atas.

## [1.3.0] - 2026-08-08 (Leads→Klien + Lisensi HMAC-V2 universal)

### 📇 Leads digabung ke Klien
- Screen & menu **"Leads" terpisah dihapus** → leads kini **tab "Leads"** di dalam
  layar **Klien** (`screen-klien`, `.tab-bar` Outlet/Leads).
- `js/clients.js` kini menangani keduanya: `loadClients` (tabel `clients`) +
  `loadLeads` (tabel `leads` → `STATE.leads` sehingga dashboard overview tetap terisi),
  `renderLeadsTable`, status update, delete, `exportLeadsCSV`, `openLeadDetail`.
- Tab wiring `switchKlienTab` di `initClients`. **`js/leads.js` dihapus.**

### 🔑 Lisensi HMAC-V2 universal (gerobak & retail kini valid)
- Gerobak (`gerobak/index.html`) di-port ke **GBK** HMAC-V2
  (`KASIRSOLO-GEROBAK-HMAC-V2`); retail (`retail/index.html`) di-port ke **RTL**
  HMAC-V2 (`KASIRSOLO-RETAIL-HMAC-V2`); keduanya backward-compatible dengan
  skema lama masing-masing.
- Kini **ke-4 salt admin** (KSR/KK5/GBK/RTL) cocok dengan app klien →
  semua serial yang di-generate admin bisa diaktivasi (diverifikasi end-to-end).

### 🧹 Hygiene
- `manifest.json` `theme_color` disinkronkan ke `#EA5129` (== `--brand` produksi).
- `.vercelignore` mengecualikan `proto/`, `proto2/`, `.pre-proto2-backup/`,
  `prototype-redesign.html`, `*.backup*` dari deploy.
- Naming convention salt diperbarui ke `KASIRSOLO-{APP}-HMAC-V2`.

---

## [1.2.0] - 2026-08-07 (CRM Klien + Sinkronisasi Profil)

### 📇 Tab Klien (CRM) — baru
- `js/clients.js` + nav/halaman **Klien**: analitik (total outlet, aktif 30 hari,
  per app), daftar klien (cari + filter), detail/edit/delete.
- Data dari Supabase tabel **`clients`** (profil outlet yang dikirim app klien via
  `sync.js`) — akses via **service_role**.

### ⚡ Generate lisensi langsung dari kartu klien
- Dari kartu klien bisa **generate serial** (produk + device code otomatis terisi)
  + **Copy** + **Kirim via WhatsApp** ke nomor merchant — tanpa pindah menu.
- **Fix bug**: prefix produk kaki5 `K5` → **`KK5`** (selama ini serial kaki5 yang
  digenerate admin DITOLAK app karena regex kaki5 pakai `KK5`). Registry + ikon ikut berubah.

### 🗺️ Analitik wilayah
- Kolom wilayah tersruktur (`provinsi/kabkota/kecamatan`) di `clients` → fondasi
  agregasi analitik per daerah yang akurat.

---

## [1.1.0] - 2026-08-07 (Audit Menyeluruh + Deploy Model Baru)

### 🔐 Lisensi
- **Salt disamakan ke salt asli app klien** — `PRODUCT_REGISTRY` memakai `KASIRSOLO-ROSOK-HMAC-V2` / `KASIRSOLO-KAKI5-HMAC-V2` (dulu `-SALT-2024`, salah). Dampak: serial yang di-generate admin kini **valid & bisa diaktifkan** di app rosok/kaki5 (diverifikasi end-to-end dengan meniru logika `validateLicenseKeyV2`).
- Field "Unit ID" 💬 diganti **"Device Code (dari app klien)"** + hint — serial terikat ke device code, bukan unitId toko.

### ⚙️ Tombol / handler yang sebelumnya mati → aktif
- `exportLeadsCSV()` (Export CSV Leads)
- `openLeadDetail(id)` (klik aktivitas terbaru di dashboard)
- `openLicenseSheet()` (chip LICENSE di header)
- `finishAdminOnboarding()` (tombol onboarding)
- `exportLicenseBackup()` / `importLicenseBackup()` (backup & restore lisensi)

### 🐛 Bug
- Status lead tersimpan sebagai **label emoji** (`🆕 Baru`) bukan kunci (`baru`) → `<option value="key">`. Dashboard/filter/statistik kini benar.
- KPI **"Aplikasi Aktif" selalu 0** → filter `c.visible !== false` (sebelumnya `c.active`).

### 💾 Storage
- `storage.js` kini punya **fallback ke `window.localStorage`** — data persist di browser produksi biasa (dulu hanya jalan di environment yang inject `window.storage`).

### ☁️ Supabase
- **Wiring dipulihkan:** `js/env-loader.js` + `js/supabase-client.js` + tag script di `index.html` (file sempat tidak ada di produksi).
- **Build step baru:** `scripts/build-env-loader.mjs` menulis `js/env-loader.js` dari **Vercel environment variables / konektor Supabase** saat deploy — key **tidak pernah di-commit**. Fail-safe (exit 0 jika env kosong).

### 🧹 Pembersihan
- Buang unused import (catalog, license-ui, navigation, settings), dedupe `escapeHtml` di dashboard (import dari utils).
- Manifest shortcut `/#overview` → `/#dashboard`; SW cache `v1` → `v2`; `.vercelignore` kecualikan `migrate-catalog-to-supabase.html` & `run-migration.html`.

### 🚀 Deploy
- **GitHub Actions tidak dipakai lagi** (semua `.github/workflows/*` dihapus). Deploy via **Vercel git integration (auto-detect)** — project `kasir-admin`, Root Directory `admin/`, build command `node scripts/build-env-loader.mjs`.

---

## [1.0.0] - 2026-08-06 (Modular ESM Refactor)

- Refactor ke modular ESM (`js/app-state.js`, `js/*.js`, entry `js/app.js`), hapus inline single-file.
- Katalog, Settings, Leads, License, Dashboard sebagai module terpisah dengan storage abstraction.
- CSS class contract & empty-state; backup/import admin.
