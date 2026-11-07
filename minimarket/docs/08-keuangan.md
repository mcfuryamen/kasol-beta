# Keuangan — Arus Kas, Uang Masuk/Keluar, Void & Retur

Panduan lengkap fitur keuangan: kas aktif, pencatatan uang masuk/keluar, riwayat shift, void, dan retur.

---

## Halaman Keuangan

Akses via sidebar: **Keuangan** (hanya Owner & Manager). Halaman ini memiliki **4 tab**:

### Ringkasan Atas (Selalu Tampil)

3 kartu ringkasan di bagian atas:
- **Uang Masuk Hari Ini** — total cash in (hijau)
- **Pengeluaran Hari Ini** — total cash out (merah)
- **Saldo Kas** — running balance (orange/merah)

---

## Tab 1: Kas Aktif

Menampilkan status shift kasir yang sedang aktif:

### Saat Kas Aktif (🟢)

- Informasi shift: waktu buka, siapa yang buka
- 4 kartu info:
  - Modal Awal
  - Penjualan Tunai
  - Pengeluaran
  - Saldo Kas (estimasi)
- Daftar transaksi hari ini (10 terbaru)

### Saat Kas Tutup (🔴)

- Pesan "Tidak ada shift aktif"
- Tombol **Buka Kas** untuk memulai shift baru

### Tombol Aksi

| Tombol | Fungsi |
|--------|--------|
| **Buka Kas** | Mulai shift baru (jika belum ada) |
| **Tutup Kas** | Akhiri shift aktif (hitung kas) |

> Detail lengkap buka/tutup kas: [Buka/Tutup Kas](03-buka-tutup-kas.md)

---

## Tab 2: Uang Masuk/Keluar

Fitur pencatatan arus kas selain dari transaksi penjualan.

### Uang Masuk (Cash In)

Untuk mencatat pemasukan kas non-penjualan:

| Kategori | Contoh |
|----------|--------|
| **Setoran Tambahan** | Owner menambah modal ke laci kas |
| **Pengembalian** | Uang kembali dari pembelian yang dibatalkan |
| **Lainnya** | Pemasukan lain-lain |

**Cara:**
1. Klik tombol **"Uang Masuk"** (hijau)
2. Modal form muncul:
   - Pilih kategori
   - Masukkan jumlah (Rp)
   - Tulis deskripsi
3. Klik **Simpan**
4. Record tercatat, saldo kas bertambah

### Uang Keluar (Cash Out)

Untuk mencatat pengeluaran kas operasional:

| Kategori | Contoh |
|----------|--------|
| **Belanja Operasional** | Beli plastik, tisu, ATK |
| **Setor Bank** | Setor uang tunai ke rekening bank |
| **Gaji** | Pembayaran gaji karyawan |
| **Listrik/Air** | Bayar tagihan PLN, PDAM |
| **Kebersihan** | Beli alat kebersihan, jasa cleaning |
| **Lainnya** | Pengeluaran lain-lain |

**Cara:**
1. Klik tombol **"Uang Keluar"** (merah)
2. Modal form muncul:
   - Pilih kategori
   - Masukkan jumlah (Rp)
   - Tulis deskripsi
3. Klik **Simpan**
4. Record tercatat, saldo kas berkurang

### Filter Log

Filter riwayat arus kas berdasarkan:
- **Semua** — tampilkan semua
- **Masuk** — hanya cash in
- **Keluar** — hanya cash out

### Running Balance

Saldo berjalan (running balance) dihitung:

```
Saldo = Modal Awal + Total Penjualan Tunai + Total Cash In - Total Cash Out
```

---

## Tab 3: Riwayat Shift

Menampilkan semua shift kasir yang sudah pernah terjadi:

| Informasi | Keterangan |
|-----------|------------|
| Waktu buka | Kapan shift dimulai |
| Dibuka oleh | Siapa yang buka kas |
| Waktu tutup | Kapan shift berakhir |
| Modal awal | Jumlah modal saat buka |
| Kas aktual | Jumlah kas saat tutup |
| Selisih | Perbedaan aktual vs ekspektasi |
| Status | Buka (hijau) / Tutup (abu) |
| Catatan | Notes saat buka/tutup |

### Analisis Shift

- **Selisih positif** (surplus) → lebih banyak uang dari seharusnya
- **Selisih negatif** (defisit) → kurang dari seharusnya
- **Selisih nol** → sempurna

---

## Tab 4: Void & Retur

Mencatat transaksi yang dibatalkan (void) atau dikembalikan (retur):

### Void

Void = membatalkan transaksi yang sudah selesai.

**Kapan void:**
- Salah input produk/qty
- Pelanggan berubah pikiran setelah bayar
- Error sistem

**Cara:**
1. Cari order yang ingin di-void
2. Klik **Void**
3. Masukkan alasan void
4. Konfirmasi
5. Status order berubah ke "Void"
6. Stok otomatis dikembalikan

### Retur

Retur = pengembalian barang oleh pelanggan.

**Cara:**
1. Cari order terkait
2. Klik **Retur**
3. Pilih item yang diretur dan qty
4. Masukkan alasan
5. Konfirmasi
6. Stok dikembalikan, uang dikembalikan ke pelanggan

### Log Void/Retur

Setiap void/retur tercatat dengan:
- Nomor order
- Alasan
- Jumlah nominal
- Tipe (Void/Retur)
- Siapa yang melakukan
- Kapan

---

## Alur Keuangan Harian

```
Pagi:
├── Buka Kas (modal awal)
│
Siang:
├── Transaksi POS (penjualan)
├── Uang Masuk (jika ada setoran/pengembalian)
├── Uang Keluar (jika ada belanja operasional)
├── Void/Retur (jika ada)
│
Sore/Malam:
├── Review saldo kas
├── Tutup Kas (hitung aktual, denominasi)
└── Logout
```

---

## Tips Keuangan

- **Catat SEMUA pengeluaran** — sekecil apapun, agar selisih kas minim
- **Jangan campur uang pribadi** dengan uang kas toko
- **Setor ke bank secara rutin** — jangan simpan terlalu banyak cash di laci
- **Review riwayat shift** mingguan — pantau tren selisih
- **Gunakan void sparingly** — terlalu banyak void = indikasi masalah
- **Kategorikan pengeluaran** dengan benar untuk laporan yang akurat

---

**Selanjutnya:** [Promo & Voucher →](09-promo-voucher.md)
