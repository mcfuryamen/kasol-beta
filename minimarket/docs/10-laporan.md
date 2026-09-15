# Laporan & Dashboard

Panduan memahami dan menggunakan laporan penjualan, laba rugi, stok, dan dashboard.

---

## Dashboard

Halaman utama setelah login. Menampilkan ringkasan operasional hari ini.

### Kartu Ringkasan

| Kartu | Isi |
|-------|-----|
| **Total Penjualan** | Omset hari ini (Rupiah) |
| **Jumlah Transaksi** | Berapa kali transaksi |
| **Rata-rata Transaksi** | Total / jumlah transaksi |
| **Produk Terjual** | Total item terjual |

### Widget Tambahan

- **Status Kas** — apakah kas aktif atau tutup
- **Stok Menipis** — produk yang stoknya rendah
- **Notifikasi Terbaru** — alert yang belum dibaca
- **Transaksi Terkini** — 5 transaksi terakhir

---

## Halaman Laporan

Akses via sidebar: **Laporan** (hanya Owner & Manager).

### Period Selector

Pilih periode laporan:
- **Hari Ini** — data tanggal hari ini
- **Kemarin** — data tanggal kemarin
- **Minggu Ini** — Senin sampai hari ini
- **Bulan Ini** — tanggal 1 sampai hari ini

### Tab Laporan

Halaman laporan memiliki beberapa tab:

---

## Tab Penjualan

### Ringkasan Penjualan

| Metrik | Keterangan |
|--------|------------|
| Total Penjualan (Gross) | Omset kotor sebelum diskon |
| Total Diskon | Jumlah semua diskon |
| PPN | Pajak yang dipungut |
| Net Sales | Penjualan bersih |
| Jumlah Transaksi | Total order |
| Rata-rata Per Transaksi | Net sales / jumlah order |

### Per Metode Pembayaran

Progress bar visual menunjukkan breakdown per metode bayar:

```
Tunai       ████████████████░░░░  62%  Rp 527.000
QRIS        ██████░░░░░░░░░░░░░░  22%  Rp 187.000
Debit       ███░░░░░░░░░░░░░░░░░  10%  Rp 85.000
E-Wallet    ██░░░░░░░░░░░░░░░░░░   6%  Rp 51.000
```

### Per Kategori

Breakdown penjualan per kategori produk:

```
Sembako     ████████████████░░░░  40%  Rp 340.000
Minuman     ██████████░░░░░░░░░░  25%  Rp 212.500
Snack       ██████░░░░░░░░░░░░░░  15%  Rp 127.500
...
```

### Top 10 Produk Terlaris

Ranking produk berdasarkan qty terjual:

| # | Produk | Qty | Revenue |
|---|--------|-----|---------|
| 1 | Indomie Goreng | 45 pcs | Rp 157.500 |
| 2 | Aqua 600ml | 38 botol | Rp 114.000 |
| 3 | Teh Pucuk Harum | 25 botol | Rp 100.000 |
| ... | ... | ... | ... |

### Penjualan Per Jam

Bar chart menunjukkan pola penjualan per jam:

```
08: ██
09: ████
10: ██████
11: ████████
12: ██████████████  ← Peak lunch
13: ██████████
14: ██████
15: ████████
16: ██████████████  ← Peak sore
17: ████████████
18: ██████████
19: ████████
20: ████
```

### Trend 7 Hari

Bar chart + tabel trend penjualan 7 hari terakhir, menunjukkan pola harian.

---

## Tab Laba Rugi (P&L)

Laporan Profit & Loss waterfall:

```
┌─────────────────────────────────────┐
│ Revenue (Pendapatan)    Rp 5.000.000│
│                                      │
│ - HPP (Harga Pokok)   -Rp 3.500.000│
│                        ─────────────│
│ = Laba Kotor            Rp 1.500.000│
│   Gross Margin: 30%                 │
│                                      │
│ - Biaya Operasional:                │
│   Listrik              -Rp  150.000 │
│   Air                  -Rp   50.000 │
│   Sewa                 -Rp  500.000 │
│   Gaji                 -Rp  300.000 │
│   Kebersihan           -Rp   50.000 │
│   Transport            -Rp   30.000 │
│   Maintenance          -Rp   20.000 │
│   Lainnya              -Rp   50.000 │
│                        ─────────────│
│ = Laba Bersih           Rp  350.000 │
│   Net Margin: 7%                    │
└─────────────────────────────────────┘
```

### Breakdown Biaya Operasional

Progress bar per kategori biaya, menunjukkan proporsi setiap pos pengeluaran.

---

## Tab Stok

### Ringkasan Stok

| Metrik | Keterangan |
|--------|------------|
| Total Produk | Jumlah jenis produk |
| Nilai Stok | Total harga beli × qty semua produk |
| Low Stock | Produk di bawah minimum stok |
| Near Expiry | Produk mendekati kadaluarsa |

### Pergerakan Stok

Ringkasan pergerakan:
- Stok Masuk: total qty masuk (pembelian, retur pelanggan)
- Stok Keluar: total qty keluar (penjualan, rusak, expired)
- Waste: total qty waste (rusak + expired)

### Top 5 Produk Paling Banyak Dipakai

Produk dengan pergerakan stok keluar tertinggi (paling laku).

---

## Export

Tombol **Export** tersedia di setiap tab laporan. Fitur export akan mengunduh data dalam format yang sesuai (skeleton — siap untuk implementasi custom).

---

## Tips Laporan

- **Cek dashboard setiap pagi** — overview cepat kondisi bisnis
- **Review P&L bulanan** — pastikan net margin sehat (>5%)
- **Pantau top 10 produk** — pastikan selalu tersedia
- **Analisis penjualan per jam** — optimasi jadwal staf berdasarkan peak hours
- **Bandingkan trend mingguan** — deteksi pola dan anomali
- **Track HPP** — negosiasi harga beli yang lebih baik untuk meningkatkan margin
- **Monitor stok report** — produk near-expiry bisa di-promo

---

**Selanjutnya:** [Printer →](11-printer.md)
