# Admin Dashboard — Data Schema

Detail struktur data: Supabase (cloud) untuk katalog, localStorage untuk data lokal.

---

## ☁️ Supabase Cloud (Katalog)

### Tabel `products`

Sumber utama katalog aplikasi. Diakses oleh Admin (CRUD) dan Landing (read-only).

| Field | Tipe | Wajib | Deskripsi |
|-------|------|-------|-----------|
| `id` | UUID | ✅ | Primary key |
| `app_type` | TEXT | ✅ | Identifier unik (rosok, gerobak, kaki5, retail, dll) |
| `name` | TEXT | ✅ | Nama tampilan |
| `tagline` | TEXT | | Subtitle singkat |
| `description` | TEXT | | Deskripsi lengkap |
| `price_label` | TEXT | | Format harga (contoh: "Rp 250.000") |
| `features` | JSONB | | Array fitur |
| `icon` | TEXT | | Emoji icon |
| `color` | TEXT | | Warna tema |
| `order_index` | INTEGER | | Urutan tampilan (0 = paling atas) |
| `visible` | BOOLEAN | | Tampilkan di landing (true/false) |
| `created_at` | TIMESTAMPTZ | | Waktu dibuat |
| `updated_at` | TIMESTAMPTZ | | Waktu update terakhir |

### Contoh Data

```json
{
  "id": "c16c63e1-1e1b-4d6b-b98d-54d5eba5d610",
  "app_type": "retail",
  "name": "Kasir Retail",
  "tagline": "Sistem Kasir untuk Toko Retail & Minimarket",
  "description": "Sistem kasir lengkap untuk toko retail, minimarket, dan warung.",
  "price_label": "Rp 250.000",
  "features": ["Barcode scanner", "Manajemen stok", "Multi-user"],
  "icon": "🛍️",
  "color": "#E14E15",
  "order_index": 0,
  "visible": true
}
```

### RLS Policies

```sql
-- Public read (landing page pakai anon key)
CREATE POLICY "public_read_products" ON products
  FOR SELECT USING (visible = true);

-- Service role full access (admin CRUD)
CREATE POLICY "service_role_all_products" ON products
  FOR ALL USING (true);
```

---

## 💾 localStorage (Lokal)

Data lokal masih menggunakan localStorage untuk fitur yang belum di-migrasi.

### `kasirsolo:leads` — Data Lead

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

### `kasirsolo:settings` — Pengaturan

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

### `kasirsolo:stats` — Statistik

```json
{
  "visits": 1234
}
```

### `kasirsolo_license_products_v3` — Product Registry Lisensi

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

---

## 📊 Ringkasan Schema

| Entity | Storage | Keterangan |
|--------|---------|------------|
| Katalog Aplikasi | **Supabase** `products` | CRUD dari admin, read dari landing |
| Leads | localStorage `kasirsolo:leads` | Belum migrasi ke cloud |
| Settings | localStorage `kasirsolo:settings` | Belum migrasi ke cloud |
| Stats | localStorage `kasirsolo:stats` | Belum migrasi ke cloud |
| Product Registry | localStorage `kasirsolo_license_products_v3` | Untuk license generator |

---

## 🔄 Migrasi ke Supabase (Rencana)

### Fase 2: Leads
Migrasi `kasirsolo:leads` ke tabel `leads` di Supabase.

```sql
CREATE TABLE leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  address TEXT,
  wa TEXT,
  app TEXT,
  status TEXT DEFAULT 'Baru',
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### Fase 3: Settings
Migrasi `kasirsolo:settings` ke tabel `settings` di Supabase.

```sql
CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

### Fase 4: Stats
Migrasi `kasirsolo:stats` ke tabel `stats` di Supabase.

```sql
CREATE TABLE stats (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

---

*Data Schema — KASIRSOLO Admin Dashboard*
