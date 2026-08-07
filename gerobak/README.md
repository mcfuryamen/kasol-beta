# Kasir Solo - Gerobak

Aplikasi kasir PWA untuk usaha gerobak/angkringan (makanan cepat saji, minuman, dll). Kelola menu, transaksi POS, kas harian, dan laporan dengan mudah.

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
# Menggunakan Python (simple HTTP server) — PORT RESMI = 8083 (lihat Port Registry: kasol/CONTEXT.md)
python3 -m http.server 8083

# Atau menggunakan Node.js
npx serve .
```

Lalu buka: `http://localhost:8083`

**Note:** PWA memerlukan HTTPS atau localhost untuk berfungsi penuh (Service Worker & Manifest).

## 📱 Features

### Manajemen Menu
- ✅ Tambah/edit/hapus menu item
- ✅ Kategori menu (makanan, minuman, dll)
- ✅ Varian menu (ukuran, level pedas, topping)
- ✅ Harga dasar (modal) & harga jual
- ✅ Status ketersediaan menu

### Transaksi POS
- ✅ Keranjang belanja dengan varian
- ✅ Sistem pembayaran (Tunai, QRIS, Transfer)
- ✅ Cetak struk & share via WhatsApp
- ✅ Riwayat transaksi

### Kas Harian
- ✅ Buka/tutup kas (shift)
- ✅ Modal awal & perhitungan selisih
- ✅ Pengeluaran kas
- ✅ Estimasi kas di tangan

### Dashboard & Laporan
- ✅ Ringkasan harian (omzet, transaksi, pengeluaran)
- ✅ Top menu terlaris
- ✅ Laporan penjualan periode tertentu
- ✅ Grafik penjualan

### Lain-lain
- ✅ Bekerja offline (PWA + Service Worker)
- ✅ Responsive mobile-first design
- ✅ Data tersimpan lokal (IndexedDB)

## 🏗️ Tech Stack

- **Frontend:** Vanilla HTML5, CSS3, JavaScript (ES6+)
- **Database:** Dexie.js (IndexedDB wrapper)
- **PWA:** Service Worker + Web App Manifest
- **Build:** Externalized assets (CSS/JS split)
- **Icons:** 192x192, 512x512, favicon 16/32px

## 📂 Project Structure

```
gerobak/
├── index.html          # Main HTML shell (1.3KB)
├── css/
│   └── style.css      # All application styles (24KB)
├── js/
│   ├── app.js         # Application logic (113KB)
│   └── vendor/
│       └── dexie.min.js  # Dexie.js library (80KB)
├── assets/
│   ├── logo.png       # App logo (49KB)
│   ├── favicon-16.png # Favicon 16x16
│   ├── favicon-32.png # Favicon 32x32
│   ├── icon-192.png   # PWA icon 192x192
│   └── icon-512.png   # PWA icon 512x512
├── sw-gerobak.js       # Service Worker (v3)
├── manifest.json       # PWA manifest
├── vercel.json         # Vercel deployment config
└── README.md           # This file
```

**Optimization Notes:**
- HTML size reduced from 522KB → 1.3KB (99.7% reduction)
- Total assets: ~218KB (from 522KB, 58% reduction)
- External CSS/JS for better caching
- Long-term caching headers (1 year for CSS/JS)

## 📝 Version History

See [CHANGELOG.md](./CHANGELOG.md) for detailed version history.

## 🔐 Security

- XSS prevention dengan `escapeHtml()`
- Sanitasi semua input user
- Data tersimpan lokal (IndexedDB)

## 📝 License

Copyright © 2026 PT Mesin Kasir Solo

## 🤝 Support

- WhatsApp: 0881-6566-935
- Email: owner.kasirsolo@gmail.com

---

**Versi:** 2.0.0 (Optimized)  
**Last Updated:** 31 Juli 2026
