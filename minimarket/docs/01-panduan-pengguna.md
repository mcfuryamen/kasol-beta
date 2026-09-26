# Panduan Pengguna — Kasir Solo Minimarket

Dokumen ini adalah panduan lengkap penggunaan aplikasi **Kasir Solo - Minimarket** dari awal hingga mahir.

---

## Daftar Isi

1. [Memulai Aplikasi](#1-memulai-aplikasi)
2. [Login & Role Pengguna](#2-login--role-pengguna)
3. [Navigasi Antarmuka](#3-navigasi-antarmuka)
4. [Alur Kerja Harian](#4-alur-kerja-harian)
5. [Tips & Trik](#5-tips--trik)

---

## 1. Memulai Aplikasi

### Pertama Kali

```bash
# Extract dan install
unzip kasir-solo-minimarket.zip
cd kasir-solo-minimarket
npm install

# Jalankan
npm run dev
```

Buka browser di `http://localhost:5173`. Anda akan melihat halaman login.

### Mode Demo vs Produksi

| Mode | Kondisi | Keterangan |
|------|---------|------------|
| **Demo** | Tidak ada `.env` atau Supabase belum dikonfigurasi | Semua data sampel, tidak perlu database |
| **Produksi** | File `.env` berisi URL dan Key Supabase yang valid | Data persistent di Supabase |

> **Rekomendasi:** Mulai dengan Demo Mode untuk memahami fitur, lalu migrasi ke Supabase untuk penggunaan nyata.

---

## 2. Login & Role Pengguna

### Halaman Login

Di halaman login, Anda bisa:
- Memasukkan email dan password secara manual
- Atau klik salah satu tombol "Demo Login" untuk masuk cepat

### 4 Role Pengguna

| Role | Akses | Deskripsi |
|------|-------|-----------|
| **Owner** | Semua halaman | Pemilik toko, akses penuh termasuk laporan dan staf |
| **Manager** | Semua kecuali pengaturan staf | Manajer operasional |
| **Kasir** | POS, Produk, Pelanggan | Operator kasir harian |
| **Gudang** | Stok, Supplier, Produk | Petugas gudang dan receiving |

### Akun Demo

| Role | Email | Password |
|------|-------|----------|
| Owner | `owner@demo.com` | `demo123` |
| Manager | `manager@demo.com` | `demo123` |
| Kasir | `kasir@demo.com` | `demo123` |
| Gudang | `gudang@demo.com` | `demo123` |

### Logout

Klik ikon logout di bagian bawah sidebar, atau di profil user.

---

## 3. Navigasi Antarmuka

### Sidebar (Menu Kiri)

Sidebar menampilkan menu navigasi utama:

| Icon | Menu | Halaman |
|------|------|---------|
| 🏠 | Dashboard | Ringkasan hari ini |
| 🛒 | Kasir | POS / Point of Sale |
| 📦 | Produk | Manajemen produk |
| 📊 | Stok | Inventori & mutasi |
| 🚚 | Supplier | Supplier & Purchase Order |
| 👥 | Pelanggan | Customer & loyalty |
| 💰 | Keuangan | Kas, shift, arus uang |
| 🏷️ | Promo | Diskon & voucher |
| 📈 | Laporan | Sales, P&L, stok report |
| 👤 | Staf | Manajemen karyawan |
| ⚙️ | Pengaturan | Konfigurasi toko & printer |

> Sidebar bisa di-collapse (sembunyikan teks) dengan tombol toggle di header.

### Header (Atas)

Header menampilkan:
- **Judul halaman** saat ini
- **Status Kas**: 🟢 "Kas Aktif" atau 🔴 "Kas Tutup"
- **Toggle dark mode** (🌙/☀️)
- **Bell notifikasi** dengan badge unread count
- **Toggle sidebar**

### Dark Mode

Klik ikon bulan/matahari di header untuk beralih antara mode terang dan gelap. Preferensi disimpan di browser.

### Bahasa

Bahasa bisa diganti di halaman Pengaturan antara **Indonesia** dan **English**.

---

## 4. Alur Kerja Harian

Berikut adalah alur kerja standar kasir minimarket menggunakan aplikasi ini:

### Pagi: Persiapan

```
1. Login → dengan akun kasir
2. Buka Kas → masukkan modal awal (misal Rp 300.000)
3. Cek Dashboard → lihat ringkasan stok, notifikasi
4. Cek Stok → perhatikan item yang menipis
```

### Siang: Operasional

```
5. POS/Kasir → proses transaksi pelanggan
   - Scan barcode atau cari produk
   - Tambah ke keranjang
   - Pilih metode pembayaran
   - Cetak struk

6. Catat Uang Keluar → jika ada pengeluaran operasional
   (misal: beli plastik, bayar listrik)

7. Catat Uang Masuk → jika ada setoran tambahan
```

### Sore: Penerimaan Barang

```
8. Cek PO → apakah ada barang datang dari supplier
9. Terima Barang → update stok masuk
10. Cek Expired → perhatikan produk mendekati kadaluarsa
```

### Malam: Penutupan

```
11. Laporan → cek penjualan hari ini
12. Tutup Kas → hitung uang di laci kas
    - Hitung per denominasi (opsional)
    - Bandingkan dengan ekspektasi sistem
    - Catat selisih (jika ada)
13. Logout
```

---

## 5. Tips & Trik

### Untuk Kasir

- **Hafalkan shortcut F1-F4** — ini yang paling sering dipakai:
  - `F1` = fokus barcode, `F4` = bayar
- **Gunakan numpad layar** saat pakai touchscreen/tablet
- **Mode BAYAR** di numpad untuk input uang tunai, langsung tekan tombol hijau BAYAR
- **Hold order** (`F2`) kalau pelanggan mau ambil barang tambahan
- Scan barcode secara **berurutan** — input auto-clear setelah scan berhasil

### Untuk Owner/Manager

- **Cek Dashboard** setiap pagi untuk overview
- **Pantau laporan** mingguan untuk trend penjualan
- **Atur promo** untuk produk slow-moving
- **Review selisih kas** saat tutup — defisit berulang = masalah
- **Kelola member** — pelanggan loyal = revenue stabil

### Umum

- Aplikasi bisa **di-install sebagai PWA** — klik "Install" di address bar browser
- Data **tetap aman** walau browser ditutup (tersimpan di IndexedDB/RxDB)
- **Dark mode** nyaman untuk shift malam
- Tekan `?` di halaman POS untuk lihat semua shortcut

---

**Selanjutnya:** [POS & Kasir →](02-pos-kasir.md)
