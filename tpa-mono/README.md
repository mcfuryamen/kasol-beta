# 📖 Kasir Solo - TPA

**Aplikasi Manajemen TPA/TPQ/Madrasah Diniyah**

Dikembangkan oleh **PT Mesin Kasir Solo** | [kasirsolo.app](https://kasirsolo.app) | WA: 08816566935

---

## 🏗️ Arsitektur

Monorepo dengan **4 aplikasi** dan 1 shared package:

```
kasir-solo-tpa/
├── apps/
│   ├── portal/    → Website Portofolio Institusi + Login Gate (port 3000)
│   ├── admin/     → Dashboard Admin/Kepala TPA (port 3001)
│   ├── guru/      → Dashboard Ustadz/Guru (port 3002)
│   └── wali/      → Portal Wali Santri (port 3003)
├── packages/
│   └── shared/    → UI Components, Hooks, Utils, Types, DB, Seed Data, Tutorial
└── supabase/      → Database Schema & Migrations
```

## 🛠️ Tech Stack

- **Frontend:** Vite + Preact + TypeScript
- **Styling:** Tailwind CSS
- **Database:** Supabase (PostgreSQL + Auth + Realtime)
- **Offline:** RxDB (IndexedDB) + Sync Engine
- **PWA:** vite-plugin-pwa
- **Architecture:** Atomic Design + Data/Logic/Visual separation
- **i18n:** Indonesian + English
- **Monorepo:** pnpm workspaces + Turborepo

## 📱 4 Aplikasi

### 🕌 Portal (Website Institusi)
Website portofolio resmi TPA/Yayasan:
- Hero + statistik live dari database
- Profil: Visi & Misi lembaga
- 7 Pilar Kurikulum lengkap
- Tim Pengajar (otomatis dari DB)
- Info Pendaftaran, Jadwal, Kegiatan
- Portal login terpusat ke 3 dashboard
- Kontak & informasi yayasan

### 👑 Admin / Kepala TPA
- Dashboard ringkasan (santri, guru, kelas, keuangan)
- CRUD Santri, Ustadz, Wali, Kelas, Jadwal
- Kurikulum immersif (7 kategori, 60+ materi)
- Absensi, Hafalan, Iqro
- Pembayaran SPP, Kas, Laporan
- Cetak: Rapor, Sertifikat, Kartu Santri, Kwitansi
- Proyek Pengembangan, Multi Lokasi
- Modul Bantuan (11 tutorial langkah-langkah)

### 👳 Ustadz / Pengajar
- Dashboard kelas & jadwal hari ini
- Input Absensi touch-friendly
- Input Hafalan (surat + ayat + 5 grade)
- Input Iqro (jilid + halaman + 3 grade)
- Lihat Kurikulum & Materi
- Modul Bantuan (6 tutorial)

### 👨‍👩‍👧 Wali Santri
- Dashboard anak (multi anak)
- Progres Hafalan & Iqro real-time
- Rekap Kehadiran
- Status Pembayaran SPP
- Modul Bantuan (5 tutorial)

## 📊 Data

### Database (25+ tabel)
Schema lengkap di `supabase/schema.sql` dengan RLS, triggers, indexes.

### Seed Data
- 1 lokasi default + 7 kategori kurikulum + 60+ materi
- 4 jenis SPP + 2 wali + 2 guru + 5 santri demo
- 2 kelas + jadwal + notifikasi

### Kurikulum 7 Pilar
1. **Iqro / Baca Tulis** — 6 materi (huruf hijaiyah → mad thobi'i)
2. **Hafalan Al-Quran** — 14 materi (Al-Fatihah → At-Takasur)
3. **Tajwid** — 8 materi (nun mati → idzhar)
4. **Fiqh Ibadah** — 7 materi (thaharah → zakat fitrah)
5. **Akhlak & Adab** — 8 materi (adab makan → sabar & syukur)
6. **Doa Harian** — 9 materi (doa makan → doa kendaraan)
7. **Sirah Nabi** — 8 materi (kelahiran → khulafaur rasyidin)

## 🚀 Quick Start

```bash
pnpm install
cp .env.example .env  # Set Supabase credentials
pnpm dev              # Run all 4 apps
pnpm dev:portal       # Portal only (port 3000)
pnpm dev:admin        # Admin only (port 3001)
pnpm dev:guru         # Guru only (port 3002)
pnpm dev:wali         # Wali only (port 3003)
```

## 📄 Lisensi

UNLICENSED - Hak cipta PT Mesin Kasir Solo
