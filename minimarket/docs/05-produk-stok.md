# Produk & Stok — Manajemen Inventori

Panduan lengkap mengelola produk, kategori, stok, mutasi, dan stok opname.

---

## Manajemen Produk

### Halaman Produk

Akses via sidebar: **Produk**. Halaman menampilkan:
- Toggle **Grid/List** view
- **Pencarian** (nama, SKU, barcode)
- **Filter kategori** (pill buttons)
- **Tombol tambah** produk baru
- Daftar/grid produk dengan info: nama, SKU, harga, stok

### Menambah Produk Baru

1. Klik tombol **"+ Tambah Produk"**
2. Isi form:

| Field | Keterangan | Contoh |
|-------|------------|--------|
| Nama Produk* | Nama tampilan | Indomie Goreng |
| SKU* | Kode unik internal | SKU001 |
| Barcode | Kode barcode (13 digit) | 8886008101053 |
| Kategori* | Pilih dari dropdown | Sembako |
| Harga Beli* | Harga modal | Rp 2.800 |
| Harga Jual* | Harga ke pelanggan | Rp 3.500 |
| Harga Grosir | Harga untuk member/qty besar | Rp 3.200 |
| Satuan Beli | Unit saat beli dari supplier | Karton |
| Satuan Jual | Unit saat jual ke pelanggan | Pcs |
| Stok Awal* | Jumlah stok saat ini | 100 |
| Stok Minimum | Alert jika stok di bawah ini | 10 |
| Stok Maksimum | Batas stok ideal | 200 |

3. Klik **Simpan**

### 10 Kategori Produk

| Kategori | Contoh Produk |
|----------|--------------|
| Makanan Ringan (Snack) | Chitato, Taro, Oreo |
| Minuman | Aqua, Teh Pucuk, Pocari |
| Sembako | Beras, Gula, Minyak, Mie |
| Rokok | Gudang Garam, Sampoerna |
| Toiletries | Sabun, Shampoo, Pasta Gigi |
| Rumah Tangga (Household) | Rinso, Wipol, Baygon |
| Frozen Food | Nugget, Sosis, Es Krim |
| Bumbu & Rempah | Kecap, Saos, Garam |
| Susu & Dairy | Indomilk, Ultra, Yakult |
| Lainnya | Plastik, Korek, Tisu |

### 25 Produk Demo

Aplikasi menyediakan 25 produk demo yang sudah terisi lengkap, termasuk: Indomie Goreng, Aqua 600ml, Gudang Garam Surya 16, Minyak Bimoli 1L, Gula Gulaku 1kg, Beras Rojolele 5kg, Teh Pucuk Harum, Pocari Sweat 500ml, Sabun Lifebuoy, Rinso Cair, dan lainnya.

### Mengedit Produk

1. Klik produk di list/grid
2. Form edit muncul dengan data terisi
3. Ubah field yang diinginkan
4. Klik **Simpan**

### Menghapus Produk

1. Klik produk → tombol **Hapus**
2. Konfirmasi dialog muncul
3. Klik **Ya, Hapus**

> Produk yang sudah ada di transaksi historis tidak akan hilang dari laporan.

---

## Manajemen Stok

### Halaman Stok

Akses via sidebar: **Stok**. Menampilkan:
- Ringkasan: total produk, nilai stok, low stock, near expiry
- Tabel stok: produk, stok saat ini, min stok, status
- Filter: semua, low stock, overstock, near expiry
- Riwayat mutasi stok

### Status Stok

| Status | Warna | Kondisi |
|--------|-------|---------|
| Normal | Hijau | Stok > minimum, < maksimum |
| Low Stock | Merah | Stok <= minimum |
| Overstock | Biru | Stok > maksimum |
| Habis | Merah gelap | Stok = 0 |

### Stok Masuk

Stok bertambah dari:
1. **Penerimaan PO** — otomatis saat PO diterima
2. **Manual** — klik "Stok Masuk" di halaman stok
3. **Retur dari pelanggan** — otomatis saat retur diproses

Form stok masuk:
- Produk (pilih)
- Qty masuk
- Alasan: Pembelian, Retur Pelanggan, Penyesuaian, Lainnya
- Referensi (nomor PO, dll)
- Catatan

### Stok Keluar

Stok berkurang dari:
1. **Penjualan** — otomatis saat transaksi POS
2. **Manual** — klik "Stok Keluar" di halaman stok
3. **Rusak/Expired** — input manual
4. **Retur ke supplier** — input manual

Form stok keluar:
- Produk (pilih)
- Qty keluar
- Alasan: Penjualan, Rusak, Expired, Sampel, Retur Supplier, Lainnya
- Catatan

### Riwayat Mutasi

Tabel riwayat menampilkan semua pergerakan stok:
- Tanggal & waktu
- Produk
- Tipe (masuk/keluar)
- Qty
- Alasan
- Referensi (nomor order/PO)

### Stok Opname

Stok opname (stock take) untuk memverifikasi stok fisik vs sistem:

1. Klik **"Stok Opname"** di halaman stok
2. Daftar produk muncul dengan:
   - Stok sistem (dari database)
   - Input stok fisik (yang dihitung manual)
   - Selisih otomatis terhitung
3. Hitung fisik setiap produk dan input ke sistem
4. Review produk dengan selisih
5. Klik **Simpan Opname**
6. Stok sistem di-update sesuai stok fisik

### Low Stock Alert

Notifikasi otomatis muncul saat stok produk ≤ minimum:
- Badge di bell icon header
- Item di notification panel
- Highlight merah di halaman stok

---

## Tips Inventori

- **Set minimum stok** berdasarkan rata-rata penjualan harian × lead time supplier
- **Lakukan stok opname** minimal 1× per minggu
- **Perhatikan expired** — produk mendekati kadaluarsa bisa di-promo
- **Track mutasi** untuk investigasi selisih stok

---

**Selanjutnya:** [Supplier & PO →](06-supplier-po.md)
