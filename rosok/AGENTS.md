# AGENTS — Kasir Rosok

Konteks spesifik untuk aplikasi **Kasir Rosok** (bengkel/pengepul barang bekas).
Selalu baca [`../CONTEXT.md`](../CONTEXT.md) untuk standar ekosistem.

---

## 📋 Info Aplikasi

| Item | Value |
|------|-------|
| **Folder** | `rosok/` |
| **Prefix** | `KSR` |
| **Salt** | `KASIRSOLO-ROSOK-HMAC-V2` |
| **Database** | `KasirSoloRosokDB` |
| **Vercel Project** | `kasir-rosok` |
| **Target User** | Pengepul rosok, bengkel, SPK, usaha barang bekas |

---

## 🎯 Referensi Utama

Folder `rosok/` (repo ini) adalah **kode aktif & sumber referensi** — arsitektur modular ES6+
dengan state terpusat di `js/app-state.js` dan handler global (window) di `js/app.js`.

> **Referensi historis:** `rosok.zip` (single-file build ~276KB) dipakai sebagai rujukan saat
> refactor modular masih berjalan. Sekarang sudah tergantikan oleh struktur modular di `js/`.

---

## 🗂️ Struktur File

```
rosok/
├── index.html          # Entry point (HTML + loader ESM)
├── style.css           # Seluruh styling (design tokens CSS)
├── js/                 # Modul ES6+ aktif
│   ├── app.js          # Entry module — wire window handlers global
│   ├── app-state.js    # State terpusat + setter (binding read-only)
│   ├── pos.js          # POS: timbang, keranjang, pembayaran, nota
│   ├── nav.js          # Navigasi screen + sticky bar
│   ├── dashboard.js    # Beranda & statistik
│   ├── kategori.js     # Stok & kategori barang
│   ├── riwayat.js      # Riwayat transaksi
│   ├── laporan.js      # Laporan & tempo
│   ├── kas.js          # Buka/tutup kas & kas manual
│   ├── license.js      # Lisensi (trial 7 hari / HMAC v2)
│   ├── onboard.js      # Onboarding pertama
│   ├── carousel.js     # Platform carousel
│   ├── router.js       # Route hashing
│   └── utils.js        # Utilitas (fmt, toast, escape, overlay)
├── assets/             # Logo, icon, favicon, splash (satu sumber)
├── sw.js               # Service Worker (Stale-While-Revalidate)
├── manifest.json       # PWA manifest
├── dexie.min.js        # Library Dexie (IndexedDB)
├── run-local.js        # Dev server lokal (node run-local.js)
├── sync-to-mirror.sh   # Salin produksi -> mirror (whitelist otomatis)
├── vercel.json / .vercelignore
├── AGENTS.md / README.md / CHANGELOG.md
└── docs/               # (opsional) arsip dokumen audit/QA
```

### ⚠️ Konvensi State Modular (PENTING)

Binding `export let` di `js/app-state.js` bersifat **read-only** bagi modul lain (aturan ESM).
Semua mutasi state harus lewat **setter** (`setCart`, `setActiveTransTipe`, `setCurrentBerat`, dll)
yang diekspor dari `app-state.js`. **Jangan pernah** menulis `cart = ...` langsung di modul lain —
itu memicu `SyntaxError: Assignment to constant variable` dan membuat seluruh app gagal load.

Setiap fungsi baru yang menambah/mengubah state harus memakai setter ini.


---

## 🗄️ Database Schema (Dexie v4)

```javascript
const db = new Dexie("KasirSoloRosokDB");
db.version(1).stores({
  settings: 'key',
  kategori: '++id, nama, aktif',
  transaksi: '++id, tipe, tanggal',
  transaksiItem: '++id, transaksiId, kategoriId',
  kas: '++id, tanggal, tipe'
});
db.version(2).stores({
  settings: 'key',
  kategori: '++id, nama, aktif',
  transaksi: '++id, tipe, tanggal',
  transaksiItem: '++id, transaksiId, kategoriId',
  kas: '++id, tanggal, tipe',
  kasShift: '++id, status, waktuBuka'
});
db.version(3).stores({
  settings: 'key',
  kategori: '++id, nama, aktif',
  transaksi: '++id, tipe, tanggal',
  transaksiItem: '++id, transaksiId, kategoriId',
  kas: '++id, tanggal, tipe',
  kasShift: '++id, status, waktuBuka',
  platformMessages: '++id, order, visibleFrom, visibleUntil'
});
db.version(4).stores({
  settings: 'key',
  kategori: '++id, nama, aktif',
  transaksi: '++id, tipe, tanggal',
  transaksiItem: '++id, transaksiId, kategoriId',
  kas: '++id, tanggal, tipe',
  kasShift: '++id, status, waktuBuka',
  platformMessages: '++id, order, visibleFrom, visibleUntil',
  tutupBuku: '++id, tahun'
});
```

---

## 🖥️ Screens & Sheets

### 6 Screen (Bottom Nav Tabs)

| Screen | Tab | Fitur |
|--------|-----|-------|
| Dashboard | 📊 | Stat cards (kas, stok, beli, jual, laba, utang, piutang), platform carousel |
| Transaksi | 💳 | Form beli/jual, timbang (kg/ons/kuintal), keranjang, metode bayar (tunai/transfer/tempo) |
| Stok | 📦 | Kategori barang, daftar stok, tambah/edit kategori |
| Riwayat | 📋 | List transaksi + filter, detail nota, hapus/void |
| Laporan | 📈 | Laba kotor, saldo kas, top kategori, chart, periode (7/30/all hari) |
| Pengaturan | ⚙️ | Profil usaha, buka/tutup kas, lisensi, tentang |

### 7 Sheet (Overlay Forms)

| Sheet | Fungsi |
|-------|--------|
| `sheetKas` | Catat kas manual (masuk/keluar) |
| `sheetBukaKas` | Buka kas shift (input modal awal) |
| `sheetTutupKas` | Tutup kas (bandingkan sistem vs fisik) |
| `sheetLunasi` | Lunasi tempo/piutang |
| `sheetKategori` | Tambah/edit kategori barang |
| `sheetLicense` | Status lisensi & aktivasi |
| `sheetOnboard` | Onboarding pertama (nama usaha) |

---

## 🚀 Deployment & Monorepo

Folder produksi berkode modular. Deploy ke cloud via monorepo `kasol` (2 skrip):

1. **`sync-to-mirror.sh`** (di folder produksi) — salin file aplikasi (whitelist modular) ke
   folder mirror `Documents/GitHub/kasol/rosok`. Sampah dev (node_modules, tes, screenshot,
   report) otomatis dikecualikan.
2. **`push-to-github.sh`** (di root monorepo `kasol`) — commit + push ke `origin/main`.

**Perilaku Vercel — penting:** deploy **tidak lagi memakai GitHub Actions**. Semua
`.github/workflows/*` sudah dihapus. Deploy otomatis oleh **Vercel git integration
(auto-detect)**.

1. Project `kasir-rosok` terhubung ke repo dengan **Root Directory = `rosok/`**.
2. Push ke branch utama → Vercel otomatis deploy project rosok.
3. **Tanpa** `vercel-ignore.sh`, tanpa `deploy-all.yml`, tanpa secrets CI
   (`VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID_*`).
4. `vercel.json` rosok ber-tipe statis (`buildCommand: null`, `outputDirectory: "."`).

### ⚠️ Aturan yang TIDAK BOLEH dilanggar

Beberapa pernah dilanggar dan membuat production mati total. Detail + troubleshooting
ada di [`../DEPLOYMENT.md`](../DEPLOYMENT.md).

| # | Aturan | Kalau dilanggar |
|---|--------|-----------------|
| 1 | `dexie.min.js` wajib punya negasi `!rosok/dexie.min.js` di root `.gitignore` | `*.min.js` menelannya → `Dexie is not defined` → seluruh app mati di production |
| 2 | Bump cache `sw.js` (CACHE_VERSION) setiap deploy | klien melihat versi rusak dari cache SW |

Verifikasi setelah deploy — jangan berhenti di "sudah di-push":

```bash
curl -sI "https://rosok.vercel.app/dexie.min.js" | grep -i content-type
#   ✅ application/javascript    ❌ text/html = file TIDAK ADA di deployment
curl -s "https://rosok.vercel.app/sw.js" | grep -oE "CACHE_VERSION = '[^']+'"
```

---

## 🔐 License

- **Prefix:** `KSR`
- **Format serial:** `KSR-XXXX-XXXX-XX-XXXXXX`
- **Trial:** 7 hari, extend max 20x (1 hari per extend)
- **Device Code:** `simpleHash('DEVICE-' + installId)` → base36 pad 8 char
- **Kode lengkap:** `js/license.js`

---

## 🎨 Design

- **Theme color:** `#F5821F` (orange; meta tag & manifest harus sinkron dengan `--brand`)
- **Font:** Plus Jakarta Sans + Inter + Space Mono
- **Pattern:** Topbar gradient + Bottom nav 5 tabs + Sheet overlays

---

*AGENTS.md — Kasir Rosok*
