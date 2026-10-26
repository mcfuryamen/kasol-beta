# Promo & Voucher

Panduan membuat dan mengelola promosi, voucher, dan diskon untuk menarik pelanggan.

---

## Halaman Promo

Akses via sidebar: **Promo**. Menampilkan:
- Statistik: total promo aktif, total digunakan, penghematan pelanggan
- Daftar promo dengan status, tipe, periode
- Voucher checker (cek kode voucher)
- Filter: status (aktif/nonaktif/expired) dan tipe

---

## 5 Tipe Promo

### 1. Diskon Persentase (%)

Potongan harga berdasarkan persentase dari harga produk.

```
Contoh: Diskon 10%
Harga asli: Rp 50.000
Diskon: Rp 5.000
Harga final: Rp 45.000
```

- Bisa set **maksimal diskon** (cap), misal: 10% max Rp 20.000
- Bisa set **minimal pembelian**, misal: min Rp 50.000

### 2. Diskon Nominal (Rp)

Potongan harga tetap dalam Rupiah.

```
Contoh: Diskon Rp 5.000
Berlaku untuk pembelian min Rp 30.000
```

### 3. Beli X Gratis Y

Promosi beli beberapa dapat bonus gratis.

```
Contoh: Beli 2 Gratis 1
Beli 2 Indomie → dapat 1 Indomie gratis
Bayar: 2 × Rp 3.500 = Rp 7.000 (bukan Rp 10.500)
```

### 4. Bundling

Paket produk dengan harga spesial.

```
Contoh: Paket Sarapan
Indomie + Teh Pucuk = Rp 6.000 (hemat Rp 1.500)
```

### 5. Happy Hour

Diskon berlaku hanya pada jam tertentu.

```
Contoh: Happy Hour 14:00 - 16:00
Semua minuman diskon 15%
Berlaku Senin - Jumat
```

---

## 6 Promo Demo

Aplikasi menyediakan 6 promo demo yang sudah aktif:

| Promo | Tipe | Diskon | Syarat |
|-------|------|--------|--------|
| Weekend Sale | Diskon % | 10% | Min Rp 50.000 |
| Hemat 5000 | Nominal | Rp 5.000 | Min Rp 30.000 |
| Beli 2 Gratis 1 | Buy X Get Y | 1 gratis | Beli 2 item sama |
| Paket Hemat | Bundling | Rp 5.000 off | Paket tertentu |
| Happy Hour Sore | Happy Hour | 15% | Jam 14-16, Senin-Jumat |
| PROMO2026 | Voucher | 20% | Kode: PROMO2026, max Rp 25.000 |

---

## Membuat Promo Baru

1. Klik **"+ Buat Promo"**
2. Isi form:

| Field | Keterangan |
|-------|------------|
| Nama Promo | Judul promosi |
| Tipe | Pilih dari 5 tipe |
| Nilai Diskon | Persentase atau nominal |
| Min. Pembelian | Minimal total belanja |
| Maks. Diskon | Batas atas diskon (untuk %) |
| Periode | Tanggal mulai - selesai |
| Jam (Happy Hour) | Jam aktif (opsional) |
| Hari (Happy Hour) | Hari aktif (opsional) |
| Scope | Semua produk / kategori / produk tertentu / member only |
| Limit Penggunaan | Berapa kali bisa dipakai |
| Kode Voucher | Kode unik (untuk tipe voucher) |

3. Klik **Simpan**

---

## Voucher System

### Membuat Voucher

1. Saat buat promo, pilih tipe yang menghasilkan kode voucher
2. Masukkan **kode voucher** (misal: `HEMAT2026`)
3. Set **limit penggunaan** (misal: 100 kali)
4. Simpan

### Menggunakan Voucher di POS

1. Di halaman POS, kolom tengah, masukkan kode voucher
2. Klik **Pakai**
3. Sistem memvalidasi:
   - Kode valid? ✅/❌
   - Belum expired? ✅/❌
   - Limit belum habis? ✅/❌
   - Min. pembelian terpenuhi? ✅/❌
4. Jika valid → diskon otomatis diterapkan
5. Usage counter bertambah

### Voucher Checker

Di halaman Promo, tersedia **Voucher Checker**:
1. Masukkan kode voucher
2. Klik **Cek**
3. Hasil: Valid (diskon berapa, sisa limit) atau Invalid (alasan)

---

## Mengelola Promo

### Toggle Aktif/Nonaktif

- Klik toggle switch di kartu promo untuk aktifkan/nonaktifkan
- Promo nonaktif tidak berlaku di POS

### Statistik per Promo

Setiap promo menampilkan:
- Berapa kali digunakan
- Total penghematan pelanggan
- Sisa limit penggunaan

### Promo Expired

Promo yang melewati tanggal akhir otomatis berstatus "expired" dan tidak berlaku lagi.

---

## Tips Promo

- **Happy Hour** efektif untuk meningkatkan traffic saat jam sepi
- **Voucher** cocok untuk marketing (bagi ke pelanggan via WhatsApp)
- **Beli X Gratis Y** mendorong pelanggan beli lebih banyak
- **Weekend Sale** menarik pelanggan akhir pekan
- **Member only** promo mendorong pelanggan daftar member
- **Set limit** untuk menghindari kerugian berlebihan
- **Monitor penggunaan** — promo yang jarang dipakai mungkin perlu penyesuaian

---

**Selanjutnya:** [Laporan →](10-laporan.md)
