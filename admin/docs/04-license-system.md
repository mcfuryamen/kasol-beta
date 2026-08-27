# Admin Dashboard — Sistem Lisensi

Detail lengkap algoritma lisensi HMAC-SHA256 yang terintegrasi di admin dashboard.

> ⚠️ **Arah Arsitektur (2026-08-10 — KONSEP HYBRID terkunci):** Sistem lisensi
> bergerak ke **generate + validasi via Supabase** (admin = **satu-satunya sumber
> kebenaran**), *melengkapi* pendekatan offline (bukan menggantikan sepenuhnya).
>
> - **Operasional tetap offline total** (Dexie) — transaksi tidak pernah ke server.
> - **Lisensi + profil klien disimpan di Supabase** (database platform Kasir Solo).
> - **Admin `admin/` mengelola SEMUA lisensi app klien** (kecuali landing & admin):
>   generate, aktivasi, revoke, blacklist.
> - App klien validasi offline (HMAC) → kawal sync status + blacklist saat online.
> - Salt HMAC tetap dipakai app klien untuk validasi offline, tapi **generate &
>   kontrol penuh pindah ke admin** (bukan helper publik `generator-lisensi-universal.html`).
> - Rujukan arsitektur cloud menyeluruh: **`../CLOUD-ROADMAP.md`** (di root repo kasol).
> - Standar ekosistem: **`../CONTEXT.md`**.

---

## 🔐 Ringkasan Skema Lisensi

| Aspek | Detail |
|-------|--------|
| **Algoritma** | HMAC-SHA256 |
| **Encoding Signature** | Base32 (6 karakter) |
| **Format Serial** | `PREFIX-XXXX-XXXX-XX-XXXXXX` |
| **Device-Bound** | ✅ Satu serial = satu produk = satu perangkat |
| **Expiry** | Fleksibel: seumur hidup, bulan, atau hari |
| **Produk** | Tidak terbatas (registry di localStorage) |

---

## 📐 Format Serial

```
KSR-A1B2-C3D4-99-X7K9M2
│   │      │    │  └── Signature HMAC (6 char, Base32)
│   │      │    │
│   │      │    └─────── Expiry Code (2 char)
│   │      │
│   │      └──────────── Device Code part 2 (4 char)
│   │
│   └─────────────────── Device Code part 1 (4 char)
│
└─────────────────────── Product Prefix (3-5 huruf kapital)
```

### Komponen

| Komponen | Panjang | Contoh | Deskripsi |
|----------|---------|--------|-----------|
| **Prefix** | 3-5 char | `KSR` | Identifikasi produk (unik per aplikasi) |
| **Device Code** | 8 char | `A1B2-C3D4` | Kode unik perangkat (dihasilkan oleh aplikasi klien) |
| **Expiry Code** | 2 char | `99` | Masa berlaku (99=seumur hidup, 06=6 bulan, 7D=7 hari) |
| **Signature** | 6 char | `X7K9M2` | HMAC-SHA256 yang di-encode Base32 |

---

## 🔢 Algoritma

### 1. Base32 Encoding

```javascript
const B32_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
// 32 karakter: tanpa 0, 1, I, O (untuk menghindari kebingungan visual)
```

### 2. HMAC-SHA256 Signature

```javascript
async function hmacSignature(salt, deviceConcat) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(salt),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign(
    'HMAC', key,
    enc.encode(salt + deviceConcat)
  );
  return b32Encode(new Uint8Array(sig), 6); // 6 karakter Base32
}
```

### 3. Generate Serial

```javascript
async function generateSerial(prefix, salt, deviceCodeRaw, expCode) {
  const deviceCode = normalizeDeviceCode(deviceCodeRaw);
  const [d1, d2] = deviceCode.split('-');
  const sig = await hmacSignature(salt, d1 + d2 + expCode);
  return `${prefix}-${d1}-${d2}-${expCode}-${sig}`;
}
```

### 4. Verifikasi Serial

```javascript
async function verifySerial(prefix, salt, serialRaw, deviceCodeRaw) {
  const clean = (serialRaw || '').trim().toUpperCase().replace(/\s+/g, '');
  const re = new RegExp('^' + prefix + '-([A-Z0-9]{4})-([A-Z0-9]{4})-([A-Z0-9]{2})-([A-Z0-9]{6})$');
  const m = clean.match(re);
  if (!m) return { valid: false, reason: 'Format serial tidak sesuai' };
  
  const [, d1, d2, exp, sig] = m;
  const expected = await hmacSignature(salt, d1 + d2 + exp);
  
  if (expected !== sig) {
    return { valid: false, reason: 'Signature HMAC tidak cocok' };
  }
  
  const deviceCode = d1 + '-' + d2;
  if (deviceCodeRaw && normalizeDeviceCode(deviceCodeRaw) !== deviceCode) {
    return { valid: false, reason: 'Serial ini untuk Device Code lain: ' + deviceCode };
  }
  
  return { valid: true, deviceCode, expCode: exp };
}
```

### 5. Normalize Device Code

```javascript
function normalizeDeviceCode(input) {
  let v = (input || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  v = (v + '00000000').slice(0, 8);
  return v.slice(0, 4) + '-' + v.slice(4, 8);
}
```

---

## 🏷️ Expiry Code

| Code | Makna | Durasi |
|------|-------|--------|
| `99` | Seumur Hidup | Tidak kadaluarsa |
| `01` - `99` | Bulan | 1-99 bulan |
| `1D` | 1 Hari | Trial 1 hari |
| `7D` | 7 Hari | Trial 7 hari |
| `03` | 3 Bulan | 3 bulan |
| `06` | 6 Bulan | 6 bulan |
| `12` | 12 Bulan | 1 tahun |

---

## 📦 Product Registry

Setiap produk (aplikasi) punya pasangan **prefix + salt** yang unik.

### Struktur Data

```json
{
  "id": "p_rosok",
  "name": "Rosok (Kasir Solo)",
  "prefix": "KSR",
  "salt": "KASIRSOLO-ROSOK-HMAC-V2",
  "scheme": "v2-hmac"
}
```

### Prefix Rules

| Aturan | Detail |
|--------|--------|
| Panjang | 3-5 huruf kapital |
| Unik | Tidak boleh sama dengan produk lain |
| Konsisten | Harus sama di semua aplikasi klien |
| Contoh | `KSR` (Rosok), `KK5` (Kaki5), `GBK` (Gerobak), `RTL` (Retail) |

> **Produk aktif saat ini (2026-08-08):**
> | Prefix | App | Salt (HMAC-V2) |
> |--------|-----|----------------|
> | `KSR` | rosok | `KASIRSOLO-ROSOK-HMAC-V2` |
> | `KK5` | kaki5 | `KASIRSOLO-KAKI5-HMAC-V2` |
> | `GBK` | gerobak | `KASIRSOLO-GEROBAK-HMAC-V2` |
> | `RTL` | retail | `KASIRSOLO-RETAIL-HMAC-V2` |
>
> Ke-4 app ini memvalidasi serial yang di-generate admin (diverifikasi end-to-end).

### Salt Rules

| Aturan | Detail |
|--------|--------|
| Panjang | Minimal 10 karakter |
| Rahasia | Simpan dengan aman — jika bocor, serial bisa dipalsukan |
| Unik | Berbeda untuk setiap produk |
| Format | `KASIRSOLO-{APP}-HMAC-V2` (mis. `KASIRSOLO-GEROBAK-HMAC-V2`) |

---

## 🧩 Reference Code (untuk Aplikasi Klien)

Blok kode JS berikut harus disalin ke setiap aplikasi klien:

```javascript
// ====== Kode Lisensi Universal Kasir Solo — v2-HMAC ======
// GANTI dua baris ini sesuai produk:
const PRODUCT_PREFIX = 'KSR';
const PRODUCT_SALT   = 'KASIRSOLO-ROSOK-HMAC-V2';

const B32_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

function b32Encode(bytes, length) {
  let bits = 0, value = 0, out = '';
  for (let i = 0; i < bytes.length; i++) {
    value = (value << 8) | bytes[i];
    bits += 8;
    while (bits >= 5) { out += B32_ALPHABET[(value >>> (bits - 5)) & 31]; bits -= 5; }
  }
  if (bits > 0) out += B32_ALPHABET[(value << (5 - bits)) & 31];
  return length ? out.slice(0, length) : out;
}

async function hmacSignature(data) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(PRODUCT_SALT),
    {name:'HMAC', hash:'SHA-256'}, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(PRODUCT_SALT + data));
  return b32Encode(new Uint8Array(sig), 6);
}

function simpleHash(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) { h = (h * 31 + str.charCodeAt(i)) >>> 0; }
  return h;
}

function getDeviceCode(installId) {
  const h = simpleHash('DEVICE-' + installId);
  const b36 = h.toString(36).toUpperCase().padStart(8, '0').slice(0, 8);
  return b36.slice(0, 4) + '-' + b36.slice(4, 8);
}

function checkExpired(expCode, activationDate) {
  if (expCode === '99') return false;
  if (expCode.endsWith('D')) {
    const days = parseInt(expCode);
    const expiry = new Date(activationDate);
    expiry.setDate(expiry.getDate() + days);
    return new Date() > expiry;
  }
  const months = parseInt(expCode);
  if (!isNaN(months)) {
    const expiry = new Date(activationDate);
    expiry.setMonth(expiry.getMonth() + months);
    return new Date() > expiry;
  }
  return false;
}

async function isValidSerial(serial, myDeviceCode, activationDate) {
  const clean = (serial || '').trim().toUpperCase().replace(/\s+/g, '');
  const re = new RegExp('^' + PRODUCT_PREFIX + '-([A-Z0-9]{4})-([A-Z0-9]{4})-([A-Z0-9]{2})-([A-Z0-9]{6})$');
  const m = clean.match(re);
  if (!m) return false;
  const [, d1, d2, exp, sig] = m;
  if ((d1 + '-' + d2) !== myDeviceCode) return false;
  const expected = await hmacSignature(d1 + d2 + exp);
  if (sig !== expected) return false;
  return !checkExpired(exp, activationDate);
}
```

> **Penting:** Setiap aplikasi klien harus mengganti `PRODUCT_PREFIX` dan `PRODUCT_SALT`
> sesuai produk yang bersangkutan. Salt harus sama persis dengan yang ada di product registry admin.

---

## 🔄 Flow Lengkap Lisensi

> **Kondisi saat ini (offline):** validasi HMAC dilakukan penuh di app klien.
> **Arah masa depan (Supabase):** validasi tambahan server-side via Lapisan Meta/CRM.
> Kedua jalur digambarkan di bawah.

```
  ADMIN DASHBOARD        SUPABASE (Meta/CRM)            KLIEN (Aplikasi)
        │                        │                            │
        │  1. Generate serial    │                            │
        │     (device code)      │                            │
        │───────────────────────►│ 2. simpan record lisensi   │
        │◄───────────────────────│    (status active)         │
        │                        │                            │
        │  3. Kirim serial via WhatsApp                      │
        │───────────────────────────────────────────────────►│
        │                        │                            │
        │                        │                            │  4. Aktivasi
        │                        │                            │     → generate device code
        │                        │                            │     → input serial
        │                        │                            │     → validasi HMAC lokal
        │                        │       5. validasi server   │     (fallback offline)
        │                        │◄───────────────────────────│
        │                        │   6. status = active?      │
        │                        │───────────────────────────►│
        │                        │                            │  7. simpan aktivasi
        │                        │                            │     (Dexie / localStorage)
        │                        │                            │
        │                        │                            │  8. gunakan aplikasi
        │                        │                            │     (cek expired tiap buka)
```

> **Catatan status:** Langkah 5–6 (validasi server via Supabase) adalah **arah
> target**. Sampai `admin/` tersinkron ke Supabase, langkah ini dilewati dan
> validasi hanya mengandalkan HMAC lokal (langkah 4). Lihat `../CLOUD-ROADMAP.md`.
>
> **Opsi 3 (2026-08-27):** validasi kepemilikan serial kini **server-side**.
> Admin `kaki5`/`retail`/`rosok` memanggil RPC `device_assign` saat serial dipakai
> di perangkat baru (model 1 serial = 1 unit_id = 1 profil). Profil cocok (nama
> warung / no WA) → `unit_id` di-reassign; tak cocok → tolak + lock overlay. Admin
> bisa memindahkan lisensi antar-unit lewat tombol **"↔️ Unit"** (`admin/js/clients.js`
> `reassignClientUnit`). Rujukan: `supabase/migration-device-assign.sql`.

---

## 🛡️ Keamanan

| Aspek | Implementasi |
|-------|-------------|
| **Signature** | HMAC-SHA256 (kriptografis, tidak bisa dibalik) |
| **Device-Bound** | Serial hanya valid untuk device code tertentu |
| **Salt** | Rahasia, tidak tersimpan di aplikasi klien |
| **Prefix** | Membedakan produk (serial Rosok tidak bisa dipakai di Retail) |
| **Expiry** | Bisa diatur seumur hidup atau periode tertentu |
| **Validasi server (target)** | Status lisensi diverifikasi via Supabase → bisa dicabut (revoke) terpusat |

> **Satu alasan utama validasi via Supabase:** memungkinkan **revoke/reset lisensi
> terpusat** tanpa menunggu ada di tiap perangkat. Validasi offline saja tidak bisa
> mencabut serial yang sudah disalahgunakan.

---

## 📋 Contoh Serial

| Prefix | Device Code | Expiry | Signature | Serial Lengkap |
|--------|------------|--------|-----------|---------------|
| KSR | A1B2-C3D4 | 99 | X7K9M2 | `KSR-A1B2-C3D4-99-X7K9M2` |
| KRT | F5G6-H7J8 | 12 | M3N4P5 | `KRT-F5G6-H7J8-12-M3N4P5` |
| KSL | Q1W2-E3R4 | 7D | T5Y6U7 | `KSL-Q1W2-E3R4-7D-T5Y6U7` |

---

*Sistem Lisensi — KASIRSOLO Admin Dashboard*
