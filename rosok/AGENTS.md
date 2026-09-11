# AGENTS — Kasir Rosok

Konteks spesifik untuk agen AI yang mengerjakan aplikasi **Kasir Rosok**
(kasir pengepul rosok / barang bekas). Selalu baca [`../CONTEXT.md`](../CONTEXT.md)
untuk standar ekosistem, dan [`DESIGN.md`](DESIGN.md) untuk arsitektur & kontrak cloud.

---

## 📋 Info Aplikasi

| Item | Value |
|------|-------|
| **Folder** | `rosok/` |
| **Prefix lisensi** | `KSR` |
| **Salt (fallback)** | `KASIRSOLO-ROSOK-HMAC-V2` — sumber utama = kolom `products.salt` |
| **Database lokal** | `KasirSoloRosokDB` (Dexie, schema v5) |
| **App type cloud** | `app_type = 'rosok'` (tabel `clients`/`products`/`settings` SHARED dgn kaki5 dkk — proyek Supabase `hhywrvedlwljawgxzpkq`) |
| **Vercel (live)** | project `rosok` (`prj_Z6lAYUJvVbdMS8aTToYLRXJoLnHI`), repo `mcfuryamen/kasol`, Root Directory `rosok/`, domain `rosok.kasirsolo.com` (rosok.vercel.app dihapus sengaja pemilik 2026-09-05) |
| **Vercel (beta)** | project `rosok-beta`, repo `mcfuryamen/kasol-beta`, domain `rosok-beta.vercel.app` |
| **Dev server** | `node run-local.js` → **port 8084** (WAJIB; registry di `../CONTEXT.md`) |
| **Versi** | 1.4.9 · SW v70 |

---

## 🗂️ Struktur File

```
rosok/
├── index.html / style.css / sw.js / manifest.json / vercel.json / .vercelignore
├── dexie.min.js            # vendor — JANGAN hapus negasi .gitignore-nya
├── run-local.js            # dev server 8084 (static + CORS utk ESM)
├── sync-to-mirror.sh       # produksi -> mirror GitHub kasol (whitelist ITEMS)
├── README.md / AGENTS.md / CHANGELOG.md / DESIGN.md
├── docs/                   # arsip laporan audit/QA sekali-pakai
├── assets/                 # logo, icon, splash, region/provinces.json (fallback emsifa)
└── js/
    ├── app.js              # ENTRY: boot, wire window handlers, profil UI + hook cloud
    ├── app-state.js        # state terpusat + setter — ZERO import dari modul lain
    ├── db.js               # Dexie ONLY — zero import
    ├── utils.js            # fmt/toast/overlay/getSetting/setSetting/getDeviceInfo
    ├── router.js  nav.js   # pushState SPA; showScreen + sticky bars + hook layar
    ├── pos.js  kategori.js  kas.js  laporan.js  riwayat.js  dashboard.js  carousel.js
    ├── onboard.js          # tersisa emoji picker kategori (wizard onboarding DIHAPUS)
    ├── license.js          # kuota + HMAC V1/V2 + gate/chip/kartu + rate-limit aktivasi
    ├── license.sync.js     # KONTRAK SUPABASE (lihat DESIGN.md §Kontrak Cloud)
    ├── purchase.js         # beli lisensi QRIS/rekening + bukti + polling + realtime
    ├── settings-x.js       # toggle metode bayar, PWA install, Diagnosa 10 langkah
    ├── printer.js          # printer thermal BLE (chunk 20B + persist localStorage)
    ├── backup.js           # export/import payload v3 + cadangan cloud (lisensi aktif)
    ├── region.js           # picker wilayah 4 level (API emsifa)
    ├── app-link.js         # link situs dari cloud (products.store_url → app_links)
    ├── version.js          # SUMBER VERSI TUNGGAL (APP_VERSION + CACHE_BUST)
    ├── version.json        # sinyal rilis di server (cacheBust + notes) — di-bypass dari cache SW
    ├── update.js           # overlay update paksa + refresh (port kaki5)
    ├── confirm.js          # showConfirm() modal in-app — PENGANTI confirm() native (dilarang)
    └── supabase-config.js  # URL+anon key runtime (skip fetch di dev host)
```

---

## ⚠️ Konvensi yang WAJIB dipatuhi

### 1. State modular (ESM)
Binding `export let` di `app-state.js` **read-only** bagi modul lain — semua mutasi
lewat setter (`setCart`, `setBayarMetode`, `setSETTINGS`, dst). Menulis langsung =
`SyntaxError` dan SELURUH app gagal load. Pola berulang di repo ini: satu sisa
import dari modul yang dihapus bikin seluruh modul mati — selalu sweep referensi.

### 2. Wiring handler
HTML memakai `onclick="namaFungsi()"` global. Setiap handler baru WAJIB diekspos
`window.namaFungsi = namaFungsi` di modul pemiliknya (pola di akhir tiap file).
Verifikasi: sweep `grep -oE 'on(click|change)="([a-zA-Z_]+)' index.html` vs definisi window.

### 3. Rilis = bump 4 slot (konvensi kaki5, sejak v1.4.5 — insiden v100)
Satu rilis WAJIB menyentuh 4 tempat sekaligus, angka SAMA (mis. `v59` / `?v=59`):
1. `js/version.js` → `CACHE_BUST` (+ `APP_VERSION` naik bila ada perubahan fitur — sumber tunggal, TIDAK lagi hardcode di app.js)
2. `js/version.json` → `cacheBust` + `version` + `notes` (bahasa user — bahan overlay update)
3. `sw.js` → `CACHE_VERSION` (+ entri `CORE_ASSETS` bila ada file/URL baru)
4. `index.html` → `?v=` pada `style.css` dan `js/app.js`
Kalau slot 1–2 tidak sinkron, overlay update (`js/update.js`) tidak pernah muncul
atau muncul palsu — pelajaran insiden v100 kaki5 & drift v167/v168. `version.json`
TIDAK boleh masuk `CORE_ASSETS` (sw.js mem-bypass-nya dari cache — sinyal rilis
harus selalu network-murni). Verifikasi cepat pasca-rilis: keempat angka sama,
dan `curl <url>/js/version.json` menampilkan cacheBust terbaru.

### 4. `.gitignore` monorepo — TRAP vendor `.min.js`
Root `.gitignore` punya `*.min.js` global + negasi eksplisit per file vendor.
Vendor baru tanpa negasi = **silam tak ter-commit** → deploy kehilangan file → app
rusak diam-diam. Sudah terjadi DUA KALI pada `rosok/js/supabase.min.js`
(2026-09-04 pagi: negasi hanya dipasang di `.gitignore` mirror beta; snapshot
`push-beta.ps1` menimpa `.gitignore` mirror dengan versi work tree → file hilang
lagi). **Pelajaran: negasi WAJIB hidup di `.gitignore` WORK TREE** — mirror hanya
cerminan snapshot. Selalu cek `git check-ignore -v <file>` DAN
`git ls-tree HEAD -- <file>` sebelum menganggap aman.

### 5. Cloud = sumber kebenaran mutlak (aturan pemilik 2026-09-04)
Berlaku untuk **profil usaha** dan **lisensi**. Kontrak lengkap + alasan tiap
cabang ada di `DESIGN.md §Kontrak Cloud`. Ringkas:
- Simpan profil → `pushProfile()` payload penuh ke `clients`; baris belum ada → insert.
- Pull (boot / buka Pengaturan / tiap 5 mnt) → cloud MENIMPA lokal; `NULL` = belum pernah di-push → jangan sentuh.
- Editan yang belum dikonfirmasi cloud → flag `profileSyncPending` menahan pull; retry saat `online`.
- Lisensi: cloud `'aktif'` → adopsi; cloud `'belum'`/`''`/`batal` + lokal active → **downgrade zombie** wajib ke trial.
- Aktivasi kode manual: online → serial harus dikenal cloud (`device_assign`); offline → HMAC lokal. `profile-mismatch` → kunci `#mismatchLock`.
- Salt serial: `products.salt` → env → konstanta — sama di klien, `/api/license`, dan kedua edge functions.

### 6. Jangan diulang (pelajaran audit)
- `getSupabaseClient()` selalu lewat fungsi (jangan baca global mentah) — bug v40 `isPlaceholderKey` pernah mematikan SEMUA fitur cloud diam-diam.
- `SETTINGS` yang dipakai modul WAJIB di-import dari `app-state.js` (bug `testPrint` ReferenceError).
- Baris `setting-row` yang memicu file input butuh `onclick` eksplisit (bug "Pulihkan Data" mati).
- Cloud 'diam' tanpa error = cek `getSupabaseClient()` null dulu, jangan tuduh RLS.
- **DILARANG `confirm()/alert()/prompt()` native** — tidak andal di webview tertanam
  (insiden preload `embeddedBrowserJavaScriptDialog` ZCode 2026-09-05: dialog bisa
  mengembalikan nilai bohong → alur destruktif batal diam-diam). Gunakan
  `showConfirm()` dari `js/confirm.js` (Promise-based, berantrean).

---

## 🗄️ Database Schema (Dexie — kondisi v5)

```javascript
db.version(1): settings:'key' | kategori:'++id,nama,aktif' | transaksi:'++id,tipe,tanggal'
               transaksiItem:'++id,transaksiId,kategoriId' | kas:'++id,tanggal,tipe'
db.version(2): + kasShift:'++id,status,waktuBuka'
db.version(3): + platformMessages:'++id,order,visibleFrom,visibleUntil'
db.version(5): + tutupBuku:'++id,tahun'  &  kas += refTransaksiId   // v4 dilewati
```

`refTransaksiId` (v5) dipakai Hapus/Void transaksi membalikkan kas terkait — tanpa
index, Dexie `SchemaError` dan transaksi rollback (bug kritis audit 2026-09-03).

---

## 🖥️ Screens & Overlays (kondisi 2026-09-04)

### 5 Screen (bottom-nav: Beranda | Stok | [+Transaksi] | Laporan | ⚙️Pengaturan)

| Screen | Isi |
|--------|-----|
| `screen-dashboard` | stat cards, carousel platformMessages |
| `screen-transaksi` | wizard timbang → keranjang → bayar (tunai/transfer/tempo) → nota |
| `screen-stok` | kategori + stok + bar aksi sticky |
| `screen-laporan` | LAPORAN + RIWAYAT satu halaman mengalir; filter sticky menyelip header |
| `screen-pengaturan` | 6 blok: Profil Usaha · Metode Pembayaran · Perangkat · Lisensi · Data & Cadangan · Tentang Aplikasi |

### Overlays
`sheetTimbang`, `sheetNota`, `sheetKas`, `sheetBukaKas`, `sheetTutupKas`,
`sheetTutupBuku`, `sheetLunasi`, `sheetKategori`, `sheetLicense`, `sheetAlamat`,
`sheetCekData` (diagnosa), `sheetPurchase`, `#quotaBanner` (closable),
`#profileBanner` (modal wajib lengkapi profil — semua layar KECUALI Pengaturan),
`#mismatchLock` (hard lock profil-tidak-cocok, tanpa tombol tutup),
`#updateOverlay` (rilis baru — hanya bisa OKE, dari update.js),
`#sheetRestoreOffer` (tawaran pulih cloud utk browser baru, maks 1×/hari),
`#confirmModal` (showConfirm — semua konfirmasi destruktif),
`#loadingOverlay`, `#toast`.

---

## 🚀 Deployment & Rilis (monorepo kasol)

**Model 2026-09:** dua mirror git lokal, Vercel git-integration per project
(Root Directory `rosok/`), TANPA GitHub Actions.

| Tujuan | Mirror | GitHub | Memicu |
|--------|--------|--------|--------|
| **Beta** | `Documents/GitHub/kasol-beta` | `mcfuryamen/kasol-beta` | Vercel project beta (ctrlbeta/kq5beta dkk) |
| **Live** | `Documents/GitHub/kasol` | `mcfuryamen/kasol` | Vercel project produksi per app |

### 🚦 ATURAN RILIS — SELURUH EKOSISTEM KASOL (WAJIB, aturan pemilik 2026-09-06)
1. **Default = commit + rilis BETA saja** (mirror `kasol-beta`). Fix disetujui → beta boleh langsung.
2. **Rilis LIVE (mirror `kasol` → produksi) WAJIB perintah EKSPLISIT pemilik, PER RILIS.** Approval "gas" atas fix BUKAN izin rilis live.
3. **Jangan improve sendiri di luar permintaan** — temuan lain = SARAN, menunggu dipilih.
4. Teks lengkap: `../CONTEXT.md` → "🎯 Keputusan Strategis" → "🚦 Aturan Rilis".

- **Skrip resmi:** `../push-beta.ps1` (snapshot SELURUH work tree → `kasol-beta main`) dan
  `../push-live.ps1` (snapshot dari `refs/beta/main` "beta stabil" → `kasol main`).
  Keduanya interaktif (`Read-Host y/N`) → non-interaktif: `echo y | powershell ... -File push-beta.ps1`.
- ⚠️ **Skrip bersifat all-or-nothing.** Bila work tree mengandung WIP app lain yang belum
  layak rilis (cek `git status`!), lakukan **rilis tertarget manual**: `cp` hanya file
  app yang berubah ke mirror → commit → `git push origin main` (fast-forward).
  Contoh nyata 2026-09-04: beta `320b45a` + live `d21bc5c` (admin+supabase saja).
- **Mirror beta untuk rosok:** `sync-to-mirror.sh` hanya target mirror utama; beta =
  rebuild folder `rosok/` manual dengan whitelist ITEMS skrip (`rm -rf` + `cp -R`),
  lalu commit. (Snapshot `3b258a0` dibuat pola ini.)
- **Verifikasi deploy JANGAN berhenti di "sudah di-push":**
  ```bash
  curl -sI "https://rosok.kasirsolo.com/dexie.min.js" | grep -i content-type          # application/javascript!
  curl -sI "https://rosok.kasirsolo.com/js/supabase.min.js" | grep -i content-type    # application/javascript! (TRAP vendor)
  curl -s  "https://rosok.kasirsolo.com/sw.js" | grep -oE "CACHE_VERSION = '[^']+'"
  ```
  (`text/html` = file TIDAK ADA di deployment — catch-all rewrite membalas HTML 200.)
- **Edge functions** (`generate-license`, `activate-license`) TIDAK ikut deploy Vercel —
  manual: `supabase functions deploy generate-license activate-license`.

---

## 🔐 Lisensi (ringkas — detail DESIGN.md)

- **Tier gratis:** kuota transaksi/bulan (`DEFAULT_TX_QUOTA=100`; cloud override via
  `products.tx_quota` + `clients.tx_adjust`), rollover bulan kalender, TANPA batas waktu.
- **Serial V2:** `KSR-<dc1>-<dc2>-<exp>-<sig6>`, sig = `b32(HMAC-SHA256(salt, salt+d1d2+exp),6)`;
  V1 legacy didukung. Device code = `simpleHash('DEVICE-'+deviceId)` → `XXXX-XXXX`.
- **Gate:** `checkLicenseGate()` saat boot + interval 60 dtk + setelah transaksi;
  expired → `#quotaBanner` + blok `saveTransaksi` saja.
- **Anti-rollback jam:** `clockAnchor` (toleransi 2 hari), dimajukan tiap sync sukses.

---

## 🎨 Design

- **Theme:** `#F5821F` oranye (`--brand`; meta tag & manifest sinkron)
- **Font:** Plus Jakarta Sans (judul) + Inter (body) + Space Mono (angka)
- **Pola UI:** topbar gradient rounded-bawah, bottom-nav 5 tab, sheet overlay
  dari bawah, kartu `.card` putih rounded — selera detail pemilik: lihat memori
  `mcfury-ui-taste` (panel in-flow, tanpa dobel-border fokus, akordeon default tertutup)

---

*AGENTS.md — Kasir Rosok · 2026-09-04*
