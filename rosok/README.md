# Kasir Solo - Rosok

Aplikasi kasir PWA **offline-first** untuk usaha pengepul rosok / barang bekas.
Catat pembelian & penjualan timbangan, stok, kas, laporan — dengan lisensi
berbasis kuota transaksi dan sinkronisasi cloud dua-arah (Supabase) ala kaki5.

- **Live:** https://rosok.vercel.app (Vercel project `rosok`, repo `mcfuryamen/kasol`, Root Directory `rosok/`)
- **Beta:** https://rosok-beta.vercel.app (Vercel project `rosok-beta`, repo `mcfuryamen/kasol-beta`)
- **Versi:** 1.4.0 · **Service Worker:** v54 · **Dexie:** `KasirSoloRosokDB` v5

## 📦 Installation (PWA)

### HP (Chrome/Android)
1. Buka aplikasi di browser
2. Pengaturan → Perangkat → **📲 Pasang Aplikasi** (muncul saat browser menawarkan install), atau menu → "Add to Home Screen"

### Desktop (Chrome/Edge)
Klik icon install di address bar, atau Menu → More Tools → Create Shortcut.

## 🚀 Running Locally

> **PORT RESMI app ini = `8084`** (Port Registry — sumber kebenaran: `kasol/CONTEXT.md`). Jangan ganti-ganti.

```bash
# Development server bawaan repo (MIME + CORS utk ESM) — default port 8084
node run-local.js
# Buka: http://localhost:8084
```

`file://` TIDAK bisa dipakai (modul ESM ditolak browser). PWA butuh HTTPS/localhost.

## 📱 Features

### Transaksi (POS wizard 2 langkah)
- Pembelian dari penjual & penjualan ke bandar, timbang kg/ons/kuintal dengan keypad
- Keranjang multi-item, preset nominal, kembalian otomatis
- **Metode bayar** (bisa di-toggle di Pengaturan): **Tunai**, **Transfer** (nominal pas + foto bukti transfer wajib, tampil di riwayat), **Tempo** (uang muka opsional → utang/piutang, pelunasan di Laporan)
- Nota: cetak browser, share WhatsApp, dan **printer thermal Bluetooth** (BLE chunking ala kaki5, koneksi persist)

### Stok & Kategori
- 10 kategori default pengepul (kardus, besi, aluminium, tembaga, dll), emoji picker, stok real-time anti-minus

### Kas
- Buka/tutup kas (shift + modal awal + selisih), catatan kas masuk/keluar, riwayat shift, tutup buku tahunan

### Laporan + Riwayat (satu halaman mengalir)
- Filter periode sticky menyelip di bawah header: Harian/Mingguan/Bulanan/Custom + navigasi ‹ › + picker tanggal (akordeon, default tertutup)
- Statistik omzet/laba/utang/piutang, grafik per jam, Rosok Terlaris ranked, daftar riwayat mengikuti periode laporan

### Lisensi & Kuota (model kaki5)
- **Gratis = kuota transaksi per bulan** (default 100; angka dari cloud `products.tx_quota` + bonus admin `clients.tx_adjust`), kuota segar tiap awal bulan, TANPA batas waktu
- Kuota habis → banner bisa ditutup + transaksi terkunci; eksplorasi tetap bebas
- **Beli Lisensi**: QRIS/rekening live dari Supabase (dikelola aplikasi admin), upload bukti → verifikasi admin → aktif otomatis (realtime + polling)
- **Kode manual** `KSR-XXXX-XXXX-XX-XXXXXX` (HMAC V1/V2, terikat perangkat) — fallback offline
- **Cloud = sumber kebenaran mutlak**: adopsi aktivasi admin, downgrade bila cloud mencabut, anti-rollback jam (`clockAnchor`)

### Cloud Sync (Supabase, proyek shared ekosistem kasirsolo)
- **Profil usaha dua-arah** di tabel `clients`: push penuh saat simpan (nama, pemilik, telepon, wilayah emsifa 4 level + telemetri perangkat), pull saat boot/buka Pengaturan/tiap 5 menit; flag pending melindungi editan offline
- **Cadangan cloud** (khusus lisensi aktif): bucket `backups`, file `cadangan-latest.json` per unit
- **Backup lokal**: export/import JSON tandatangani HMAC-device (validasi 3 lapis, restore atomik)
- **Diagnosa 10 langkah** (Pengaturan → Perangkat → Cek Data Online): rantai sync diperiksa berurutan + hasil bisa disalin ke admin

## 🏗️ Tech Stack

- **Frontend:** Vanilla HTML5 + CSS3 + JavaScript ES6+ Modules (tanpa framework, tanpa build step)
- **Database:** Dexie.js (IndexedDB) — `KasirSoloRosokDB`, schema v1→v2→v3→v5
- **Cloud:** Supabase (PostgREST + Storage + Realtime + Edge Functions) via `supabase.min.js` + `supabase-config.js` (anon key dari Edge Function/`/api/supabase-config`, fallback konstanta)
- **PWA:** Service Worker **network-first** (HTML & aset) dengan fallback cache offline — CACHE_VERSION v54; auto-update prompt + `controllerchange` reload
- **Wilayah:** API wilayah Indonesia emsifa (statis JSON, fallback lokal `assets/region/provinces.json`)

## 📂 Project Structure

```
rosok/
├── index.html          # Entry point (HTML + loader ESM, cache-bust ?v=)
├── style.css           # Seluruh styling (design tokens CSS)
├── sw.js               # Service Worker (network-first, CACHE_VERSION)
├── manifest.json       # PWA manifest
├── dexie.min.js        # Library Dexie (wajib negasi .gitignore!)
├── run-local.js        # Dev server lokal (node run-local.js, port 8084)
├── sync-to-mirror.sh   # Salin produksi -> mirror GitHub kasol (whitelist)
├── vercel.json / .vercelignore
├── README.md / AGENTS.md / CHANGELOG.md / DESIGN.md
├── docs/               # Arsip laporan audit/QA sekali-pakai
├── assets/             # Logo, icon, favicon, splash, region/provinces.json
└── js/
    ├── app.js          # Entry — wire window handlers, boot, profil UI, hook cloud
    ├── app-state.js    # State terpusat + setter (binding ESM read-only)
    ├── db.js           # Dexie ONLY (zero import)
    ├── utils.js        # fmt, toast, overlay, getSetting/setSetting, getDeviceInfo
    ├── router.js       # pushState SPA + deep link
    ├── nav.js          # showScreen, sticky bars, hook Pengaturan/diagnosa
    ├── pos.js          # Timbang, keranjang, pembayaran (tunai/transfer/tempo), nota
    ├── kategori.js     # Stok & kategori
    ├── kas.js          # Buka/tutup kas & manual
    ├── laporan.js      # Laporan + periode jangkar lokal
    ├── riwayat.js      # Riwayat (satu halaman dgn laporan)
    ├── dashboard.js    # Beranda & statistik
    ├── carousel.js     # Platform messages carousel
    ├── onboard.js      # Emoji picker kategori (wizard onboarding sudah dihapus)
    ├── license.js      # Kuota + serial HMAC V1/V2 + gate + chip + kartu lisensi
    ├── license.sync.js # Kontrak Supabase: clients/products/settings, claim, pull/push
    ├── purchase.js     # Beli lisensi: QRIS/rekening, bukti, polling, realtime
    ├── settings-x.js   # Toggle metode bayar, PWA install, Diagnosa 10 langkah
    ├── printer.js      # Printer thermal BLE (chunking + persist)
    ├── backup.js       # Export/import + cadangan cloud (payload v3, validasi 3 lapis)
    ├── region.js       # Picker wilayah 4 level (emsifa API)
    ├── app-link.js     # Link situs aplikasi dari cloud (products/settings)
    └── supabase-config.js  # URL+anon key (Edge Function / fallback, skip di dev host)
```

## 🔐 Security

- XSS prevention `escapeHtml()` di semua render input user; entity-map di region picker
- Data transaksi 100% lokal (IndexedDB) — cloud hanya profil, lisensi, kuota, cadangan
- Validasi lisensi HMAC-SHA256; salt serial hanya server-side (client baca `products.salt` utk verifikasi)
- Anon key publik by design; akses `clients` per perangkat via RLS hybrid (`user_id` ATAU claim `unit_id` di JWT sesi anon)
- Backup lokal bertanda tangan HMAC device-bound (anti file ubahan); cadangan cloud tanpa signature (lintas perangkat)

## 🚢 Release & Deploy (ringkas — detail di AGENTS.md)

1. Ubah kode → **WAJIB bump** `sw.js` CACHE_VERSION + token `?v=` di `index.html` (dan `APP_VERSION` bila ada perubahan fitur)
2. `node run-local.js` → uji manual + `curl` endpoint
3. Beta: rebuild folder `rosok/` di mirror `kasol-beta` → push `main`
4. Live: `sync-to-mirror.sh` → mirror `kasol` → push `main` → Vercel auto-deploy `kasir-rosok`
5. Verifikasi: `curl -sI https://rosok.vercel.app/dexie.min.js` (content-type JS!) + `sw.js` versi —
   dan `curl -sI https://rosok.vercel.app/js/supabase.min.js` (vendor Supabase, jangan sampai HTML)

## 📝 License

Copyright © 2026 PT Mesin Kasir Solo

## 🤝 Support

- WhatsApp: 0881-6566-935
- Email: owner.kasirsolo@gmail.com

---

**Versi:** 1.4.0 · **Last Updated:** 2026-09-04
