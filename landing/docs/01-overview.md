# Landing Page — Ringkasan Proyek

Website marketing utama untuk KASIRSOLO — aplikasi kasir & manajemen bisnis Indonesia dengan model **bayar sekali, pakai seumur hidup**.

---

## 📋 Informasi Dasar

| Item | Detail |
|------|--------|
| **Nama** | KASIRSOLO Landing Page |
| **Tipe** | Single HTML Page (marketing site) |
| **Bahasa** | Indonesia |
| **Deployment** | Vercel |
| **Framework** | Vanilla HTML/CSS/JS (no build step) |
| **Font** | Plus Jakarta Sans + Inter (Google Fonts) |
| **File utama** | `index.html` (~1000 baris) |

---

## 🎯 Tujuan

Landing page ini memiliki 4 tujuan utama:

1. **Marketing** — Memperkenalkan produk KASIRSOLO kepada calon pelanggan
2. **Funnel Konversi** — Mengarahkan pengunjung ke form trial gratis
3. **Lead Generator** — Mengumpulkan data calon pelanggan (nama, WA, aplikasi yang diminati)
4. **Showcase** — Menampilkan katalog aplikasi yang tersedia

---

## 🏗️ Struktur Halaman

Halaman terdiri dari **11 section** utama:

```
┌─────────────────────────────────────┐
│  01. Header / Navbar                │  ← Sticky, glassmorphism, mobile menu
├─────────────────────────────────────┤
│  02. Hero                           │  ← Headline, CTA, counter stats,
│                                     │     phone mockup, floating cards
├─────────────────────────────────────┤
│  03. Trust Strip                    │  ← Baris kepercayaan (data, enkripsi, dll)
├─────────────────────────────────────┤
│  04. Problem & Solution             │  ← 2 kolom: masalah vs solusi
├─────────────────────────────────────┤
│  05. Katalog Aplikasi               │  ← Grid 4 kolom, filter kategori,
│                                     │     data dinamis dari localStorage
├─────────────────────────────────────┤
│  06. Cara Kerja                     │  ← 4 langkah: Daftar → Trial → Bayar → Hidup
├─────────────────────────────────────┤
│  07. Keunggulan                     │  ← 3 kartu keunggulan
├─────────────────────────────────────┤
│  08. Pricing                        │  ← Kartu harga gelap, fitur list
├─────────────────────────────────────┤
│  09. Form Trial                     │  ← Form: nama, alamat, WA, pilih aplikasi
├─────────────────────────────────────┤
│  10. Final CTA                      │  ← Gradient orange-red, ajakan terakhir
├─────────────────────────────────────┤
│  11. Footer                         │  ← 4 kolom: brand, produk, perusahaan, alamat
└─────────────────────────────────────┘
```

---

## 🧩 Fitur Utama

### Katalog Dinamis
Daftar aplikasi ditampilkan berdasarkan data di `localStorage` key `kasirsolo:catalog`.
Admin dapat menambah, mengubah, atau menghapus aplikasi melalui dashboard admin.
Perubahan otomatis muncul saat landing page dimuat ulang.

### Form Trial → Lead
Ketika pengunjung mengisi form trial:
1. Data disimpan ke `localStorage` key `kasirsolo:leads`
2. Form reset + pesan sukses muncul
3. Data otomatis tersedia di dashboard admin (tab Leads)

### Counter Animation
Statistik di hero (jumlah klien, jumlah aplikasi, uptime) menggunakan animasi counting
yang memicu saat elemen masuk viewport (Intersection Observer).

### Scroll Reveal
Semua section dengan class `.reveal` akan muncul dengan animasi fade-in + slide-up
saat di-scroll ke dalam viewport.

### Filter Katalog
Tombol filter (Semua / Bisnis / Institusi / Kesehatan) menyaring kartu aplikasi
secara real-time tanpa reload halaman.

---

## 💾 Data yang Digunakan

Landing page membaca 4 key dari `localStorage`:

| Key | Isi | Sumber Penulisan |
|-----|-----|-----------------|
| `kasirsolo:catalog` | Daftar aplikasi (nama, harga, kategori, dll) | Admin Dashboard |
| `kasirsolo:settings` | Kontak, alamat, statistik hero | Admin Dashboard |
| `kasirsolo:leads` | Data pendaftar trial | Form submission (halaman ini) |
| `kasirsolo:stats` | Jumlah kunjungan | Form submission (halaman ini) |

> **Catatan:** Sinkronisasi saat ini menggunakan `localStorage` (hanya tersedia di browser yang sama).
> Untuk produksi multi-device, perlu migrasi ke Supabase.

---

## 📁 Struktur File

```
landing/
├── docs/
│   ├── 00-ekosistem.md
│   ├── 01-overview.md
│   ├── 02-architecture.md
│   ├── 03-data-schema.md
│   ├── 04-design-system.md
│   ├── 05-product-catalog.md
│   └── 06-setup-deploy.md
├── index.html          # Semua kode (HTML + CSS + JS) dalam satu file
├── logo.png            # Logo KASIRSOLO
├── vercel.json         # Konfigurasi Vercel
└── .vercelignore       # File yang diabaikan Vercel
```

---

## 🚀 Quick Start

```bash
# 1. Buka di browser
open landing/index.html

# 2. Untuk deploy ke Vercel
cd landing
vercel deploy --prod

# 3. Atau push ke repo GitHub (Vercel auto-deploy, no GitHub Actions)
git add .
git commit -m "docs: tambahkan dokumentasi"
git push
```

---

*Landing Page — KASIRSOLO by PT Mesin Kasir Solo*
