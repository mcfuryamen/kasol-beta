# POS & Kasir — Tutorial Lengkap

Halaman POS (Point of Sale) adalah inti dari aplikasi kasir. Di sini semua transaksi penjualan dilakukan.

---

## Daftar Isi

1. [Layout 3-Kolom](#1-layout-3-kolom)
2. [Scan Barcode & Cari Produk](#2-scan-barcode--cari-produk)
3. [Mengelola Keranjang](#3-mengelola-keranjang)
4. [Memilih Pelanggan](#4-memilih-pelanggan)
5. [Menggunakan Voucher](#5-menggunakan-voucher)
6. [Numpad Jumbo & Mode](#6-numpad-jumbo--mode)
7. [Proses Pembayaran](#7-proses-pembayaran)
8. [Hold & Recall Order](#8-hold--recall-order)
9. [Struk / Receipt](#9-struk--receipt)
10. [Tips Efisiensi](#10-tips-efisiensi)

---

## 1. Layout 3-Kolom

Halaman POS menggunakan layout 3 kolom yang dioptimalkan untuk kecepatan transaksi:

```
┌─────────────────────┬───────────────────┬──────────────────┐
│                      │                   │                  │
│  KOLOM KIRI (38%)    │  KOLOM TENGAH     │  KOLOM KANAN     │
│  Keranjang Belanja   │  (30%)            │  (32%)           │
│                      │  Opsi Pembayaran  │  Numpad Jumbo    │
│  • Scan barcode      │                   │                  │
│  • Cari produk       │  • 6 metode bayar │  • Tombol besar  │
│  • Filter kategori   │  • Pelanggan      │  • 4 mode input  │
│  • Daftar item       │  • Voucher        │  • Quick amounts │
│  • Qty +/-           │  • Total          │  • Tombol BAYAR  │
│  • Hold/Clear        │  • Quick amounts  │                  │
│                      │                   │                  │
└─────────────────────┴───────────────────┴──────────────────┘
```

### Kolom Kiri — Keranjang Belanja
- Input scan barcode (auto-focus, green indicator)
- Input pencarian produk
- Filter kategori (pill buttons, scroll horizontal)
- Daftar item di keranjang:
  - Nama produk, harga satuan
  - Qty dengan tombol +/- dan input angka
  - Subtotal per item
  - Tombol hapus (×)
- Tombol "Tahan [F2]" dan "Hapus [F5]" di bawah

### Kolom Tengah — Opsi Pembayaran
- 6 metode pembayaran dalam grid 2×3
- Selector pelanggan / member
- Input kode voucher
- Ringkasan keuangan:
  - Subtotal
  - Diskon (jika ada)
  - PPN 11%
  - **TOTAL** (besar, bold, warna primer)
- Quick cash amounts (pembulatan)
- Tombol BAYAR utama

### Kolom Kanan — Numpad Jumbo
- Display mode & angka saat ini
- Tombol angka besar (7-8-9 / 4-5-6 / 1-2-3 / 0-00-C)
- Tombol backspace (⌫)
- 4 mode switching (F6)
- Tombol BAYAR/TERAPKAN (hijau, besar)

---

## 2. Scan Barcode & Cari Produk

### Scan Barcode

1. **Pastikan scanner terhubung** ke komputer/tablet via USB atau Bluetooth
2. Input barcode di POS **auto-focus** saat halaman terbuka
3. **Arahkan scanner** ke barcode produk
4. Scanner otomatis mengetik kode + Enter
5. Produk **langsung masuk** ke keranjang
6. Input otomatis **di-clear** untuk scan berikutnya

**Indikator Scanner:**
- 🟢 **Green pulse** = scanner ready (input sedang fokus)
- ⚫ **Gray** = scanner tidak aktif (input kehilangan fokus)

Tekan **F1** kapan saja untuk re-focus ke input barcode.

### Cari Manual

1. Klik input pencarian (di bawah barcode input)
2. Ketik nama produk, SKU, atau barcode
3. Hasil filter real-time
4. Klik produk untuk menambahkan ke keranjang

### Filter Kategori

Klik pill button kategori untuk filter:
- Semua, Snack, Minuman, Sembako, Rokok, Toiletries, Rumah Tangga, Frozen, Bumbu, Susu, Lainnya

---

## 3. Mengelola Keranjang

### Menambah Produk

- **Scan barcode** → otomatis masuk ke keranjang (qty +1)
- **Klik produk** di grid → masuk ke keranjang (qty +1)
- **Scan ulang** produk yang sama → qty bertambah otomatis

### Mengubah Quantity

- Klik tombol **+** atau **-** di item keranjang
- Atau klik angka qty → ketik manual
- Atau: pilih item → set numpad ke mode **QTY** (F6) → ketik qty → TERAPKAN

### Menghapus Item

- Klik tombol **×** di item keranjang
- Atau tekan **F10** untuk void item terakhir
- Atau tekan **Delete** untuk hapus item terpilih

### Diskon Per Item

1. Pilih item di keranjang (klik)
2. Switch numpad ke mode **DISKON** (F6 2x)
3. Ketik nominal diskon (misal: 500 untuk diskon Rp 500)
4. Tekan TERAPKAN

### Diskon Total Order

1. Pastikan **tidak ada item terpilih**
2. Switch numpad ke mode **DISKON**
3. Ketik nominal diskon total
4. Tekan TERAPKAN

### Clear Keranjang

- Klik tombol "Hapus [F5]" di bawah keranjang
- Atau tekan **F5** — semua item dihapus, diskon reset, pelanggan reset

---

## 4. Memilih Pelanggan

Memilih pelanggan (member) saat transaksi memberikan:
- Harga member otomatis (jika produk punya harga grosir)
- Points loyalty yang terakumulasi
- Riwayat belanja tercatat

### Cara:

1. Klik tombol "Pilih Pelanggan [F7]" di kolom tengah
2. Atau tekan **F7**
3. Modal picker muncul — cari nama atau nomor telepon
4. Klik nama pelanggan untuk memilih
5. Nama & tier badge tampil di selector
6. Untuk membatalkan: klik **×** di sebelah nama

---

## 5. Menggunakan Voucher

1. Di kolom tengah, masukkan **kode voucher** ke input field
2. Klik tombol **Pakai**
3. Jika valid:
   - Diskon otomatis diterapkan
   - Toast notifikasi menunjukkan jumlah diskon
   - Usage counter voucher bertambah
4. Jika tidak valid:
   - Toast error "Voucher tidak valid"
   - Kemungkinan: kode salah, expired, sudah habis limit, belum mencapai min. purchase

---

## 6. Numpad Jumbo & Mode

Numpad di kolom kanan memiliki **4 mode** yang bisa di-switch:

### Mode BAYAR (Hijau) — Default
- Ketik jumlah uang yang diterima dari pelanggan
- Display menunjukkan kembalian secara real-time
- Quick amounts (pembulatan) muncul di atas numpad
- Tekan BAYAR untuk proses

### Mode QTY (Biru)
- Ketik jumlah quantity untuk item terpilih
- Pilih item di keranjang dulu → ketik qty → TERAPKAN

### Mode DISKON (Merah)
- Ketik nominal diskon
- Jika ada item terpilih → diskon per item
- Jika tidak ada item terpilih → diskon total order

### Mode HARGA (Ungu)
- Untuk override harga custom (coming soon / use case khusus)

### Cara Ganti Mode
- Klik label mode di numpad panel
- Atau tekan **F6** untuk cycle ke mode berikutnya
- Urutan: BAYAR → QTY → DISKON → HARGA → BAYAR → ...

### Tombol Numpad

| Tombol | Fungsi |
|--------|--------|
| 0-9 | Input angka |
| 00 | Input double zero (ribuan) |
| ⌫ | Hapus digit terakhir |
| C | Clear input (reset ke 0) |
| BAYAR/TERAPKAN | Proses sesuai mode |

---

## 7. Proses Pembayaran

### Alur Standar (Tunai)

1. Pastikan keranjang berisi item
2. Pilih metode **Tunai** di kolom tengah
3. Di numpad (mode BAYAR), ketik jumlah uang diterima
   - Atau klik quick amount button
4. Tekan tombol hijau **BAYAR [F4]**
5. Jika uang cukup → transaksi berhasil → struk muncul
6. Jika uang kurang → toast error "Uang tidak cukup!"

### Alur Non-Tunai (QRIS/Debit/Kredit/E-Wallet)

1. Pilih metode pembayaran (misal QRIS)
2. Tekan **BAYAR [F4]** atau tombol Bayar di kolom tengah
3. Sistem otomatis menggunakan jumlah total sebagai amount paid
4. Transaksi berhasil → struk muncul

### Alur Tempo (Piutang)

1. **Wajib pilih pelanggan** terlebih dahulu
2. Pilih metode **Tempo**
3. Tekan BAYAR
4. Piutang tercatat di akun pelanggan

### Setelah Pembayaran

- Struk preview otomatis muncul
- Klik **Cetak** untuk print struk (jika printer terhubung)
- Klik **Transaksi Baru** untuk mulai order baru
- Atau tutup modal, keranjang otomatis di-clear

---

## 8. Hold & Recall Order

Fitur ini berguna saat pelanggan ingin mengambil barang tambahan atau ada pelanggan lain yang perlu dilayani dahulu.

### Hold (Tahan Order)

1. Saat ada item di keranjang, tekan **F2** atau klik "Tahan [F2]"
2. Beri label (opsional, misal: "Bu Sari")
3. Order tersimpan, keranjang di-clear
4. Badge jumlah hold muncul di ikon clipboard

### Recall (Panggil Kembali)

1. Tekan **F3** atau klik ikon clipboard
2. Daftar order yang ditahan muncul
3. Klik order untuk memanggilnya kembali
4. Keranjang terisi kembali dengan item yang ditahan
5. Lanjutkan transaksi seperti biasa

> Bisa hold **beberapa order** sekaligus.

---

## 9. Struk / Receipt

### Preview Struk

Setelah pembayaran berhasil, modal struk muncul dengan format thermal:

```
================================
     Kasir Solo - Minimarket
   Jl. Solo Raya No. 1, Surakarta
        0271-123456
================================
No:    INV-20260814-0001
Tgl:   14/08/2026 10:30:25
Kasir: Andi Prasetyo
================================
Indomie Goreng
  3 x Rp 3.500            Rp 10.500
Aqua 600ml
  2 x Rp 3.000            Rp  6.000
================================
Subtotal:                  Rp 16.500
PPN 11%:                   Rp  1.815
--------------------------------
TOTAL:                     Rp 18.315
Tunai:                     Rp 20.000
Kembalian:                 Rp  1.685
================================
  Terima kasih telah berbelanja!
     Powered by Kasir Solo
```

### Mencetak

- Klik tombol **Cetak** di modal struk
- Atau tekan **F9** untuk cetak struk terakhir (tanpa membuka modal)
- Jika **auto-print** aktif di Settings, struk langsung tercetak setelah pembayaran

> Lihat [Printer](11-printer.md) untuk setup printer.

---

## 10. Tips Efisiensi

### Untuk Transaksi Cepat

1. **Scan → BAYAR** — Paling cepat: scan semua barang → F4 → ketik uang → BAYAR
2. **Quick amounts** — Jangan ketik, klik nominal yang sudah di-rounded
3. **Hold banyak** — Kalau ada antrian, hold semua, proses satu per satu
4. **Numpad mode** — Jangan buka modal, langsung pakai numpad untuk input uang

### Shortcut Paling Penting

| Shortcut | Kapan Dipakai |
|----------|---------------|
| `F1` | Setelah scan gagal, re-focus input |
| `F4` | Setiap mau bayar |
| `F5` | Batal transaksi, mulai baru |
| `F2` | Pelanggan mau ambil barang lagi |
| `Esc` | Tutup modal apapun yang terbuka |

### Troubleshooting

| Masalah | Solusi |
|---------|--------|
| Barcode tidak terbaca | Cek koneksi scanner, tekan F1 untuk re-focus |
| "Buka kas terlebih dahulu" | Buka kas di halaman Keuangan atau modal yang muncul |
| Numpad tidak input | Pastikan mode yang benar (F6 untuk ganti mode) |
| Struk tidak tercetak | Cek Settings → Printer → Test Print |

---

**Selanjutnya:** [Buka/Tutup Kas →](03-buka-tutup-kas.md)
