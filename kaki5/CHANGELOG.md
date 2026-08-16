# Changelog — Kasir Solo Kaki Lima (kaki5)

Semua perubahan dicatat per tanggal, versi terbaru di atas.

## 2026-08-17 (v63: halaman "Lisensi Dicabut" bergaya gate)
- **Layar lisensi dicabut kini halaman penuh putih** dengan struktur persis halaman gate lisensi (permintaan pemilik 2026-08-17): logo + Kasir Solo/Kaki Lima Edition, judul merah "Lisensi Dinonaktifkan", tombol 💳 Beli Lisensi (QRIS) + 💬 Tanya Admin, tautan "Sudah punya kode baru? Aktivasi manual" (input serial → `activateLicense`), footer kontak WhatsApp. Mengganti kartu kecil di overlay gelap.
- Implementasi: `#lockRevokedPage` baru di dalam `#lockOverlay` + kelas `.revoked-page` (latar putih penuh); mode di-sinkronkan di `checkLicenseGate` (`setLockMode`) sehingga kondisi lain (trial habis) tetap memakai kartu default.
- E2e lengkap terverifikasi: cloud diset `batal` → halaman baru tampil → aktivasi via edge function `activate-license` (auth x-admin-key, serial KK5-00ZZ-O9VD-99-NHDRBL) → reload → auto-unlock "LISENSI ✓ Aktif".
- Versi: `1.0.12` / `v63` sinkron 5 titik.

## 2026-08-17 (v62: tombol perpanjangan langsung ke WhatsApp)
- **"🎁 Tambah 1 Hari Gratis" kini langsung membuka WhatsApp** (`wa.me` dengan teks promo + link aplikasi terisi; mobile → aplikasi WhatsApp, desktop → WhatsApp Web). Dulu: contact picker OS / share sheet — membingungkan ("kok ke kontak?"). Alur setelahnya tetap: konfirmasi "sudah dibagikan?" → +1 hari (maks 20x).
- Versi: `1.0.11` / `v62` sinkron 5 titik. E2e: klik tombol → tab wa.me dengan teks terisi.

## 2026-08-17 (v61: panel kalender lebih kontras)
- **Panel pemilih tanggal (#customPicker)** — kalender harian/custom, opsi minggu, opsi bulan — kini berlatar krem-oranye brand (`--orange-bg`), border oranye lembut, dan bayangan mengambang, sehingga jelas terbedakan dari kartu-kartu laporan di bawahnya. Sel tanggal, opsi minggu & bulan tetap putih agar terbaca. Style pindah dari inline (laporan.js) ke kelas CSS (`.date-nav .custom-picker`). (Permintaan pemilik 2026-08-17.)
- Versi: `1.0.10` / `v61` sinkron 5 titik.

## 2026-08-17 (v60: fix akordeon rincian pengeluaran)
- **Bug (laporan user):** akordeon kategori pengeluaran tidak membuka di filter Mingguan/Bulanan/Custom — daftar transaksi di dalam panel hanya dirender untuk periode Harian (panel terbuka tapi kosong). Kini semua periode menampilkan daftarnya; untuk periode lintas hari tiap baris menampilkan tanggal + jam (contoh: "17 Agu 2026 · 04:30").
- Versi: `1.0.9` / `v60` sinkron 5 titik. E2e: klik kategori di Mingguan → panel terbuka berisi item.

## 2026-08-17 (v59: kotak kembalian selalu tampil)
- **Kotak 💰 Kembalian kini SELALU tampil** di layar pembayaran (sebelumnya tersembunyi sampai uang diterima diisi). Modal dibuka → "Rp 0" (uang pas); uang belum cukup → tetap "Rp 0"; cukup/lebih → angka kembalian. (Permintaan pemilik 2026-08-17.)
- E2e: buka modal → box tampil Rp 0; preset 20.000 utk total 15.000 → Rp 5.000.
- Versi: `1.0.8` / `v59` sinkron 5 titik.

## 2026-08-17 (v58: Fase 4-5 — UI & kebersihan, penutup audit 2026-08-17)
- **T17/M7**: `bottom-nav` z-index 700 → **350** sesuai kontrak ekosistem (modal/gate/toast kini di atas nav; sebelumnya nav menutupi semuanya). Kontrak z-index CONTEXT.md diperbarui lengkap termasuk `#updateOverlay 800`.
- **T18/M8**: tab kategori POS pakai `data-cat` + delegasi (mengganti interpolasi string mentah ke onclick — rapuh terhadap kategori dari cadangan buatan).
- **T19/M9**: `boot()` tidak menggantung selamanya saat settings module gagal termuat — race timeout 8 detik + toast + tetap lanjut (setupPWA, subscribe).
- **T22/L2**: `checkExpired` clamp tanggal bulanan (31 Jan + 1 bln = 28/29 Feb, bukan 3 Mar).
- **T23/L3**: `./js/version.json` masuk precache SW (cek versi kini jalan offline); komentar strategi SW dikoreksi (network-first).
- **T25/L5**: teks "Hapus Semua Data" jujur menyebut status lisensi dipertahankan.
- **T26/L6**: `Math.max(...arr)` di laporan → reduce (aman dataset ekstrem).
- **T27/L8**: dead exports dihapus (`getLicenseSyncState`, `isWithinLicenseGracePeriod`, `activateLicenseCloud`, `NETWORK_GRACE_DAYS`).
- **T28/L9**: manifest dibersihkan dari key non-standar; **T21**: file `*.bak` dihapus.
- **T24/L4**: dokumen disinkronkan — README (?v=58), DEVELOPER.md (versi SW generik), CONTEXT.md (onboarding = Nomor WhatsApp, kontrak z-index + updateOverlay, aturan bump 5 titik + notes).
- Versi: `1.0.7` / `v58` sinkron 5 titik. Validasi: 41/41 modul, validate 30/30, pos 6/6.
- **STATUS PLAN: Fase 0-5 selesai.** Sisa backlog opsional: T20 self-host data wilayah, D4 validasi lisensi server-side (roadmap cloud).

## 2026-08-17 (v57: Fase 3 — robustness lisensi)
- **T12/M1 — Trial berjangkar cloud**: `startTrial(anchorStartedAt)` menerima `clients.first_seen`; `continueKnownDevice` meneruskannya sehingga hapus data lokal / install ulang **tidak me-reset jatah trial** (first_seen > 7 hari → langsung gate beli lisensi, bukan trial baru).
- **T13/M3 — Anti-rollback jam**: `clockAnchor` (waktu tertinggi yang pernah app lihat, diperbarui saat cek lisensi & sync sukses). Jam perangkat dimundurkan > 2 hari → "sekarang" efektif = anchor → trial/lisensi yang habis tidak hidup lagi. `checkExpired`/`getLicenseStatus`/`isLicensed` pakai `getEffectiveNow()`.
- **T14/M4 — Fingerprint V3**: zona waktu & devicePixelRatio dikeluarkan dari komposit (ganti zona waktu/zoom display tidak lagi mengubah deviceCode → tidak ada lagi "kode bukan untuk perangkat ini" karena bepergian). Aman diterapkan sekarang karena belum ada serial berbayar terbit. Pendukung: `readLicenseRow` kini keyed by **unit_id** (kekal) bukan device_code; `unit_id` tersimpan dipertahankan sehingga baris cloud & identitas perangkat tetap tersambung, kolom device_code menyegarkan via sync.
- **T15/M5 — Wire callback UI lisensi**: `window._ksr_updateTrialChip/_ksr_checkLicenseGate/_ksr_renderLicenseInfoCard` kini di-wire di app.js — refresh chip/kartu pasca-aktivasi realtime/polling tidak lagi menunggu interval 60 detik.
- **T16/M6 — Polling ber-cancel token**: memulai poll baru membatalkan rantai lama (tidak lagi tumpuk timer paralel saat submit berulang).
- Versi: `1.0.6` / `v57` sinkron 5 titik. Validasi: 41/41 modul, validate 30/30.

## 2026-08-17 (v56: Fase 1 — integritas data cadangan)
- **T6/H4 — Restore transaksional**: clear+insert dibungkus `DB.transaction('rw', …)` — gagal di tabel mana pun = rollback total, data lama tetap utuh (dulu: clear duluan tanpa transaksi, file rusak di tengah = data lenyap).
- **T6 — Validasi dua lapis**: selain bentuk array, kini field per tabel divalidasi (nama/harga menu, tanggal-transaksi format, total, items, jumlah pengeluaran, key settings) + id wajib positive-integer + id tidak boleh ganda dalam satu tabel. File rusak ditolak DI DEPAN dengan pesan spesifik, bukan meledak di tengah restore.
- **T7/H5 — Lisensi keluar dari file cadangan**: `sanitizeSettingsRows()` membuang `license`, `onboarded`, `sync`, `installId`, `unitId`, `deviceIdentity` dari ekspor DAN impor — file cadangan lama yang masih memuat license otomatis netral saat dipulihkan; kloning lisensi antar perangkat via file cadangan tertutup. Keputusan D2: buang total.
- **Fix overlay force-update palsu**: `pwa.js` memanggil `notifyUpdateAvailable(string)` saat event SW `updatefound` (kontrak lama) → overlay muncul walau versi sama. Pemanggil dihapus (sumber kebenaran versi = version.json), dan `notifyUpdateAvailable` dikeraskan: abaikan pemanggil tanpa objek remote valid / versi sama. (Bug ketemu live saat uji v56.)
- Validasi: `test_validate.js` diperluas 14 → 30 kasus (field rusak, id ganda, filtering) — 30/30.
- Versi: `1.0.5` / `v56` sinkron 5 titik.

## 2026-08-17 (v55: Force Update Overlay)
- **Notifikasi versi baru jadi overlay full-screen** (`#updateOverlay`, z-index 800 — menutup seluruh dashboard termasuk navbar; tidak bisa ditutup kecuali tombol). Toast lama jadi fallback.
- **Catatan perubahan per rilis**: `version.json` kini punya field `notes` (array) — dirender sebagai daftar "Yang baru di versi ini" (di-escape, fallback default bila kosong).
- **Tombol "OKE"** = pemicu `performForceUpdate()` (SW update → reload). Reload menjalankan boot() → profil tersinkron ke server — jadi setiap rilis baru otomatis jadi momen backfill profil user lama.
- Versi: `1.0.4` / `v55` sinkron 5 titik.

## 2026-08-17 (v54: Fase 0 + Sync Robust — hasil audit 2026-08-17)
- **T8/H3 Fix false-revoke** (`license.sync.js`): baris clients yang tak terlihat RLS (user_id NULL / milik session lain) tidak lagi otomatis dianggap "terhapus" → dibuat session ber-metadata `unit_id` lalu **dibaca ulang**; revoke hanya jika benar-benar hilang. Revoke lama bertanda `not-found` yang barisnya ternyata ada **otomatis dipulihkan**. (Bug ini kejadian nyata: fresh install di perangkat dikenal cloud langsung terkunci "Lisensi Dicabut".)
- **T29 Sync robust** (`sync.js`, `sync.health.js` baru): flag `synced` diverifikasi ke server max 1×/24 jam — baris hilang otomatis di-push ulang (self-heal); retry loop 5 menit saat pending + trigger `online`; toast alasan spesifik per tahap; tabel `sync_errors` (RLS insert-only, migration `supabase/migration-sync-errors.sql`); panel **🩺 Diagnosa Sinkronisasi** (10 langkah + Salin Hasil) di Pengaturan → Data & Cadangan.
- **T1**: navigasi laporan tanpa inline onclick — delegasi klik via `data-*` (`data-date/start-date/month-date/catid`, `.trx-detail-item/.expense-detail-item`).
- **T2**: pulihkan `.license-lock-card` (hapus `display:none !important` yang bikin layar kunci kosong).
- **T3**: CSP `connect-src` + `https://raw.githubusercontent.com` (region picker emsifa tidak lagi diblokir).
- **T4**: script unregister SW di-guard hostname (localhost/127.0.0.1) — produksi tidak lagi membongkar SW tiap load (offline-first hidup kembali).
- **Perbaikan fondasi**: re-export `helpers.pure.js` dari `helpers.js` (tanpa ini 19 modul gagal load), bersihkan orphan ref `customStartInput/customEndInput`, `boot()` tahan banting (try/catch per langkah, sync tetap jalan), stub MutationObserver di test-shim.
- Versi: `APP_VERSION 1.0.3` · `CACHE_BUST v54` · `CACHE_NAME v54` · `?v=54` · `version.json` — sinkron.
- Validasi: `test-modules.js` 41/41 + DOM id 0 orphan, `test-imports.js` 41/41, `test_validate` 14/14, `test_pos` 6/6; end-to-end browser: onboarding → trial → isi profil → baris `clients` ter-update → Diagnosa 10/10 ✅.

## 2026-08-13 (P8: Smart Button Bukti Bayar + Harga dari products)
- **🔘 "Kirim Bukti Bayar" jadi smart button** — klik langsung buka file picker foto
  perangkat (hidden input), tampil preview + nama file, lalu tombol berubah jadi submit.
  Satu aksi, tanpa dobel-step (sebelumnya harus pilih file dulu baru kirim).
- **Harga & kode produk dari `products`** — pembelian tidak lagi mengirim/menyimpan
  kolom `harga`; harga diambil dari `products.price_label` & `kode_produk` (filter
  `app_type=eq.kaki5&visible=eq.true`), dikirim ke `clients` (kolom `harga` sudah di-drop).
- **Upload bukti** ke bucket `bukti` (privat) → `bukti_url` simpannya path objek.
  Admin lihat via signed URL (15 menit).

## 2026-08-11 (P7: Seragamkan window-wiring — semua handler di app.js)
- Hapus **self-wire** di modul: `purchase.js` (5 handler), `settings.sync.js` &
  `settings.js` (`_ksr_syncNow`, duplikat), `bantuan.js` (`initBantuan`,
  `toggleTutorial`). Kini **function handler hanya di-wire di `app.js`** (konvensi R3).
- `app.js`: wire purchase handlers + `_ksr_syncNow` secara eksplisit; tambah
  `toggleTutorial` ke `_bantuanWireMap` (dipakai onclick global tanpa prefix).
- Shared-state `window.*` (config/client cache) tetap di modul — di luar scope R3.
- Tanpa bump versi/cache-version (logika internal wiring saja).
- Validasi: `test-modules.js` 38/38 + lint DOM 0 orphan, `test-imports.js` 38/38,
  `test_validate` 14/14 — semua exit 0.

## 2026-08-11 (P6: Perkuat lisensi â€” harden core logic + obfuscate salt)
- **Enforce MAX_EXTENSIONS di core logic** (`grantExtensionLogic`): function kini
  return `{ granted:false, reason:'max' }` saat jatah habis, bukan sekadar increment
  (sebelumnya cap cuma di UI layer â€” bisa di-bypass via console). UI `grantExtension`
  menangani `granted:false` dengan toast error.
- **Sanitize counter**: `grantExtensionLogic` & `trialEndDate` kini menolak nilai
  `extensionsUsed` negatif/NaN yang bisa dipakai memanipulasi masa trial (trial abadi).
- **Obfuscate salt**: `PRODUCT_SALT` tidak lagi konstanta plain yang greppable â€”
  di-derive runtime via `buildProductSalt()`. Â± defense-in-depth (security-through-
  obscurity), bukan pengganti validasi server. Trade-off offline PWA didokumentasikan.
- **Tidak ada bump versi/**cache-version (logika internal saja, tanpa public-facing
  constant index.html/sw).
- Validasi: `test-modules.js` (38/38 + lint DOM 0 orphan) & `test-imports.js` (38/38), exit 0.

## 2026-08-11 (P5: Self-Host supabase-js agar offline-cache-able)

- **Self-host supabase-js (P5/K6)**: download `@supabase/supabase-js@2.112.2` (UMD, `var supabase` → `window.supabase`) ke `js/supabase.min.js` (211KB). `index.html` tidak lagi load dari `https://cdn.jsdelivr.net/...` — kini file lokal, jadi bisa **di-precache** oleh SW.
- **Akar masalah (K6)**: fetch handler SW cuma `response.type === 'basic'` — supabase dari CDN cross-origin (type `cors`/`opaque`) **tidak pernah masuk cache**, jadi sync tak tersedia offline. Dengan self-host, file jadi same-origin `basic` → bisa `cache.addAll`.
- **SW precache**: tambah `./js/supabase.min.js` ke `ASSETS_TO_CACHE`; bump `CACHE_NAME = 'kasir-solo-kaki5-v41'`.
- **Versi di-sync (P4 rule)**: cache-bust `?v=47 → ?v=48` di `index.html` & `README.md`.
- **Tes**: `test-modules.js` & `test-imports.js` **38/38** (supabase.min.js ikut ke-scan, valid), lint DOM id 0 orphan, `test_validate` 14/14, `test_pos` 6/6 — semua exit 0.
- **Docs**: `AUDIT-REPORT.md` §12, `DEVELOPER.md` §2/supabase, `REGRESSION-CHECKLIST.md` cache-version table.

## 2026-08-11 (P4: Anti-Regression Checklist DOM id + Version Bump)

- **Lint DOM id otomatis (P4)**: file baru `test-html-refs.js` — scan semua `getElementById('...')` di 37 modul & verifikasi tiap id resolve ke `index.html` atau dibuat dinamis. Exit 1 kalau ada ref orphan (mencegah regresi senyap ala `#licenseInfoCard`/`#syncStatusText` yang pernah hilang tanpa error karena null-guard).
- **Gate diperkuat**: `test-modules.js` kini menjalankan lint DOM id di akhir run & exit 1 kalau ada orphan — satu perintah = syntax + real-import + anti-regresi id.
- **Dokumen baru** `docs/REGRESSION-CHECKLIST.md`: daftar id kritis (licenseInfoCard, syncStatusText, licUnit, installBanner, licenseGate) + trap order-of-operations untuk id yang di-inject dinamis + aturan bump cache version (APP_VERSION/CACHE_BUST di `js/version.js`, `CACHE_NAME` di `sw.js`, `?v=` di `index.html` & `README.md` wajib naik bareng).
- **Docs**: `DEVELOPER.md` §6 & §10 + unit-test lint; `AUDIT-REPORT.md` mencatat §11 (P4).
- Hasil lint bersih: **159 ref getElementById, 0 orphan**; `test-modules.js` & `test-imports.js` 37/37 exit 0.

## 2026-08-11 (P1–P3: Sentralisasi Versi + Test Harness Reliable)

- **Sentralisasi versi (P1/N7/K8)**: file baru `js/version.js` jadi satu sumber `APP_VERSION` (`1.0.0`). `app.js` me-wire `window.APP_VERSION` + mengisi label `#appVersionLabel`; `index.html` tidak lagi hard-code "Versi 1.0"; cache-bust `?v=46 → ?v=47` disinkronkan di `README.md`.
- **Test harness reliable (P2/K4)**: file baru `test-shim.js` (stub global Dexie/window/document/dll). `test-imports.js` di-rewrite agar memuat **semua** modul `js/` (36/36), bukan daftar hard-coded yang gagal karena kurang stub.
- **Validator CI-grade (P3/K5)**: file baru `test-modules.js` menjalankan `node --check` + real ESM import per modul dan exit 1 bila gagal — menghentikan false-pass `node --check` (trap yang pernah bikin `app.js` rusak lolos ke produksi).
- **Docs**: `DEVELOPER.md` §6 & §10 memakai `test-modules.js` & `test-imports.js` sebagai validasi utama; `AUDIT-REPORT.md` mencatat §9 (temuan K1–K8) & §10 (perbaikan P1–P3).
- **Cache-bust index.html `?v=47`** (bump setelah perubahan app.js/README).

## 2026-08-10 (Fix Sync Profil + Region Picker 4-Level + Logo Baru)

- **Fix `sync.js` skip-on-already-synced**: `ensureSynced()` dulunya return early bila `state.status === 'synced'` (tanpa force). Kini semua save function di `settings.js` memanggil `ensureSynced({ force: true })` agar perubahan profil (alamat, pemilik, WA, nama warung) selalu di-push ke Supabase.
- **Fix `region.js` village prefill chain**: `loadDesa()` kini dipanggil otomatis saat modal alamat dibuka dengan data tersimpan (pre-fill desa sesuai kecamatan yang terpilih). Sebelumnya desa selalu kosong karena `loadDesa()` hanya dipanggil saat user manual pilih kecamatan.
- **Endpoint desa diperbaiki**: API desa menggunakan ID kecamatan 7 digit (bukan ID desa 8 digit). URL: `static/api/villages/{kecamatanId}.json`.
- **Logo aplikasi diperbarui**: `assets/icon.png` diganti logo baru (orange gradient, 1254x1254 PNG). PWA icons (`icon-192.png`, `icon-512.png`) diregenerasi dari logo baru. Logo lama (`icon-old.png`) dipertahankan di kartu versi halaman Pengaturan.
- **Hapus console.log debug** dari `sync.js`, `settings.js`, `region.js` pasca-verifikasi.
- **SW cache v30 → v31** (perubahan sync.js, region.js, settings.js, assets/icon*).

## 2026-08-11 (Audit jalur data → Supabase + leads dari profil)

- **Fix `sync.js` getClient() → isPlaceholderKey()**: filter `'******'` & placeholder umum (sebelumnya cuma blokir `'PASTE...'` & `'...'`). Konfigurasi anon key di `supabase-config.js` sudah terisi asli sejak audit sebelumnya — view tool sempat ngeredact jadi `'******'`.
- **Jalur profil → `leads`**: `sync.js` `ensureSynced()` sekarang upsert ke tabel `leads` (ON CONFLICT unit_id) setelah upsert `clients`. Gagal leads tidak memutus sync clients (graceful catch). **Prasyarat:** jalankan `migration-leads-unitid.sql` di Supabase SQL editor.
- **`purchase.js` client mandiri**: `getSupabaseClient()` sendiri (tidak bergantung `sync.js` getClient()). Guard `isPlaceholderKey()` + createClient sendiri. Semua fungsi purchase pakai `sb = getSupabaseClient()` bukan `window._ksrSupabaseClient` langsung.
- **Migrasi:** `supabase/migration-leads-unitid.sql` — tambah `unit_id` + `user_id` + unique index + RLS anon own-rows di `leads` + backfill dari `clients`.

## 2026-08-07 (PWA Install Detection + API Wilayah Desa + Custom Period Laporan)

- **PWA Install Detection** (`js/pwa.js`):
  - Deteksi otomatis kalau PWA sudah terinstal (standalone, iOS standalone, SW controlling, localStorage flag)
  - Tidak tampilkan banner "Pasang di HP" jika sudah terinstal
  - Persist flag ke localStorage `kasirsolo:pwa-installed`
  - Listen `display-mode` change untuk deteksi instalasi sesudah reload
  - Notifikasi update SW versi baru tersedia
  - Export `isPWAInstalled`, `checkPWAInstalled` untuk manual check
- **API Wilayah Indonesia sampai Desa** (`js/region.js`):
  - Support 4-level dropdown: Provinsi → Kota/Kab → Kecamatan → Desa/Kelurahan
  - Endpoint: raw GitHub `master/static/api/villages/{kecId}.json`
  - Update `settings.js` + `index.html` (modal alamat) tambah dropdown Desa
- **Custom Period di Laporan** (`js/laporan.js`, `js/app-state.js`, `js/app.js`, `index.html`):
  - Tab baru "Custom" di halaman Laporan
  - Date picker mulai → selesai (input type=date)
  - Validasi mulai ≤ selesai
  - Grafik label "Custom"
- **Fix NaN Laporan** (`js/laporan.js`): Guard `|| 0` di akumulator (totalModal, totalHarga, qty, hargaJual, daySum)
- **Fix Tanggal Bocor** (`js/app-state.js`): `setReportPeriod()` reset tanggal ke hari ini
- **Sync ke mirror & commit** semua perubahan kaki5 + admin docs

## 2026-08-07 (Fix Tanggal "Bocor" saat Ganti Tab Periode Laporan)

Hasil audit logika tampilan laporan (diuji 6 skenario di browser):
- **Skenario A** Normal Mingguan: Omzet/Modal/Pengeluaran/Untung/Porsi/Margin ✓ akurat.
- **Skenario B** Transaksi **tanpa field `totalModal`** (data lama/import): ❌ dibuget —
  `modal += undefined` → NaN merambat ke **Modal=0, Untung=0, Margin=NaN%**. **DIPERBAIKI**
  dengan guard `|| 0` di akumulator (`totalHarga`, `totalModal`, `qty`, `hargaJual`, `daySum`).
- **Skenario D** Bulanan: chart M1–M5 + agregasi menu laris ✓.
- **Skenario E** Periode kosong: tampil Rp 0 tanpa crash/NaN ✓.
- **Skenario F** Harian: label "Hari Ini" + akordeon pengeluaran dengan item list ✓.
- Catatan desain: item list pengeluaran hanya tampil di mode Harian (mingguan/bulanan cuma total kategori).
- SW cache `v21` → `v22`.

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
