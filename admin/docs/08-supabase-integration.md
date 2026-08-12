# Supabase Integration — KASIRSOLO

Panduan lengkap integrasi Supabase untuk admin dan landing page KASIRSOLO.

---

## 🎯 Overview

Supabase digunakan sebagai cloud backend untuk:
- **Katalog produk** (tabel `products`)
- **Admin CRUD** (service_role key)
- **Landing page** (anon key, read-only)
- **CRM Klien** (tabel `clients`) — profil outlet dari aplikasi klien (kaki5, rosok, gerobak, retail)
  - Data masuk via **onboarding** (user baru) & **update profil** (user lama) di app klien
  - Satu tabel `clients` untuk keduanya (dedupe by `unit_id`)
- **Sistem Lisensi** — generate & validasi serial HMAC-SHA256 + Base32

---

## 📋 Supabase Project

| Item | Nilai |
|------|-------|
| Project URL | `https://hhywrvedlwljawgxzpkq.supabase.co` |
| Project Ref | `hhywrvedlwljawgxzpkq` |
| Tables | `products`, `clients` |
| RLS | Enabled |
| Auth | Anonymous (klien), Email/Password (admin - planned) |

---

## 🔑 API Keys

### Anon Key (Public)
- Digunakan oleh **landing page** (read-only products)
- Digunakan oleh **aplikasi klien** (kaki5, dll) untuk sync profil via anonymous auth
- Aman di-expose ke browser
- Policy: `public_read_products` (hanya baca `visible=true`), `clients own select/insert/update` (RLS anon)

### Service Role Key (Private)
- Digunakan oleh **admin dashboard** (full CRUD products, clients)
- **JANGAN** di-commit ke GitHub
- Simpan di `.env.local` (lokal saja)
- Policy: `service_role_all_products`, `service_role_all_clients` (BYPASS RLS)
- ⚠️ **RISIKO**: Saat ini di-inject ke browser via `env-loader.js` → siapa pun dengan devtools dapat akses penuh DB. Lihat Security Hardening di bawah.

---

## 🗄️ Database Schema

### Tabel `products` (Katalog)

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

### Tabel `clients` (CRM — Sinkron Profil Klien)

```sql
-- 1 baris per outlet/perangkat (unit_id unik per device)
create table if not exists public.clients (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid references auth.users(id) on delete set null, -- pemilik (anonymous user)
  unit_id       text not null unique,       -- contoh: K5-XXXX-XXXX (kunci natural, dedupe)
  app_type      text not null,              -- kaki5 | rosok | gerobak | retail | ...
  device_code   text not null,              -- contoh: XXXX-XXXX
  install_id    text,
  nama_warung   text,
  nama_pemilik  text,
  no_whatsapp   text,
  -- Wilayah Indonesia (id kanonik + nama, untuk agregasi analitik yang akurat)
  provinsi_id   text,
  provinsi      text,
  kabkota_id    text,
  kabkota       text,
  kecamatan_id  text,
  kecamatan     text,
  desa_id       text,        -- NEW 2026-08: support desa/kelurahan
  desa          text,
  alamat_detail text,
  first_seen    timestamptz default now(),
  last_seen     timestamptz default now(),
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

-- index untuk filter ringan
create index if not exists clients_app_type_idx  on public.clients (app_type);
create index if not exists clients_provinsi_idx on public.clients (provinsi_id);
create index if not exists clients_kabkota_idx  on public.clients (kabkota_id);
create index if not exists clients_last_seen_idx on public.clients (last_seen);

-- RLS
alter table public.clients enable row level security;

-- Tiap perangkat (anonymous user) hanya bisa lihat/insert/update baris miliknya.
create policy "clients own select" on public.clients
  for select using (auth.uid() = user_id);

create policy "clients own insert" on public.clients
  for insert with check (auth.uid() = user_id);

create policy "clients own update" on public.clients
  for update using (auth.uid() = user_id);

-- NOTE:
--  * Admin read/write SEMUA baris via service_role key (BYPASS RLS) — tidak
--    perlu policy khusus anon.
--  * Upsert dari klien pakai `ON CONFLICT (unit_id) DO UPDATE`; policy update
--    memeriksa baris lama milik anon yang sama. Jika perangkat di-reset dan
--    mendapat anonymous user baru, baris lama perlu di-merge admin.

-- updated_at otomatis
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists clients_set_updated on public.clients;
create trigger clients_set_updated
  before update on public.clients
  for each row execute function public.set_updated_at();
```

### RLS Policies (products)

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

### Admin Dashboard Files

| File | Purpose |
|------|---------|
| `js/env-loader.js` | Load env vars ke `window` (SUPABASE_URL, ANON_KEY, ADMIN_API_KEY gate) — **GENERATED at build**; TIDAK pernah berisi SERVICE_KEY |
| `js/supabase-client.js` | Supabase REST client untuk landing (anon key) |
| `js/api.js` | Helper `supabaseFetch()` — semua operasi data lewat Vercel Serverless `/api/rest` |
| `api/rest.js` | **Vercel Serverless Proxy** — satu-satunya tempat service_role key (server-side); whitelist tabel `clients`/`products` (leads & pembelian di-drop 2026-08-11) + fn activate-license |
| `js/catalog.js` | CRUD products via `supabaseFetch()` (service key di server) |
| `js/clients.js` | **CRM Klien** — baca/tulis `clients` via `supabaseFetch()`, generate lisensi. Data dari onboarding + update profil app klien. |
| `js/license-core.js` | Pure logic HMAC-SHA256 + Base32 (portable ke client apps) |
| `js/license-ui.js` | UI komponen lisensi (import dari license-core) |
| `js/settings.js` | **MASIH localStorage** — rencana migrasi ke Supabase |

### Client App Files (kaki5, rosok, gerobak, retail)

| File | Purpose |
|------|---------|
| `js/supabase-config.js` | Embed anon key + URL (public, aman) |
| `js/sync.js` | `ensureSynced()` — push profil ke `clients` via anonymous auth + RLS (onboarding + update profil) |
| `js/region.js` | API wilayah Indonesia (provinsi → kab/kota → kecamatan → desa) |
| `js/license.js` | Validasi serial lokal (replikasi verifySerial dari license-core) |

---

## 🔐 License System (HMAC-SHA256 + Base32)

**File utama:** `admin/api/license.js` (Vercel Serverless — memegang salt & crypto)

> ⚠️ **Security (Fix C1):** Generate & verifikasi lisensi DIJALANKAN SERVER-SIDE.
> `admin/js/license-core.js` adalah pure logic yang dipakai server (`api/license.js`).
> **HMAC salt TIDAK PERNAH dikirim ke browser** — salt produk resmi hanya ada di
> env server (`LICENSE_SALT_*` / `LICENSE_SALTS`) dengan fallback konstanta di
> `api/license.js`. Client cuma kirim aksi (`generate`/`verify`) + input polos lewat
> helper `licenseApi()` di `js/api.js`, dilindungi gate `ADMIN_API_KEY`.

### Produk & Salt (WAJIB SAMA antar app klien & server)
```javascript
// Konfigurasi salt SERVER-SIDE (admin/api/license.js)
const DEFAULT_SALTS = {
  KK5: process.env.LICENSE_SALT_KAKI5 || 'KASIRSOLO-KAKI5-HMAC-V2',  // kaki5
  KSR: process.env.LICENSE_SALT_ROSOK || 'KASIRSOLO-ROSOK-HMAC-V2',  // rosok
  GBK: process.env.LICENSE_SALT_GEROBAK || 'KASIRSOLO-GEROBAK-HMAC-V2', // gerobak
  RTL: process.env.LICENSE_SALT_RETAIL || 'KASIRSOLO-RETAIL-HMAC-V2' // retail
};
```

### Format Serial
`PREFIX-XXXX-XXXX-YY-SIGGGG`
- `PREFIX` = produk (KK5, KSR, GBK, RTL)
- `XXXX-XXXX` = device code 8 char (dari install_id)
- `YY` = expiry code (01-99 = bulan, 99 = lifetime)
- `SIGGGG` = HMAC-SHA256(salt, deviceCode+expCode) → Base32 6 char

### Generate (Admin)
```javascript
const serial = await LicenseCore.generateSerial(prefix, salt, deviceCodeRaw, expCode);
// → "KK5-A1B2-C3D4-12-X7K9M2"
```

### Verify (Client App)
```javascript
const result = await LicenseCore.verifySerial(prefix, salt, serialRaw, deviceCodeRaw);
// { valid: true/false, expired: true/false, expCode: '12', deviceCode: 'A1B2C3D4' }
```

> **KRITIS**: Salt di admin HARUS sama persis dengan `PRODUCT_SALT` di client app.
> Jika beda → serial ditolak (valid: false).

---

## 🔄 Data Flow

### Admin → Supabase (Products & Clients)
```
Browser (admin)
  └─ Service Role Key (.env.local → build → env-loader.js)
      └─ POST/PATCH/DELETE /rest/v1/products
      └─ GET/PATCH/DELETE /rest/v1/clients
          └─ Supabase Cloud (RLS bypassed by service_role)
```

### Landing → Supabase (Products)
```
Browser (landing)
  └─ Anon Key (public)
      └─ GET /rest/v1/products?visible=eq.true
          └─ Supabase Cloud (RLS: public_read_products)
```

### Client App → Supabase (Clients Sync)
```
Browser (kaki5, rosok, dll)
  └─ Anon Key (public, embedded)
      └─ sb.auth.signInAnonymously() → user_id
      └─ UPSERT /rest/v1/clients (onConflict: unit_id)
          └─ Supabase Cloud (RLS: auth.uid() = user_id)
              → Device hanya bisa ubah baris MILIKNYA
              → Data masuk dari: onboarding (user baru) + update profil (user lama)
```

---

## 📁 Environment Files

### `.env.local` (LOKAL SAJA — JANGAN COMMIT)
```bash
SUPABASE_URL=https://hhywrvedlwljawgxzpkq.supabase.co
SUPABASE_ANON_KEY=eyJhbG...4x50
SUPABASE_SERVICE_ROLE_KEY=eyJhbG...aFIU
```

### `.gitignore`
```gitignore
.env*
.env
.env.local
!.env.example
```

### Vercel Environment Variables
```bash
SUPABASE_URL=https://hhywrvedlwljawgxzpkq.supabase.co
SUPABASE_ANON_KEY=eyJhbG...4x50
SUPABASE_SERVICE_ROLE_KEY=svc_...   # HANYA server-side, dibaca api/rest.js
ADMIN_API_KEY=xxx                    # gate proxy — WAJIB di-set (fail-closed: jika kosong → 503, bukan terbuka)
```

> **Phase A (FIXED):** service_role key TIDAK lagi di-inject ke client. Build command `node scripts/build-env-loader.mjs` hanya menulis `SUPABASE_URL`, `SUPABASE_ANON_KEY`, dan `SUPABASE_ADMIN_KEY` (gate) ke `js/env-loader.js`. Service key hidup **hanya** di Vercel Serverless `/api/rest`.
>
> **H1 (FIXED v1.3.2):** gate `/api/rest` & `/api/license` memakai helper `api/_gate.js` — **fail-closed + constant-time** (`timingSafeEqual`). Jika `ADMIN_API_KEY` tidak diset di env, kedua endpoint return `503 server_not_configured`, TIDAK pernah membiarkan request lewat. Login admin resmi tetap ditunda (lihat `../CONTEXT.md`); upgrade ke JWT admin = follow-up terpisah.

---

## 🔐 Supabase Access Token (Hermes Env)

**Access Token Supabase sudah disimpan di Hermes environment** (`C:\Users\Admin\AppData\Local\hermes\.env`):

```bash
SUPABASE_PROJECT_REF=hhywrvedlwljawgxzpkq
SUPABASE_ACCESS_TOKEN=sbp_xxx...  # Personal Access Token dengan scope admin
```

### Kegunaan
Agent/assistant (Hermes) **bisa eksekusi migration SQL langsung** via Supabase Management API tanpa manual ke dashboard:

```bash
# Contoh: Jalankan migration via Management API
curl -X POST "https://api.supabase.com/v1/projects/${SUPABASE_PROJECT_REF}/database/query" \
  -H "Authorization: Bearer ${SUPABASE_ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"query": "CREATE TABLE ..."}'
```

### Workflow Migration (Otomatis)
1. **Agent baca file SQL** dari `supabase/migration-*.sql`
2. **Agent POST ke Management API** pakai `SUPABASE_ACCESS_TOKEN`
3. **Supabase eksekusi query** → return hasil
4. **Agent verifikasi** → update checklist/docs

> **Tidak perlu manual** buka Supabase Dashboard → SQL Editor → paste query. Agent handle end-to-end.

---

## 🚀 Seed Data (products)

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

## ⚠️ Security Hardening

### Status Phase A
**FIXED:** Sebelumnya admin dashboard meng-inject **service_role key** ke `window` via `js/env-loader.js` → siapa pun dengan DevTools bisa akses penuh DB. Sekarang service key **tidak pernah** masuk browser; semua operasi Supabase lewat Vercel Serverless Proxy `/api/rest` (service key server-side) + whitelist tabel + gate `ADMIN_API_KEY`.

### Follow-up (Phase B / setelah admin password beres)
1. **Supabase Auth (Email/Password) + RLS per role**
   - Enable Email/Password auth di Supabase
   - Admin login pakai kredensial sesungguhnya (bukan hardcoded `admin123`)
   - RLS policy: `auth.role() = 'authenticated'` untuk admin CRUD
   - Anon key tetap dipakai landing + client apps

2. **Vercel Serverless Proxy (Edge Function)**
   - Buat `/api/supabase/*` proxy di Vercel
   - Service role key hanya di server-side env Vercel (tidak ke browser)
   - Admin JS panggil `/api/supabase/products` → proxy forward ke Supabase dgn service_role

### Solusi Jangka Panjang
- **Row Level Security berbasis organizasi** (multi-tenant)
- **Audit log** untuk operasi sensitif (hapus klien, generate lisensi massal)
- **Rate limiting** di Supabase (pg_cron + functions) atau Vercel Edge

---

## 📝 Migration Checklist

- [x] Setup Supabase project
- [x] Create table `products`
- [x] Setup RLS policies `products`
- [x] Seed 11 produk default
- [x] Update admin `catalog.js` untuk CRUD
- [x] Update landing fetch dari Supabase
- [x] Create `.env.local` untuk local dev
- [x] Update `.gitignore`
- [x] Create table `clients` (CRM) + RLS anonymous auth
- [x] Update admin `clients.js` (CRM + generate lisensi)
- [x] Update kaki5 `sync.js` (anonymous auth + upsert unit_id)
- [x] Embed anon key di kaki5 `supabase-config.js`
- [x] Fix API wilayah Indonesia → raw GitHub (support sampai desa)
- [ ] **Migrate `settings` ke Supabase** (rencana)
- [ ] **Migrate `stats` ke Supabase** (rencana)
- [ ] **Security Hardening: Auth + RLS / Serverless Proxy** (prioritas tinggi)
- [ ] **License validation endpoint di Supabase Edge Function** (untuk verifikasi online)

> **Catatan**: Migration sekarang bisa dijalankan otomatis oleh Agent via Supabase Management API menggunakan `SUPABASE_ACCESS_TOKEN` di Hermes env. Tidak perlu manual ke dashboard.

---

## 🔗 Referensi File

| File | Deskripsi |
|------|-----------|
| `supabase/migration-clients.sql` | SQL create table `clients` + RLS + trigger |
| `supabase/migration-device-claim.sql` | RPC `device_known` (SECURITY DEFINER) — onboarding once-per-device lintas browser + transfer ownership anon |
| `admin/js/license-core.js` | Pure logic HMAC-SHA256 + Base32 (generate/verify) |
| `admin/js/clients.js` | CRM module + generate serial di sheet |
| `kaki5/js/sync.js` | `ensureSynced()` — push profil ke clients (onboarding + update profil) |
| `kaki5/js/supabase-config.js` | Anon key embed (public) |
| `kaki5/js/region.js` | API wilayah Indonesia (4-level: prov→kab→kec→desa) |
| `kaki5/js/pwa.js` | PWA install detection |

---

*Supabase Integration — KASIRSOLO (Updated 2026-08-07)*
