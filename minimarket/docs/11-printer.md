# Printer — Setup & Penggunaan

Panduan setup printer thermal, cetak struk, dan konfigurasi printer.

---

## Printer yang Didukung

| Tipe Printer | Paper Size | Koneksi | Keterangan |
|-------------|------------|---------|------------|
| **Thermal 58mm** | 58mm (2.25") | USB/Bluetooth | Paling umum untuk minimarket kecil |
| **Thermal 80mm** | 80mm (3.15") | USB/Network | Lebih lebar, lebih jelas |
| **A4 (Biasa)** | A4 | USB/Network | Printer biasa untuk laporan |

---

## Konfigurasi Printer

### Mengakses Pengaturan Printer

1. Buka sidebar → **Pengaturan**
2. Klik tab **Printer**

### Opsi Konfigurasi

| Setting | Pilihan | Default |
|---------|---------|---------|
| **Ukuran Kertas** | 58mm / 80mm / A4 | 58mm |
| **Tipe Koneksi** | USB / Bluetooth / Network | USB |
| **IP Address** | Input IP (untuk Network) | - |
| **Auto Print** | Ya / Tidak | Tidak |
| **Jumlah Salinan** | 1-5 | 1 |
| **Print Barcode** | Ya / Tidak | Tidak |
| **Teks Header** | Custom text | "Kasir Solo - Minimarket" |
| **Teks Footer** | Custom text | "Terima kasih telah berbelanja!" |

### Cara Mengubah

1. Ubah setting yang diinginkan
2. Perubahan otomatis tersimpan ke browser (localStorage)
3. Klik **Test Print** untuk menguji

---

## Mencetak Struk

### Otomatis (Auto Print)

Jika **Auto Print** aktif di pengaturan:
1. Setelah pembayaran berhasil di POS
2. Struk otomatis dikirim ke printer
3. Printer langsung mencetak

### Manual

1. Setelah pembayaran, modal struk muncul
2. Klik tombol **Cetak**
3. Window print browser terbuka
4. Pilih printer → Klik Print

### Cetak Ulang

- Tekan **F9** di POS untuk mencetak struk terakhir
- Atau buka modal struk dari riwayat transaksi

---

## Format Struk

### Struk 58mm (32 karakter per baris)

```
================================
   Kasir Solo - Minimarket
 Jl. Solo Raya No. 1, Surakarta
       0271-123456
================================
No:   INV-20260814-0001
Tgl:  14/08/2026 10:30:25
Kasir: Andi Prasetyo
================================
Indomie Goreng
  3 x Rp 3.500        Rp 10.500
Aqua 600ml
  2 x Rp 3.000         Rp 6.000
Gudang Garam Surya
  1 x Rp 28.000       Rp 28.000
================================
Subtotal:              Rp 44.500
PPN 11%:                Rp 4.895
--------------------------------
TOTAL:                 Rp 49.395
Tunai:                 Rp 50.000
Kembalian:                Rp 605
================================
Terima kasih telah berbelanja!
    Powered by Kasir Solo
```

### Struk 80mm (48 karakter per baris)

Format lebih lebar, informasi lebih lengkap per baris.

### Elemen Struk

| Bagian | Isi |
|--------|-----|
| **Header** | Nama toko, alamat, telepon |
| **Info Transaksi** | No. order, tanggal, kasir, member |
| **Item** | Nama produk, qty × harga, subtotal per item |
| **Diskon Item** | Jika ada diskon per item |
| **Footer Keuangan** | Subtotal, diskon total, PPN, TOTAL |
| **Pembayaran** | Metode, jumlah bayar, kembalian |
| **Footer** | Teks footer custom, branding |

---

## Test Print

Untuk menguji koneksi printer:

1. Buka **Pengaturan** → tab **Printer**
2. Klik tombol **Test Print**
3. Printer akan mencetak:

```
== TEST PRINT ==
Kasir Solo - Minimarket
Printer OK!
================
```

4. Jika berhasil → printer terhubung dengan benar
5. Jika gagal → cek koneksi dan driver printer

---

## Troubleshooting Printer

| Masalah | Solusi |
|---------|--------|
| Printer tidak terdeteksi | Cek koneksi USB/Bluetooth, restart printer |
| Struk kosong/blank | Cek kertas thermal (sisi yang benar menghadap print head) |
| Karakter acak | Pastikan paper size setting sesuai printer |
| Struk terpotong | Cek paper width setting (58mm vs 80mm) |
| Auto print tidak jalan | Pastikan toggle "Auto Print" aktif di Settings |
| Browser block popup | Izinkan popup untuk localhost di browser settings |
| Tulisan pudar | Ganti roll kertas thermal, periksa print head |

### Tips Maintenance Printer Thermal

- **Bersihkan print head** secara berkala dengan alkohol
- **Simpan kertas thermal** di tempat sejuk, kering, terhindar sinar matahari
- **Jangan tarik kertas saat printing** — bisa merusak motor
- **Matikan printer** saat tidak digunakan
- **Gunakan kertas berkualitas** — kertas murah bisa meninggalkan residu

---

## Mode Browser (Fallback)

Saat tidak ada printer thermal terhubung, sistem menggunakan browser print:

1. Window baru terbuka dengan format struk
2. Dialog print browser muncul
3. Pilih printer yang tersedia (bisa PDF, atau printer A4)
4. Klik Print

Ini berguna untuk:
- Testing tanpa printer thermal
- Mencetak ke PDF untuk arsip
- Mencetak di printer biasa (A4) jika diperlukan

---

**Selanjutnya:** [Pengaturan & Deploy →](12-pengaturan-deploy.md)
