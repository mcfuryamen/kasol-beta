# Kasir Solo — Kaki Lima Edition (kaki5)

> Aplikasi **kasir untuk pedagang kaki lima (PKL)** — catat jualan, kelola kas (buka/tutup
> laci), pantau pengeluaran, dan lihat untung tiap hari langsung dari HP.
>
> `kaki5` adalah aplikasi klien dalam **ekosistem kasirsolo POS** (monorepo `kasol`),
> berdampingan dengan `rosok`, `gerobak`, `retail`, `landing`, dan `admin`.
> Menurut `../CONTEXT.md:71`, **kaki5 adalah referensi arsitektur** bagi aplikasi klien lain.

---

## ✨ Ringkasan

**Progressive Web App (PWA)** single-page dengan arsitektur **offline-first**: seluruh
operasi kasir berjalan tanpa internet dan semua data transaksi hidup di perangkat lewat
**IndexedDB** (Dexie.js). Ada koneksi cloud (Supabase) tetapi **hanya** untuk lisensi,
profil klien (CRM), tautan aplikasi, dan cadangan — **transaksi penjualan tidak pernah
dikirim ke server** (`../CONTEXT.md:77`).

| Aspek | Nilai | Bukti |
|---|---|---|
| **Nama aplikasi** | Kasir Solo - Kaki Lima (`short_name: KasirKaki5`) | `manifest.json` |
| **Versi** | `APP_VERSION 1.0.99` · `CACHE_BUST v167` | `js/version.js:7,18` |
| **Arsitektur** | SPA vanilla ESM, modular-atomic 3-layer, PWA offline | `docs/DEVELOPER.md` §1 |
| **Penyimpanan data** | IndexedDB via **Dexie 3.2.4**, skema **v8**, 9 object store | `js/db.js:6,137` |
| **Keranjang (cart)** | `localStorage['kaki5-cart']` (persist lintas buka-tutup) | `js/pos.sync.js:9` |
| **Cloud** | Supabase (anon key + RLS): `clients`, `products`, `settings`, `sync_errors`, Storage `backups`/`bukti` | `js/sync.js`, `js/backup.js:304` |
| **Bahasa UI** | Indonesia | — |
| **Port dev resmi** | **8086** (bind `127.0.0.1` saja) | `../CONTEXT.md:51`, `server.cjs:9,46` |
| **Deploy** | Vercel project `kasir-kaki5` via alur rilis 2-mirror | `../DEPLOYMENT.md:88,127` |
| **Domain live** | `kaki5.kasirsolo.com` | `../DEPLOYMENT.md:168` |

---

## 📁 Struktur Proyek (Modular-Atomic 3-Layer)

Setiap domain besar dipecah menjadi **logic (murni) + ui (DOM) + sync (cloud)**, dirakit
oleh satu file **coordinator/facade**. Total **45 file `.js`** di `js/`.

```
kaki5/
├── index.html              ← shell: 6 halaman .page + 17 modal/sheet + meta CSP (:16)
├── css/style.css           ← SINGLE-SOURCE CSS (dijaga test-css-drift.js)
├── dexie.min.js            ← vendor, root (harus di-track git — lihat § Ekosistem)
├── sw.js                   ← Service Worker, 3 strategi cache
├── server.cjs              ← dev server 8086, no-store (di-gitignore, tidak ikut rilis)
├── test-*.js               ← harness QA (di-gitignore)
├── api/supabase-config.js  ← serverless: suntik URL + anon key
├── assets/                 ← 8 ukuran ikon + region/provinces.json
├── docs/                   ← DEVELOPER.md · REGRESSION-CHECKLIST.md
└── js/
    ├── app.js              ← ENTRY (1290 baris): wire window, dispatcher data-action, boot()
    ├── app-state.js        ← state terpusat (binding read-only + setter)
    ├── db.js               ← Dexie v1..v8 + getSetting/setSetting
    ├── navigation.js       ← router hash + lifecycle halaman
    ├── templates.js        ← initPage/cleanupPage
    ├── modal.js · confirm.js ← open/close + focus trap + showConfirm
    ├── helpers.js          ← DOM/toast; re-export `export * from './helpers.pure.js'` (:118)
    ├── helpers.pure.js     ← format/validasi/tanggal/rate-limiter (murni)
    │
    ├── pos.js ─┬─ pos.logic.js   ← harga efektif, topping, harga ojol (murni)
    │           ├─ pos.ui.js      ← render grid & keranjang
    │           └─ pos.sync.js    ← simpan penjualan + keranjang ke localStorage
    ├── kas.js ─┴─ kas.logic.js   ← buka/tutup kas, tutup buku, laba (logika murni)
    ├── settings.js (FACADE) ─┬─ settings.logic.js
    │                         ├─ settings.ui.js
    │                         └─ settings.sync.js
    ├── license.js (FACADE) ──┬─ license.logic.js  ← kuota transaksi + HMAC
    │                         ├─ license.ui.js
    │                         └─ license.sync.js   ← aktivasi/verify cloud
    ├── sync.js · sync.health.js ← push/pull profil + diagnosa 10 langkah
    ├── purchase.js           ← beli lisensi (QRIS/transfer + realtime)
    ├── app-link.js           ← tautan resmi dari cloud `products.store_url`
    ├── nomor.js              ← penomoran TRX/MSK/BLJ
    ├── beranda.js · menu.js · laporan.js · pengeluaran.js · bantuan.js
    ├── trxdetail.js · expensedetail.js · printer.js · carousel.js
    ├── region.js · backup.js · pwa.js · update.js · version.js
    └── supabase-config.js · supabase.min.js · dev-unregister-sw.js
```

**Yang perlu dipahami lebih dulu sebelum menyentuh kode:**
1. **Tidak ada inline handler.** `index.html` **0** atribut `onclick`/`onchange` — CSP
   `script-src 'self'` (`index.html:16`) memang menolaknya. Semua lewat
   `data-action="..."` + `case '...'` di `handleDataAction()` (`js/app.js:330`).
2. **Modul di-*import* eager saat `app.js` dimuat**, bukan saat halaman dibuka
   (komentar "Lazy-loaded" di `app.js:42` sudah tidak sesuai perilaku).
3. **File facade wajib me-re-export** setiap nama yang ada di `_*WireMap` — kalau tidak,
   fungsinya hilang **diam-diam** (penyebab bug saklar kas v166). Detail:
   `docs/DEVELOPER.md` §4.

---

## 🚀 Cara Menjalankan

Aplikasi **menolak dibuka lewat `file://`** (Service Worker & IndexedDB butuh HTTP).

```bash
cd kaki5
node server.cjs            # PORT resmi 8086, bind 127.0.0.1, header no-store
# buka → http://127.0.0.1:8086/
```

Alternatif: `python -m http.server 8086 --bind 127.0.0.1`.
**Jangan pakai port lain** — port tiap app dikunci di `../CONTEXT.md:39-55`.
`server.cjs` bind `127.0.0.1` saja, jadi **tidak terjangkau dari perangkat lain di LAN**;
untuk uji di HP, pakai server lain yang bind `0.0.0.0` sementara.

### Deploy produksi

Melalui **alur rilis 2-mirror** (`../DEPLOYMENT.md:127-181`), bukan push langsung dari
folder kerja:

```
folder kerja kasol/  →  push-beta.ps1  →  mirror kasol-beta  →  GitHub mcfuryamen/kasol-beta
                                          → Vercel <app>.vercel.app   (BETA)
                   →  push-live.ps1  →  mirror kasol       →  GitHub mcfuryamen/kasol
                                          → kaki5.kasirsolo.com       (LIVE)
```

Kedua skrip menjalankan **guard drift** (`Test-SnapshotDrift`) dan **secret scan** sebelum
commit, dan berhenti di `Read-Host` untuk konfirmasi push. Vercel project `kasir-kaki5`
(root directory `kaki5/`). Satu workflow preview masih ada di
`.github/workflows/deploy-preview.yml`.

---

## 🗄️ Skema Database (IndexedDB / Dexie)

Didefinisikan di `js/db.js`. Nama DB: **`KasirSoloKakiLima`**, versi tertinggi **v8**.
Migrasi bersifat **aditif — tidak ada tabel/kolom yang pernah di-drop**.

| Tabel | Skema indeks | Isi | Sejak |
|---|---|---|---|
| **`menu`** | `++id, nama, kategori, hargaJual, hargaModal, aktif, urutan, suplayer` | daftar produk/menu (`suplayer` v5 → konsinyasi) | v1 |
| **`penjualan`** | `++id, tanggal, items, totalHarga, totalModal, bayar, kembalian, waktu, status` | riwayat transaksi; `status` (v6) dipakai untuk pesanan ditahan | v1 |
| **`pengeluaran`** | `++id, tanggal, keterangan, kategori, jumlah, waktu, jenis, metodeBayar, shiftId, nomor` | catatan pengeluaran **dan** pemasukan (`jenis` v8) | v1 |
| **`pengaturan`** *(legacy)* | `key` | dipertahankan dari v1; **tidak lagi dibaca kode** | v1 |
| **`settings`** | `key` | key-value utama: profil, lisensi, saklar fitur — via `getSetting`/`setSetting` | v2 |
| **`platformMessages`** | `++id, order, visibleFrom, visibleUntil` | banner/promo carousel | v3 |
| **`kasShift`** | `++id, status, tanggalBuka, waktuBuka` | satu baris per shift buka/tutup laci | v7 |
| **`kas`** | `++id, tanggal, tipe, shiftId` | catatan kas manual lama — **sudah dimigrasi ke `pengeluaran`**, tabel sengaja tidak di-drop | v7 |
| **`tutupBuku`** | `++id, tahun` | rekap tahunan yang sudah ditutup | v7 |

**Migrasi v8** (`js/db.js:147-174`) memindahkan tiap baris `kas` ke `pengeluaran`:
`tipe:'masuk'` → kategori `Modal Tambahan` (`jenis:'pemasukan'`), `tipe:'keluar'` →
`Setor Bank / Prive`, keduanya tunai, diberi penanda `sumber:'migrasi-kas-v164'`, baris
`jumlah<=0` dilewati, lalu tabel `kas` dikosongkan.

> ⚠️ Index Dexie tidak bisa memuat boolean, jadi `menu.aktif` difilter di JS
> (`aktif === 1 || aktif === true`, `js/pos.js:343-349`).
>
> ⚠️ Ada handler `db.on('blocked')` (`js/db.js:14-23`) yang me-reload halaman **sekali**
> lewat `sessionStorage['ksr:db-blocked-reload']` — kalau skema naik dan tab lain masih
> membuka DB versi lama.

---

## 🧩 Fitur Utama

### 1. 🏠 Beranda (Dashboard)
- **Carousel banner/promosi** dari tabel `platformMessages` (`js/carousel.js`).
- Ringkasan hari ini: omzet, pengeluaran, keuntungan bersih, jumlah transaksi, porsi terjual.
- **Kartu Kas** (`renderKasCard`, `js/kas.js:324`) — status laci + tombol Buka/Tutup Kas,
  Catat, dan Tutup Buku Tahunan.
- Daftar transaksi terakhir.

### 2. 🍽️ Menu
- CRUD menu: nama, kategori (**Makanan / Minuman / Snack / Lainnya / Titipan**), harga jual,
  harga modal, harga Ojol, topping.
- **Suplayer** untuk menu titipan (konsinyasi) → muncul sebagai kategori khusus di Laporan
  dengan aksi **Retur** dan **Setor** (`js/laporan.js:492-493`, modal `#returModal`).
- Pencarian (debounce 300ms), FAB Tambah Menu.

### 3. 🛒 Jualan (POS)
- **Tipe order di atas grid**: 🍽️ Dine-in / 🥡 Take-away / 🛵 Ojol. Pilih Ojol →
  `hargaOjol` otomatis dipakai di grid & keranjang (`js/pos.logic.js`).
- **Kontrol sticky**: tipe order + pencarian + accordion kategori (`index.html:106`).
- **Catatan pesanan** per transaksi dengan placeholder dinamis per tipe order; draft di
  `localStorage['kasirsolo:order-note']`; ikut ke nota, detail transaksi, dan laporan.
- **Menu selector** untuk topping + qty sebelum masuk keranjang.
- **Keranjang**: qty via stepper atau ketik manual; total & kembalian real-time.
  Footer cart: **🤚 Tahan** dan **Bayar** (`index.html:458-459`).
- **Tahan Pesanan**: simpan keranjang sebagai `penjualan.status='held'`, badge di FAB
  `#heldFab`, modal daftar pesanan ditahan (`#heldListModal`) untuk buka/bayar/hapus.
- **Metode pembayaran**: Tunai / QRIS / Transfer (bisa dihidupkan-matikan di Pengaturan);
  non-tunai bisa dilampiri **foto bukti bayar**.
- **Gerbang kas**: transaksi ditolak bila laci belum dibuka — **hanya** kalau saklar
  fitur kas aktif (`js/pos.js:529`).
- **Nomor transaksi** otomatis: `TRX-YYYYMMDD-NNN` (`js/nomor.js`).

### 4. 📊 Laporan (+ Pengeluaran)
- Satu halaman: laporan + catatan pengeluaran/pemasukan.
- Empat periode: **Harian / Mingguan / Bulanan / Custom** (`index.html:185`).
- Kartu statistik (omzet, pengeluaran, untung bersih) + grafik batang & grafik harian per jam.
- **Blok Kas** (`kasReportBlocksHtml`, `js/kas.js:371`): rekap sistem vs fisik per shift,
  rincian dompet digital, selisih — plus blok rekap tahunan Tutup Buku.
- Navigasi periode dengan aritmatika bulan sungguhan (termasuk Des → Jan).
- Catatan punya **kolom Tanggal** dan bisa diedit; nomor `MSK`/`BLJ` dihitung ulang hanya
  saat tanggalnya pindah hari.

### 5. 💰 Kas & Tutup Buku Tahunan
- **Buka Kas** (`js/kas.js:154`) mencatat modal awal laci → baris `kasShift` `status:'buka'`.
- **Tutup Kas** (`js/kas.js:269`) menghitung kas sistem vs kas fisik, selisih, durasi shift,
  lalu menutup baris shift.
- **Tutup Buku Tahunan** (`js/kas.js:473`) membekukan rekap satu tahun
  (validasi 2000–2100, tolak tahun duplikat, `showConfirm`); tahun yang sudah tertutup
  diperingatkan saat menambah/mengubah catatan (`tahunTertutup`, `js/kas.js:515`).
- **Saklar "Buka / Tutup Kas"** di Pengaturan (v166): kalau dimatikan, kios boleh jualan
  tanpa buka kas; kartu kas di Beranda dan blok kas di Laporan ikut disembunyikan.
  Shift yang masih terbuka **tidak pernah** ditutup/dihapus diam-diam.

### 6. ⚙️ Pengaturan (Profil)
Halaman menampilkan kartu **"📋 Info Usaha"**: Nama Usaha, Nama Pemilik, Nomor WhatsApp,
Alamat (region picker 4-level Provinsi → Kota/Kab → Kecamatan → Desa + detail).
Setiap perubahan memicu **sinkronisasi ulang ke Supabase** (`js/sync.js`).

Blok **"⚙️ Aktifkan Fitur"** berisi saklar metode pembayaran (Tunai/QRIS/Transfer) dan
saklar fitur kas (`#fiturKasToggle`).

Fitur lain:
- **Simpan cadangan (export JSON)** & **Pulihkan data (import JSON)** dengan validasi
  struktur + verifikasi signature (lihat § Backup).
- **Cadangan cloud** ke Storage bucket `backups` (hanya untuk perangkat berlisensi aktif),
  simpan 10 salinan terakhir (`js/backup.js:304-305`).
- **Hapus semua data** (dengan konfirmasi).
- **Printer Bluetooth** (hubungkan / cetak tes / putuskan).
- **Diagnosa Sinkronisasi** — modal 10 langkah + tombol salin "Kirim ke Admin"
  (`js/sync.health.js`, `#syncDiagModal`).
- **Kelola Lisensi** — bottom sheet status/kuota + aktivasi serial + alur beli
  (`js/license.ui.js`, `js/purchase.js`).
- **Kontak & tautan resmi diambil dari cloud** (`products.store_url` → fallback
  `https://kasirsolo.app`, `js/app-link.js:15-38`), bukan lagi di-hard-code.

> **Catatan onboarding:** gerbang onboarding 2-langkah **dihapus 2026-08-29**.
> Syarat & Ketentuan kini modal **sekali-jalan non-blocking** (`#tcModal`) — bisa ditutup,
> muncul lagi di boot berikutnya bila belum disetujui, dan dibuka ulang dari Bantuan
> (`js/app.js:245-253,1189`).

### 7. ❓ Bantuan
Panduan + tutorial per fitur, dirender dari `js/bantuan.js`; akses lewat tombol ❓ di
header (`index.html:43`) — **bukan** tab bottom-nav.

### 8. 📲 PWA & Offline
- `sw.js` dengan **tiga strategi**: API Supabase network-only (`:232`), **HTML cache-first**
  supaya navigasi tetap bisa offline (`:244`), aset statis network-first + fallback cache (`:264`).
- **Installable** ke layar utama (`js/pwa.js`, banner `#installBanner`).
- `manifest.json` **statis** (bukan dihasilkan dinamis) + `<link rel="manifest">`.
- **Overlay "Versi Baru Tersedia"** (`js/update.js`) — muncul hanya bila
  `version.json.cacheBust` berbeda dari `CACHE_BUST` kode yang sedang jalan.
- `js/dev-unregister-sw.js` melepas SW di lingkungan dev supaya tidak menyajikan JS basi.

### 9. 🖨️ Cetak Nota
Printer thermal Bluetooth via Web Bluetooth (ESC/POS, lebar 58/80mm) — `js/printer.js`.
Cetak dari pembayaran, dari detail transaksi, atau nota terakhir.

### 10. ☁️ Sinkronisasi Profil (CRM → Admin)
- Mengirim **profil identitas outlet** (nama usaha, pemilik, WhatsApp, wilayah, device code)
  ke Supabase tabel **`clients`** → dikelola di Admin (tab Klien). Kegagalan sync dicatat
  ke tabel **`sync_errors`**.
- **Offline-first**: app tetap jalan tanpa internet; retry otomatis tiap 5 menit
  (`startSyncRetryLoop`, `js/sync.js:334`).
- **Backfill-only**: `ensureSynced()` tidak menimpa baris yang sudah ada; penimpaan cloud
  hanya lewat `force` (form profil / tombol sinkron / retry pending).
- **Profil di-pull dari cloud saat boot** (cloud = sumber kebenaran, `../CONTEXT.md:87`).
- Keamanan: **Anonymous Auth + RLS** — tiap perangkat hanya mengubah barisnya sendiri.

---

## 🔒 Lisensi & Kuota (ringkas — detail di `DESIGN.md`)

- Tier gratis = **kuota transaksi per bulan kalender**, default `DEFAULT_TX_QUOTA = 100`
  (`js/license.logic.js:20`); angka sebenarnya diambil dari cloud `products.tx_quota`,
  dengan penyesuaian per perangkat di `clients.tx_adjust`.
- Serial berbayar: prefix **`KK5`**, format `KK5-XXXX-XXXX-XX-XXXXXX`, validasi
  **HMAC-SHA256** device-bound; salt asli dari cloud `products.salt`
  (fallback lokal `KASIRSOLO-KAKI5-HMAC-V2`).
- Anti-rollback jam lewat `clockAnchor` / `getEffectiveNow()`.
- **1 serial = 1 `unit_id` = 1 profil** ("Opsi 3"): aktivasi di perangkat baru memanggil
  RPC `device_assign`; profil cocok → reassign, tidak cocok → ditolak + lock overlay
  (`js/license.sync.js:394`, migrasi di `../supabase/migration-device-assign.sql`).
- **Kuota habis TIDAK mengunci aplikasi** (keputusan pemilik 2026-08-29): hanya banner
  `#quotaBanner` + blokir transaksi. Yang boleh full-lock **hanya** revoke admin
  (`lockOverlay`).

---

## 🔒 Keamanan (XSS & CSP)

- **CSP** `script-src 'self'` (`index.html:16`) — tidak ada `<script>` inline, tidak ada
  inline event handler.
- `escapeHtml(s)` — escape `<`, `>`, `&`, `"`, `'`.
- `buildSafeHtml(strings, ...values)` — template tag; nilai otomatis di-escape, HTML mentah
  hanya lewat `{__raw:true}` untuk literal yang dipercaya.
- Secret scan otomatis sebelum rilis (`secretPatterns` di `../push-beta.ps1:18-20`).
- Transaksi & data kas **tidak pernah** dikirim ke server.

> Catatan internal: string berisi literal `&`/`<` ditulis dengan idiom concat
> (`'&'+'amp;'`) karena tool patch me-decode entity HTML.

---

## 💾 Backup & Pemulihan Data

- **Export** (`exportData`) membuat JSON `version: 4` berisi
  `{ version, exportDate, menu, penjualan, pengeluaran, kasShift, tutupBuku }`
  **plus** `_signature` / `_signatureVersion` — HMAC device-bound (`js/backup.js:36-50,61-71`).
  Tabel `settings` dan `pengaturan` **sengaja tidak dicadangkan** (profil & lisensi punya
  jalur cloud sendiri). Kunci proteksi: `PROTECTED = ['installId','unitId','deviceIdentity',
  'license','onboarded','sync']` dibuang dari ekspor maupun impor (`js/backup.js:27`).
- **Import** (`importData`) → `await validateBackup(data)` memvalidasi struktur ketat +
  verifikasi signature sebelum menimpa → konfirmasi → pulihkan.
- Cadangan lama `version` yang masih memuat tabel `kas` dikonversi otomatis ke catatan
  pengeluaran/pemasukan (`catatanKasLama`, `js/backup.js`).

---

## ⚙️ Arsitektur Teknis

### Alur boot nyata (`js/app.js:1135-1246`)

```
[index.html] → <script src="dexie.min.js"> (global)
             → <script src="js/dev-unregister-sw.js">
             → <script type="module" src="js/app.js?v=166">
   ↓
app.js dimuat → wire 8 modul via _*WireMap (eager) + wiring langsung window._ksr_*
   ↓
boot()
  ├─ ensureUnitId()                      :1136
  ├─ FASE 1 (cloud dulu, aturan pemilik) :1145-1168
  │    runLicenseSync → verifyBootLicenseAssignment
  │    → pullCloudProfileIfOnline → ensureSynced
  ├─ FASE 2 (render)                     :1176-1189
  │    ensureNomorBackfill → refreshShiftCache → loadBeranda → modal S&K
  ├─ FASE 3                              :1212-1243
  │    startSyncRetryLoop → race _settingsReady (timeout 8 dtk) → setupPWA
  │    → subscribeToLicenseUpdates (realtime)
  ↓
initRouter() :1267 · startUpdateWatcher() :1274 · window.APP_VERSION :1285
```

### Event delegation

| Event listener (document) | Baris | Kenapa perlu |
|---|---|---|
| `click` | `app.js:953` → `handleDataAction` `:974` | juga menutup backdrop/modal (`:962-969`); `lockOverlay` dikecualikan |
| `keydown` Enter/Space | `app.js:982` → `:992` | aksesibilitas; skip elemen native |
| `input` | `app.js:1004` | `data-action` di `<input>` tidak pernah memicu `click` |
| `change` | `app.js:1005` | sama, untuk `<select>` / `<input type=file>` / saklar |

### Navigation Router

Enam rute hash, cocok dengan `js/navigation.js:20,49,60` dan elemen `.page` di
`index.html` (`#page-beranda:51`, `#page-jualan:106`, `#page-menu:166`,
`#page-laporan:180`, `#page-pengaturan:193`, `#page-bantuan:324`).
Bottom nav memuat **5** tab (Bantuan lewat tombol header). Lifecycle `initPage` /
`cleanupPage` diatur `js/templates.js`.

### Komponen Teknis

| Komponen | Teknologi | Keterangan |
|---|---|---|
| UI | HTML + CSS murni | tanpa framework, mobile-first |
| State & rendering | Vanilla ESM | state terpusat di `app-state.js`, mutasi lewat setter |
| Database lokal | Dexie 3.2.4 / IndexedDB | skema v8, 9 object store |
| Persist sementara | `localStorage` | cart, catatan pesanan, tipe order, metode bayar, status instal |
| Offline/PWA | `sw.js` + `manifest.json` | 3 strategi (lihat § PWA) |
| Printer | Web Bluetooth | ESC/POS 58/80mm |
| Lisensi | HMAC-SHA256 offline + Supabase | kuota per bulan, `device_assign`, anti-rollback jam |
| Cloud | Supabase (anon + RLS) | `clients`, `products`, `settings`, `sync_errors`, Storage, Realtime |

---

## ⚠️ Kendala & Hal yang Perlu Diketahui

1. **Data transaksi tetap lokal** — cloud hanya lisensi/profil/cadangan. Perangkat hilang =
   data transaksi hilang bila tidak pernah backup.
2. **Butuh konteks HTTP/HTTPS** — tidak jalan via `file://`.
3. **Branding belum 100% konsisten** — variasi *"Kasir Solo - Kaki Lima"* vs
   *"Kasir Solo — Kaki Lima Edition"*, dan nama DB `KasirSoloKakiLima` tidak mengikuti
   konvensi `KasirSolo<App>DB` di `../CONTEXT.md:555`.
4. **Web Bluetooth** hanya didukung sebagian browser (umumnya Chrome/Android).
5. **Tiga harness QA merah sebagai baseline** (`test-data-actions`, `test-html-refs`,
   `test-modules`) — sudah gagal sejak rilis 1.0.97. Jangan panik, tapi jangan tambah
   korban baru. Detail di `docs/REGRESSION-CHECKLIST.md` §5.
6. **`server.cjs` dan `test-*.js` di-gitignore** (`.gitignore:108,112`) — keduanya tidak
   ikut snapshot rilis, jadi mirror/GitHub memang tidak memuatnya.

---

## 🧪 Pengembangan & QA

```bash
cd kaki5
node test-modules.js          # gate: node --check + real ESM import tiap js/*.js
                              #       + child test-html-refs.js & test-css-drift.js
node test-imports.js          # muat semua js/*.js di browser-stub
node test-dynamic-imports.js  # semua target import('./x') literal harus ada
node test-db-migrations.js    # skema v1..v8 berurutan, tidak ada tabel/index hilang
node test-css-drift.js        # 1 link CSS, folder css/ hanya style.css, brace seimbang, SW precache
node test-html-refs.js        # setiap getElementById resolve ke id di HTML / dibuat dinamis
node test-data-actions.js     # setiap data-action punya case di app.js (dan sebaliknya)
node test-shim.js             # browser-stub itu sendiri
node server.cjs               # dev server 8086
```

`package.json` **tidak punya `scripts`** — jalankan tiap file langsung dengan `node`.
Sebagian harness memakai `process.cwd()`, jadi **CWD wajib `kaki5`**.

### Catatan ekosistem (monorepo kasol)
- **`dexie.min.js` harus di-track git.** Root `.gitignore` meng-ignore `*.min.js`; tanpa
  pengecualian, deploy mati dengan `Dexie is not defined` (`../DEPLOYMENT.md:101`).
- Rilis **tidak pernah** push langsung dari folder kerja — selalu lewat 2 mirror.
- Standar ekosistem & keputusan pemilik: `../CONTEXT.md`. Prosedur deploy: `../DEPLOYMENT.md`.
- Aturan kerja untuk agen AI: `AGENTS.md`.

---

## 📚 Dokumen

| File | Isi |
|---|---|
| `README.md` | file ini — gambaran fitur, skema DB, cara menjalankan |
| `AGENTS.md` | konvensi wajib + jebakan yang diketahui agen AI |
| `docs/DEVELOPER.md` | peta modul, boot, lisensi, kas, cloud, QA mendalam |
| `docs/REGRESSION-CHECKLIST.md` | kelas bug berulang, aturan bump versi, baseline harness |
| `DESIGN.md` | model lisensi/kuota, kontrak cloud, gaya visual |
| `CHANGELOG.md` | riwayat rilis `vNNN / 1.0.NN` |

## 📮 Dukungan / Kontak

- **WhatsApp / situs resmi** diambil dinamis dari cloud (`products.store_url`),
  fallback `https://kasirsolo.app`
- **Pengembang:** PT Mesin Kasir Solo

---

*Dokumen ini mencerminkan kondisi kode **v167 / 1.0.99 (2026-09-04)**. Setiap klaim diberi
rujukan `file:baris` supaya bisa diverifikasi ulang terhadap kode.*
