# Pelanggan & Loyalty Program

Panduan mengelola pelanggan, membership, loyalty points, dan tier member.

---

## Manajemen Pelanggan

### Halaman Pelanggan

Akses via sidebar: **Pelanggan**. Menampilkan:
- Statistik: total member, member aktif, total points distributed
- Daftar pelanggan dengan: nama, telepon, tier, points, total belanja
- Pencarian dan filter tier
- Tombol tambah pelanggan

### 6 Pelanggan Demo

| Nama | Tier | Points | Total Belanja |
|------|------|--------|---------------|
| Ibu Siti Rahayu | Gold | 1.250 | Rp 12.500.000 |
| Pak Bambang Wijaya | Silver | 680 | Rp 6.800.000 |
| Dian Permatasari | Bronze | 320 | Rp 3.200.000 |
| Ahmad Fadli | Bronze | 150 | Rp 1.500.000 |
| Rina Susanti | Bronze | 75 | Rp 750.000 |
| Teguh Prasetya | Bronze | 20 | Rp 200.000 |

### Menambah Pelanggan

1. Klik **"+ Tambah Pelanggan"**
2. Isi form:

| Field | Keterangan | Wajib? |
|-------|------------|--------|
| Nama | Nama lengkap | Ya |
| Telepon | Nomor HP/WA | Ya |
| Email | Email (opsional) | Tidak |
| Alamat | Alamat rumah | Tidak |
| Tanggal Lahir | Untuk promo birthday | Tidak |
| Catatan | Info tambahan | Tidak |

3. Klik **Simpan**
4. **Member card ID** otomatis di-generate (format: MBR-XXXX)

---

## Loyalty Program

### 3 Tier Membership

| Tier | Syarat | Warna | Diskon |
|------|--------|-------|--------|
| **Bronze** | Default (semua member baru) | Orange | 0% |
| **Silver** | Total belanja ≥ Rp 5.000.000 | Abu/Silver | 3% |
| **Gold** | Total belanja ≥ Rp 10.000.000 | Kuning/Gold | 5% |

### Sistem Points

```
Setiap Rp 10.000 belanja = 1 Point

Contoh:
Belanja Rp 185.000 = 18 points
Belanja Rp 50.000  = 5 points
Belanja Rp 9.999   = 0 points
```

### Cara Kerja di POS

1. **Pilih pelanggan** sebelum proses pembayaran (F7)
2. Sistem otomatis:
   - Menerapkan harga grosir/member (jika ada)
   - Menghitung dan menambahkan points
   - Mencatat transaksi di riwayat belanja pelanggan
3. Setelah pembayaran, points otomatis terakumulasi

### Upgrade Tier

Tier otomatis naik berdasarkan **total belanja kumulatif**:
- Belanja total mencapai Rp 5 juta → Bronze → Silver
- Belanja total mencapai Rp 10 juta → Silver → Gold

> Downgrade tidak terjadi otomatis. Owner bisa manual adjust.

---

## Piutang Pelanggan

### Konsep Piutang

Saat pelanggan bayar dengan metode **Tempo** di POS:
- Transaksi tercatat sebagai piutang
- Jumlah hutang pelanggan bertambah
- Jatuh tempo bisa di-set

### Melihat Piutang

Di halaman Pelanggan, klik nama pelanggan untuk melihat:
- Total piutang outstanding
- Daftar piutang per transaksi
- Status: Belum Lunas, Sebagian, Lunas

### Menerima Pembayaran Piutang

1. Buka detail pelanggan
2. Klik piutang yang ingin dibayar
3. Masukkan jumlah pembayaran
4. Klik **Bayar**
5. Jika lunas → status berubah ke "Lunas"
6. Jika sebagian → sisa tercatat

---

## Riwayat Belanja

Setiap pelanggan punya riwayat belanja yang mencatat:
- Tanggal transaksi
- Nomor order
- Jumlah belanja
- Metode pembayaran
- Points yang didapat

Ini berguna untuk:
- Memahami pola belanja pelanggan
- Menawarkan produk yang relevan
- Menentukan promo yang tepat

---

## Tips Pelanggan

- **Ajak pelanggan jadi member** — data kontak berguna untuk promo
- **Ingatkan tentang points** — pelanggan senang mendapat reward
- **Pantau tier** — pelanggan yang mendekati upgrade bisa di-encourage
- **Hati-hati dengan Tempo** — set batas piutang per pelanggan
- **Birthday promo** — gunakan data tanggal lahir untuk diskon spesial

---

**Selanjutnya:** [Keuangan →](08-keuangan.md)
