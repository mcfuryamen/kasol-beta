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
2. Admin menekan **"Publikasikan"** di Pengaturan → data dikirim ke Supabase via RPC `masjid_publish_by_account` (otorisasi dari sesi login + peran owner; **tanpa token di perangkat**).
3. **Website** membaca data dari Supabase REST API. Jika Supabase tidak terjangkau, website memakai fallback file `data-website.json`.

## Setup Awal (sekali)

### 1. Terapkan migration Supabase

```bash
# dari root proyek kasol
node supabase/apply-migration.js --ref=hhywrvedlwljawgxzpkq --file=supabase/migration-masjid-website.sql --dry-run
node supabase/apply-migration.js --ref=hhywrvedlwljawgxzpkq --file=supabase/migration-masjid-website.sql --apply
node supabase/apply-migration.js --ref=hhywrvedlwljawgxzpkq --file=supabase/migration-masjid-website.sql --verify
# model 1-project (redirect /<slug> -> TLD aktif):
node supabase/apply-migration.js --ref=hhywrvedlwljawgxzpkq --file=supabase/migration-masjid-one-project.sql --dry-run
node supabase/apply-migration.js --ref=hhywrvedlwljawgxzpkq --file=supabase/migration-masjid-one-project.sql --apply
```

Migration membuat:
- Tabel `masjid_website` (data JSON, bisa dibaca publik via RLS)
- Tabel `masjid_publish_tokens` (token, tidak bisa dibaca publik)
- Fungsi RPC `masjid_publish(slug, token, data)` (SECURITY DEFINER, cek token)
- Fungsi RPC `masjid_domain_for_slug(slug)` (anon; dipakai web-masjid untuk redirect `/<slug>` → domain TLD aktif)

### 2. Akun & outlet (tanpa token di perangkat)

Admin WAJIB masuk lewat gerbang login Akun Kasol (No. WhatsApp + PIN). Token publikasi **tidak ada lagi di perangkat** — hak publikasi ditentukan server dari sesi JWT + peran `owner` pada outlet situs (RPC `masjid_publish_by_account` / `masjid_draft_by_account`). RPC lama `masjid_publish` / `masjid_draft` masih ada untuk backward-compat.

### 3. Publikasikan

Di admin: **Pengaturan → 🌐 Website Masjid → Publikasikan**. Data profil, kegiatan yang akan datang, dan laporan kas bulan berjalan dikirim ke Supabase memakai sesi login. Slug & situs aktif mengikuti outlet yang sedang dipilih.

## Deploy Website

`web-masjid/` adalah situs statis (1 file HTML + 1 JSON). Tidak ada build step. File `data-website.json` hanya fallback — data utama datang dari Supabase.

### Vercel — SATU project (model 1-project, diputuskan 15 Nov 2026)

| Project | Root Directory | Output | Contoh URL | Config |
|---------|----------------|--------|------------|--------|
| kasolmasjid (nama bebas) | `masjid/` | `.` | https://kasolmasjid.vercel.app/ | `masjid/vercel.json` |

Satu project static (Framework: None) melayani **admin dan website klien pada origin yang sama**:

| URL | Hasil |
|-----|-------|
| `/adm` | redirect 302 → `/adm/` |
| `/adm/` dan `/adm/*` | Admin PWA (rewrite ke `/adm-masjid/...`; service worker scope `/adm/` via header `Service-Worker-Allowed`) |
| `/` | Website publik — slug dibaca dari host via RPC `masjid_resolve_domain` (dipakai domain TLD custom) |
| `/<slug>` dan `/<slug>/` | Website publik untuk masjid tertentu (path cadangan: `adm`, `adm-masjid`, `web-masjid`, `assets`, `m`, `data-website.json`, `manifest.webmanifest`, `sw.js`, `vercel.json`) |
| `/m/<slug>` | Tetap didukung (kompatibilitas URL lama) |
| `/assets/*`, `/data-website.json`, `/manifest.webmanifest` | Rewrite ke `/web-masjid/...` |

> **Aset web-masjid memakai path absolut dari root (`/assets/...`).** Diperlukan karena di model 1-project aset di-serve lewat rewrite `vercel.json`, dan situs juga bisa diakses di `/<slug>` maupun domain TLD — path relatif akan rusak bergantung trailing-slash.

**Redirect slug → TLD:** saat `/<slug>` di host platform (`.vercel.app` / domain platform sendiri) dibuka dan slug tersebut punya domain TLD `active` di `masjid_website_domains`, `web-masjid/index.html` memanggil RPC `masjid_domain_for_slug(slug)` (anon, sudah ter-migrasi via `supabase/migration-masjid-one-project.sql`) lalu `location.replace('https://<tld>/...')`. Di domain TLD klien, resolve tetap via `masjid_resolve_domain` seperti biasa.

File helper QA (`_qa/`, `_audit/`, `_docs/`, `_dev-server.mjs`, `_qa-*.mjs`, `README.md`) dikecualikan dari deploy lewat `masjid/.vercelignore`.

Project lama (2-project: `web-masjid-beta.vercel.app`, `adm-masjid-beta.vercel.app` dengan root `masjid/web-masjid` & `masjid/adm-masjid`) tetap ada sebagai beta historis; config `vercel.json` di dalam kedua folder itu masih dipakai bila di-deploy sebagai project terpisah.

### Status deploy aktual (21 Nov 2026)

| Environment | Project Vercel | Root | Link git | URL |
|---|---|---|---|---|
| **Beta** | `masjid-beta` | `masjid` | mirror `kasol-beta` branch `main` | https://masjid-beta-mcfury.vercel.app (alias), juga `masjid-beta-git-main-mcfury.vercel.app` & `masjid-beta-weld.vercel.app` |
| Produksi | **belum ada** | — | — | — |

- Beta ter-deploy otomatis tiap kali ada push ke mirror `kasol-beta` (root `masjid`). Isi beta terakhir = commit `279e92c` (adm-masjid **v1.5.7**).
- **Project beta terproteksi login Vercel** → Pengunjung tanpa login Vercel melihat halaman login Vercel, bukan app. Jangan salah menyimpulkan "project tidak ada" dari probing URL anonim.
- Verifikasi status deploy pakai **API Vercel** (token ada di `.env.local` root): `GET https://api.vercel.com/v9/projects?teamId=team_VPDFCbDl3nLlG8rmsam7Px7H` dan `GET /v13/deployments?projectId=...`. CLI `vercel` di mesin ini **tidak** login.
- Project dengan nama `kasolmasjid` / `adm-masjid-beta` **tidak pernah dibuat** → 404 `DEPLOYMENT_NOT_FOUND`. Jangan dipakai sebagai acuan status.
- **Origin beta belum masuk whitelist `account-register`** → tombol "Daftar" di admin masjid 403 dari origin beta. Tambahkan `https://masjid-beta-mcfury.vercel.app` (+ alias) ke `BASELINE_ORIGINS` (`supabase/functions/account-register/index.ts`) dan/atau env `ACCOUNT_CORS_ORIGIN`, lalu deploy ulang Edge Function.

### Preview dari admin

Admin tidak lagi memakai konstanta `WEB_BASE_URL`: `webBaseUrl()` = `location.origin + '/'` di produksi (model 1-project — admin & website satu origin), dan `/web-masjid/` saat dev lokal. URL publik yang ditampilkan = `<origin>/<slug>`.

### Domain TLD custom

1. Di admin: **Pengaturan → 🌐 Website Masjid → Klaim Domain** → isi domain (mis. `masjid-aliklas.com`). Admin menampilkan blok DNS yang harus dipasang.
2. Di registrar DNS: buat **CNAME** untuk domain → `cname.vercel-dns.com`, dan **TXT** `_vercel` → `vc-domain-verify=<token>` (token juga tersimpan di perangkat pada `ks_masjid_domtok`).
3. Di Vercel: project **kasolmasjid** (root = `masjid/`) → **Settings → Domains → add domain** tersebut. DNS saja tidak cukup — tanpa di-attach ke project, domain mengembalikan `404 DEPLOYMENT_NOT_FOUND`. Domain diarahkan ke project tunggal ini supaya root `/` langsung menampilkan situs publik (slug dari host via `masjid_resolve_domain`).
4. Setelah DNS propagation, tekan **"Cek Verifikasi"** di admin → domain jadi `active`. Setelah itu `/<slug>` di host platform otomatis redirect ke TLD (RPC `masjid_domain_for_slug`), dan TLD sendiri langsung melayani situs.

#### Aturan domain (hardening 15 Nov 2026, `supabase/migration-masjid-domain-hardening.sql`)

- **Domain platform tidak bisa diklaim.** Host milik platform (mis. `*.vercel.app`, `vercel-dns.com`) ditolak dengan kode `domain_reserved`, baik saat klaim maupun verifikasi. Daftar host terlarang disimpan di tabel `masjid_reserved_domains` (isi tabel = sumber kebenaran operasional; bisa ditambah tanpa migrasi baru) dan `*.vercel.app` / `*.vercel-dns.com` otomatis ditolak oleh CHECK constraint `masjid_dom_reserved_suffix_ck`.
- **Klaim ulang domain yang sudah `active` tidak lagi menurunkan status diam-diam.** `masjid_claim_domain` mengembalikan `domain_already_active` tanpa mengubah data; owner lalu diminta konfirmasi di admin, dan baru RPC `masjid_reclaim_domain` (owner-only) yang mengubah status jadi `pending` + token baru. Setelah re-klaim, website **tetap mati sampai verifikasi ulang** — itu konsekuensi yang disadari.
- **Fungsi sesi tidak bisa dipanggil role `anon`.** `masjid_claim_domain`, `masjid_verify_domain`, `masjid_reclaim_domain`, `masjid_site_role`, `masjid_my_sites`, `masjid_ensure_site`, `masjid_publish_by_account`, `masjid_draft_by_account`, `masjid_slugify` → hanya `authenticated` + `service_role`. Yang tetap boleh `anon`: `masjid_resolve_domain` (website publik) serta `masjid_publish` / `masjid_draft` versi token (backward-compat untuk admin lama v1.3.x).
- **Fungsi baru wajib grant eksplisit.** Default privileges Supabase memberi `EXECUTE` ke `anon` (dan implisit ke `PUBLIC`) untuk setiap fungsi baru. Default global sudah dibetulkan, tapi `PUBLIC` hanya bisa dicabut per fungsi — jadi **setiap `create function` baru wajib diikuti `revoke all on function ... from public`**, lalu grant seperlunya.

### QA domain & hak akses

```bash
# skenario end-to-end (semua dibungkus begin…rollback → produksi bersih)
node masjid/_qa/run-sql.mjs --ref=hhywrvedlwljawgxzpkq --file=masjid/_qa/claim-domain.test.sql

# bukti level HTTP (PostgREST): anon ditolak, host platform not_found
node masjid/_qa/http-rpc-check.mjs

# daftar fungsi yang masih bisa dipanggil anon (review tiap migrasi baru)
node supabase/audit-query.js --ref=hhywrvedlwljawgxzpkq --sql="select p.proname, has_function_privilege('anon', p.oid, 'EXECUTE') as anon_exec from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' order by 1"
```

### Catatan deploy

- Setelah deploy project tunggal (root = `masjid/`), cek: `https://<host>/adm/` → 200 (admin), `https://<host>/masjid` → 200 (website via slug), `https://<host>/m/masjid` → 200 (kompat lama), `https://<host>/assets/hero.jpg` → 200. Kalau `/<slug>` 404, kemungkinan Root Directory project belum `masjid/` sehingga `masjid/vercel.json` tidak terbaca.
- File helper QA (`_qa/`, `_audit/`, `_docs/`, `_dev-server.mjs`) tidak ikut ter-publish karena masuk `masjid/.vercelignore`.
- Dev lokal: `node masjid/_dev-server.mjs 8095` — sudah mencerminkan model 1-project (`/adm` → 302 `/adm/`, `/adm/*` → `/adm-masjid/*`, `/<slug>` → index web-masjid dengan path cadangan).

## Struktur

```
masjid/
├── vercel.json              # Config project Vercel TUNGGAL (root = masjid/): rute /adm/, /<slug>, aset
├── .vercelignore            # Pengecualian file helper QA dari deploy
├── _dev-server.mjs          # Server dev lokal (model 1-project, port 8095)
├── adm-masjid/              # Admin PWA (di-serve di /adm/ oleh project tunggal)
│   ├── index.html           # Aplikasi lengkap (HTML+CSS+JS, PWA) — v1.4.2
│   ├── sw.js                # Service worker (cache v1.4.2, scope /adm/)
│   ├── manifest.webmanifest
│   └── vercel.json          # Masih dipakai bila adm-masjid di-deploy sebagai project terpisah (beta lama)
└── web-masjid/              # Website publik (di-serve di / dan /<slug>)
    ├── index.html           # Situs statis — slug dari /<slug> atau /m/<slug>, redirect TLD via masjid_domain_for_slug
    ├── vercel.json          # Masih dipakai bila web-masjid di-deploy sebagai project terpisah (beta lama)
    ├── data-website.json    # Fallback data contoh
    └── assets/              # Aset (path absolut /assets/... via rewrite)
```

## Catatan

- **Anon key Supabase** tertanam di kedua file HTML — ini normal dan aman (kunci anon bersifat publik; keamanan dijaga RLS + otorisasi server).
- **Token publikasi tidak ada di perangkat.** Penegakan hak publish dilakukan server-side (RLS + RPC SECURITY DEFINER yang membaca peran dari sesi JWT). Token domain (verifikasi DNS) memang disimpan per-domain di perangkat (`ks_masjid_domtok`) dan hanya berlaku untuk domain itu.
- Kuota 60 catatan/bulan di admin tetap hanya menghitung transaksi kas (keputusan bisnis).
- **Akun & lisensi (v1.3.0):** admin WAJIB masuk/daftar lewat gerbang login (No. WhatsApp + PIN, Akun Kasol) sebelum aplikasi terbuka. Lisensi **mengikuti akun** via RPC `app_my_license('masjid', device_code, …)` (sama dengan kaki5 Fase B1) — bukan lagi kode device-bound. Akun **belum berlisensi** tetap mendapat kuota gratis 60 catatan/bulan. Sesi disimpan di localStorage `ks_masjid_session`, lisensi di-cache di `ks_masjid_license` (grace offline).
- Pendaftaran lewat Edge Function `account-register` **fail-closed CORS** — origin asal harus ada di `BASELINE_ORIGINS` (`supabase/functions/account-register/index.ts`) lalu fungsi di-redeploy (`node supabase/deploy-account-functions.js`).
