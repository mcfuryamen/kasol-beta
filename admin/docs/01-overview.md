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
| **Tipe** | Modular Vanilla ESM SPA (Single Page Application) |
| **Bahasa** | Indonesia |
| **Deployment** | Vercel (via local mirror, GitHub Actions dihapus) |
| **Arsitektur** | 3-layer: Entry → State/Data → Core/UI/Utils |
| **Storage** | Abstraction layer (localStorage → Supabase ready) |
| **Auth** | Simple password gate (password: `admin123`) |
| **Theme** | Orange (kaki5) + Dark sidebar + Card-based UI |
| **Responsive** | 4 tier: HP (<768) / Tablet (768-1023) / Desktop (≥1024) / Large (≥1440) |

---

## 🎯 Tujuan

Admin dashboard berfungsi sebagai **pusat kontrol** untuk owner dan tim KASIRSOLO:

1. **Melihat statistik** — 6 KPI: Total Leads 👥, Deal 🤝, Aplikasi Aktif 📦, Potensial Revenue 💰, Lead Baru 🆕, Konversi 📈
2. **Mengelola leads** — memantau pendaftar trial dari landing page (tabel 5 kolom, search, filter, export CSV)
3. **Mengelola katalog** — CRUD aplikasi yang tampil di landing (card actions: Edit/Hapus, sheet form `.field-grid`)
4. **Generate lisensi** — membuat serial aktivasi untuk klien (HMAC-SHA256, product registry, generate/verify)
5. **Mengatur pengaturan** — info usaha (field-grid 2 kolom tablet/desktop), landing config, backup/restore

---

## 🏗️ Struktur Aplikasi

```
admin/
├── docs/                    # Dokumentasi (file ini)
├── index.html              # Entry point (~430 baris, no inline styles)
├── style.css               # Design system (~940 baris, 4-tier responsive)
├── js/
│   ├── app.js              # Entry: boot, routing, screen switching
│   ├── app-state.js        # State management (STATE, setState, getState)
│   ├── storage.js          # Storage abstraction (localStorage → Supabase ready)
│   ├── utils.js            # escapeHtml, formatRupiah, formatDate, showToast
│   ├── toast.js            # Toast notification system
│   ├── auth.js             # doLogin, doLogout, checkAuth
│   ├── navigation.js       # showScreen, sidebar/bottomnav handling
│   ├── dashboard.js        # 6 KPI cards + bar charts + empty states
│   ├── leads.js            # 5-col table + search/filter/export + empty state
│   ├── catalog.js          # Card grid + actions + sheet modal (.field-grid)
│   ├── license-ui.js       # Product registry + Generate/Verify + Reference code
│   ├── license-core.js     # Pure HMAC-SHA256 (no DOM, no side-effects)
│   └── settings.js         # Business/Landing forms + backup/restore/reset
├── vercel.json             # Vercel config (rewrites to index.html)
├── manifest.json           # PWA manifest
├── sw.js                   # Service Worker
└── .vercelignore           # Vercel ignore rules
```

---

## 📐 5 Modul Utama

### 1. Dashboard / Overview

Menampilkan ringkasan data bisnis (6 KPI gradient cards):

| KPI | Icon | Metrik |
|-----|------|--------|
| Total Leads | 👥 | `leads.length` |
| Deal | 🤝 | status = "Deal" |
| Aplikasi Aktif | 📦 | catalog.length / max 8 |
| Potensial Revenue | 💰 | Σ price × leads |
| Lead Baru | 🆕 | status = "Baru" |
| Konversi | 📈 | Deal / Total × 100% |

- **Bar Charts**: Leads per Aplikasi + Leads per Status (horizontal, proportional)
- **Empty states**: pakai `hidden` attribute (bukan inline style)

### 2. Leads Management

Tabel interaktif 5 kolom untuk mengelola pendaftar trial:
- **Kolom**: Nama/Bisnis, WhatsApp (link wa.me), Aplikasi, Tanggal Daftar, Status (dropdown)
- **Toolbar**: Search real-time (nama/WA/alamat) + Filter status dropdown
- **Actions**: Ubah status (auto-save), Hapus (konfirmasi), Export CSV
- **Empty state**: `hidden` attribute + semantic classes (`.empty-icon`, `.empty-title`, `.empty-desc`)

### 3. Katalog Management

CRUD untuk aplikasi di landing page:
- **Card grid responsif**: HP 1 kolom, Tablet 2, Desktop 3, Large 4
- **Card actions**: Edit (buka sheet modal) + Hapus (konfirmasi)
- **Sheet modal**: `.field-grid` (1 kolom HP, 2 kolom tablet/desktop) + `.field-span-2` untuk textarea
- **Form fields**: Ikon (emoji), Nama, Deskripsi, Kategori, Harga, Hot badge
- **Empty state**: konsisten dengan Leads (class `.empty-icon` + `hidden`)

### 4. Lisensi (Generate & Verify)

Modul untuk penerbitan lisensi device-bound:
- **Product Registry**: Daftar produk dengan prefix & salt (grid responsif 3-tier)
- **Generate Serial**: Pilih produk + Device Code + Expiry → Serial HMAC-SHA256 (auto-format device code)
- **Verify Serial**: Pilih produk + Serial + Device Code (opsional) → validasi HMAC + device match
- **Reference Code**: Generate blok kode JS universal untuk disalin ke aplikasi klien
- **Backup/Restore**: Export/import product registry JSON

> **Arah: generate + validasi via Supabase** (Lapisan Meta/CRM) — memungkinkan
> revoke/reset lisensi terpusat. Saat ini masih offline sampai `admin/` sinkron ke
> Supabase. Detail: `04-license-system.md` & `../CLOUD-ROADMAP.md`.

### 5. Pengaturan

Form untuk mengontrol konten landing page + admin backup:
- **Info Usaha** (`.field-grid` 2 kolom tablet/desktop): Nama Usaha, Tagline, Alamat, Telepon, Email, WhatsApp, Instagram
- **Landing Page Config** (`.field-grid` 2 kolom): Hero Title, Hero Description (span-2), CTA Button Text
- **Backup & Restore**: Export Backup Admin (JSON), Import Backup Admin (file input)
- **Bantuan & Dukungan**: Contact strip (WhatsApp + Email)
- **Lainnya**: Hapus Semua Data Admin (konfirmasi ganda)
- **Submit handler**: Simpan ke STATE + storage + toast notifikasi

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

## 📁 Struktur File (Updated)

```
admin/
├── docs/
│   ├── 00-ekosistem.md
│   ├── 01-overview.md          # (file ini)
│   ├── 02-architecture.md
│   ├── 03-data-schema.md
│   ├── 04-license-system.md
│   ├── 05-design-system.md
│   ├── 06-product-features.md
│   └── 07-setup-deploy.md
├── index.html                  # Entry point, no inline styles
├── style.css                   # Design system, 4-tier responsive
├── js/
│   ├── app.js                  # Entry: boot + routing
│   ├── app-state.js            # State management
│   ├── storage.js              # Storage abstraction
│   ├── utils.js                # Utilities
│   ├── toast.js                # Toast system
│   ├── auth.js                 # Auth gate
│   ├── navigation.js           # Screen switching
│   ├── dashboard.js            # Dashboard module
│   ├── leads.js                # Leads module
│   ├── catalog.js              # Catalog module
│   ├── license-ui.js           # License UI module
│   ├── license-core.js         # Pure HMAC core
│   └── settings.js             # Settings module
├── vercel.json
├── manifest.json
├── sw.js
└── .vercelignore
```

---

## 🚀 Quick Start

```bash
# 1. Buka di browser (butuh HTTP server untuk ESM modules)
cd admin
python3 -m http.server 8083
# Buka http://127.0.0.1:8083

# 2. Masukkan password: admin123

# 3. Navigasi menggunakan bottom nav (HP) atau sidebar (Desktop)
#    - Dashboard: 6 KPI + bar charts
#    - Leads: kelola pendaftar trial
#    - Katalog: kelola aplikasi landing page
#    - Lisensi: generate/verifikasi serial
#    - Pengaturan: atur info usaha, landing, backup
```

---

## 🔄 Perubahan Terbaru (2026-08-06)

- **Full modular ESM refactor**: dari monolith `index.html` → 12 file JS modular
- **3-layer architecture**: Entry (`app.js`) → State/Data (`app-state.js`, `storage.js`) → Core/UI/Utils
- **Storage abstraction**: `storage.js` siap untuk Supabase (interface tetap sama)
- **Adopted kaki5 design system**: orange theme, bottom nav, sheet modal, card-based UI
- **Gerobak KPI**: 6 metrik gradient cards (👥🤝📦💰🆕📈) + bar charts
- **4 device tiers**: HP (<768) / Tablet (768-1023) / Desktop (≥1024) / Large (≥1440)
- **All inline styles removed** → CSS utility classes (`.mt12`, `.field-grid`, `.input-mono`, `.hidden` attr, dll)
- **Catalog**: card actions, sheet form `.field-grid`/`.field-span-2`, empty-state `hidden`
- **Settings**: field IDs reconciled, form wrapper, submit handler (STATE+storage+toast)
- **Leads**: 5-col table aligned, empty-state `hidden`
- **License**: product registry responsive grid 3-tier, generate/verify forms
- **Sheets/Modals**: `.open` + `.show` support, desktop center modal, mobile bottom-sheet
- **GitHub Actions workflows removed** — deploy via local mirror only

---

*Admin Dashboard — KASIRSOLO by PT Mesin Kasir Solo*