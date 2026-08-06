# Ekosistem KASIRSOLO — Perspektif Admin

Panduan lengkap arsitektur, data flow, dan integrasi seluruh komponen ekosistem dari sudut pandang admin dashboard.

> ⚠️ **Arah Arsitektur Cloud (2026):** Ekosistem berkembang dalam **3 lapisan** —
> **Meta/CRM** (Supabase: pelanggan, lisensi **generate + validasi**, banner),
> **Data Bisnis** (transaksi, masa depan), dan **Offline** (Dexie). Sistem lisensi
> akan melakukan **generate + validasi via Supabase**, menggantikan pendekatan
> offline saat ini (yang masih dipakai karena `admin/` belum sinkron ke Supabase).
> Rujukan roadmap menyeluruh: **`../CLOUD-ROADMAP.md`**.

---

## 🗺️ Peta Ekosistem

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         KASIRSOLO ECOSYSTEM                                 │
│                            (PT Mesin Kasir Solo)                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   ┌──────────────────┐         ┌──────────────────────────────┐             │
│   │    LANDING       │         │       ADMIN DASHBOARD         │             │
│   │   (marketing)    │◄────────│       (owner & tim)           │             │
│   │                  │         │                              │             │
│   │  • Funnel        │         │  • Kelola leads              │             │
│   │  • Katalog       │         │  • Kelola katalog             │             │
│   │  • Form trial    │         │  • Generate lisensi (HMAC)    │             │
│   │  • CTA           │         │  • Verifikasi serial          │             │
│   │                  │         │  • Atur pengaturan             │             │
│   └────────┬─────────┘         └──────────────┬───────────────┘             │
│            │                                   │                             │
│            │                                   │                             │
│            ▼                                   ▼                             │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │                      SUPABASE (Cloud Database) — RENCANA            │   │
│   │                                                                     │   │
│   │   users          → multi-user dengan RLS (owner & tim)             │   │
│   │   businesses     → data bisnis klien                               │   │
│   │   licenses       → serial, device code, expiry, HMAC, status        │   │
│   │   leads          → pendaftar trial dari landing                     │   │
│   │   products       → katalog aplikasi (name, price, category)        │   │
│   │   settings       → pengaturan landing page                          │   │
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
│  PERAN ADMIN DALAM EKOSISTEM:                                                │
│                                                                              │
│  1. Menulis data katalog → dibaca landing page                               │
│  2. Menulis data pengaturan → dibaca landing page                            │
│  3. Membaca data leads →来自 landing page form submission                   │
│  4. Generate lisensi → dikirim ke klien via WA                               │
│  5. Verifikasi serial → untuk dukungan pelanggan                             │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## 🔄 Flow Data dari Perspektif Admin

```
  ADMIN              LANDING PAGE           KLIEN              SUPABASE (rencana)
    │                    │                   │                      │
    │                    │                   │                      │
    │  Update katalog ──►│  (read) Katalog   │                      │
    │  Update settings ──►│  (read) Settings │                      │
    │                    │                   │                      │
    │◄── Read leads ─────│  (write) Form     │                      │
    │                    │                   │                      │
    │  Generate serial ─────────────────────►│  (activates)         │
    │                    │                   │                      │
    │                    │                   │  Simpan di Dexie     │
    │                    │                   │  (offline)           │
    │                    │                   │                      │
    │  Verifikasi serial ◄───────────────────│  (validate)          │
    │                    │                   │                      │
```

> Diagram di atas menggambarkan jalur **offline saat ini** (localStorage admin,
> validasi HMAC di app klien). **Arah target (Supabase):** generate serial disimpan
> ke tabel `licenses` (status active) dan validasi diverifikasi server-side oleh app
> klien. Lihat `../CLOUD-ROADMAP.md` & `./04-license-system.md`.

---

## 📦 Komponen dalam Ekosistem

### 1. Landing Page

| Aspek | Detail |
|-------|--------|
| **Peran** | Marketing, funnel, lead generation |
| **Hubungan ke Admin** | Membaca katalog & settings dari admin |
| **Menulis ke Admin** | Menulis leads & stats ke localStorage |
| **Dokumentasi** | [`landing/docs/`](../landing/docs/) |

### 2. Admin Dashboard

| Aspek | Detail |
|-------|--------|
| **Peran** | Pusat kontrol seluruh ekosistem |
| **Hubungan ke Landing** | Menulis katalog, settings; membaca leads, stats |
| **Hubungan ke Klien** | Generate & verifikasi lisensi |
| **Hubungan ke Supabase** | Rencana: read/write semua data (dengan RLS) |
| **Dokumentasi** | `admin/docs/` (file ini) |

### 3. Aplikasi Klien

| Aspek | Detail |
|-------|--------|
| **Peran** | Digunakan oleh pelaku usaha (klien) |
| **Hubungan ke Admin** | Device code dikirim ke admin untuk generate serial |
| **Hubungan ke Supabase** | Validasi lisensi via cloud (target); banner & meta dari Lapisan Meta/CRM |
| **Database Lokal** | Dexie.js (IndexedDB) — full offline |
| **Contoh** | Rosok, Gerobak, Retail, dll. |

### 4. Supabase (Cloud Database) — Rencana

| Tabel | Fungsi | Diakses oleh |
|-------|--------|-------------|
| `users` | Multi-user dengan RLS | Admin |
| `businesses` | Data bisnis klien | Admin |
| `leads` | Pendaftar trial | Admin |
| `products` | Katalog aplikasi | Admin, Landing |
| `settings` | Pengaturan landing | Admin |
| `licenses` | Generate & **validasi** serial (status active/expired/revoked) | Admin, Klien |
| `stats` | Analytics | Admin |

### 5. Generator Lisensi

| Aspek | Detail |
|-------|--------|
| **Status** | Sudah terintegrasi ke admin (tab Lisensi) |
| **File terpisah** | `generator-lisensi-universal.html` (akan dihapus) |
| **Algoritma** | HMAC-SHA256 + Base32 |
| **Kunci Rahasia** | Salt tersimpan di product registry admin |
| **Dokumentasi** | [`admin/docs/04-license-system.md`](./04-license-system.md) |

---

## 🏗️ Arsitektur Database per Tier

```
┌─────────────────────────────────────────────────────────────────┐
│                        TIER 1: CLIENT                          │
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │   Rosok      │  │   Gerobak    │  │   Retail     │         │
│  │              │  │              │  │              │         │
│  │  Dexie.js    │  │  Dexie.js    │  │  Dexie.js    │         │
│  │  (offline)   │  │  (offline)   │  │  (offline)   │         │
│  │              │  │              │  │              │         │
│  │  transaksi   │  │  transaksi   │  │  transaksi   │         │
│  │  produk/stok │  │  produk/stok │  │  produk/stok │         │
│  │  pelanggan   │  │  pelanggan   │  │  pelanggan   │         │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘         │
│         │                 │                 │                  │
│         └─────────────────┼─────────────────┘                  │
│                           │                                    │
│                    Lisensi (HMAC)                              │
│                    (validasi lokal + cloud via Supabase)       │
└─────────────────────────┼─────────────────────────────────────┘
                          │
┌─────────────────────────▼─────────────────────────────────────┐
│                        TIER 2: ADMIN & LANDING                │
│                                                                 │
│  ┌─────────────────┐      ┌─────────────────┐                 │
│  │   Admin         │      │   Landing       │                 │
│  │   Dashboard     │      │   Page          │                 │
│  │                 │      │                 │                 │
│  │  Write:         │      │  Write:         │                 │
│  │  • leads        │      │  • leads        │                 │
│  │  • stats        │      │  • stats        │                 │
│  │                 │      │                 │                 │
│  │  Read:          │      │  Read:          │                 │
│  │  • catalog      │◄─────│  • catalog      │                 │
│  │  • settings     │      │  • settings     │                 │
│  │  • leads        │      │                 │                 │
│  └────────┬────────┘      └────────┬────────┘                 │
│           │                        │                          │
│           └──────────┬─────────────┘                          │
│                      │                                        │
│              localStorage (tahap awal)                        │
│              Supabase (rencana)                               │
└──────────────────────┼───────────────────────────────────────┘
                       │
┌──────────────────────▼───────────────────────────────────────┐
│                        TIER 3: CLOUD (RENCANA)                │
│                                                                 │
│  ┌─────────────────────────────────────────────────────┐      │
│  │                  SUPABASE                           │      │
│  │                                                     │      │
│  │  Tables: users, businesses, leads, products,        │      │
│  │          settings, licenses, stats                  │      │
│  │                                                     │      │
│  │  licenses: generate + VALIDASI (status active/      │      │
│  │             expired/revoked), dipakai app klien     │      │
│  │                                                     │      │
│  │  RLS: owner write all, team read only               │      │
│  └─────────────────────────────────────────────────────┘      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📋 Checklist untuk Aplikasi Klien Baru

Ketika membangun aplikasi klien baru, ikuti checklist ini:

- [ ] Salin reference code lisensi dari admin dashboard
- [ ] Ganti `PRODUCT_PREFIX` dan `PRODUCT_SALT` sesuai produk
- [ ] Implementasikan validasi lisensi di awal aplikasi (onboard), **termasuk validasi server via Supabase** + fallback offline
- [ ] Tambah tabel `settings` untuk `bizName`, `setupDone`, **`unitId`**, dan lisensi
- [ ] Simpan data transaksi di Dexie.js (offline); jaga **offline-first** (premium = offline + sync)
- [ ] Siapkan abstraksi `fetchMeta()` / `validateLicense()` (cloud-ready sejak freemium)
- [ ] Deploy ke Vercel (root directory sesuai nama aplikasi)
- [ ] Daftarkan produk di admin dashboard (tambah product registry)
- [ ] Tambahkan ke katalog landing page (via admin)
- [ ] Dokumentasikan di folder `docs/` aplikasi tersebut
- [ ] Rujuk `CLOUD-ROADMAP.md` utk kesiapan Dashboard Hub (`unitId` sebagai DNA)

---

*Dokumentasi Ekosistem — KASIRSOLO Admin Dashboard*
