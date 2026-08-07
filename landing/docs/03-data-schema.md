# Landing Page — Data Schema

Detail struktur data yang disimpan di `localStorage`.

---

## 📋 Storage Keys

Semua data disimpan di browser user melalui `localStorage` dengan 4 key utama.

---

## 1. `kasirsolo:catalog` — Katalog Aplikasi

Array dinamis berisi daftar aplikasi yang tampil di halaman.
**Ditulis oleh:** Admin Dashboard | **Dibaca oleh:** Landing Page

```json
[
  {
    "id": "retail",
    "icon": "🛒",
    "name": "Kasir Retail",
    "desc": "Sistem kasir lengkap untuk toko retail, minimarket, dan warung. Dilengkapi manajemen stok & laporan.",
    "price": 250000,
    "category": "bisnis",
    "hot": true
  },
  {
    "id": "konveksi",
    "icon": "👕",
    "name": "Manajemen Konveksi",
    "desc": "Kelola produksi konveksi dari order hingga pengiriman. Tracking progress & manajemen bahan.",
    "price": 350000,
    "category": "bisnis",
    "hot": false
  }
  // ... bisa ditambah tanpa batas
]
```

### Field Definitions

| Field | Tipe | Wajib | Deskripsi |
|-------|------|-------|-----------|
| `id` | string | ✅ | Identifier unik (slug) |
| `icon` | string | ✅ | Emoji icon (max 4 karakter) |
| `name` | string | ✅ | Nama aplikasi |
| `desc` | string | ✅ | Deskripsi singkat (1-2 kalimat) |
| `price` | number | ✅ | Harga dalam Rupiah (angka, tanpa pemisah) |
| `category` | string | ✅ | Kategori: `"bisnis"` \| `"institusi"` \| `"kesehatan"` |
| `hot` | boolean | ✅ | Tampilkan badge "Hot" jika true |

### Kategori Aplikasi

| Kategori | ID | Contoh Aplikasi |
|----------|----|----------------|
| `bisnis` | bisnis | Retail, Konveksi, Bengkel |
| `institusi` | institusi | Masjid, TPA/TPQ, Dapur SPPG |
| `kesehatan` | kesehatan | Klinik THT, Apotek |

---

## 2. `kasirsolo:settings` — Pengaturan

Object berisi konfigurasi kontak, alamat, dan statistik hero.
**Ditulis oleh:** Admin Dashboard | **Dibaca oleh:** Landing Page

```json
{
  "waNumber": "628816566935",
  "email": "owner.kasirsolo@gmail.com",
  "addrLegal": "Perum Graha Tiara 2 B1 Gumpang 07/01, Kartasura, Sukoharjo, Jawa Tengah 57169",
  "mapsLegal": "https://maps.app.goo.gl/DtNwuJvY9KufJN3CA",
  "addrOps": "Gumiring 04/04, Sidomulyo, Banjarejo, Blora, Jawa Tengah 58253",
  "mapsOps": "https://maps.app.goo.gl/F9YMpuBUPMd1tcNWA",
  "statClients": 500,
  "statUptime": 99.9
}
```

### Field Definitions

| Field | Tipe | Deskripsi |
|-------|------|-----------|
| `waNumber` | string | Nomor WhatsApp (format internasional 62xxx) |
| `email` | string | Email perusahaan |
| `addrLegal` | string | Alamat legal (untuk footer & dokumen) |
| `mapsLegal` | string | Link Google Maps alamat legal |
| `addrOps` | string | Alamat operasional (tempat kerja) |
| `mapsOps` | string | Link Google Maps alamat operasional |
| `statClients` | number | Jumlah klien aktif (tampil di hero counter) |
| `statUptime` | number | Persentase uptime (tampil di hero counter) |

---

## 3. `kasirsolo:leads` — Data Lead

Array berisi semua pendaftar trial dari form landing page.
**Ditulis oleh:** Landing Page (form submit) | **Dibaca oleh:** Admin Dashboard

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

### Field Definitions

| Field | Tipe | Deskripsi |
|-------|------|-----------|
| `id` | string | ID unik: `lead_` + timestamp + random string |
| `name` | string | Nama lengkap / nama bisnis |
| `address` | string | Alamat usaha |
| `wa` | string | Nomor WhatsApp |
| `app` | string | Nama aplikasi + harga yang dipilih |
| `status` | string | Status lead: `"Baru"` \| `"Dihubungi"` \| `"Trial Aktif"` \| `"Berlangganan"` \| `"Batal"` |
| `createdAt` | string | ISO timestamp saat form disubmit |

### Status Lead Flow

```
  Baru → Dihubungi → Trial Aktif → Berlangganan
                                    ↓
                                 Batal
```

---

## 4. `kasirsolo:stats` — Statistik Kunjungan

Object sederhana untuk menghitung jumlah kunjungan.
**Ditulis oleh:** Landing Page (setiap load) | **Dibaca oleh:** Admin Dashboard

```json
{
  "visits": 1234
}
```

### Field Definitions

| Field | Tipe | Deskripsi |
|-------|------|-----------|
| `visits` | number | Total jumlah halaman dimuat |

---

## 🔧 Cara Kerja读写

### Membaca Data

```javascript
// Fungsi helper yang dipakai di landing/index.html
async function storageGetJSON(key, fallback) {
  try {
    if (!window.storage) return fallback;  // fallback jika localStorage tidak tersedia
    const res = await window.storage.get(key, true);
    if (res && res.value) return JSON.parse(res.value);
    return fallback;
  } catch (e) {
    return fallback;
  }
}
```

### Menulis Data

```javascript
// Fungsi helper yang dipakai di landing/index.html
async function storageSetJSON(key, value) {
  try {
    if (!window.storage) return false;
    await window.storage.set(key, JSON.stringify(value), true);
    return true;
  } catch (e) {
    return false;
  }
}
```

---

## ⚠️ Batasan localStorage

| Batasan | Dampak | Solusi (Rencana) |
|---------|--------|-----------------|
| Hanya 1 browser | Data tidak sinkron antar device | Migrasi ke Supabase |
|capacity ~5-10MB | Leads besar bisa penuh | Supabase unlimited |
| Tidak ada auth | Siapapun bisa akses | Supabase RLS |
| Tidak ada real-time | Butuh refresh manual | Supabase real-time subscription |

---

*Data Schema Landing Page — KASIRSOLO*
