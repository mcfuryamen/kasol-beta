# 📊 KASIRSOLO Admin Dashboard

Dashboard internal untuk mengelola seluruh ekosistem KASIRSOLO — leads, katalog aplikasi, lisensi, dan pengaturan landing page.

[![License](https://img.shields.io/badge/license-Proprietary-red.svg)](LICENSE)
[![Architecture](https://img.shields.io/badge/architecture-Modular%20ESM-blue.svg)](docs/02-architecture.md)
[![Supabase](https://img.shields.io/badge/cloud-Supabase-green.svg)](docs/08-supabase-integration.md)
[![Design System](https://img.shields.io/badge/design-DESIGN.md-orange.svg)](DESIGN.md)

---

## 🚀 Quick Start

```bash
# 1. Clone repository
cd /c/Users/Admin/Documents/kasol/admin

# 2. Setup environment (copy .env.example to .env.local)
cp .env.example .env.local

# 3. Start local server (port 8082)
python -m http.server 8082

# 4. Open browser
http://127.0.0.1:8082

# 5. Login
Password: admin123
```

**Requirements:**
- Browser modern (Chrome, Firefox, Safari, Edge) dengan ES Modules support
- Python 3 untuk HTTP server
- **Tidak perlu Node.js, build tool, atau npm dependencies**

---

## 📐 Arsitektur

**Modular Vanilla ESM SPA** — Zero build, runs in browser

```
admin/
├── index.html              # Entry point (~430 lines)
├── style.css               # Design system (~940 lines)
├── DESIGN.md              # Formal design tokens spec
├── js/
│   ├── app.js              # Entry: boot + routing
│   ├── app-state.js        # State management
│   ├── storage.js          # Storage abstraction (localStorage)
│   ├── utils.js            # Shared utilities
│   ├── toast.js            # Toast notifications
│   ├── auth.js             # Auth gate
│   ├── navigation.js       # Screen switching
│   ├── license-core.js     # Pure HMAC (reusable)
│   ├── dashboard.js        # Dashboard module
│   ├── leads.js            # Leads management
│   ├── catalog.js          # Catalog CRUD (Supabase)
│   ├── license-ui.js       # License UI
│   ├── settings.js         # Settings management
│   ├── supabase-client.js  # Supabase REST client
│   └── env-loader.js       # Load .env.local → window vars
├── vercel.json             # Vercel config
├── .vercelignore           # Vercel ignore
├── manifest.json           # PWA
├── sw.js                   # Service Worker
├── .env.local              # Local env (NOT committed)
└── docs/                   # Dokumentasi
    ├── 00-ekosistem.md
    ├── 01-overview.md
    ├── 02-architecture.md
    ├── 03-data-schema.md
    ├── 04-license-system.md
    ├── 05-design-system.md
    ├── 06-product-features.md
    ├── 07-setup-deploy.md
    └── 08-supabase-integration.md
```

---

## 🗂️ Fitur

| Modul | Deskripsi | Storage |
|-------|-----------|---------|
| **Dashboard** | Ringkasan KPI: leads, deal, revenue, konversi | localStorage |
| **Leads** | Manajemen pendaftar trial: tabel, search, filter, export CSV | localStorage |
| **Katalog** | CRUD produk aplikasi: tambah, edit, hapus, atur urutan | **Supabase** |
| **Lisensi** | Generate & verifikasi serial lisensi (HMAC-SHA256) | localStorage |
| **Pengaturan** | Edit info bisnis, backup/restore data | localStorage |

---

## ☁️ Supabase Integration

Katalog produk sekarang tersimpan di **Supabase cloud** — sinkron real-time antara admin dan landing page.

| Fitur | Status |
|-------|--------|
| Tabel `products` | ✅ Ready |
| RLS policies | ✅ Enabled |
| Admin CRUD | ✅ Implemented |
| Landing fetch | ✅ Implemented |
| Leads → Supabase | 🔄 Rencana |
| Settings → Supabase | 🔄 Rencana |

Lihat dokumentasi lengkap: [docs/08-supabase-integration.md](docs/08-supabase-integration.md)

---

## 🔐 Login

Password default: **`admin123`**

Untuk mengubah password, edit `js/auth.js`:

```javascript
function doLogin() {
  if (val === 'admin123') {  // ← GANTI password di sini
    showApp();
  }
}
```

---

## 📝 Dokumentasi

| File | Deskripsi |
|------|-----------|
| [00-ekosistem.md](docs/00-ekosistem.md) | Arsitektur ekosistem KASIRSOLO |
| [01-overview.md](docs/01-overview.md) | Overview aplikasi |
| [02-architecture.md](docs/02-architecture.md) | Arsitektur teknis |
| [03-data-schema.md](docs/03-data-schema.md) | Schema database |
| [04-license-system.md](docs/04-license-system.md) | Sistem lisensi HMAC |
| [05-design-system.md](docs/05-design-system.md) | Design tokens & CSS |
| [06-product-features.md](docs/06-product-features.md) | Fitur per produk |
| [07-setup-deploy.md](docs/07-setup-deploy.md) | Setup & deploy |
| [08-supabase-integration.md](docs/08-supabase-integration.md) | Integrasi Supabase |

---

## 🚀 Deploy ke Vercel

1. Push ke GitHub: `git push origin main`
2. Vercel auto-detect changes di folder `admin/`
3. Environment variables di-set di Vercel Dashboard

Lihat panduan lengkap: [docs/07-setup-deploy.md](docs/07-setup-deploy.md)

---

## 📜 License

Proprietary — PT Mesin Kasir Solo

---

*Admin Dashboard — KASIRSOLO*
