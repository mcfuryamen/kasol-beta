# Ekosistem KASIRSOLO — Perspektif Admin

Panduan lengkap arsitektur, data flow, dan integrasi seluruh komponen ekosistem dari sudut pandang Control Center.

> ⚠️ **Arah Arsitektur Cloud (2026):** Ekosistem berkembang dalam **3 lapisan** —
> **Meta/CRM** (Supabase: pelanggan, lisensi **generate + validasi**, banner),
> **Data Bisnis** (transaksi, masa depan), dan **Offline** (Dexie). Sistem lisensi
> akan melakukan **generate + validasi via Supabase**, menggantikan pendekatan
> offline saat ini (yang masih dipakai karena `control/` belum sinkron ke Supabase).
> Rujukan roadmap menyeluruh: **`../CLOUD-ROADMAP.md`**.
>
> 🚀 **Alur Deploy (2-Mirror):** Folder kerja tidak pernah push langsung ke GitHub.
> Rilis mengalir mirrored — `push-beta.ps1` → repo **BETA** `kasol-beta` (URL `*.vercel.app`),
> lalu stabil → `push-live.ps1` → repo **LIVE** `kasol` (URL `*.kasirsolo.com`).
> Detail: **`../DEPLOYMENT.md`**.
>
> ⚠️ **Pipeline (2026-08-11):** tabel `leads` & `pembelian` di-DROP. Funnel kini
> satu tabel `clients` (baru/dihubungi/tertarik/menunggu_verifikasi/aktif/batal) —
> dikelola di admin lewat UI Klien List + Kanban.

---

## 🗺️ Peta Ekosistem

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         KASIRSOLO ECOSYSTEM                                 │
│                            (PT Mesin Kasir Solo)                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   ┌──────────────────┐         ┌──────────────────────────────┐             │
│   │    SHOP          │         │       CONTROL CENTER          │             │
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
│  PERAN ADMIN DALAM EKOSISTEM:                                                │
│                                                                              │
│  1. Menulis data katalog → dibaca shop                               │
│  2. Menulis data pengaturan → dibaca shop                            │
│  3. Membaca data leads →来自 shop form submission                   │
│  4. Generate lisensi → dikirim ke klien via WA                               │
│  5. Verifikasi serial → untuk dukungan pelanggan                             │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## 🔄 Flow Data dari Perspektif Admin

```
  CONTROL CTR        SHOP                  KLIEN              SUPABASE (rencana)
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

### 1. Shop

| Aspek | Detail |
|-------|--------|
| **Peran** | Marketing, funnel, lead generation |
| **Hubungan ke Admin** | Membaca katalog & settings dari admin |
| **Menulis ke Admin** | Menulis pipeline `clients` & stats (via sync app klien / `/api/rest`) |
| **Dokumentasi** | [`shop/docs/`](../shop/docs/) |

### 2. Control Center

| Aspek | Detail |
|-------|--------|
| **Peran** | Pusat kontrol seluruh ekosistem |
| **Hubungan ke Shop** | Menulis katalog, settings; membaca pipeline `clients`, stats |
| **Hubungan ke Klien** | Generate & verifikasi lisensi |
| **Hubungan ke Supabase** | Rencana: read/write semua data (dengan RLS) |
| **Dokumentasi** | `control/docs/` (file ini) |

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
| `clients` | Pipeline klien (leads & pembelian dikonsolidasi, 2026-08-11) | Admin |
| `products` | Katalog aplikasi | Control Center, Shop |
| `settings` | Pengaturan shop | Control Center |
| `licenses` | Generate & **validasi** serial (status active/expired/revoked) | Admin, Klien |
| `stats` | Analytics | Admin |

### 5. Generator Lisensi

| Aspek | Detail |
|-------|--------|
| **Status** | Sudah terintegrasi ke admin (tab Lisensi) |
| **File terpisah** | `generator-lisensi-universal.html` (akan dihapus) |
| **Algoritma** | HMAC-SHA256 + Base32 |
| **Kunci Rahasia** | Salt tersimpan di product registry admin |
| **Dokumentasi** | [`control/docs/04-license-system.md`](./04-license-system.md) |

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
│                        TIER 2: CONTROL CENTER & SHOP                │
│                                                                 │
│  ┌─────────────────┐      ┌─────────────────┐                 │
│  │   Control Ctr   │      │   Shop          │                 │
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
│  │  Tables: users, businesses, clients (pipeline), products,│      │
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

- [ ] Salin reference code lisensi dari Control Center
- [ ] Ganti `PRODUCT_PREFIX` dan `PRODUCT_SALT` sesuai produk
- [ ] Implementasikan validasi lisensi di awal aplikasi (onboard), **termasuk validasi server via Supabase** + fallback offline
- [ ] Tambah tabel `settings` untuk `bizName`, `setupDone`, **`unitId`**, dan lisensi
- [ ] Simpan data transaksi di Dexie.js (offline); jaga **offline-first** (premium = offline + sync)
- [ ] Siapkan abstraksi `fetchMeta()` / `validateLicense()` (cloud-ready sejak freemium)
- [ ] Daftarkan produk di Control Center (tambah product registry)
- [ ] Tambahkan ke katalog shop (via Control Center)
- [ ] Dokumentasikan di folder `docs/` aplikasi tersebut
- [ ] Rujuk `CLOUD-ROADMAP.md` utk kesiapan Dashboard Hub (`unitId` sebagai DNA)
- [ ] **Adopsi Fitur Standar Global UX** (root `CONTEXT.md` → "Fitur Standar Global"):
      onboarding 2-langkah tanpa checkbox, profil tersruktur (region picker Provinsi/Kab/Kec),
      auto-sync profil on-update, banner "Lengkapi Profil" center-large, kontrak z-index,
      narasi benefit-driven, akordeon Bantuan auto-close. Referensi implementasi: `kaki5/`.

---

*Dokumentasi Ekosistem — KASIRSOLO Control Center*
