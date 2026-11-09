# Proyek Masjid — 2 Repo dalam 1 Proyek

Proyek ini terdiri dari **2 repo terpisah** yang saling terhubung melalui Supabase:

| Repo | Isi | Peran |
|------|-----|-------|
| `adm-masjid/` | Aplikasi admin manajemen kas masjid (PWA, offline-first) | Input data, publikasi konten |
| `web-masjid/` | Website publik masjid (statis, ringan) | Tampilan untuk jamaah |

## Alur Koneksi

```
┌─────────────┐   Publikasikan    ┌──────────────────┐    Baca     ┌─────────────┐
│ adm-masjid  │ ────────────────▶ │    Supabase      │ ──────────▶ │ web-masjid  │
│  (admin)    │  RPC masjid_      │ masjid_website   │  REST API   │  (publik)   │
│             │  publish + token  │                  │             │             │
└─────────────┘                   └──────────────────┘             └─────────────┘
                                                                        ▲
                                          Fallback: data-website.json ──┘
```

1. **Admin** mengisi profil, kegiatan, dan transaksi kas.
2. Admin menekan **"Publikasikan"** di Pengaturan → data dikirim ke Supabase via RPC `masjid_publish` (butuh slug + token).
3. **Website** membaca data dari Supabase REST API. Jika Supabase tidak terjangkau, website memakai fallback file `data-website.json`.

## Setup Awal (sekali)

### 1. Terapkan migration Supabase

```bash
# dari root proyek kasol
node supabase/apply-migration.js --ref=hhywrvedlwljawgxzpkq --file=supabase/migration-masjid-website.sql --dry-run
node supabase/apply-migration.js --ref=hhywrvedlwljawgxzpkq --file=supabase/migration-masjid-website.sql --apply
node supabase/apply-migration.js --ref=hhywrvedlwljawgxzpkq --file=supabase/migration-masjid-website.sql --verify
```

Migration membuat:
- Tabel `masjid_website` (data JSON, bisa dibaca publik via RLS)
- Tabel `masjid_publish_tokens` (token, tidak bisa dibaca publik)
- Fungsi RPC `masjid_publish(slug, token, data)` (SECURITY DEFINER, cek token)

### 2. Set token di admin

Token publikasi sudah di-generate dan tertanam di `supabase/migration-masjid-website.sql` (cari baris `insert into public.masjid_publish_tokens`). Salin token itu, lalu di admin: **Pengaturan → 🌐 Website Masjid** → isi **Slug** (`masjid`) dan **Token Publikasi** → Simpan.

### 3. Publikasikan

Di admin: **Pengaturan → 🌐 Website Masjid → Publikasikan**. Data profil, kegiatan yang akan datang, dan laporan kas bulan berjalan akan dikirim ke Supabase.

## Deploy Website

`web-masjid/` adalah situs statis (1 file HTML + 1 JSON). Bisa di-deploy ke mana saja:

- **GitHub Pages**: push repo `web-masjid`, aktifkan Pages dari branch `main`.
- **Netlify / Vercel**: drag-and-drop folder `web-masjid` atau hubungkan repo.

Tidak ada build step. File `data-website.json` hanya fallback — data utama datang dari Supabase.

## Struktur

```
masjid/
├── adm-masjid/              # REPO 1: admin (git terpisah)
│   ├── index.html           # Aplikasi lengkap (HTML+CSS+JS, PWA)
│   ├── sw.js                # Service worker (cache v1.2.2)
│   └── manifest.webmanifest
└── web-masjid/              # REPO 2: website publik (git terpisah)
    ├── index.html           # Situs statis
    └── data-website.json    # Fallback data contoh
```

## Catatan

- **Anon key Supabase** tertanam di kedua file HTML — ini normal dan aman (kunci anon bersifat publik; keamanan dijaga RLS + token).
- **Token publikasi** rahasia: jangan di-commit ke repo publik dalam bentuk lain; cukup ada di migration SQL (server-side) dan di pengaturan admin (localStorage perangkat).
- Kuota 60 catatan/bulan di admin tetap hanya menghitung transaksi kas (keputusan bisnis).
- Lisensi admin tetap client-side (sinkronisasi lisensi ke hub bukan bagian proyek ini).
