# Supabase Integration — KASIRSOLO

Panduan lengkap integrasi Supabase untuk admin dan landing page KASIRSOLO.

---

## 🎯 Overview

Supabase digunakan sebagai cloud backend untuk:
- **Katalog produk** (tabel `products`)
- **Admin CRUD** (service_role key)
- **Landing page** (anon key, read-only)

---

## 📋 Supabase Project

| Item | Nilai |
|------|-------|
| Project URL | `https://hhywrvedlwljawgxzpkq.supabase.co` |
| Project Ref | `hhywrvedlwljawgxzpkq` |
| Table | `products` |
| RLS | Enabled |

---

## 🔑 API Keys

### Anon Key (Public)
- Digunakan oleh **landing page** (read-only)
- Aman di-expose ke browser
- Policy: `public_read_products` (hanya baca `visible=true`)

### Service Role Key (Private)
- Digunakan oleh **admin dashboard** (full CRUD)
- **JANGAN** di-commit ke GitHub
- Simpan di `.env.local` (lokal saja)
- Policy: `service_role_all_products` (semua akses)

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

-- Indexes
CREATE INDEX idx_products_visible ON products(visible);
CREATE INDEX idx_products_order ON products(order_index);
```

### RLS Policies

```sql
-- Enable RLS
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

-- Policy 1: Public read (landing page)
CREATE POLICY "public_read_products" ON products
  FOR SELECT USING (visible = true);

-- Policy 2: Service role full access (admin CRUD)
CREATE POLICY "service_role_all_products" ON products
  FOR ALL USING (true);
```

---

## 🔧 Client Implementation

### File: `js/env-loader.js`

Load environment variables ke window:

```javascript
window.SUPABASE_URL = 'https://hhywrvedlwljawgxzpkq.supabase.co';
window.SUPABASE_ANON_KEY = 'eyJ...';  // public, aman
window.SUPABASE_SERVICE_KEY = 'eyJ...';  // private, jangan commit!
```

### File: `js/supabase-client.js`

Supabase REST API client:

```javascript
async function fetchProductsFromSupabase() {
  const { url, key } = getSupabaseConfig();
  const response = await fetch(`${url}/rest/v1/products?order=order_index.asc`, {
    headers: {
      'apikey': key,
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json'
    }
  });
  return response.json();
}
```

### File: `js/catalog.js`

CRUD operations:

```javascript
// READ
const products = await fetchProductsFromSupabase();

// CREATE
const response = await fetch(`${url}/rest/v1/products`, {
  method: 'POST',
  headers: { 'apikey': key, 'Authorization': `Bearer ${key}` },
  body: JSON.stringify(payload)
});

// UPDATE
const response = await fetch(`${url}/rest/v1/products?id=eq.${id}`, {
  method: 'PATCH',
  headers: { 'apikey': key, 'Authorization': `Bearer ${key}` },
  body: JSON.stringify(payload)
});

// DELETE
const response = await fetch(`${url}/rest/v1/products?id=eq.${id}`, {
  method: 'DELETE',
  headers: { 'apikey': key, 'Authorization': `Bearer ${key}` }
});
```

---

## 📁 Environment Files

### `.env.local` (LOKAL SAJA)
```
SUPABASE_URL=https://hhywrvedlwljawgxzpkq.supabase.co
SUPABASE_ANON_KEY=eyJhbG...4x50
SUPABASE_SERVICE_ROLE_KEY=eyJhbG...aFIU
```

### `.gitignore`
```
.env*
.env
.env.local
!.env.example
```

### Vercel Environment Variables
```
NEXT_PUBLIC_SUPABASE_URL=https://hhywrvedlwljawgxzpkq.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbG...4x50
```

> **Service role key TIDAK perlu di-set di Vercel!**

---

## 🔄 Data Flow

### Admin → Supabase
```
Browser (admin)
  └─ Service Role Key (.env.local)
      └─ POST/PATCH/DELETE /rest/v1/products
          └─ Supabase Cloud
```

### Landing → Supabase
```
Browser (landing)
  └─ Anon Key (public)
      └─ GET /rest/v1/products?visible=eq.true
          └─ Supabase Cloud (RLS: public read)
```

---

## 🚀 Seed Data

11 produk default sudah di-insert ke Supabase:

| No | App Type | Name | Price | Order |
|----|----------|------|-------|-------|
| 1 | retail | Kasir Retail | Rp 250.000 | 0 (HOT) |
| 2 | rosok | Kasir Rosok | Rp 200.000 | 1 |
| 3 | gerobak | Kasir Gerobak | Rp 150.000 | 2 |
| 4 | kaki5 | Kasir Kaki5 | Rp 180.000 | 3 |
| 5 | konveksi | Manajemen Konveksi | Rp 350.000 | 4 |
| 6 | bengkel | Bengkel + Sparepart | Rp 400.000 | 5 |
| 7 | masjid | Manajemen Masjid | Rp 200.000 | 6 |
| 8 | tpa | Manajemen TPA/TPQ | Rp 200.000 | 7 |
| 9 | klinik | Klinik THT | Rp 500.000 | 8 |
| 10 | apotek | Apotek | Rp 450.000 | 9 |
| 11 | dapur | Dapur SPPG | Rp 300.000 | 10 |

---

## 📝 Migration Checklist

- [x] Setup Supabase project
- [x] Create table `products`
- [x] Setup RLS policies
- [x] Seed 11 produk default
- [x] Update admin `catalog.js` untuk CRUD
- [x] Update landing fetch dari Supabase
- [x] Create `.env.local` untuk local dev
- [x] Update `.gitignore`
- [ ] Migrate leads ke Supabase (rencana)
- [ ] Migrate settings ke Supabase (rencana)
- [ ] Migrate stats ke Supabase (rencana)

---

*Supabase Integration — KASIRSOLO*
