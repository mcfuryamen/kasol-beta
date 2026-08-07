# Landing Page — Arsitektur

Single-file architecture dengan data sharing melalui `localStorage`.

---

## 🏛️ Arsitektur

```
┌──────────────────────────────────────────────────────────────────┐
│                        index.html                                │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  HTML (struktur & konten)                                │   │
│  │  - Header/Nav (sticky, glassmorphism)                    │   │
│  │  - Hero Section (headline, CTA, counter, phone mockup)  │   │
│  │  - Trust Strip (keamanan, backup, support)               │   │
│  │  - Problem & Solution (2 kolom)                          │   │
│  │  - Katalog Aplikasi (grid dinamis + filter)              │   │
│  │  - Cara Kerja (4 langkah)                                │   │
│  │  - Keunggulan (3 kartu)                                  │   │
│  │  - Pricing (kartu harga gelap)                           │   │
│  │  - Form Trial (lead generation)                          │   │
│  │  - Final CTA (gradient)                                  │   │
│  │  - Footer (4 kolom)                                      │   │
│  └──────────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  CSS (styles internal)                                   │   │
│  │  - CSS Variables (color, spacing, radius)                │   │
│  │  - Layout & Components                                   │   │
│  │  - Responsive breakpoints (980px, 620px)                 │   │
│  │  - Animations (reveal, counter, hover)                   │   │
│  └──────────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  JavaScript (logika)                                     │   │
│  │  - Mobile menu toggle                                    │   │
│  │  - Catalog render & filter                               │   │
│  │  - Counter animation (Intersection Observer)             │   │
│  │  - Scroll reveal (Intersection Observer)                 │   │
│  │  - Form submission → localStorage                        │   │
│  │  - Stats counter increment                               │   │
│  │  - WhatsApp dynamic links                                │   │
│  └──────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────┘
```

---

## 🔄 Data Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         DATA FLOW                                       │
│                                                                         │
│   ┌─────────────────┐                                                  │
│   │   Admin Dashboard│                                                  │
│   │   (write data)  │                                                  │
│   └────────┬────────┘                                                  │
│            │                                                          │
│            ▼                                                          │
│   ┌─────────────────────────────────────────┐                         │
│   │         localStorage (browser)           │                         │
│   │                                         │                         │
│   │  kasirsolo:catalog  ──► baca ──► Katalog│                         │
│   │  kasirsolo:settings ──► baca ──► Hero   │                         │
│   │  kasirsolo:leads    ◄── tulis◄── Form   │                         │
│   │  kasirsolo:stats    ◄── tulis◄── Visit  │                         │
│   └────────┬────────────────────────────────┘                         │
│            │                                                          │
│            │ baca                                                     │
│            ▼                                                          │
│   ┌─────────────────┐                                                  │
│   │   Landing Page  │                                                  │
│   │   (read/write)  │                                                  │
│   └─────────────────┘                                                  │
│                                                                         │
│   CATATAN: Landing page hanya BISA menulis leads & stats.              │
│   Katalog dan settings dibaca, tapi penulisan dilakukan oleh Admin.     │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 📡 Alur Kerja (User Journey)

```
  1. Pengunjung buka landing page
         │
         ▼
  2. Halaman load → baca kasirsolo:catalog & kasirsolo:settings
         │
         ▼
  3. Katalog dirender di section "Aplikasi" (dinamis)
         │
         ▼
  4. Pengunjung scroll, section reveal animasi
         │
         ▼
  5. Counter stats animasi saat masuk viewport
         │
         ▼
  6. Pengunjung klik "Coba Gratis 7 Hari" → scroll ke form
         │
         ▼
  7. Pengunjung isi form: nama, alamat, WA, pilih aplikasi
         │
         ▼
  8. Submit → data disimpan ke kasirsolo:leads
         │
         ▼
  9. Form reset + pesan sukses muncul
         │
         ▼
  10. Stats kunjungan bertambah (kasirsolo:stats)
         │
         ▼
  11. Admin buka dashboard → lihat lead baru di tab Leads
```

---

## 🔑 Storage Keys

| Key | Tipe | dibaca oleh | ditulis oleh |
|-----|------|------------|-------------|
| `kasirsolo:catalog` | Array of objects | Landing page | Admin dashboard |
| `kasirsolo:settings` | Object | Landing page | Admin dashboard |
| `kasirsolo:leads` | Array of objects | Admin dashboard | Landing page (form) |
| `kasirsolo:stats` | Object `{visits: N}` | Admin dashboard | Landing page (setiap load) |

---

## 🌐 Deployment

### Vercel

File `vercel.json` mengonfigurasi:
- `buildCommand: null` — tidak ada build step
- `outputDirectory: "."` — file statis langsung serve
- `rewrites` — SPA fallback ke `index.html`
- `headers` — security headers (X-Content-Type-Options, X-Frame-Options, X-XSS-Protection)

### Deployment

Landing di-deploy otomatis ke **Vercel** lewat **git integration (auto-detect)** — project `kasir-solo-landing` dengan **Root Directory = `landing/`**. **GitHub Actions tidak dipakai** (semua workflow sudah dihapus). Push ke branch utama → Vercel auto-deploy.

### Domain

Domain bisa di-set di Vercel dashboard, contoh: `kasirsolo.com`.

---

## 📱 Responsivitas

| Breakpoint | Layout |
|------------|--------|
| `> 980px` | Desktop — nav links visible, 4-col grid, side-by-side sections |
| `≤ 980px` | Tablet — burger menu, 2-col grid, stacked sections |
| `≤ 620px` | Mobile — 1-col everything, smaller fonts, hidden float cards |
| `prefers-reduced-motion` | Disable semua animasi |

---

## 🔮 Rencana Migrasi ke Supabase

Tahap lanjut, data akan dipindahkan dari `localStorage` ke Supabase:

| Saat Ini (localStorage) | Rencana (Supabase) |
|-------------------------|-------------------|
| `kasirsolo:catalog` | Tabel `products` di Supabase |
| `kasirsolo:settings` | Tabel `settings` di Supabase |
| `kasirsolo:leads` | Tabel `leads` di Supabase (dengan RLS) |
| `kasirsolo:stats` | Tabel `stats` di Supabase |

Landing page akan menggunakan Supabase JS client untuk membaca/menulis data.
Admin dashboard akan menjadi satu-satunya writer untuk catalog & settings.

---

*Arkitektar Landing Page — KASIRSOLO*
