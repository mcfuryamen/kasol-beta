# 📊 KASIRSOLO Admin Dashboard

Dashboard internal untuk mengelola seluruh ekosistem KASIRSOLO — leads, katalog aplikasi, lisensi, dan pengaturan landing page.

[![License](https://img.shields.io/badge/license-Proprietary-red.svg)](LICENSE)
[![Architecture](https://img.shields.io/badge/architecture-Modular%20ESM-blue.svg)](docs/02-architecture.md)
[![Design System](https://img.shields.io/badge/design-DESIGN.md-orange.svg)](DESIGN.md)

---

## 🚀 Quick Start

```bash
# 1. Clone repository
cd /c/Users/Admin/Documents/kasol/admin

# 2. Start local server — PORT RESMI app ini = 8082 (lihat Port Registry: kasol/CONTEXT.md)
python -m http.server 8082

# 3. Open browser
http://127.0.0.1:8082

# 4. Login
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
│   ├── storage.js          # Storage abstraction (localStorage → Supabase ready)
│   ├── utils.js            # Shared utilities
│   ├── toast.js            # Toast notifications
│   ├── auth.js             # Auth gate
│   ├── navigation.js       # Screen switching
│   ├── license-core.js     # Pure HMAC (reusable)
│   ├── dashboard.js        # Dashboard module (6 KPI)
│   ├── leads.js            # Leads module (5-col table)
│   ├── catalog.js          # Catalog module (cards + sheet)
│   ├── license-ui.js       # License module (generate/verify)
│   └── settings.js         # Settings module (forms + backup)
└── docs/                   # Documentation (8 files)
```

**3-Layer Architecture:**
- **Entry Layer:** `app.js` — boot, routing, screen switching
- **State/Data Layer:** `app-state.js`, `storage.js` — state management + storage abstraction
- **Core/UI/Utils Layer:** modules + license-core + utilities

---

## 🎨 Design System

**Theme:** Warm orange accent (#E65100) + professional gray hierarchy

| Aspect | Detail |
|--------|--------|
| **Colors** | 9 tokens: primary/secondary/tertiary/accent/neutral/ink + semantic |
| **Typography** | 7 scales: h1/h2, body-lg/md/sm, caption, mono |
| **Spacing** | 7-step scale: xs-xxxl (4px-32px) |
| **Rounded** | 4 radius: sm (12px), md (16px), lg (20px), full (9999px) |
| **Responsive** | 4 tiers: HP (<768) / Tablet (768-1023) / Desktop (≥1024) / Large (≥1440) |

**Formal spec:** [`DESIGN.md`](DESIGN.md) — Google DESIGN.md format dengan machine-readable tokens

---

## 📦 5 Modul Utama

### 1. 📊 Dashboard
- **6 KPI gradient cards:** Total Leads, Deal, Aplikasi Aktif, Potensial Revenue, Lead Baru, Konversi
- **Bar charts:** Leads per Aplikasi + Leads per Status
- **Empty states:** semantic classes dengan `hidden` attribute

### 2. 👥 Leads
- **Tabel 5 kolom:** Nama/Bisnis, WhatsApp (wa.me link), Aplikasi, Tanggal, Status dropdown
- **Toolbar:** Search real-time + Filter status
- **Actions:** Export CSV

### 3. 📦 Katalog
- **Card grid responsif:** 1-4 kolom (HP-Large)
- **Card actions:** Edit (sheet modal) + Hapus (konfirmasi)
- **Sheet form:** `.field-grid` (2 kolom tablet+)

### 4. 🔐 Lisensi
- **Product registry:** Grid 3-tier responsif
- **Generate serial:** HMAC-SHA256 + device-bound
- **Verify serial:** Validasi HMAC + device match
- **Reference code:** Universal JS untuk app klien

### 5. ⚙️ Pengaturan
- **Info usaha:** `.field-grid` 2 kolom (tablet+)
- **Landing config:** Hero title/desc/CTA
- **Backup/Restore:** Export/import JSON

---

## 🗄️ Data & Storage

### Tahap Awal (localStorage)

| Key | Fungsi | Penulis | Pembaca |
|-----|--------|---------|---------|
| `kasirsolo:catalog` | Katalog aplikasi | Admin | Landing page |
| `kasirsolo:settings` | Pengaturan landing | Admin | Landing page |
| `kasirsolo:leads` | Data leads | Landing form | Admin |
| `kasirsolo:stats` | Analytics | Landing | Admin |
| `kasirsolo_license_products_v3` | Product registry | Admin | Admin |

### Tahap Lanjut (Supabase) — Roadmap

Migrasi ke cloud dengan RLS (Row Level Security):
- `users` — Multi-user (owner & tim)
- `businesses` — Data bisnis klien
- `licenses` — Generate + **validasi server** (status active/expired/revoked)
- `leads`, `products`, `settings`, `stats`

**Keuntungan storage abstraction:** Hanya `storage.js` yang perlu diubah, semua module lain tetap.

---

## 🚢 Deploy

### Vercel (Production)

**Strategi:** Manual push ke GitHub, Vercel auto-deploy (no GitHub Actions workflow)

```bash
# 1. Sync produksi ke mirror
cd /c/Users/Admin/Documents/kasol/admin
cp -r . /c/Users/Admin/Documents/GitHub/kasol/admin/

# 2. Commit & push dari monorepo root
cd /c/Users/Admin/Documents/GitHub/kasol
git add admin/
git commit -m "admin: <deskripsi perubahan>"
git push origin main

# 3. Vercel auto-deploy dari GitHub (configured via Vercel dashboard)
```

**Vercel Project Settings:**
- **Root Directory:** `admin/`
- **Framework Preset:** Other
- **Build Command:** *(leave empty)*
- **Output Directory:** `.`
- **Install Command:** *(leave empty)*

**File Config:**
- `vercel.json` — SPA rewrites + caching headers
- `.vercelignore` — ignore docs/, *.md, node_modules

**Domain:** Akan dikonfigurasi sebagai subdomain (e.g., `admin.kasirsolo.com`)

> **Note:** GitHub Actions workflows sudah dihapus. Deploy dilakukan manual push → Vercel auto-detect changes.

---

## 🔐 Keamanan

| Aspek | Saat Ini | Rencana |
|-------|----------|---------|
| **Auth** | Password hardcoded `admin123` | Supabase Auth + RLS |
| **Data** | localStorage (local only) | Supabase (cloud, encrypted) |
| **Multi-user** | Single user | RLS policies (owner write, team read) |
| **Lisensi** | HMAC-SHA256 + device-bound | Sama, tapi validasi via cloud (status revoke terpusat) |

⚠️ **Production:** Ganti password di `js/auth.js` sebelum deploy.

---

## 📚 Dokumentasi Lengkap

| File | Isi |
|------|-----|
| [`docs/00-ekosistem.md`](docs/00-ekosistem.md) | Peta ekosistem KASIRSOLO (admin, landing, apps, Supabase) |
| [`docs/01-overview.md`](docs/01-overview.md) | Ringkasan proyek + struktur aplikasi |
| [`docs/02-architecture.md`](docs/02-architecture.md) | Arsitektur 3-layer + data flow + module dependencies |
| [`docs/03-data-schema.md`](docs/03-data-schema.md) | Schema localStorage + rencana Supabase |
| [`docs/04-license-system.md`](docs/04-license-system.md) | Algoritma HMAC-SHA256 + reference code + validasi flow |
| [`docs/05-design-system.md`](docs/05-design-system.md) | Color palette + typography + components + responsive |
| [`docs/06-product-features.md`](docs/06-product-features.md) | Spec detail 5 modul (Dashboard/Leads/Katalog/Lisensi/Settings) |
| [`docs/07-setup-deploy.md`](docs/07-setup-deploy.md) | Setup lokal + deploy Vercel + migrasi Supabase |

---

## 🛠️ Development

### Menambah Screen Baru

1. **HTML:** Tambah sidebar link + screen section di `index.html`
2. **JS Module:** Buat file baru di `js/new-screen.js` dengan `render` function
3. **Import:** Tambah ke `app.js` dan wire ke `showScreen`
4. **CSS:** Tambah styling di `style.css` (ikuti design system)

### Mengubah Password

Edit `js/auth.js`:
```javascript
export const ADMIN_PASSWORD = 'admin123';  // ← GANTI
```

### Testing Checklist

- [ ] Login dengan password
- [ ] Dashboard: 6 KPI cards + charts
- [ ] Leads: table 5 kolom, search, filter, export CSV
- [ ] Katalog: card grid, tambah/edit/hapus, sheet modal
- [ ] Lisensi: product registry, generate/verify serial
- [ ] Pengaturan: forms, backup/restore
- [ ] Responsive: HP/Tablet/Desktop/Large
- [ ] No console errors

---

## 🗺️ Roadmap

### ✅ Fase 1 — Modular Refactor (Selesai)
- 3-layer architecture (Entry/State/Data/Core/UI/Utils)
- Storage abstraction (localStorage → Supabase ready)
- Kaki5 design system adoption
- 4-tier responsive layout
- DESIGN.md formal spec

### 🔄 Fase 2 — Cloud Integration (In Progress)
- [ ] Supabase project setup
- [ ] Migration SQL (schema dari `docs/03-data-schema.md`)
- [ ] Update `storage.js` ke Supabase client
- [ ] RLS policies (owner write, team read)
- [ ] Supabase Auth integration
- [ ] License server-side validation

### 📋 Fase 3 — Dashboard Hub (Planned)
- [ ] Client-facing dashboard (`hub.kasirsolo.com`)
- [ ] Per-unit + global aggregate stats
- [ ] Real-time sync (offline-first apps → cloud)
- [ ] 3-layer global schema compliance

**Rujukan lengkap:** [`../CLOUD-ROADMAP.md`](../CLOUD-ROADMAP.md)

---

## 🤝 Contributing

**Folder produksi:** `C:\Users\Admin\Documents\kasol\admin\` (source of truth)  
**Folder mirror:** `C:\Users\Admin\Documents\GitHub\kasol\admin\` (GitHub sync)

**Workflow:**
1. Edit di folder produksi
2. Test di `http://127.0.0.1:8082`
3. Sync ke mirror: `cp -r . /c/Users/Admin/Documents/GitHub/kasol/admin/`
4. Commit dari monorepo root: `cd /c/Users/Admin/Documents/GitHub/kasol && git add admin/ && git commit`

**Commit conventions:**
- `admin: <subject>` — general changes
- `admin/docs: <subject>` — documentation only
- `admin/js: <subject>` — JavaScript modules
- `admin/css: <subject>` — styling

---

## 📄 License

Proprietary — PT Mesin Kasir Solo

---

## 🔗 Links

- **Live Demo:** TBD (production deployment pending)
- **Landing Page:** `../landing/`
- **Aplikasi Klien:** `../rosok/`, `../gerobak/`, `../kaki5/`, `../retail/`
- **Design System:** [`DESIGN.md`](DESIGN.md)
- **Cloud Roadmap:** [`../CLOUD-ROADMAP.md`](../CLOUD-ROADMAP.md)

---

**Built with ❤️ by PT Mesin Kasir Solo**  
Admin Dashboard — KASIRSOLO Ecosystem
