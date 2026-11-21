# Smoke Test E2E — Kasir Solo Masjid (live browser)

**Tanggal:** 20 November 2026
**Target:** `http://localhost:8095/adm/` (app admin) + `http://localhost:8095/web-masjid/` (situs publik)
**Metode:** Chrome DevTools MCP — klik nyata di UI, bukan pemanggilan fungsi internal
**Viewport:** 375×667 (mobile) + 320×640
**Data uji:** 1 transaksi `SMOKE-TEST-2026-11-20` (Rp12.345) — **dibuat lalu dihapus**, data asli dipulihkan 100%

## Hasil: LULUS SEMUA (14/14 skenario)

| # | Skenario | Hasil | Bukti |
|---|---|---|---|
| A | Boot aplikasi | ✅ | Judul "Kasir Solo - Masjid", 452 elemen, 74 tombol, view Beranda aktif, tidak ada gate yang menghalangi |
| B | Navigasi 4 tab (Beranda/Kas/Kegiatan/Laporan) | ✅ | Semua view `.active` berganti, isi ter-render (dashboard 1.021 teks, kas 395, kegiatan 70, laporan 1.091) |
| C | Menu ☰ "Lainnya" | ✅ | Sheet terbuka, 4 item (Jamaah/Inventaris/Website/Pengaturan), Escape menutup |
| D | Validasi form transaksi | ✅ | Jumlah dikosongkan → ditolak: "Jumlah harus lebih dari 0" (validasi hidup) |
| E | Simpan transaksi | ✅ | Toast "Transaksi tersimpan", modal tertutup, jumlah 4 → **5**, item tampil "+Rp12.345 · 20 Nov, 08.05" |
| F | Detail transaksi | ✅ | Judul "Detail Transaksi", tombol Tambah Bukti Foto / Hapus Transaksi / Cetak ada |
| G | Hapus transaksi | ✅ | Konfirmasi "Hapus Transaksi?" → "Ya, Hapus", toast "Transaksi dihapus", jumlah 5 → **4**, saldo kembali **Rp700.000** |
| H | Pencarian Jamaah | ✅ | Cari "Suherman" → 3 item jadi 1; dikosongkan → balik 3 |
| I | Backup data | ✅ | Toast "Backup berhasil diunduh" |
| J | Laporan 3 periode | ✅ | Mingguan (16–22 Nov) / Bulanan (Nov 2026) / Custom → isi berubah, `aria-selected="true"` di tab aktif, tombol cetak ada |
| K | 4 halaman dari menu | ✅ | Jamaah / Inventaris / Website / Pengaturan terbuka, semua berisi konten (21–136 elemen) |
| L | Persistensi setelah reload | ✅ | Saldo Rp700.000, 4 transaksi, **tidak ada sisa data uji** |
| M | Offline (reload tanpa internet) | ✅ | 447 elemen, 72 tombol, CSS & JS dari cache SW v1.5.7, saldo terbaca, navigasi + modal tetap jalan |
| N | Situs publik | ✅ | "Masjid Al-Ikhlas — Website Resmi", alamat & jadwal ter-load (7 NOV Kajian Rutin), menu mobile toggle (`aria-expanded`), smooth scroll ke #jadwal, `<main>` = 1, canonical ada, 0 error konsol |

## Konsol
- App admin: **0 error / 0 warning**. Satu-satunya pesan adalah `ERR_INTERNET_DISCONNECTED` ×4 — memang terjadi saat uji offline (app mencoba cek gate/session ke server). Fitur lokal tetap normal.
- Situs publik: **0 error / 0 warning**.

## Catatan (bukan kegagalan)
1. **Saat offline app tetap mencoba menghubungi server** (cek gate & session). Hasilnya 4 error jaringan di konsolmeskipun tidak merusak apa pun. Kalau ingin lebih bersih, bungkus fetch gate dengan penanganan "offline" agar diam-diam. (Perubahan kecil, tapi belum dikerjakan — menunggu perintah.)
2. `/m/masjid` di dev server **mengarah ke domain TLD asli** (mis. `tes.masjidgumiring.my.id`) sehingga tidak bisa dibuka di lingkungan lokal — itu perilaku yang disengaja (redirect slug → domain aktif), bukan bug. Untuk uji lokal dipakai `/web-masjid/`.
3. Validasi form terbukti bekerja: percobaan pertama gagal karena field yang diklik adalah "Banyaknya" (bukan "Jumlah") — aplikasi menolak dengan pesan jelas, bukan menyimpan data salah.

## PerUbahan pada data
Tidak ada data permanen yang berubah: transaksi uji sudah dihapus, saldo kembali Rp700.000, jumlah transaksi kembali 4, jumlah jamaah kembali 3. Backup file yang terunduh ada di folder unduhan browser (berkas lokal, tidak dikirim ke server mana pun).
