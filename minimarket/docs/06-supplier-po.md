# Supplier & Purchase Order

Panduan mengelola supplier, membuat purchase order, dan menerima barang.

---

## Manajemen Supplier

### Halaman Supplier

Akses via sidebar: **Supplier**. Menampilkan daftar supplier dengan:
- Nama, kontak, alamat
- Jumlah PO
- Status (aktif/nonaktif)

### 6 Supplier Demo

| Supplier | Produk Utama | Kontak |
|----------|-------------|--------|
| PT Indofood CBP | Indomie, Supermie, Bimoli | Jakarta |
| Wings Group | Mie Sedaap, So Klin, Wings | Surabaya |
| PT Unilever Indonesia | Lifebuoy, Rinso, Sunlight | Jakarta |
| PT Mayora Indah | Kopiko, Beng-Beng, Energen | Tangerang |
| PT Garudafood | Kacang Garuda, Gery, Chocolatos | Jakarta |
| PT ABC President | Kecap ABC, Sardines, Mr. Pancake | Jakarta |

### Menambah Supplier

1. Klik **"+ Tambah Supplier"**
2. Isi form:
   - Nama perusahaan
   - Nama kontak (salesperson)
   - Telepon / WhatsApp
   - Email
   - Alamat
   - Catatan (terms pembayaran, dll)
3. Klik **Simpan**

---

## Purchase Order (PO)

### Konsep PO

Purchase Order adalah dokumen permintaan pembelian barang ke supplier:

```
Buat PO (Draft) → Approve → Kirim ke Supplier → Terima Barang → Selesai
```

### Status PO

| Status | Warna | Keterangan |
|--------|-------|------------|
| Draft | Abu | PO baru dibuat, belum final |
| Approved | Biru | Disetujui, siap dikirim ke supplier |
| Ordered | Kuning | Sudah dikirim ke supplier, menunggu barang |
| Received | Hijau | Barang sudah diterima |
| Closed | Abu gelap | PO selesai/ditutup |

### Membuat PO Baru

1. Di halaman Supplier, klik **"+ Buat PO"**
2. Pilih supplier
3. Tambahkan item:
   - Pilih produk
   - Qty yang dipesan
   - Harga beli per unit (otomatis terisi dari data produk)
4. Review total PO
5. Klik **Simpan** (status: Draft)

### Approve PO

1. Buka PO dengan status Draft
2. Review item dan total
3. Klik **Approve** (hanya Owner/Manager)
4. Status berubah ke "Approved"

### Menerima Barang

1. Saat barang datang, buka PO terkait
2. Klik **Terima Barang**
3. Masukkan qty aktual yang diterima per item:
   - Bisa sama dengan qty order
   - Bisa kurang (partial receiving)
4. Klik **Konfirmasi Penerimaan**
5. Stok otomatis bertambah
6. Status PO: "Received"

### Retur ke Supplier

Jika ada barang rusak/salah dari supplier:
1. Buka PO terkait
2. Klik **Retur**
3. Pilih item dan qty yang diretur
4. Masukkan alasan
5. Stok otomatis berkurang
6. Record retur tersimpan

---

## Tips Supplier

- **Simpan kontak WhatsApp** salesperson di catatan supplier untuk komunikasi cepat
- **Buat PO teratur** — gunakan data laporan stok untuk menentukan qty order
- **Track lead time** — berapa hari dari order sampai barang datang
- **Bandingkan harga** antar supplier untuk produk yang sama
- **Cek kualitas** saat receiving — reject barang rusak di tempat

---

**Selanjutnya:** [Pelanggan & Loyalty →](07-pelanggan-loyalty.md)
