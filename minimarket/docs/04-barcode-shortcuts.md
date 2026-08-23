# Barcode Scanner & Keyboard Shortcuts

Panduan lengkap optimasi barcode scanning dan 16 keyboard shortcuts untuk operasional kasir yang super cepat.

---

## Barcode Scanner

### Hardware yang Didukung

| Tipe | Koneksi | Catatan |
|------|---------|---------|
| USB Barcode Scanner | USB HID | Plug & play, paling direkomendasikan |
| Bluetooth Scanner | Bluetooth | Cocok untuk tablet/mobile |
| Camera-based Scanner | Webcam/Kamera | Butuh library tambahan (belum built-in) |

> Scanner USB HID bekerja sebagai keyboard — mengirim karakter barcode + Enter secara otomatis.

### Setup Scanner

1. **Hubungkan scanner** ke komputer/tablet
2. **Buka halaman POS** — input barcode otomatis focus
3. **Arahkan scanner** ke barcode produk
4. Scanner mengirim kode → Enter → produk masuk keranjang
5. Input otomatis **di-clear** → siap scan berikutnya

### Indikator Scanner

Di bagian atas kolom kiri POS, terdapat input barcode dengan indikator:

- 🟢 **Hijau (berkedip)** — Scanner ready, input fokus
- ⚫ **Abu-abu** — Scanner tidak aktif, input tidak fokus

Tekan **F1** untuk mengaktifkan kembali (re-focus).

### Alur Scan

```
Scanner → Input Field → Enter → Cari Barcode
                                    │
                          ┌─────────┴─────────┐
                          │                     │
                    Ditemukan ✅            Tidak Ditemukan ❌
                          │                     │
                   Tambah ke keranjang     Jadikan search query
                   Toast: "Produk          Toast: "Tidak ditemukan
                    ditambahkan"            barcode: xxx"
                          │                     │
                   Clear input              Input tetap
                   Ready scan lagi          (bisa cari manual)
```

### Manual Entry

Jika scanner tidak tersedia:
1. Tekan **F1** atau klik input barcode
2. Ketik nomor barcode secara manual (misal: `8886008101053`)
3. Tekan **Enter**
4. Produk ditambahkan ke keranjang

### Tips Barcode

- **Atur suffix scanner** ke "Enter" (CR/LF) — kebanyakan scanner sudah default begini
- **Jarak scan** optimal: 5-15 cm dari barcode
- Jika barcode rusak/pudar, gunakan pencarian manual
- **Scan berturutan** — tidak perlu menunggu, scan secepatnya
- Setiap scan yang berhasil pada produk yang sama = qty +1

---

## Keyboard Shortcuts

### Daftar Lengkap 16 Shortcuts

| Shortcut | Aksi | Kapan Dipakai |
|----------|------|---------------|
| **F1** | Fokus input barcode/cari | Saat scanner kehilangan fokus |
| **F2** | Tahan order (Hold) | Pelanggan mau ambil barang lagi |
| **F3** | Tampilkan order ditahan | Recall order yang di-hold |
| **F4** | Bayar / Proses pembayaran | Setiap mau bayar |
| **F5** | Hapus keranjang / Transaksi baru | Batal atau mulai baru |
| **F6** | Toggle mode numpad | Ganti BAYAR/QTY/DISKON/HARGA |
| **F7** | Pilih pelanggan | Pilih member untuk transaksi |
| **F8** | Buka cash drawer (visual) | Perlu buka laci kas |
| **F9** | Cetak struk terakhir | Cetak ulang struk |
| **F10** | Void item terakhir | Salah scan, hapus item terakhir |
| **F12** | Toggle fullscreen POS | Layar penuh untuk kasir |
| **Esc** | Tutup modal yang terbuka | Batal dari modal apapun |
| **Enter** | Konfirmasi aksi saat ini | Konfirmasi di luar input field |
| **+** | Tambah qty item terpilih | Cepat naikkan jumlah |
| **-** | Kurangi qty item terpilih | Kurangi jumlah |
| **Delete** | Hapus item terpilih | Hapus dari keranjang |
| **?** | Panel bantuan shortcut | Lihat semua shortcut |

### Panel Bantuan Shortcut

Tekan **?** (tanda tanya) di POS untuk membuka panel bantuan yang menampilkan semua shortcut dalam modal overlay.

- Panel bisa dibuka/ditutup dengan **?**
- Atau tutup dengan **Esc**
- Hanya tampil di halaman POS

### Shortcut pada Tombol

Banyak tombol di UI menampilkan hint shortcut:

```
[Tahan F2]    [Hapus F5]    [Bayar F4]    [Pilih Pelanggan F7]
```

Ini membantu kasir baru menghafalkan shortcut.

### Alur Transaksi Tercepat

Menggunakan keyboard only, transaksi bisa selesai dalam hitungan detik:

```
F1 → [Scan Barcode] → [Scan Barcode] → [Scan Barcode]
   → F4 (Bayar)
   → [Ketik Uang di Numpad]
   → BAYAR (Enter/klik)
   → F9 (cetak struk)
   → Done! Transaksi baru otomatis
```

### Shortcut Tidak Aktif Kapan?

- Saat mengetik di **input field** — Enter, +, -, Delete, ? tidak aktif
- **F-keys** (F1-F12) selalu aktif, bahkan saat di input field
- **Esc** selalu aktif
- Shortcuts hanya aktif di **halaman POS**

---

## Kombinasi Umum

### Scan → Bayar Tunai

```
F1 (focus) → Scan → Scan → Scan → F4 (bayar) → numpad amount → BAYAR
```

### Scan → Ubah Qty → Bayar

```
Scan → klik item → F6 (mode QTY) → numpad qty → TERAPKAN → F6 (mode BAYAR) → F4
```

### Hold → Layani Pelanggan Lain → Recall

```
[transaksi A] → F2 (hold) → [transaksi B selesai] → F3 (recall A) → F4 (bayar)
```

### Void Item Salah

```
F10 (void terakhir) → atau klik item → Delete (hapus)
```

### Diskon

```
klik item → F6 F6 (mode DISKON) → numpad amount → TERAPKAN → F6 (mode BAYAR)
```

---

**Selanjutnya:** [Produk & Stok →](05-produk-stok.md)
