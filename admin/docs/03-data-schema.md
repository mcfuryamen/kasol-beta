# Admin Dashboard — Data Schema

Detail struktur data localStorage (tahap awal) dan rencana schema Supabase.

---

## 📋 Schema Saat Ini (localStorage)

### 1. `kasirsolo:catalog` — Katalog Aplikasi

```json
[
  {
    "id": "retail",
    "icon": "🛒",
    "name": "Kasir Retail",
    "desc": "Sistem kasir lengkap untuk toko retail, minimarket, dan warung.",
    "price": 250000,
    "category": "bisnis",
    "hot": true
  }
]
```

**Field:**

| Field | Tipe | Wajib | Deskripsi |
|-------|------|-------|-----------|
| `id` | string | ✅ | Identifier unik |
| `icon` | string | ✅ | Emoji (max 4 char) |
| `name` | string | ✅ | Nama aplikasi |
| `desc` | string | ✅ | Deskripsi singkat |
| `price` | number | ✅ | Harga dalam Rupiah |
| `category` | string | ✅ | `bisnis` \| `institusi` \| `kesehatan` |
| `hot` | boolean | ✅ | Badge Hot di katalog |

---

### 2. `kasirsolo:settings` — Pengaturan

```json
{
  "waNumber": "628816566935",
  "email": "owner.kasirsolo@gmail.com",
  "addrLegal": "Perum Graha Tiara 2...",
  "mapsLegal": "https://maps.app.goo.gl/...",
  "addrOps": "Gumiring 04/04...",
  "mapsOps": "https://maps.app.goo.gl/...",
  "statClients": 500,
  "statUptime": 99.9
}
```

---

### 3. `kasirsolo:leads` — Data Lead

```json
[
  {
    "id": "lead_1722480000000_a3f2k",
    "name": "Toko Maju Jaya",
    "address": "Jl. Pemuda No. 12, Solo",
    "wa": "081234567890",
    "app": "Kasir Retail - Rp250.000",
    "status": "Baru",
    "createdAt": "2026-08-01T10:30:00.000Z"
  }
]
```

**Status values:** `Baru`, `Dihubungi`, `Trial Aktif`, `Berlangganan`, `Batal`

---

### 4. `kasirsolo:stats` — Statistik

```json
{
  "visits": 1234
}
```

---

### 5. `kasirsolo_license_products_v3` — Product Registry Lisensi

```json
[
  {
    "id": "p_rosok",
    "name": "Rosok (Kasir Solo)",
    "prefix": "KSR",
    "salt": "KASIRSOLO-ROSOK-HMAC-V2",
    "scheme": "v2-hmac"
  },
  {
    "id": "p_retail",
    "name": "Retail (Kasir Solo)",
    "prefix": "KRT",
    "salt": "KASIRSOLO-RETAIL-2026",
    "scheme": "v2-hmac"
  }
]
```

**Field:**

| Field | Tipe | Deskripsi |
|-------|------|-----------|
| `id` | string | Identifier unik (format: `p_` + timestamp) |
| `name` | string | Nama produk (tampil di dropdown) |
| `prefix` | string | 3-5 huruf kapital unik per produk |
| `salt` | string | Kunci rahasia untuk HMAC signature |
| `scheme` | string | Versi skema: `v2-hmac` |

---

## 🔮 Schema Supabase (Rencana)

### Tabel `users`

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('owner', 'team')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

**RLS Policy:**
```sql
-- Owner bisa semua
CREATE POLICY "owner_all" ON users
  FOR ALL USING (auth.uid() = id);

-- Team hanya read
CREATE POLICY "team_read" ON users
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'team')
  );
```

### Tabel `businesses`

```sql
CREATE TABLE businesses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  name TEXT NOT NULL,
  address TEXT,
  wa TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### Tabel `leads`

```sql
CREATE TABLE leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID REFERENCES businesses(id),
  name TEXT NOT NULL,
  address TEXT,
  wa TEXT,
  app TEXT,
  status TEXT DEFAULT 'Baru' CHECK (status IN ('Baru','Dihubungi','Trial Aktif','Berlangganan','Batal')),
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### Tabel `products`

```sql
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  icon TEXT,
  description TEXT,
  price INTEGER NOT NULL,
  category TEXT CHECK (category IN ('bisnis','institusi','kesehatan')),
  is_hot BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

### Tabel `licenses`

```sql
CREATE TABLE licenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID REFERENCES businesses(id),
  product_id UUID REFERENCES products(id),
  device_code TEXT NOT NULL,
  serial TEXT NOT NULL UNIQUE,
  expiry_code TEXT NOT NULL,
  hmac_signature TEXT NOT NULL,
  status TEXT DEFAULT 'active' CHECK (status IN ('active','expired','revoked')),
  created_at TIMESTAMPTZ DEFAULT now(),
  verified_at TIMESTAMPTZ
);
```

### Tabel `settings`

```sql
CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

### Tabel `stats`

```sql
CREATE TABLE stats (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

---

## 📊 Ringkasan Schema

| Entity | localStorage Key | Supabase Table |
|--------|-----------------|----------------|
| Katalog Aplikasi | `kasirsolo:catalog` | `products` |
| Pengaturan | `kasirsolo:settings` | `settings` |
| Leads | `kasirsolo:leads` | `leads` |
| Statistik | `kasirsolo:stats` | `stats` |
| Product Registry | `kasirsolo_license_products_v3` | `products` (with salt) |
| Users | — | `users` |
| Businesses | — | `businesses` |
| Licenses | — | `licenses` |

---

*Data Schema — KASIRSOLO Admin Dashboard*
