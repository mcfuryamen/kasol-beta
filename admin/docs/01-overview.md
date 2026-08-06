# Admin Dashboard — Ringkasan Proyek

Dashboard internal untuk mengelola seluruh ekosistem KASIRSOLO — leads, katalog aplikasi, lisensi, dan pengaturan landing page.

> ⚠️ **Arah Arsitektur Cloud (2026):** Admin adalah pintu ke **Lapisan Meta/CRM**
> (Supabase). Sistem lisensi akan melakukan **generate + validasi via Supabase**,
> menggantikan pendekatan offline saat ini. Lihat **`../CLOUD-ROADMAP.md`** untuk
> roadmap 3 lapisan & Dashboard Hub.

---

## 📋 Informasi Dasar

| Item | Detail |
|------|--------|
| **Nama** | Admin Marketing — KASIRSOLO |
| **Tipe** | Single HTML SPA (Single Page Application) |
| **Bahasa** | Indonesia |
| **Deployment** | Vercel |
| **Framework** | Vanilla HTML/CSS/JS |
| **Auth** | Simple password gate (password: `admin123`) |
| **File utama** | `index.html` (~630 baris) |

---

## 🎯 Tujuan

Admin dashboard berfungsi sebagai **pusat kontrol** untuk owner dan tim KASIRSOLO:

1. **Melihat statistik** — total kunjungan, jumlah leads, distribusi per aplikasi
2. **Mengelola leads** — memantau pendaftar trial dari landing page
3. **Mengelola katalog** — menambah, mengedit, menghapus aplikasi yang tampil di landing
4. **Generate lisensi** — membuat serial aktivasi untuk klien (HMAC-SHA256)
5. **Mengatur pengaturan** — kontak, alamat, dan statistik hero landing page

---

## 🏗️ Struktur Aplikasi

```
┌──────────────────────────────────────────────────────────┐
│                    index.html (SPA)                      │
│                                                          │
│  ┌─────────────────┐    ┌──────────────────────────────┐ │
│  │   LOGIN GATE    │    │         APP SHELL            │ │
│  │                 │    │                              │ │
│  │  Password:      │    │  ┌──────────┐  ┌─────────┐  │ │
│  │  admin123       │───►│  │ SIDEBAR  │  │  MAIN   │  │ │
│  │                 │    │  │          │  │  CONTENT│  │ │
│  │  [Masuk]        │    │  │ • Dash   │  │         │  │ │
│  │  [Salah!]       │    │  │ • Leads  │  │ • Stats │  │ │
│  └─────────────────┘    │  │ • Catalog│  │ • Leads │  │ │
│                         │  │ • Lisensi│  │ • Form  │  │ │
│                         │  │ • Settings│ │ • Catalog│ │ │
│                         │  │          │  │ • License│ │ │
│                         │  │ [Refresh]│  │ • Settings│ │ │
│                         │  │ [Logout] │  └─────────┘  │ │
│                         │  └──────────┘               │ │
│                         └──────────────────────────────┘ │
└──────────────────────────────────────────────────────────┘
```

---

## 📐 5 Modul Utama

### 1. Dashboard / Overview

Menampilkan ringkasan data bisnis:
- **Stat Cards**: Total Kunjungan, Total Leads, Leads Baru, Sudah Berlangganan
- **Bar Chart**: Leads per Aplikasi (horizontal bar)
- **Bar Chart**: Leads per Status (horizontal bar)

### 2. Leads Management

Tabel interaktif untuk mengelola pendaftar trial:
- Pencarian real-time (nama, WA, alamat)
- Filter berdasarkan status
- Ubah status langsung dari dropdown
- Hapus lead dengan konfirmasi
- Export ke CSV

### 3. Katalog Management

CRUD untuk aplikasi di landing page:
- Tambah aplikasi baru
- Edit: ikon, nama, deskripsi, kategori, harga, badge Hot
- Hapus aplikasi
- Data tersimpan ke localStorage → otomatis muncul di landing

### 4. Lisensi (Generate & Verify)

Modul untuk penerbitan lisensi device-bound:
- **Product Registry**: Daftar produk dengan prefix & salt
- **Generate Serial**: Input device code → pilih expiry → output serial HMAC
- **Verify Serial**: Input serial → validasi HMAC & device match (lokal); **target: validasi server via Supabase**
- **Reference Code**: Generate kode JS untuk disalin ke aplikasi klien
- **Backup/Restore**: Export/import product registry JSON

> **Arah: generate + validasi via Supabase** (Lapisan Meta/CRM) — memungkinkan
> revoke/reset lisensi terpusat. Saat ini masih offline sampai `admin/` sinkron ke
> Supabase. Detail: `04-license-system.md` & `../CLOUD-ROADMAP.md`.

### 5. Pengaturan

Form untuk mengontrol konten landing page:
- Kontak (WhatsApp, Email)
- Alamat (Legal + Operasional + link Google Maps)
- Statistik Hero (jumlah klien, uptime)

---

## 💾 Data & Storage

### Tahap Awal (localStorage)

| Key | Sumber | Penulis | Pembaca |
|-----|--------|---------|---------|
| `kasirsolo:catalog` | Admin → Landing | Admin | Landing page |
| `kasirsolo:settings` | Admin → Landing | Admin | Landing page |
| `kasirsolo:leads` | Landing → Admin | Landing (form) | Admin |
| `kasirsolo:stats` | Landing → Admin | Landing (visit) | Admin |
| `kasirsolo_license_products_v3` | Admin only | Admin | Admin |

### Tahap Lanjut (Supabase) — Lapisan Meta/CRM

| Tabel | Fungsi |
|-------|--------|
| `users` | Multi-user dengan RLS (owner & tim) |
| `businesses` | Data bisnis klien / unit |
| `leads` | Pendaftar trial (terintegrasi dengan users) |
| `products` | Katalog aplikasi |
| `settings` | Pengaturan landing page |
| `licenses` | Serial, device code, HMAC, expiry, **status (active/expired/revoked)** — generate & validasi |
| `stats` | Kunjungan & analytics |

> Jalur **Data Bisnis** (transaksi klien) dan **Dashboard Hub** termasuk Lapisan B,
> bukan bagian dari admin. Lihat `../CLOUD-ROADMAP.md`.

---

## 🔐 Keamanan

| Aspek | Saat Ini | Rencana |
|-------|----------|---------|
| **Auth** | Password hardcoded `admin123` | Supabase Auth + RLS |
| **Data** | localStorage (local only) | Supabase (cloud, encrypted) |
| **Multi-user** | Single user | RLS policies (owner write, team read) |
| **Lisensi** | HMAC-SHA256 + device-bound | Sama, tapi validasi via cloud |

> ⚠️ **Peringatan:** Password saat ini hardcoded di source code. Untuk produksi,
> ganti dengan sistem autentikasi yang lebih kuat.

---

## 📁 Struktur File

```
admin/
├── docs/
│   ├── 00-ekosistem.md
│   ├── 01-overview.md
│   ├── 02-architecture.md
│   ├── 03-data-schema.md
│   ├── 04-license-system.md
│   ├── 05-design-system.md
│   ├── 06-product-features.md
│   └── 07-setup-deploy.md
└── index.html          # Seluruh aplikasi (HTML + CSS + JS)
```

---

## 🚀 Quick Start

```bash
# 1. Buka di browser
open admin/index.html

# 2. Masukkan password: admin123

# 3. Navigasi menggunakan sidebar
#    - Dashboard: lihat statistik
#    - Leads: kelola pendaftar trial
#    - Katalog: kelola aplikasi landing page
#    - Lisensi: generate/verifikasi serial
#    - Pengaturan: atur kontak & alamat
```

---

*Admin Dashboard — KASIRSOLO by PT Mesin Kasir Solo*
