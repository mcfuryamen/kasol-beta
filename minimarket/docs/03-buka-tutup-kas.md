# Buka/Tutup Kas — Tutorial Manajemen Sesi Kas

Sistem buka/tutup kas memastikan setiap shift kasir tercatat dengan akurat. **Membuka kas adalah WAJIB** sebelum bisa menggunakan fitur POS.

---

## Daftar Isi

1. [Konsep Buka/Tutup Kas](#1-konsep-bukatutup-kas)
2. [Membuka Kas (Awal Shift)](#2-membuka-kas-awal-shift)
3. [Selama Shift Aktif](#3-selama-shift-aktif)
4. [Menutup Kas (Akhir Shift)](#4-menutup-kas-akhir-shift)
5. [Hitung Denominasi](#5-hitung-denominasi)
6. [Menangani Selisih](#6-menangani-selisih)
7. [Riwayat Shift](#7-riwayat-shift)

---

## 1. Konsep Buka/Tutup Kas

### Alur Shift

```
Login → Buka Kas (modal awal) → Transaksi → Tutup Kas (hitung aktual) → Logout
         │                                          │
         │  ┌──────────────────────────┐            │
         └──│ SHIFT AKTIF              │────────────┘
             │ • Transaksi POS         │
             │ • Uang masuk            │
             │ • Uang keluar           │
             │ • Void / retur          │
             └──────────────────────────┘
```

### Mengapa Wajib?

- **Akuntabilitas** — Setiap kasir bertanggung jawab atas uang di laci
- **Rekonsiliasi** — Membandingkan kas seharusnya vs kas aktual
- **Audit trail** — Riwayat siapa buka/tutup kapan
- **Loss prevention** — Deteksi defisit/surplus kas

---

## 2. Membuka Kas (Awal Shift)

### Kapan Muncul?

Modal buka kas muncul otomatis saat:
- Anda mengakses halaman **POS/Kasir** dan belum ada shift aktif
- Anda klik tombol **"Buka Kas"** di halaman Keuangan

### Langkah-Langkah

1. **Hitung uang fisik** di laci kas terlebih dahulu
2. Modal "Buka Kas" akan muncul dengan:
   - Display angka modal awal (default: Rp 0)
   - Quick amount buttons: Rp 100K, 200K, 300K, 500K, 1M
   - Numpad untuk input manual
   - Field catatan (opsional)

3. **Masukkan modal awal:**
   - Klik quick amount (misal Rp 300.000)
   - Atau ketik manual di numpad: 3-0-0-0-0-0
   
4. **Tambahkan catatan** (opsional):
   - "Serah terima dari shift pagi"
   - "Modal dari owner Rp 300rb"

5. Klik tombol **"Buka Kas"**

6. Sistem akan:
   - Membuat record shift baru
   - Menampilkan indikator 🟢 "Kas Aktif" di header
   - Mengizinkan akses ke halaman POS

### Indikator di Header

Setelah buka kas, di header akan muncul:

```
🟢 Kas Aktif    (green badge, pulsing dot)
```

Saat kas tutup:
```
🔴 Kas Tutup    (red badge)
```

---

## 3. Selama Shift Aktif

Selama shift aktif, sistem mencatat:

| Aktivitas | Dampak ke Kas |
|-----------|---------------|
| Penjualan tunai | + (menambah kas) |
| Uang masuk (setoran) | + (menambah kas) |
| Uang keluar (operasional) | - (mengurangi kas) |
| Void transaksi | - (mengurangi kas) |
| Retur | - (mengurangi kas) |
| Penjualan non-tunai | Tidak mempengaruhi kas fisik |

### Melihat Status Kas Saat Ini

Buka halaman **Keuangan** → tab **Kas Aktif** untuk melihat:
- Modal awal
- Total penjualan tunai
- Total pengeluaran
- Saldo kas saat ini (estimasi)
- Transaksi hari ini

### Mencatat Uang Masuk/Keluar

Lihat panduan lengkap di [Keuangan](08-keuangan.md).

---

## 4. Menutup Kas (Akhir Shift)

### Langkah-Langkah

1. Buka halaman **Keuangan** atau klik **"Tutup Kas"**
2. Modal "Tutup Kas" muncul dengan:

#### Summary Shift

```
┌────────────────────────────────────────┐
│           TUTUP KAS                     │
│  Dibuka: 14/08/2026 08:00:15           │
│                                         │
│  ┌──────────┐  ┌──────────┐            │
│  │Modal Awal│  │Penjualan │            │
│  │Rp 300.000│  │Rp 850.000│            │
│  └──────────┘  └──────────┘            │
│  ┌──────────┐  ┌──────────┐            │
│  │Pengeluarn│  │Ekspektasi│            │
│  │-Rp50.000 │  │Rp1.100.00│            │
│  └──────────┘  └──────────┘            │
│                                         │
│  [Hitung Denominasi: Aktif/Nonaktif]   │
│                                         │
│  Kas Aktual: [input / denominasi]      │
│                                         │
│  Selisih: ±Rp 0 (Sesuai/Surplus/Defisit)│
│                                         │
│  Catatan: [________________]            │
│                                         │
│  [Batal]              [Tutup Kas]       │
└────────────────────────────────────────┘
```

3. **Masukkan kas aktual** — jumlah uang fisik di laci:
   - Gunakan numpad langsung (ketik total)
   - Atau aktifkan **Hitung Denominasi** untuk menghitung per pecahan

4. **Periksa selisih:**
   - ✅ **Sesuai** (hijau) — selisih Rp 0
   - 📈 **Surplus** (biru) — kas lebih dari ekspektasi
   - 📉 **Defisit** (merah) — kas kurang dari ekspektasi

5. **Tambahkan catatan** (opsional):
   - "Selisih karena kembalian kurang Rp 500"
   - "Surplus dari customer membayar lebih"

6. Klik **"Tutup Kas"**

7. Sistem akan:
   - Mencatat closing balance dan selisih
   - Mengubah status shift menjadi "closed"
   - Menampilkan indikator 🔴 "Kas Tutup"
   - Memblokir akses POS hingga shift baru dibuka

---

## 5. Hitung Denominasi

Fitur hitung denominasi membantu menghitung uang fisik per pecahan:

### Cara Menggunakan

1. Di modal Tutup Kas, klik toggle **"Hitung Denominasi"** → Aktif
2. Tampil daftar pecahan uang:

| Pecahan | Jumlah Lembar/Koin | Total |
|---------|-------------------|-------|
| Rp 100.000 | [___] | Rp 0 |
| Rp 50.000 | [___] | Rp 0 |
| Rp 20.000 | [___] | Rp 0 |
| Rp 10.000 | [___] | Rp 0 |
| Rp 5.000 | [___] | Rp 0 |
| Rp 2.000 | [___] | Rp 0 |
| Rp 1.000 | [___] | Rp 0 |
| Rp 500 | [___] | Rp 0 |
| **TOTAL** | | **Rp 0** |

3. Masukkan jumlah lembar/koin untuk setiap pecahan
4. Total otomatis terhitung
5. Total denominasi langsung jadi kas aktual

### Contoh

Anda hitung di laci:
- 5 lembar Rp 100.000 = Rp 500.000
- 8 lembar Rp 50.000 = Rp 400.000
- 3 lembar Rp 20.000 = Rp 60.000
- 10 lembar Rp 10.000 = Rp 100.000
- 4 lembar Rp 5.000 = Rp 20.000
- 5 koin Rp 1.000 = Rp 5.000
- **Total: Rp 1.085.000**

---

## 6. Menangani Selisih

### Selisih Sesuai (Rp 0)

Ideal. Kas aktual = kas ekspektasi. Tidak ada tindakan diperlukan.

### Surplus (Kas Lebih)

Kemungkinan penyebab:
- Pelanggan membayar lebih dan tidak minta kembalian
- Setoran tambahan belum dicatat
- Kesalahan input harga (lebih tinggi dari seharusnya)

**Tindakan:** Catat di notes, investigasi jika sering terjadi.

### Defisit (Kas Kurang)

Kemungkinan penyebab:
- Kembalian berlebih
- Pengeluaran kas tidak dicatat
- Kesalahan hitung
- Kehilangan (theft)

**Tindakan:**
- Catat di notes dengan detail
- Review jika defisit > Rp 10.000
- Investigasi jika defisit berulang di shift yang sama

---

## 7. Riwayat Shift

Buka halaman **Keuangan** → tab **Riwayat Shift** untuk melihat:

- Semua shift sebelumnya (terbaru di atas)
- Per shift: waktu buka, waktu tutup, siapa yang buka/tutup
- Modal awal, kas aktual, selisih
- Catatan shift

Ini berguna untuk:
- Audit oleh owner/manager
- Investigasi selisih
- Rekap kas harian/mingguan

---

**Selanjutnya:** [Barcode & Shortcuts →](04-barcode-shortcuts.md)
