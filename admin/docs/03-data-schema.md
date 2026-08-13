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

### 3. Pipeline `clients` — Data Lead/Klien (satu tabel)

> Tabel `leads` & `pembelian` di-DROP (2026-08-11). Seluruh funnel kini **satu tabel
> `clients`**, pergerakan ditandai kolom `status`.

```json
{
  "unit_id": "K5-018T-MCER",
  "nama_warung": "Bakso Mblenger",
  "nama_pemilik": "Amin",
  "no_whatsapp": "62852369853",
  "app_type": "kaki5",
  "source": "app-kaki5",
  "kabkota": "Blora",
  "status": "baru",
  "last_seen": "2026-08-10T05:49:55.715655+00:00"
}
```

**Pipeline `status`:** `baru` → `dihubungi` → `tertarik` → `menunggu_verifikasi` → `aktif` / `batal`

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

### Tabel `clients` (pipeline satu-tabel; `leads` & `pembelian` di-drop 2026-08-11)

Kolom pipeline: `status` (baru/dihubungi/tertarik/menunggu_verifikasi/aktif/batal),
`source` (asal mis. `app-kaki5`), `lead_source`, plus kolom pembayaran yang dulu ada
di `pembelian`: `bukti_url`, `nama_pembayar`, `verified_at`, `activated_at`.

> 🔻 **2026-08-13:** Kolom `harga` di `clients` **DI-DROP**. Harga kini **bukan
> disimpan per klien** — di-resolve dinamis dari tabel `products` (kolom
> `price_label`) berdasarkan `app_type` saat menampilkan kartu/detail. Satu-satunya
> source of truth harga = `products` (lihat `migration-drop-clients-harga.sql`).
> `bukti_url` menyimpan path objek di bucket `bukti` (private) — untuk dibuka,
> admin butuh signed URL via `storageSign` (bukan URL publik).

Kolom lengkap & urutan pipeline lihat CHANGELOG 1.4.0 / `01-overview.md`.

### Tabel `products`

```sql
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  app_type TEXT NOT NULL,          -- kaki5 | rosok | gerobak | retail | konveksi | ...
  kode_produk TEXT,                -- NEW 2026-08-13: kode lisensi (KK5/KSR/GBK/RTL/dll)
  name TEXT NOT NULL,
  icon TEXT,
  tagline TEXT,
  description TEXT,
  price_label TEXT,                -- harga (string, kode negara/tampilan) — source of truth harga
  features JSONB DEFAULT '[]',
  color TEXT,
  order_index INTEGER DEFAULT 0,
  visible BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- NEW 2026-08-13: kode_produk unik per app_type
CREATE UNIQUE INDEX products_kode_produk_key ON products(kode_produk);
```

> `kode_produk` ditambahkan via `supabase/migration-add-kode-produk-to-products.sql`
> (backfill: kaki5→KK5, rosok→KSR, gerobak→GBK, retail→RTL, lainnya = upper(app_type)),
> diintegrasikan ke katalog admin (view/edit/save) & flow pembelian kaki5.

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
| Pipeline Klien | `kasirsolo:leads` (legacy) | `clients` |
| Statistik | `kasirsolo:stats` | `stats` |
| Product Registry | `kasirsolo_license_products_v3` | `products` (with salt) |
| Users | — | `users` |
| Businesses | — | `businesses` |
| Licenses | — | `licenses` |

---

*Data Schema — KASIRSOLO Admin Dashboard*
