# Kasir Solo - Rosok

Aplikasi kasir PWA untuk usaha pengepul rosok / barang bekas. Catat pembelian, penjualan, stok, dan kas dengan mudah.

## 📦 Installation

### Cara Install di HP (PWA):
1. Buka aplikasi di browser Chrome/Safari
2. Klik menu → "Add to Home Screen"
3. Icon akan muncul di home screen dengan logo Kasir Solo

### Cara Install di Desktop:
1. Buka di Chrome/Edge
2. Klik icon install di address bar
3. Atau: Menu → More Tools → Create Shortcut

## 🚀 Running Locally

```bash
# Development server bawaan (port 7777, MIME type ESM sudah diatur)
node run-local.js
# Buka: http://localhost:7777

# Alternatif: Python simple HTTP server
python3 -m http.server 8084

# Atau menggunakan Node.js
npx serve .
```

Lalu buka: `http://localhost:8084`

**Note:** PWA memerlukan HTTPS atau localhost untuk berfungsi penuh (Service Worker & Manifest).

## 📱 Features

### Transaksi
- ✅ Pembelian rosok dari penjual
- ✅ Penjualan rosok ke bandar
- ✅ Sistem timbang (kg, ons, kuintal)
- ✅ Keranjang belanja dengan wizard 2 langkah
- ✅ Pembayaran: Tunai, Transfer, Tempo (utang/piutang)
- ✅ Cetak nota & share via WhatsApp

### Manajemen
- ✅ Tracking stok real-time per kategori
- ✅ 10 kategori default (kardus, besi, aluminium, dll)
- ✅ Tambah/ubah/hapus kategori
- ✅ Emoji picker untuk kategori

### Kas
- ✅ Buka/tutup kas (shift)
- ✅ Modal awal & perhitungan selisih
- ✅ Kas masuk/keluar manual
- ✅ Riwayat kas shift (10 terakhir)

### Laporan
- ✅ Penjualan & pembelian per periode
- ✅ Top 5 kategori terlaris
- ✅ Grafik bar chart 7 hari terakhir
- ✅ Utang/piutang tempo
- ✅ Kas saldo & riwayat

### Lain-lain
- ✅ Sistem lisensi offline (trial 7 hari)
- ✅ Backup/restore data (JSON)
- ✅ Bekerja offline (PWA)
- ✅ Responsive mobile-first design

## 📝 Update Terbaru (v1.3.4) - 2026-08-03
- **Cleanup Filter Laporan** - hapus dropdown bulan kalender (`bulanFilter`) dan tab preset "Setahun"; periode kini hanya `Semua | Hari Ini | 7 Hari | 30 Hari | Custom`
- **Fix "Fitur Ilang" (Service Worker)** - ubah strategi asset dari cache-first menjadi **Stale-While-Revalidate** (CACHE_VERSION v10); sajikan cache instan lalu revalidate dari server di background, sehingga setiap update kode otomatis tampil setelah reload tanpa perlu bump versi manual
- **Script Deploy Monorepo** - tambah `sync-to-mirror.sh` (produksi → mirror, whitelist otomatis) + `push-to-github.sh` (commit & push ke GitHub cloud), menggantikan GitHub Desktop

## 📝 Update Terbaru (v1.3.3) - 2026-08-02
- **Redesign Halaman Pembayaran** - layout compact terpadu (total, metode bayar, nominal, kembalian dalam satu kartu), header step 2 grid 2 kolom, ringkasan keranjang compact, preset nominal +10K/+25K/+50K/+100K dengan auto-fill
- **Fix Label Tempo/Utang** - perbaiki TypeError saat pilih metode Tempo/Tunai (elemen label hilang); label "Uang Muka"/"Sisa Utang" dan hint tempo kini tampil benar
- **Fix Styling Pembayaran** - jarak input Catatan ke kartu, chip keranjang step 1, tombol metode bayar di layar ≤360px, koreksi variabel CSS tidak terdefinisi
- **Fix Dev Server** - module JS gagal load di `run-local.js` karena query string tidak dihapus saat lookup file (MIME type salah)

## 🏗️ Tech Stack

- **Frontend:** Vanilla HTML5, CSS3, JavaScript (ES6+ Modules)
- **Database:** Dexie.js (IndexedDB wrapper)
- **PWA:** Service Worker (v10) + Web App Manifest
  - Network-first untuk HTML, **Stale-While-Revalidate** untuk assets
  - CACHE_VERSION: v10
  - Auto-update dengan skipWaiting dan clientClaim
- **Build Tools:** Sharp.js (icon generation)
- **Icons:** 192x192, 512x512, favicon 16/32px

## 📂 Project Structure

```
rosok/
├── index.html          # Entry point (HTML + loader ESM)
├── style.css           # Seluruh styling aplikasi (design tokens CSS)
├── js/                 # Modul ES6+ (state, fitur, utilitas)
│   ├── app.js          # Entry module (wire global handlers)
│   ├── app-state.js    # State terpusat + setter (read-only binding)
│   ├── pos.js          # POS: timbang, keranjang, pembayaran, nota
│   ├── nav.js          # Navigasi screen + sticky bar
│   ├── dashboard.js    # Beranda & statistik
│   ├── kategori.js     # Stok & kategori barang
│   ├── riwayat.js      # Riwayat transaksi
│   ├── laporan.js      # Laporan & tempo
│   ├── kas.js          # Buka/tutup kas & kas manual
│   ├── license.js      # Lisensi (trial/HMAC)
│   ├── onboard.js      # Onboarding pertama
│   ├── carousel.js     # Platform carousel
│   ├── router.js       # Route hashing
│   └── utils.js        # Utilitas (fmt, toast, escape, overlay)
├── assets/             # Logo, icon, favicon, splash (satu sumber)
├── sw.js               # Service Worker (v10, Stale-While-Revalidate)
├── manifest.json       # PWA manifest
├── dexie.min.js        # Library Dexie (IndexedDB)
├── run-local.js        # Development server lokal (node run-local.js)
├── sync-to-mirror.sh   # Salin produksi -> folder mirror (whitelist otomatis)
├── vercel.json         # Konfigurasi deploy Vercel
├── AGENTS.md           # Panduan agen AI (konteks proyek)
├── CHANGELOG.md        # Riwayat versi
└── README.md           # File ini
```

## 🎨 UI Styling Reference

- **`.kat-stock`** - badge stok di pojok kanan atas kategori (background var(--green-soft), warna var(--green), font-size 11px)
- **`.btn-extend`** - tombol perpanjangan gradian hijau (background linear-gradient(var(--grad-green)), padding 14px 16px)
- **`.compact-list`** - styling compact untuk daftar keuangan (font-size 13px, padding 8px 2px, icon 32x32px)

## 🔐 Security

- XSS prevention dengan `escapeHtml()`
- Sanitasi semua input user
- Client-side license validation (HMAC-SHA256)
- Data tersimpan lokal (IndexedDB)

## 📝 License

Copyright © 2026 PT Mesin Kasir Solo

## 🤝 Support

- WhatsApp: 0881-6566-935
- Email: owner.kasirsolo@gmail.com

---

**Versi:** 1.3.4  
**Last Updated:** 2026-08-03
