# Kasir Solo - Retail

Aplikasi kasir PWA untuk toko retail offline. Kelola produk, penjualan, stok, pelanggan, dan laporan dengan mudah.

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
# Menggunakan Python (simple HTTP server) — PORT RESMI = 8085 (lihat Port Registry: kasol/CONTEXT.md)
python3 -m http.server 8085

# Atau menggunakan Node.js
npx serve .

# Atau menggunakan PHP
php -S localhost:8085
```

Lalu buka: `http://localhost:8085`

**Note:** PWA memerlukan HTTPS atau localhost untuk berfungsi penuh (Service Worker & Manifest).

## 📱 Features

### Transaksi
- ✅ Point of Sale (POS) dengan antarmuka mobile-friendly
- ✅ Scan barcode (menggunakan BarcodeDetector API)
- ✅ Multi-payment: Tunai, Transfer/QRIS, Kartu
- ✅ Sistem tempo (utang/piutang)
- ✅ Diskon item & total
- ✅ Pajak (PPN) configurable
- ✅ Cetak nota & share via WhatsApp

### Manajemen Produk
- ✅ Kategori produk (Sembako, Minuman, Makanan, dll)
- ✅ Stok real-time dengan minimum stock alert
- ✅ Barcode & SKU
- ✅ Harga beli & harga jual
- ✅ Emoji picker untuk produk

### Stok & Inventori
- ✅ Tracking stok otomatis
- ✅ Stock opname (koreksi stok)
- ✅ Riwayat mutasi stok
- ✅ Alert stok menipis/habis

### Pelanggan & Supplier
- ✅ Manajemen pelanggan & supplier
- ✅ Piutang & utang
- ✅ Pelunasan (payment settlement)
- ✅ Riwayat transaksi per kontak

### Kas & Keuangan
- ✅ Multi kasir (shift system)
- ✅ Kas masuk/keluar manual
- ✅ Buku kas (cashbook)
- ✅ Laporan laba rugi

### Laporan
- ✅ Penjualan per periode (Hari ini, 7 hari, Bulan ini, Custom)
- ✅ Produk terlaris & paling lambat
- ✅ Grafik bar chart
- ✅ Export CSV
- ✅ Omzet per kasir

### Lain-lain
- ✅ Sistem lisensi offline (trial 7 hari)
- ✅ Backup/restore data (JSON)
- ✅ Bekerja offline (PWA + IndexedDB)
- ✅ Responsive mobile-first design
- ✅ Keyboard shortcuts (F2=Cari, F4=Bayar)

## 🏗️ Tech Stack

- **Frontend:** Vanilla HTML5, CSS3, JavaScript (ES6+)
- **Database:** Dexie.js (IndexedDB wrapper)
- **PWA:** Service Worker + Web App Manifest
- **Icons:** 192x192, 512x512, favicon 16/32px

## 📂 Project Structure

```
retail/
├── index.html          # Main application (~2300 baris)
├── dexie.min.js       # Dexie.js library (80KB)
├── sw.js              # Service Worker (v1)
├── manifest.json      # PWA manifest
├── logo.png           # Source logo (49KB)
├── icon-192.png       # PWA icon 192x192
├── icon-512.png       # PWA icon 512x512
├── favicon-16.png     # Favicon 16x16
├── favicon-32.png     # Favicon 32x32
├── package.json       # Node.js dependencies (for sharp)
├── node_modules/      # Dependencies
├── README.md          # This file
├── CHANGELOG.md       # Version history
├── AUDIT_REPORT.md    # Audit report
├── .vercelignore      # Vercel ignore file
└── vercel.json        # Vercel config
```

## 🔐 Security

- XSS prevention dengan `esc()` function
- Sanitasi semua input user
- Anti-double-submit protection
- Client-side license validation
- Data tersimpan lokal (IndexedDB)

## 📝 Version History

- **v1.0.0** (2026-07-31) - Initial release dengan Phase 1-4 improvements
  - PWA structure (manifest, icons, SW)
  - Database migration ke Dexie.js
  - Security fixes (double-submit protection)
  - Performance optimizations (loading indicators)

## 🤝 Support

- WhatsApp: 0881-6566-935
- Email: owner.kasirsolo@gmail.com

---

**Copyright © 2026 PT Mesin Kasir Solo**

**Versi:** 1.0.0  
**Last Updated:** 31 Juli 2026
