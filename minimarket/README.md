<p align="center">
  <img src="public/logo.png" alt="Kasir Solo Logo" width="120" />
</p>

<h1 align="center">Kasir Solo - Minimarket</h1>

<p align="center">
  <strong>Aplikasi Point-of-Sale (POS) Modern untuk Minimarket & Toko Kelontong Indonesia</strong>
</p>

<p align="center">
  <img alt="Version" src="https://img.shields.io/badge/version-1.0.0-orange" />
  <img alt="License" src="https://img.shields.io/badge/license-MIT-green" />
  <img alt="Preact" src="https://img.shields.io/badge/Preact-10.x-673AB8" />
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-5.x-3178C6" />
  <img alt="Tailwind" src="https://img.shields.io/badge/Tailwind-3.4-38BDF8" />
  <img alt="PWA" src="https://img.shields.io/badge/PWA-Offline_Ready-5A0FC8" />
</p>

---

## Daftar Isi

- [Tentang Aplikasi](#tentang-aplikasi)
- [Fitur Utama](#fitur-utama)
- [Tech Stack](#tech-stack)
- [Arsitektur](#arsitektur)
- [Instalasi & Setup](#instalasi--setup)
- [Mode Demo](#mode-demo)
- [Setup Supabase (Opsional)](#setup-supabase-opsional)
- [Build & Deploy](#build--deploy)
- [Struktur Proyek](#struktur-proyek)
- [Keyboard Shortcuts](#keyboard-shortcuts)
- [Dokumentasi Lengkap](#dokumentasi-lengkap)
- [FAQ](#faq)
- [Changelog](#changelog)
- [Lisensi](#lisensi)

---

## Tentang Aplikasi

**Kasir Solo - Minimarket** adalah aplikasi Point-of-Sale (POS) yang dibangun khusus untuk kebutuhan minimarket dan toko kelontong di Indonesia. Aplikasi ini dirancang dengan pendekatan **offline-first** sehingga tetap dapat beroperasi tanpa koneksi internet, dilengkapi dengan antarmuka modern yang responsif, dan mendukung fitur-fitur penting seperti manajemen kas, barcode scanner, keyboard shortcuts, dan pencetakan struk thermal.

### Keunggulan

- **Offline-First (PWA)** — Tetap bisa transaksi walau internet mati
- **POS 3-Kolom** — Layout kasir modern: keranjang | pembayaran | numpad jumbo
- **16 Keyboard Shortcuts** — Operasi kasir super cepat tanpa mouse
- **Barcode Scanner Ready** — Scan langsung dari input, auto-add ke keranjang
- **Buka/Tutup Kas** — Wajib buka sesi kas sebelum transaksi, hitung denominasi saat tutup
- **Dark Mode** — Nyaman untuk operasional malam hari
- **Dual Language** — Indonesia dan English
- **Demo Mode** — Langsung coba tanpa setup database

---

## Fitur Utama

| Modul | Fitur |
|-------|-------|
| **Auth & User** | 4 role (Owner, Manager, Kasir, Gudang), demo mode 4 user, role-based access |
| **POS Kasir** | 3-column layout, barcode scan, numpad jumbo (4 mode), diskon per item & total, 6 metode bayar, PPN 11%, hold/recall order, struk thermal |
| **Produk** | CRUD, 25 produk demo, 10 kategori, SKU/barcode, harga beli/jual/grosir, min/max stok, grid/list view |
| **Stok & Inventory** | Mutasi masuk/keluar, stok opname, expired tracking, low stock alert |
| **Supplier & PO** | 6 supplier demo, Purchase Order (Draft > Approved > Received), retur |
| **Pelanggan & Member** | 6 customer demo, 3 tier loyalty (Bronze/Silver/Gold), points, member discount |
| **Keuangan & Kas** | Buka/tutup kas (wajib), uang masuk/keluar, petty cash, void/retur, arus kas harian |
| **Diskon & Promo** | 5 tipe promo, voucher validator, happy hour, bundling |
| **Notifikasi** | Bell icon, stok menipis, expired, shift reminder, real-time |
| **Laporan** | Penjualan, laba rugi, stok, per kategori, per pembayaran, trend chart |
| **Printer** | Thermal 58mm/80mm, auto-print, test print, receipt builder ESC/POS |
| **Keyboard Shortcuts** | 16 shortcut (F1-F12, +, -, Del, ?, Esc, Enter) |

---

## Tech Stack

| Teknologi | Fungsi |
|-----------|--------|
| [Vite](https://vitejs.dev) | Build tool & dev server |
| [Preact](https://preactjs.com) | UI framework (lightweight React alternative, 3KB) |
| [TypeScript](https://typescriptlang.org) | Type-safe JavaScript |
| [Tailwind CSS](https://tailwindcss.com) | Utility-first CSS framework |
| [Preact Signals](https://preactjs.com/guide/v10/signals/) | Reactive state management |
| [Supabase](https://supabase.com) | Backend (Auth, PostgreSQL, RLS) |
| [RxDB](https://rxdb.info) | Offline-first reactive database |
| [vite-plugin-pwa](https://vite-pwa-org.netlify.app) | Progressive Web App |

---

## Arsitektur

Aplikasi menggunakan **Arsitektur Modular Atomic** yang memisahkan concern ke 3 layer utama:

```
src/
├── data/           ← Data Layer: Types, Database, Sync
│   ├── types/      ← TypeScript interfaces & enums (10 file)
│   ├── supabase.ts ← Supabase client
│   └── sync/       ← RxDB ↔ Supabase sync engine
│
├── logic/          ← Business Logic Layer: Services, Hooks, State
│   ├── services/   ← Domain services dengan demo data (11 file)
│   ├── hooks/      ← Custom hooks (6 file)
│   ├── state/      ← Global state dengan Preact Signals
│   └── utils/      ← Helper functions (format Rupiah, tanggal, dll)
│
├── ui/             ← Presentation Layer: Atomic Design
│   ├── atoms/      ← Komponen terkecil: Button, Input, Badge, Icon, NumpadKey
│   ├── molecules/  ← Gabungan atoms: Toast, ProductCard, StatCard, dll
│   ├── organisms/  ← Kompleks: Sidebar, Header, NumpadPanel, KasModal, dll
│   ├── templates/  ← Layout: MainLayout, AuthLayout
│   └── pages/      ← Halaman: Dashboard, POS, Products, dll (12 halaman)
│
├── i18n/           ← Internationalization: id.ts + en.ts (250+ keys)
├── routes/         ← Client-side routing
├── app.tsx         ← Root component
└── main.tsx        ← Entry point
```

### Alur Data

```
User Action → Component → Service → Signal (State) → Component Re-render
                                  → Supabase (online)
                                  → RxDB (offline cache)
```

---

## Instalasi & Setup

### Prasyarat

- **Node.js** v18+ (disarankan v20 LTS)
- **npm** v9+ atau **pnpm** / **yarn**
- Browser modern (Chrome, Firefox, Edge, Safari)

### Langkah Instalasi

```bash
# 1. Extract dari ZIP
unzip kasir-solo-minimarket.zip
cd kasir-solo-minimarket

# 2. Install dependencies
npm install

# 3. Jalankan development server
npm run dev
```

Aplikasi akan berjalan di `http://localhost:5173` (atau port yang tersedia).

### Environment Variables (Opsional)

Buat file `.env` di root proyek jika ingin menggunakan Supabase:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

> Tanpa `.env`, aplikasi otomatis masuk **Demo Mode**.

---

## Mode Demo

Aplikasi mendukung **Demo Mode** yang bisa langsung digunakan tanpa konfigurasi database:

### Akun Demo

| Role | Email | Password |
|------|-------|----------|
| **Owner** | `owner@demo.com` | `demo123` |
| **Manager** | `manager@demo.com` | `demo123` |
| **Kasir** | `kasir@demo.com` | `demo123` |
| **Gudang** | `gudang@demo.com` | `demo123` |

### Data Demo Termasuk

- 25 produk realistis minimarket Indonesia
- 6 supplier (Indofood, Wings, Unilever, Mayora, Garudafood, ABC President)
- 6 pelanggan dengan tier loyalty berbeda
- 6 promo aktif
- 10 transaksi sample
- Notifikasi demo (stok menipis, expired, dll)

---

## Setup Supabase (Opsional)

Untuk menggunakan database real dengan Supabase:

### 1. Buat Project Supabase

Buka [supabase.com](https://supabase.com) dan buat project baru.

### 2. Jalankan Migrasi SQL

Jalankan file-file SQL di `supabase/migrations/` secara **berurutan** di SQL Editor Supabase:

```
001_users.sql         → Tabel users & profiles
002_products.sql      → Tabel products & categories
003_orders.sql        → Tabel orders, order_items, customers
004_finance.sql       → Tabel shifts, cash_flows, petty_cash, void_records
005_stock.sql         → Tabel stock_mutations, suppliers, purchase_orders
006_promos.sql        → Tabel promos & vouchers
007_settings.sql      → Tabel settings, views
```

### 3. Konfigurasi Environment

```env
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6...
```

### 4. Restart Dev Server

```bash
npm run dev
```

---

## Build & Deploy

### Build Produksi

```bash
npm run build
```

Output akan di folder `dist/`. File ini siap deploy ke hosting statis.

### Deploy ke Platform

**Vercel:**
```bash
npx vercel --prod
```

**Netlify:**
```bash
npx netlify deploy --prod --dir=dist
```

**Cloudflare Pages:**
```bash
npx wrangler pages deploy dist
```

**Docker (opsional):**
```dockerfile
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
```

---

## Struktur Proyek

```
kasir-solo-minimarket/           112 files total
├── public/
│   ├── logo.png                 Logo branding aplikasi
│   ├── manifest.json            PWA manifest
│   └── sw.js                    Service Worker
├── src/
│   ├── data/
│   │   ├── types/
│   │   │   ├── product.ts       Product, Category types
│   │   │   ├── order.ts         Order, OrderItem, PaymentMethod
│   │   │   ├── stock.ts         StockMovement, StockOpname
│   │   │   ├── supplier.ts      Supplier, PurchaseOrder
│   │   │   ├── customer.ts      Customer, MemberTier, LoyaltyPoints
│   │   │   ├── finance.ts       Shift, CashFlow, PettyCash, VoidRecord, Denomination
│   │   │   ├── promo.ts         Promo, PromoType, Voucher
│   │   │   ├── notification.ts  AppNotification, NotifType, Priority
│   │   │   ├── printer.ts       PrinterConfig, PrintJob, PaperSize
│   │   │   └── report.ts        SalesReport, ProfitReport, StockReport
│   │   ├── supabase.ts          Supabase client + demo mode detection
│   │   └── sync/
│   │       └── sync-engine.ts   RxDB ↔ Supabase sync
│   ├── logic/
│   │   ├── services/
│   │   │   ├── auth-service.ts       Login, logout, demo users, staff CRUD
│   │   │   ├── product-service.ts    Product CRUD, 25 demo, search, filter
│   │   │   ├── pos-service.ts        Cart, payment, hold/recall, barcode scan
│   │   │   ├── stock-service.ts      Stock movements, opname, alerts
│   │   │   ├── supplier-service.ts   Supplier CRUD, PO management
│   │   │   ├── customer-service.ts   Customer CRUD, loyalty, points
│   │   │   ├── finance-service.ts    Shift, cash flow, petty cash, void
│   │   │   ├── promo-service.ts      Promo CRUD, voucher validate
│   │   │   ├── notification-service.ts  Notifications, mark read
│   │   │   ├── report-service.ts     Report data generation
│   │   │   └── printer-service.ts    Print receipt, test, queue, ESC/POS
│   │   ├── hooks/
│   │   │   ├── use-auth.ts              Auth state hook
│   │   │   ├── use-dark-mode.ts         Dark mode persistence
│   │   │   ├── use-responsive.ts        Responsive breakpoints
│   │   │   ├── use-online.ts            Online/offline detection
│   │   │   ├── use-role-guard.ts        Role-based access
│   │   │   └── use-keyboard-shortcuts.ts  16 POS keyboard shortcuts
│   │   ├── state/
│   │   │   └── app-state.ts         Global signals: cart, shift, numpad, printer, etc.
│   │   └── utils/
│   │       └── format.ts            formatRupiah, formatDate, generateId, etc.
│   ├── ui/
│   │   ├── atoms/                   5 komponen dasar
│   │   ├── molecules/               7 komponen gabungan
│   │   ├── organisms/               9 komponen kompleks
│   │   ├── templates/               2 layout
│   │   └── pages/                   12 halaman
│   ├── i18n/                        ID + EN (250+ keys)
│   ├── routes/                      Routing config
│   ├── app.tsx                      Root component
│   ├── main.tsx                     Entry point
│   └── index.css                    Global styles + animations
├── supabase/migrations/             7 SQL migration files
├── docs/                            Dokumentasi & tutorial
├── index.html                       HTML entry
├── vite.config.ts                   Vite configuration
├── tsconfig.json                    TypeScript config
├── tailwind.config.js               Tailwind CSS config
├── postcss.config.js                PostCSS config
└── package.json                     Dependencies & scripts
```

---

## Keyboard Shortcuts

Aktif saat berada di halaman POS. Tekan `?` untuk menampilkan panel bantuan.

| Shortcut | Aksi |
|----------|------|
| `F1` | Fokus input barcode / pencarian |
| `F2` | Tahan order (Hold) |
| `F3` | Tampilkan order ditahan |
| `F4` | Bayar / Proses pembayaran |
| `F5` | Hapus keranjang / Transaksi baru |
| `F6` | Toggle mode numpad (BAYAR → QTY → DISKON → HARGA) |
| `F7` | Pilih pelanggan |
| `F8` | Buka cash drawer (visual) |
| `F9` | Cetak struk terakhir |
| `F10` | Void item terakhir |
| `F12` | Toggle fullscreen POS |
| `Esc` | Tutup modal yang terbuka |
| `Enter` | Konfirmasi aksi saat ini |
| `+` / `-` | Tambah / kurangi qty item terpilih |
| `Delete` | Hapus item yang dipilih |
| `?` | Tampilkan/sembunyikan panel bantuan shortcut |

---

## Dokumentasi Lengkap

Dokumentasi detail tersedia di folder `docs/`:

| Dokumen | Isi |
|---------|-----|
| [Panduan Pengguna](docs/01-panduan-pengguna.md) | Tutorial lengkap penggunaan aplikasi |
| [POS & Kasir](docs/02-pos-kasir.md) | Panduan operasional kasir, layout 3-kolom, numpad |
| [Buka/Tutup Kas](docs/03-buka-tutup-kas.md) | Manajemen sesi kas, denominasi, selisih |
| [Barcode & Shortcuts](docs/04-barcode-shortcuts.md) | Scan barcode, keyboard shortcuts |
| [Produk & Stok](docs/05-produk-stok.md) | Kelola produk, kategori, inventori |
| [Supplier & PO](docs/06-supplier-po.md) | Purchase order, penerimaan barang |
| [Pelanggan & Loyalty](docs/07-pelanggan-loyalty.md) | Member, points, tier |
| [Keuangan](docs/08-keuangan.md) | Arus kas, uang masuk/keluar, void/retur |
| [Promo & Voucher](docs/09-promo-voucher.md) | Diskon, bundling, happy hour |
| [Laporan](docs/10-laporan.md) | Sales, profit, stok, dashboard |
| [Printer](docs/11-printer.md) | Setup printer thermal, cetak struk |
| [Pengaturan & Deploy](docs/12-pengaturan-deploy.md) | Konfigurasi toko, deploy, troubleshooting |
| [Referensi API](docs/13-referensi-api.md) | Service API, types, database schema |

---

## FAQ

**Q: Apakah bisa dipakai tanpa internet?**
A: Ya! Aplikasi ini PWA (Progressive Web App) yang bisa di-install dan berjalan offline. Data tersimpan di browser (RxDB) dan akan sync ke Supabase saat online.

**Q: Printer apa yang didukung?**
A: Thermal printer 58mm dan 80mm via USB, Bluetooth, atau Network (IP). Pada mode demo, struk ditampilkan dalam format printable di browser.

**Q: Bisa multi-kasir?**
A: Ya, setiap kasir login dengan akun masing-masing. Sistem shift (buka/tutup kas) per kasir.

**Q: Bagaimana cara scan barcode?**
A: Gunakan barcode scanner USB/Bluetooth yang terhubung ke komputer/tablet. Scanner akan otomatis mengetik barcode ke input field. Atau ketik manual lalu tekan Enter.

**Q: Apakah data demo bisa dihapus?**
A: Di mode demo, data bersifat session-based (hilang saat refresh). Saat menggunakan Supabase, data persistent di database.

---

## Changelog

Lihat [CHANGELOG.md](CHANGELOG.md) untuk riwayat versi lengkap.

---

## Lisensi

MIT License - Bebas digunakan untuk keperluan komersial.

---

<p align="center">
  <strong>Kasir Solo - Minimarket v1.0.0</strong><br>
  Dibangun dengan Preact + TypeScript + Tailwind CSS<br>
  <em>Solusi POS modern untuk minimarket Indonesia</em>
</p>
