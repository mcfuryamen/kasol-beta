# Admin Dashboard — Fitur Lengkap

Penjelasan detail setiap modul di admin dashboard.

---

## 1. Dashboard (Overview)

Menampilkan ringkasan statistik bisnis.

### Stat Cards

| Card | Icon | Data | Sumber |
|------|------|------|--------|
| Total Kunjungan | 👀 | `stats.visits` | Landing page (setiap load) |
| Total Leads | 📋 | `leads.length` | Form submission |
| Leads Baru | 🆕 | leads dengan status "Baru" | Form submission |
| Sudah Berlangganan | ✅ | leads dengan status "Berlangganan" | Update manual |

### Bar Charts

**Leads per Aplikasi**
- Mengelompokkan leads berdasarkan kolom `app`
- Horizontal bar chart dengan lebar proporsional
- Menampilkan nama aplikasi (dipotong 22 karakter) dan jumlah

**Leads per Status**
- Mengelompokkan leads berdasarkan kolom `status`
- Horizontal bar chart dengan lebar proporsional
- Menampilkan nama status dan jumlah

### Refresh Data

Tombol **🔄 Refresh Data** di footer sidebar memuat ulang semua data dari localStorage.

---

## 2. Leads Management

Modul untuk mengelola pendaftar trial dari landing page.

### Toolbar

| Elemen | Fungsi |
|--------|--------|
| Search input | Filter real-time berdasarkan nama, WA, atau alamat |
| Status filter | Dropdown: Semua / Baru / Dihubungi / Trial Aktif / Berlangganan / Batal |

### Tabel Leads

| Kolom | Isi | Aksi |
|-------|-----|------|
| Nama/Bisnis | `lead.name` | — |
| WhatsApp | `lead.wa` | Klik untuk buka wa.me link |
| Aplikasi | `lead.app` | — |
| Tanggal Daftar | `lead.createdAt` (formatted) | — |
| Status | Dropdown select | Ubah status → auto-save |
| Hapus | Tombol merah | Konfirmasi → hapus → auto-save |

### Export CSV

Tombol **⬇️ Export CSV** menghasilkan file `leads-kasirsolo.csv`:
```csv
Nama,Alamat,WhatsApp,Aplikasi,Status,Tanggal Daftar
"Toko Maju Jaya","Jl. Contoh No.1","081234567890","Kasir Retail - Rp250.000","Baru","01 Agu 2026 10:30"
```

### Empty State

Jika belum ada leads:
```
📭 Belum ada leads.
Leads akan otomatis muncul di sini saat ada yang mengisi form trial di landing page.
```

---

## 3. Katalog Management

Modul CRUD untuk aplikasi yang tampil di landing page.

### Tambah Aplikasi Baru

Tombol **➕ Tambah Aplikasi** menambahkan baris kosong dengan default:
```javascript
{
  id: 'app_' + Date.now(),
  icon: '📦',
  name: '',
  desc: '',
  price: 0,
  category: 'bisnis',
  hot: false
}
```

### Edit Aplikasi

Setiap baris memiliki field yang bisa diedit:

| Field | Input | Constraints |
|-------|-------|-------------|
| Ikon | Text (emoji) | Max 4 karakter |
| Nama | Text | — |
| Deskripsi | Textarea | — |
| Kategori | Select | bisnis / institusi / kesehatan |
| Harga | Number | Min 0, step 10000 |
| Hot | Checkbox | — |

### Simpan & Hapus

| Aksi | Perilaku |
|------|----------|
| **Simpan** | Update object di array → simpan ke localStorage → toast "Aplikasi disimpan" |
| **Hapus** | Konfirmasi dialog → splice array → simpan → toast "Aplikasi dihapus" |

### Empty State

Jika katalog kosong:
```
📭 Belum ada aplikasi. Klik "Tambah Aplikasi" untuk memulai.
```

---

## 4. Lisensi Management

Modul terintegrasi dari generator lisensi universal.

### 4a. Product Registry

Daftar produk dengan prefix & salt.

| Field | Input | Constraints |
|-------|-------|-------------|
| Nama Produk | Text | — |
| Prefix | Text (uppercase) | 3-5 huruf kapital, unik |
| Salt | Text | Minimal 10 karakter |

**Tombol:**
- **➕ Tambah Produk Baru** — membuka form inline
- **🎲 Acak** — generate salt otomatis: `KASIRSOLO-{PREFIX}-{24 random chars}`
- **💾 Simpan Produk** — validasi → push ke array → simpan
- **🗑️ Hapus** — konfirmasi → filter → simpan

### 4b. Generate Serial

Form untuk membuat serial baru.

| Field | Input | Contoh |
|-------|-------|--------|
| Pilih Produk | Dropdown | Rosok (KSR) |
| Device Code | Text | A1B2-C3D4 |
| Masa Berlaku | Dropdown | Seumur Hidup / 12 Bulan / 7 Hari |

**Hasil:**
```
┌─────────────────────────────────┐
│   KSR-A1B2-C3D4-99-X7K9M2      │
│                                 │
│   Produk: Rosok (KASIRSOLO)     │
│   Device: A1B2-C3D4             │
│   Exp: Seumur Hidup             │
│                                 │
│   [📋 Salin Serial]             │
└─────────────────────────────────┘
```

**Auto-format:** Device code input otomatis dinormalisasi saat blur.

### 4c. Verifikasi Serial

Form untuk memvalidasi serial.

| Field | Input |
|-------|-------|
| Pilih Produk | Dropdown |
| Nomor Serial | Text (auto-format dengan prefix) |
| Device Code | Text (opsional) |

**Hasil:**
- ✅ **Serial VALID** — tampilkan device code & expiry
- ❌ **Serial INVALID** — tampilkan alasan penolakan

**Alasan invalid:**
- Format serial tidak sesuai
- Signature HMAC tidak cocok
- Device code tidak match

### 4d. Reference Code

Generate blok kode JavaScript yang harus disalin ke aplikasi klien.

Tombol **📋 Salin Kode** menyalin ke clipboard.

Kode yang di-generate sesuai dengan produk yang dipilih di dropdown.

### 4e. Backup & Restore

| Tombol | Fungsi |
|--------|--------|
| **⬇️ Export JSON** | Download file `kasirsolo-daftar-produk-lisensi-backup.json` |
| **⬆️ Import JSON** | Upload file → replace seluruh product registry |

---

## 5. Pengaturan

Form untuk mengontrol konten landing page.

### Kontak

| Field | Input | Contoh |
|-------|-------|--------|
| Nomor WhatsApp | Text | `628816566935` |
| Email | Email | `owner.kasirsolo@gmail.com` |

### Alamat

| Field | Input | Contoh |
|-------|-------|--------|
| Alamat Legal | Text | `Perum Graha Tiara 2...` |
| Link Google Maps (Legal) | URL | `https://maps.app.goo.gl/...` |
| Alamat Operasional | Text | `Gumiring 04/04...` |
| Link Google Maps (Operasional) | URL | `https://maps.app.goo.gl/...` |

### Statistik Hero

| Field | Input | Contoh |
|-------|-------|--------|
| Jumlah Klien Aktif | Number | `500` |
| Uptime (%) | Number (decimal) | `99.9` |

### Simpan

Tombol **💾 Simpan Pengaturan** menyimpan semua field ke `kasirsolo:settings`.
Landing page akan menampilkan data terbaru saat dimuat ulang.

---

## 🔄 Sinkronisasi dengan Landing Page

| Modifikasi di Admin | Efek di Landing |
|---------------------|-----------------|
| Tambah/ubah/hapus aplikasi di Katalog | Katalog di landing berubah (refresh halaman) |
| Ubah pengaturan kontak/alamat | Footer & CTA WhatsApp di landing berubah |
| Ubah statistik hero | Counter di hero berubah (refresh halaman) |
| Lead baru dari form trial | Muncul di tab Leads admin |

> **Catatan:** Perubahan katalog & pengaturan memerlukan refresh halaman landing untuk terlihat.

---

*Product Features — KASIRSOLO Admin Dashboard*
