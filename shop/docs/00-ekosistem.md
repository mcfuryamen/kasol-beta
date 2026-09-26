# Ekosistem KASIRSOLO

Peta lengkap seluruh aplikasi dan komponen dalam ekosistem Kasir Solo — PT Mesin Kasir Solo.

---

## 🗺️ Peta Ekosistem

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          KASIRSOLO ECOSYSTEM                                 │
│                            (PT Mesin Kasir Solo)                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   ┌──────────────────┐         ┌──────────────────────────────┐             │
│   │    SHOP          │         │       CONTROL CENTER         │             │
│   │   (marketing)    │────────►│       (owner & tim)           │             │
│   │                  │         │                              │             │
│   │  • Funnel        │         │  • Kelola leads              │             │
│   │  • Katalog       │         │  • Kelola katalog             │             │
│   │  • Form trial    │         │  • Generate lisensi (HMAC)    │             │
│   │  • CTA           │         │  • Verifikasi serial          │             │
│   │                  │         │  • Atur pengaturan             │             │
│   └────────┬─────────┘         │  • Lihat statistik             │             │
│            │                    └──────────────┬───────────────┘             │
│            │                                   │                             │
│            ▼                                   ▼                             │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │                      SUPABASE (Cloud Database) — RENCANA            │   │
│   │                                                                     │   │
│   │   users          → multi-user dengan RLS (owner & tim)             │   │
│   │   businesses     → data bisnis klien                               │   │
│   │   licenses       → serial, device code, expiry, HMAC, status        │   │
│   │   leads          → pendaftar trial dari shop                     │   │
│   │   products       → katalog aplikasi (name, price, category)        │   │
│   │   settings       → pengaturan shop                          │   │
│   │   stats          → kunjungan, analytics                             │   │
│   └──────────────────────┬──────────────────────────────────────────────┘   │
│                          │                                                   │
│    ┌───────────┬─────────┼─────────┬──────────┬──────────┬───────────┐     │
│    ▼           ▼         ▼         ▼          ▼          ▼           ▼     │
│ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌──────────┐      │
│ │ ROSOK  │ │ GEROBAK│ │ RETAIL │ │  ...   │ │ Masa   │ │  Masa    │      │
│ │bengkel │ │gerobak │ │minimark│ │aplikasi │ │  Depan │ │  Depan   │      │
│ │+SPK    │ │ mobile │ │ et    │ │ baru    │ │(aplikasi│ │(aplikasi│      │
│ └───┬────┘ └───┬────┘ └───┬────┘ └────┬────┘ └────┬────┘ └────┬─────┘      │
│     │          │          │           │            │              │          │
│     ▼          ▼          ▼           ▼            ▼              ▼          │
│ ┌─────────────────────────────────────────────────────────────────────────┐  │
│ │                    DEXIE (IndexedDB — Full Offline per-app)             │  │
│ │                                                                         │  │
│ │   transaksi    → data penjualan user                                    │  │
│ │   produk/stok   → data produk & inventori                               │  │
│ │   pelanggan     → data pelanggan                                        │  │
│ │   laporan       → laporan keuangan                                      │  │
│ │   pengaturan    → setting aplikasi lokal                                │  │
│ └─────────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
├──────────────────────────────────────────────────────────────────────────────┤
│  CATATAN PENTING:                                                            │
│                                                                              │
│  • TAHAP AWAL  : localStorage (shop ↔ control) + Dexie (klien)             │
│  • TAHAP LANJUT: Supabase dengan RLS untuk multi-user (owner & tim)          │
│  • LISENSI     : Semua aplikasi klien menggunakan skema HMAC-SHA256 yang    │
│                  sama — direferensikan dari dokumentasi ini                   │
│  • JUMLAH APLIKASI: Tidak terbatas (8 saat ini, bisa ditambah kapan saja)   │
│  • GENERATOR   : Sudah terintegrasi ke Control Center — file terpisah akan dihapus    │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## 📦 Aplikasi dalam Ekosistem

### 1. Shop (`shop/`)

| Aspek | Detail |
|-------|--------|
| **Peran** | Website marketing utama — funnel konversi & lead generator |
| **Tech** | Single HTML, Vanilla JS, Google Fonts |
| **Database** | localStorage (tahap awal), rencana Supabase |
| **Target** | Pengunjung website, calon pelanggan |
| **Link** | `kasirsolo.com` (atau subdomain Vercel) |

**Fungsi utama:**
- Menampilkan katalog aplikasi yang dinamis
- Form pendaftaran trial gratis → menyimpan lead
- Menampilkan statistik & testimoni
- Mengarahkan ke WhatsApp untuk konsultasi

---

### 2. Control Center (`control/`)

| Aspek | Detail |
|-------|--------|
| **Peran** | Pusat kontrol seluruh ekosistem — untuk owner & tim |
| **Tech** | Single HTML SPA, Vanilla JS, localStorage |
| **Database** | localStorage (tahap awal), rencana Supabase + RLS |
| **Target** | Owner PT Mesin Kasir Solo & tim marketing |
| **Link** | Control Center (internal) |

**Fungsi utama:**
- **Dashboard** — statistik kunjungan, leads, aplikasi terlaris
- **Leads** — kelola pendaftar trial (cari, filter, ubah status, export CSV)
- **Katalog** — tambah/edit/hapus aplikasi yang tampil di shop
- **Lisensi** — generate & verifikasi serial untuk klien (HMAC-SHA256)
- **Pengaturan** — kontak, alamat, statistik hero shop

---

### 3. Aplikasi Klien (`rosok/`, `gerobak/`, `retail/`, dll.)

| Aspek | Detail |
|-------|--------|
| **Peran** | Aplikasi kasir yang digunakan oleh pelaku usaha (klien) |
| **Tech** | Single HTML / modular JS, Dexie.js (IndexedDB) |
| **Database** | Dexie.js full offline (data transaksi di device user) |
| **Lisensi** | HMAC-SHA256 device-bound (divalidasi saat aktivasi) |
| **Target** | Klien: pemilik retail, bengkel, gerobak, masjid, dll. |

**Aplikasi saat ini:**

| Nama | Folder | Target User |
|------|--------|-------------|
| Kasir Rosok (Bengkel+SPK) | `rosok/` | Bengkel, SPK, otomotif |
| Kasir Gerobak | `gerobak/` | Pedagang gerobak, mobile |
| Kasir Retail | `retail/` | Toko retail, minimarket |
| Kasir Konveksi | *(akan datang)* | Produsen garmen, sablon |
| Kasir Apotek | *(akan datang)* | Apoteker, farmasi |
| Kasir Klinik | *(akan datang)* | Praktik dokter, klinik |
| Kasir Masjid | *(akan datang)* | Panitia masjid, TPA |
| Kasir Dapur SPPG | *(akan datang)* | Dapur institusi, SPPG |

**Catatan:** Jumlah aplikasi tidak terbatas. Setiap aplikasi baru mengikuti skema yang sama:
1. Salin reference code lisensi dari Control Center
2. Ganti `PRODUCT_PREFIX` dan `PRODUCT_SALT`
3. Simpan data transaksi di Dexie (offline)
4. Deploy ke Vercel (mengikuti **alur 2-mirror** ekosistem — lihat [`DEPLOYMENT.md`](../../DEPLOYMENT.md): folder kerja tidak push langsung ke GitHub; rilis lewat mirror `kasol-beta` (BETA, `*.vercel.app`) lalu `kasol` (LIVE, `*.kasirsolo.com`))

---

### 4. Generator Lisensi (Sudah Terintegrasi)

File `generator-lisensi-universal.html` **sudah digabung ke Control Center**.
Fungsi generate & verifikasi lisensi sekarang tersedia langsung di tab **Lisensi** pada Control Center.
File terpisah akan dihapus.

---

## 🔄 Flow Data Lengkap

```
  PENGUNJUNG                    ADMIN                      KLIEN
     │                           │                          │
     │  1. Buka shop            │                          │
     │     → baca katalog        │                          │
     │                           │                          │
     │  2. Isi form trial        │                          │
     │     → simpan ke           │                          │
     │       localStorage        │                          │
     │                           │                          │
     │                           │  3. Login admin          │
     │                           │     → baca leads         │
     │                           │     → kelola katalog     │
     │                           │     → generate lisensi   │
     │                           │                          │
     │                           │  4. Kirim serial         │
     │                           │     ke klien (via WA)    │
     │                           │                          │
     │                           │                          │  5. Aktivasi
     │                           │                          │     → validasi
     │                           │                          │       HMAC
     │                           │                          │     → simpan
     │                           │                          │       di Dexie
```

---

## 📚 Dokumentasi per Aplikasi

| Aplikasi | Dokumentasi |
|----------|------------|
| Shop | [`shop/docs/`](./shop/docs/) |
| Control Center | [`control/docs/`](./control/docs/) |
| Kasir Rosok | `rosok/README.md` (sudah ada) |
| Kasir Gerobak | `gerobak/README.md` (sudah ada) |
| Kasir Retail | `retail/` (akan dilengkapi) |
| Aplikasi Baru | Ikuti struktur & referensi dari dokumentasi ini |

---

*Last updated: Agustus 2026 — PT Mesin Kasir Solo*
