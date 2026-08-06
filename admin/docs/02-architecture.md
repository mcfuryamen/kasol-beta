# Admin Dashboard — Architecture

Arsitektur admin dashboard KASIRSOLO: modular ESM, Supabase cloud sync, offline-first hybrid.

---

## 🏗️ Arsitektur Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    CLIENT (Browser)                        │
├─────────────────────────────────────────────────────────────┤
│  index.html                                                 │
│  ├── js/env-loader.js      (load .env.local → window vars) │
│  ├── js/supabase-client.js (Supabase REST client)          │
│  ├── js/app.js             (entry point)                   │
│  ├── js/app-state.js       (global state)                  │
│  ├── js/catalog.js         (CRUD → Supabase)               │
│  ├── js/leads.js           (localStorage)                  │
│  ├── js/dashboard.js       (localStorage)                  │
│  └── js/settings.js        (localStorage)                  │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                   SUPABASE (Cloud)                         │
├─────────────────────────────────────────────────────────────┤
│  Table: products (catalog)                                  │
│  ├── id UUID PRIMARY KEY                                   │
│  ├── app_type TEXT (rosok, gerobak, kaki5, retail, ...)    │
│  ├── name TEXT NOT NULL                                    │
│  ├── tagline TEXT                                          │
│  ├── description TEXT                                      │
│  ├── price_label TEXT                                      │
│  ├── features JSONB                                        │
│  ├── icon TEXT                                             │
│  ├── color TEXT                                            │
│  ├── order_index INTEGER                                   │
│  ├── visible BOOLEAN                                       │
│  ├── created_at TIMESTAMPTZ                                │
│  └── updated_at TIMESTAMPTZ                                │
│                                                             │
│  RLS Policies:                                              │
│  ├── public_read: anon key can READ visible=true           │
│  └── service_role: service_role key full CRUD              │
└─────────────────────────────────────────────────────────────┘
```

---

## 📦 Modul JavaScript

### 1. `js/env-loader.js`
Load environment variables dari `.env.local` ke `window`.
**Jangan di-commit** dengan key real.

```javascript
window.SUPABASE_URL = 'https://PROJECT.supabase.co';
window.SUPABASE_ANON_KEY = 'eyJ...';
window.SUPABASE_SERVICE_KEY = 'eyJ...';
```

### 2. `js/supabase-client.js`
Supabase REST API client. Export ke window untuk diakses module lain.
- **READ**: `GET /rest/v1/products`
- **CREATE**: `POST /rest/v1/products`
- **UPDATE**: `PATCH /rest/v1/products?id=eq.<uuid>`
- **DELETE**: `DELETE /rest/v1/products?id=eq.<uuid>`

### 3. `js/catalog.js`
Module CRUD katalog.
- **READ**: Fetch dari Supabase (semua produk, urut `order_index`)
- **CREATE**: Insert ke Supabase dengan service_role key
- **UPDATE**: Patch ke Supabase
- **DELETE**: Delete dari Supabase

### 4. `js/leads.js`, `js/dashboard.js`, `js/settings.js`
Masih menggunakan **localStorage** untuk tahap awal.

---

## 🔐 Environment Variables

### File: `.env.local` (LOKAL SAJA)
```
SUPABASE_URL=https://PROJECT.supabase.co
SUPABASE_ANON_KEY=eyJ... (read-only)
SUPABASE_SERVICE_ROLE_KEY=eyJ... (full CRUD)
```

### File: `.gitignore`
```
.env*
.env
.env.local
!.env.example
```

### Deployment Vercel
Environment variables di-set via **Vercel Dashboard → Settings → Environment Variables**:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

> **Service role key TIDAK perlu di-deploy ke Vercel** karena admin CRUD dilakukan dari browser dengan service key lokal.

---

## 🔄 Data Flow

### Admin → Supabase (CRUD)
```
Admin (browser)
  └─ service_role key (.env.local)
      └─ POST/PATCH/DELETE /rest/v1/products
          └─ Supabase Cloud
```

### Landing → Supabase (Read-Only)
```
Landing (browser)
  └─ anon key (public)
      └─ GET /rest/v1/products?visible=eq.true
          └─ Supabase Cloud (RLS: public read)
```

### Admin ↔ Landing Sync
Tidak perlu sync manual — kedua app fetch dari Supabase yang sama.

---

## 🗄️ Database Schema

### Tabel `products`

```sql
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  app_type TEXT NOT NULL,
  name TEXT NOT NULL,
  tagline TEXT,
  description TEXT,
  price_label TEXT,
  features JSONB DEFAULT '[]',
  icon TEXT,
  color TEXT,
  order_index INTEGER DEFAULT 0,
  visible BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_products_visible ON products(visible);
CREATE INDEX idx_products_order ON products(order_index);
```

### RLS Policies

```sql
-- Public read (landing page)
CREATE POLICY "public_read_products" ON products
  FOR SELECT USING (visible = true);

-- Service role full access (admin CRUD)
CREATE POLICY "service_role_all_products" ON products
  FOR ALL USING (true);
```

---

## 🚀 Local Development

### Prasyarat
- Browser modern (Chrome, Firefox, Safari, Edge)
- Python 3 atau Node.js
- `.env.local` di folder `admin/`

### Setup
```bash
# 1. Buat .env.local
cd C:/Users/Admin/Documents/kasol/admin
copy ..\..\env.local .env.local

# 2. Jalankan server
python -m http.server 8082

# 3. Buka browser
http://localhost:8082
```

### Password Admin
Default: `admin123` (lihat `js/auth.js`)

---

## 📝 Changelog

| Tanggal | Perubahan |
|---------|-----------|
| 2026-08-06 | Supabase integration — katalog fetch/CRUD via REST API |
| 2026-08-06 | `.env.local` untuk local dev keys |
| 2026-08-06 | `js/supabase-client.js` dan `js/env-loader.js` ditambahkan |

---

*Architecture — KASIRSOLO Admin Dashboard*
