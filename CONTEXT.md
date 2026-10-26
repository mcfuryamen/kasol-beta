# CONTEXT — KASIRSOLO Ecosystem Standards

> **File ini dibaca oleh setiap AI agent** sebelum membangun atau mengedit aplikasi klien KASIRSOLO.
> Semua aplikasi klien HARUS mengikuti standar di bawah ini.

---

## 🏛️ Peta Ekosistem

```
  ┌─────────────────┐
  │   SHOP          │  Marketing, funnel, lead gen
  │   (shop/)       │
  └────────┬────────┘
           │ reads catalog/settings, writes clients pipeline/stats
           ▼
  ┌─────────────────┐         ┌──────────────────────┐
  │  CONTROL CENTER │────────►│   SUPABASE (cloud)   │
  │  (control/)       │  write  │   [rencana tahap 2]   │
  └────────┬────────┘         └──────────┬───────────┘
           │ generate licenses           │ validate
           ▼                              ▼
  ┌─────────────────────────────────────────────────┐
  │           APPLICATION CLIENTS                   │
  │  rosok/  retail/  [baru...]                     │
  │                                                 │
  │  ┌───────────────────────────────────────────┐  │
  │  │  Dexie.js (IndexedDB) — Full Offline       │  │
  │  │  Transaksi, produk, pelanggan, laporan     │  │
  │  └───────────────────────────────────────────┘  │
  │                                                 │
  │  ┌───────────────────────────────────────────┐  │
  │  │  License: HMAC-SHA256 device-bound         │  │
  │  │  Prefix unik per produk + salt rahasia     │  │
  │  └───────────────────────────────────────────┘  │
  └─────────────────────────────────────────────────┘
```

> Peta ringkas 3 lapis + proyek terpisah di luar repo → lihat section
> **"📊 Status Ekosistem"** di bawah.

### 🚪 Port Dev Server (REGISTRY — SUMBER KEBENARAN)

**Setiap app klien & ekosistem punya PORT tetap yang TIDAK BOLEH diubah-ubah** oleh agent.
Sebelum jalanin preview/dev server, SELALU pakai port dari tabel ini. **Jangan ngacak / nebak port.**

| App | Folder | Port | Kategori |
|-----|--------|------|----------|
| Shop | `shop/` (eks-landing) | **8081** | ekosistem |
| Control | `control/` | **8082** | ekosistem (bukan app klien) |
| Rosok | `rosok/` | **8084** | app klien (flagship) |
| Retail | `retail/` | **8085** | app klien |
| Kaki5 | `kaki5/` | **8086** | app klien |
| Minimarket | `minimarket/` | **8087** | app klien (Vite, `--strictPort`) |
| TPA | `tpa/` | **8088** | app klien domain terpisah (Vite, `--strictPort`) |
| Laundry | `laundry/` | ⚠️ **8088** — BENTROK dengan TPA, lihat catatan | app klien |
| Grosir | `grosir/` | **8089** | app klien (belum ada isi) |
| Omniroute (otak AI lokal) | `agent/` (runner+callAI) | **20128** | ekosistem |
| Company (Astro) | `company/` | **13131** | proyek terpisah, di luar registry 8081–8089 — **jalankan `npm install` DI DALAM `company/`** (company bukan workspace root, `astro`/`zod` tidak ter-hoist) lalu `npm run dev` |
| Mitra (Astro) | `mitra/` | **13132** | proyek terpisah — **Program Mitra + Portal Mitra** (`mitra.kasirsolo.com`). Sama kayak `company/`: `npm install` DI DALAM `mitra/` |
| Website korporat (Next.js) | `C:\Users\Admin\Documents\kasol-v2` | **3000** | proyek terpisah, di luar repo |

> ⚠️ **Bentrok port 8088 ( laundry ↔ TPA)** — `tpa/package.json` pin `8088 --strictPort`;
> `laundry/EVALUASI-MODUL.md` juga mengklaim 8088 (menyebut 8087 dipakai TPA). Hanya satu
> bisa jalan. **Jangan ini yang diprioritaskan** — kalau harus pilih, TPA (memakai
> `--strictPort`, gagal keras) menang. Blankup: **butuh keputusan pemilik**.

**Aturan penomoran app klien baru:** aplikasi selanjutnya meneruskan urutan dari 8089 ke atas
(urutan app klien). Ekosistem (shop/control) memegang 8081–8082 secara permanen.

**Contoh pemicu port**: `python -m http.server 8086`, `npx serve -l 8084`, `php -S localhost:8083`.

---

## 📊 Status Ekosistem — di mana Things Berada (live)

> **Snapshot 2026-10-24.** Detail lengkap & angka terkini → **[`docs/STATUS-LIVE.md`](./docs/STATUS-LIVE.md)**.
> File itu berisi fakta cepat basi (jumlah baris DB, status deploy, proses lokal) — **verifikasi
> ulang sebelum mengutip angkanya**. Yang tetap berlaku permanen ada di file ini.

### Ekosistem ada 3 lapis

```
LAPIS 1 — APLIKASI KLIEN (offline-first, lisensi HMAC, Dexie)
  kaki5 (referensi arsitektur) · rosok (flagship) · laundry · retail
  grosir/kelontong/retail-enterprise → placeholder kosong
        ▲ lisensi & profil (sync), ❌ transaksi tidak pernah ke server
        │
LAPIS 2 — CONTROL CENTER (control/) = OTORITAS LISENSI + MARKETING
  Tab Klien · Lisensi · Katalog · Outreach · Sosmed · Konten · Kalender · AI Variasi
        │ write
        ▼
LAPIS 3 — SUPABASE (2 project — JANGAN TERTUKAR)
  hhywrvedlwljawgxzpkq → Control/Platform + HUB + Minimarket
  ozsjflxfkbcygbuxgwyf → TPA staging (domain tpa_* terpisah)

PROYEK TERPISAH (di luar repo, tanpa .git):
  kasol-v2  → website korporat Next.js/Turbo/Firebase (port 3000)
  company/  → website korporat Astro (port 13131)
  mitra/    → Program Mitra + Portal Mitra, Astro (port 13132)
```

### Aturan ouro yang berlaku (ringkas, sudah panjang di bawah)

- **Cloud = sumber kebenaran untuk lisensi & profil**, lokal = fallback offline. Transaksi tetap lokal.
- **Admin `control/` = satu-satunya sumber kebenaran** generate/aktivasi/revoke lisensi.
- **Jangan commit/push tanpa perintah eksplisit pemilik.** Rilis live butuh perintah eksplisit per rilis.
- **HUB (akun utama lintas aplikasi) = FREEZE** (keputusan pemilik 2026-10-21). Fase 0 ter-apply,
  Fase 1 belum mulai. Schema `global_identities` + `app_memberships` sudah ada tapi **0 baris**.
- **Auto-posting FB/IG belum pernah hidup.** Yang hidup = jalur **manual** (Kalender Konten).
  Lihat section "📱 Otomatisasi Sosmed" di bawah.


---

## 🎯 Keputusan Strategis Saat Ini (WAJIB DIHORMATI AGENT)

> Keputusan strategis pemilik projekt. Agent **harus** baca & patuhi sebelum kerja.
> Ini SUMBER KEBENARAN untuk scope kerja (per 2026-08-10).

### 🚦 Aturan Rilis — Seluruh Ekosistem Kasol (WAJIB, untuk SEMUA agent)
**Aturan pemilik; sudah lama berlaku secara lisan, ditulis eksplisit 2026-09-06
agar memaksa kepatuhan agent mana pun (ZCode maupun di luar ZCode).**

1. **Default = commit + rilis BETA saja** (mirror `GitHub/kasol-beta` → domain
   beta `*.vercel.app`). Fix yang sudah disetujui pemilik → beta boleh langsung.
2. **Rilis LIVE (mirror `GitHub/kasol` → domain produksi: `kasirsolo.com`,
   `kaki5.kasirsolo.com`, `rosok.kasirsolo.com`, dll.) WAJIB perintah EKSPLISIT
   pemilik, PER RILIS.** Approval "gas"/"gaskeun" atas permintaan fix BUKAN izin
   rilis live — hanya perintah eksplisit semacam "rilis live"/"push live" yang sah.
3. **Jangan improve sendiri di luar permintaan.** Eksekusi persis yang diminta;
   temuan lain = SARAN tertulis untuk dipilih pemilik — jangan sekalian dikerjakan.
4. Pelanggaran tercatat 2026-09-06: diminta naikkan batas qty → agent ikut rilis
   live tanpa diminta. Jangan diulang.

### Fokus kerja (Prioritas)

- **`kaki5/` = REFERENSI ARSITEKTUR aplikasi klien** (sumber kebenaran pola code,
  smart gate, sync profil, offline-first). App klien lain nanti meniru kaki5.
- **`control/` = REFERENSI ARSITEKTUR admin** (sumber tunggal modul, guard parity,
  dev mirror). Semua modul baru wajib punya versi dev + produksi dari sumber yang sama.
- **`shop/` = funnel/marketing** (landing + lead gen).

> ⚠️ **Prioritas "hanya 3 app" ini sudah terkikis reality** (per 2026-10-24). `rosok/`
> (flagship, **sudah live**) tetap boleh diservis bila ada permintaan eksplisit —
> terutama `rosok/js/license.sync.js` & `rosok/js/utils.js`. `tpa/` dan `minimarket/`
> berjalan sebagai **proyek domain terpisah** dengan project Supabase sendiri.
> Yang tetap berlaku: **peluang di luar permintaan = saran tertulis, jangan langsung dikerjakan.**

### Lisensi — Konsep Hybrid (KONTROL PENUH via Admin)
- **Konsep lama**: offline HMAC murni, generate dari `generator-lisensi-universal.html` publik.
- **Konsep baru (HYBRID)** — sesuai kebutuhan operasional-offline klien:
  1. **Operasional = offline total** (Dexie/IndexedDB). Transaksi TIDAK pernah ke server.
  2. **Lisensi + profil klien = di server (platform Kasir Solo)** sebagai database
     platform — `clients` + `licenses` di Supabase.
  3. **Admin `control/` = satu-satunya SUMBER KEBENARAN** untuk generate, aktivasi,
     revoke, blacklist lisensi SEMUA app klien (kecuali shop & control sendiri).
  4. App klien tetap validasi offline pakai HMAC (operasional jalan tanpa internet),
     lalu **kawal/sync status lisensi + blacklist ke server** saat online.
- HTTPS: `generate-license` / `activate-license` edge function dipindah jadi
  **backend otoritatif admin**, bukan helper publik.

### Arah Sinkronisasi — Cloud = Sumber Kebenaran (ATURAN PEMILIK, 2026-08-29)
- **Supabase = satu-satunya sumber kebenaran untuk lisensi & profil klien.**
  Data lokal (IndexedDB) TIDAK BOLEH menimpa cloud — **kecuali** tulisan
  eksplisit user dari **form profil** (jalur user-intent).
- **Saat app dibuka / refresh / setelah update overlay**: cek Supabase dulu
  (boot fase 1: sync lisensi → pull profil → push backfill), baru render UI.
- **Internet mati / cloud gagal dihubungi**: lisensi & profil tetap memakai
  data lokal (offline-first) — error network TIDAK boleh mengubah/menghapus
  state lokal (revoke dari ketidakpastian = dilarang).
- Implementasi di kaki5 (app klien lain meniru): `syncLicenseStatus()`
  menangani SEMUA `license_status` cloud (`aktif` → persist; `batal`/
  `nonaktif`/`revoked` → revoke; `belum`/kosong → downgrade aktif→trial
  berjangkar `first_seen`); `ensureSynced()` push otomatis = **backfill-only**
  (baris ada → jangan sentuh), penimpaan hanya via `force` (form profil,
  tombol sinkron, retry pending).

### Skip sementara: Password Admin
- Password admin **`admin123`** (hardcoded di `control/js/auth.js`) **sengaja DI-SKIP
  dulu** sampai pemilik beresin manual (karena menyangkut auth Supabase + RLS).
- **Agent JANGAN mengubah / "memperbaiki"** admin password / auth gate admin.
  Catat sebagai item, jangan dikerjakan, sampai pemilik setuju.
- Konteks: JWT secret sudah di-*tanem* di env hermes (`C:\Users\Admin\AppData\Local\hermes\.env`)
  sebagai `JWT_SECRET` — dipakai nanti untuk auth admin.

### ☁️ Supabase: Peta Project & Aturan Migrasi (update 2026-10-12, WAJIB DIPATUHI)

Satu project Supabase dipakai bersama beberapa aplikasi (pemisahan via prefix
domain tabel + RLS + `appKey` untuk kontrak identity). Project yang diketahui:

| Project ref | Pemakai | Ciri tabel |
|---|---|---|
| `hhywrvedlwljawgxzpkq` ("mcfury's Project", ap-northeast-1) | **Control/Platform + HUB + Minimarket** | `pos_products`, `orders`, `loyalty_transactions`, `content_materials`, `outreach_contacts`, `social_posts`, `settings` + HUB: `global_identities`, `app_memberships`, `licenses`, `license_devices`, `identity_recovery_challenges` (kolom `global_identity_id`) |
| `ozsjflxfkbcygbuxgwyf` ("kasol", ap-southeast-1) | **TPA staging** + domain POS/identity | `tpa_*` (students, teachers, classes, guardians, memberships, spp_*, hafalan, iqro, schedules, locations, cash_flows) + tabel POS + `identity_otp_attempts`, `identity_recovery_audit`, `identity_recovery_challenges` (kolom **`identity_id`**), `identity_security_events` |

**Jebakan fatal:** `SUPABASE_URL` di root `.env.local` menunjuk project
**minimarket** (`hhywr...`), BUKAN TPA. Apply migrasi TPA tanpa target eksplisit
bisa merusak identity schema minimarket. Aturan wajib:

1. **Selalu target eksplisit** (`--ref=<project-ref>` atau cek dulu).
2. **Jalankan `check` dulu** — pastikan daftar tabel sesuai domain yang dimaksud
   sebelum apply apa pun.
3. **Jalur apply/verify:** `node <app>/apply-migrations-live.js
   check|apply|verify --ref=<ref>` (Management API `POST
   /v1/projects/{ref}/database/query` + `SUPABASE_ACCESS_TOKEN`).
   Script yang memanggil RPC `exec_sql` via `/rest/v1/` **tidak bekerja** di
   Supabase hosted.
4. **Kolom `pg_policies` bernama `policyname`** (bukan `policy_name`) — penyebab
   gagal migrasi 20261021 yang sudah diperbaiki.
5. Skema `identity_recovery_challenges` **beda antar project**: TPA (`ozsjf`)
   memakai kolom pemilik `identity_id`; project minimarket memakai
   `global_identity_id`. Migrasi identity harus memilih kolom secara dinamis.
6. Keamanan: service-role key & access token tidak pernah di-echo/di-commit;
   kredensial TPA ada di root `.env.local` (gitignored).

Status migrasi TPA staging per 2026-10-12: SPP/keuangan (`20261020`) + hygiene
identity (`20261021`) applied, verify 23/23 PASS. Detail: `tpa/STAGING_DEPLOYMENT.md`.

Status migrasi platform per 2026-10-24: `20261023_social_posts_status_terjadwal.sql` dan
`20261024_content_materials.sql` **sudah ter-apply** di `hhywr…` (tabel `content_materials`
= 141 baris, sudah di-seed dari `marketing-kit/`).

---

## 🧭 Control Center (admin) — Modul & Jalur Otomasi

`control/` = Control Center. Satu-satunya otoritas lisensi **dan** pusat operasi marketing.
Modul frontend di `control/js/`, API di `control/api/` (Vercel) **dan** `control/server.js`
(dev mirror lokal, port **8082**).

### Modul aktif (per 2026-10-24)

| Modul | File | Isi |
|---|---|---|
| Dashboard | `js/dashboard.js` | ringkasan pipeline & stats |
| Klien | `js/clients.js` | **Tab "👤 Per Akun"** (default) & **"📱 Perangkat"**; profil outlet, perangkat, bukti bayar, buat Akun Hub, paket multi-perangkat |
| Katalog | `js/catalog.js` | katalog produk + filter kode produk |
| Lisensi | `js/license-core.js`, `api/license.js` | generate/aktivasi/revoke serial HMAC |
| Outreach | `js/outreach.js` | pipeline prospek → kontak → DM |
| Sosmed | `js/sosmed.js`, `api/_social-fb-core.js` | koneksi Meta, posting, jadwal, komentar |
| Konten | `js/content.js` | materi & caption |
| **Kalender** 🆕 | `js/kalender.js` | 2 tab: **Jadwal Bulanan** (grid, "Isi bulan ini" dari bank materi, status `planned`/`sudah tayang`) + **Bank Materi** (141 materi) |
| **AI Variasi** 🆕 | `api/_ai-core.js`, `api/_ai-variasi-core.js`, `api/ai-variasi.js` | AI bikin 3–8 varian caption/komentar/brief dari materi, **server-side** |
| Settings | `js/settings.js` | konfigurasi |

### 📱 Otomatisasi Sosmed — 3 jalur, status tiap jalur

| Jalur | Butuh | Status 2026-10-24 |
|---|---|---|
| **A. Manual (Kalender)** | **NOL kredensial** | ✅ **HIDUP** — default sekarang. Atur rencana per tanggal+jam → salin caption → tayangkan sendiri → tandai "sudah tayang" |
| **B. Jadwal Meta Business** | `page_id` + `page_token` (Graph API Explorer, extend 60 hari → `/me/accounts`) | ⚙️ Kode siap (`schedule-remote`, status row `terjadwal`), **belum dipakai** — `settings.social_fb` belum ada |
| **C. OAuth Meta (FB Login for Business)** | `FB_APP_ID` + `FB_APP_SECRET` + redirect_uri terdaftar | ⚙️ Kode siap (`api/_social-oauth-core.js`, dipakai bersama `api/social-oauth.js`), **tidak bisa jalan — `FB_APP_ID`/`FB_APP_SECRET` KOSONG** di `.secure.env` |

> ⚠️ **Control TIDAK wajib punya Meta App** untuk auto-post — cukup `page_id` + `page_token`
> (jalur B). Yang butuh Meta App hanya **login OAuth** (jalur C). Jangan salah bikin blocker.
> ⚠️ **Auto-post tidak pernah hidup**: `social_posts` = **0 baris**. Status `planned` (rencana
> manual) **tidak pernah** diposting otomatis — `post-due` hanya mengambil status `approved`.

### 🤖 AI — server-side, bukan lewat runner lokal

`api/_ai-core.js` memanggil provider OpenAI-compatible langsung dari Control → **jalan terus
walaupun runner lokal mati**. Membaca `settings.ai_providers` → **kunci ini masih KOSONG**,
jadi fitur Variasikan akan gagal sampai diisi. Provider aktif yang dipakai: `openrouter`
(baseUrl hosted → bisa dipanggil dari Vercel). Kalau diganti ke provider lokal (`127.0.0.1`),
fitur ini **hanya jalan di dev**, bukan produksi.

> `control/api/_ai-core.js` **harus self-contained** — root Vercel = folder `control/`, jadi
> file di luar folder itu tidak ikut ter-deploy (import ke `agent/callAI.js` akan 404 di produksi).

### 🛠 Guardrails teknis Control Center (WAJIB)

1. **Satu sumber, dua tempat.** Logika inti di `control/api/_*-core.js`; dipakai oleh
   `control/api/*.js` (Vercel) **dan** `control/server.js` (dev). Jangan duplikasi logika.
2. **Whitelist `/api/rest` harus identik** di `api/rest.js` (produksi) dan `server.js` (dev).
   Lupa update salah satu → dev 200 tapi produksi 403. Guard otomatis:
   `npm run check:parity` (di `control/`). Jalankan setiap edit yang menyentuh tabel baru.
3. **Import modul tanpa query string.** Guard: `npm run check:imports`.
4. **Restart dev server setelah edit `control/server.js` / `control/api/*.js`.** File JS/CSS/HTML
   statis (`control/js/*`, `index.html`) dilayani fresh (`Cache-Control no-store`) → tidak perlu
   restart. Diagnosis "UI versi baru tapi API versi lama" = proses node basi.
5. **Hapus config + baris uji di `finally`** setiap kali uji coba Graph/DB, dan pakai
   `Prefer: return=representation` (tanpa itu POST PostgREST balas body null).

---

## 🤝 Program Mitra (referral & afiliasi) — app `mitra/`

> Spec penuh → **[`docs/ADR-VOUCHER-REFERRAL.md`](./docs/ADR-VOUCHER-REFERRAL.md)**.
> App terpisah di `mitra/` (Astro, port **13132**, domain `mitra.kasirsolo.com`) —
> **D1 direvisi 2026-10-25** dari `company/`.

| Halaman | Route | Isi |
|---|---|---|
| Landing | `/` | Narasi program (teks owner, persis) · 3 keunggulan · "Dua-duanya Menang" · 3 langkah · FAQ akordeon · klarifikasi istilah · section "Portal Mitra" · form daftar |
| Pendaftaran | `/daftar` | Form + "Habis Daftar, Terus Apa?" |
| Portal | `/portal` | Dashboard P0: Kode Saya · Poin & Saldo · Riwayat Referral · Klien Saya · Ajukan Pencairan · Riwayat Pencairan |
| Link referral | `/r/<kode>` | Halaman buat yang DIREKOMENDASIKAN (kode + pilih aplikasi + tombol diskon) |

**Aturan penting:**

1. **"Mitra" = orang yang merekomendasikan**, BUKAN pengguna aplikasi. Di website "Mitra
   Mesin Kasir" = klien. Dua konteks beda — jangan dibalik (ADR §14.2).
2. **Akses portal = token via WA** (`/portal?t=<token>`), nggak ada password. Validasi di
   server lewat RPC `partner_session(p_token)` — bukan di browser.
3. **Data portal = mock sampai Fase 1.** `src/lib/api.ts` nge-poll RPC; kalau 404 → jatuh
   ke `src/lib/mock.ts` + badge "Data contoh". Begitu RPC hidup, sumber data **otomatis**
   berubah tanpa edit markup.
4. **Poin 1 poin = Rp 1.000.** Siklus payout ikut **status mitra**: punya lisensi = **7 hari**,
   referral-only = **30 hari** — **berulang**, bukan sekali. Tier poin 50/5 tetap dari referee.
5. **Pencairan manual** — request dicatat, **owner transfer bank sendiri**. Minimal Rp 50.000.
6. **Link `/r/<kode>`** butuh rewrite Vercel (`vercel.json` → `/r?code=:code`). Di dev,
   `src/middleware.ts` meniru perilaku yang sama.
7. **Narasi = kutipan persis owner.** Kalau owner koreksi aturan → cek ADR dulu, bukan cuma edit teks.

---

## 🎨 Design System (Dari Rosok.zip)

### Color Palette

```css
--brand:        #F5821F    /* Primary orange */
--brand-dark:   #D6501C    /* Dark orange (gradient end) */
--brand-light:  #FDBA5C   /* Light orange (gradient start) */
--grad:         linear-gradient(135deg, var(--brand-light), var(--brand), var(--brand-dark))
--ink:          #2B2420    /* Text primary */
--ink-soft:     #6B5F54    /* Text secondary */
--paper:        #FBF6EF    /* Page background */
--surface:      #FFFFFF   /* Card background */
--line:         #ECE1D3   /* Border */
--green:        #3F8C52   /* Success */
--green-soft:   #E7F3E9   /* Success bg */
--red:          #D2483A   /* Danger */
--red-soft:     #FBEAE7   /* Danger bg */
```

### Typography

| Element | Font | Weight |
|---------|------|--------|
| Heading | Plus Jakarta Sans | 700-800 |
| Body | Inter | 400-600 |
| Monospace (serial) | Space Mono | 700 |

### UI Components

| Component | Style |
|-----------|-------|
| Topbar | Gradient background, fixed top, brand badge + trial chip + settings btn |
| Bottom Nav | Fixed bottom, 5 tabs (Dashboard, Kasir, Stok, Riwayat, Laporan) |
| Card | White bg, border `--line`, radius 20px, padding 16px, shadow |
| Stat Card | Color-coded (kas=orange, stok=teal, beli=red, jual=green, laba=yellow) |
| Button Primary | Gradient bg, white text, radius 14px, shadow |
| Button Outline | White bg, border, ink text |
| Button Danger | Red-soft bg, red text |
| Sheet/Overlay | Full-screen bottom sheet, rounded top, handle bar |
| Input | Border `--line`, radius 12px, focus orange border |
| Tab Button | Small pill, active = orange gradient |

### Layout Pattern

```
┌──────────────────────┐
│  TOPBAR (fixed)      │  ← gradient bg, brand + trial + settings
├──────────────────────┤
│                      │
│  SCREEN CONTENT      │  ← max-width 560px, margin auto
│  (scrollable)        │
│                      │
├──────────────────────┤
│  BOTTOM NAV (fixed)  │  ← 5 tabs: Dash│Kasir│Stok│Riwayat│Laporan
└──────────────────────┘

Sheets overlay everything when opened:
┌──────────────────────┐
│  OVERLAY (dim)       │
├──────────────────────┤
│  BOTTOM SHEET        │  ← rounded top, handle, title, form, buttons
└──────────────────────┘
```

---

## 🗂️ Struktur File Aplikasi Klien

### Pola Single-HTML (Referensi dari rosok.zip)

```
nama-aplikasi/
├── index.html              # Single file (~250-400KB)
│                           #   - Dexie.js embedded inline
│                           #   - CSS inline di <style>
│                           #   - JS inline di <script>
├── assets/
│   ├── logo.png            # 256x256
│   ├── icon-192.png        # 192x192 (maskable)
│   ├── icon-512.png        # 512x512 (maskable)
│   ├── favicon-16.png
│   ├── favicon-32.png
│   └── splash-1028.png     # iOS splash screen
├── manifest.json           # PWA manifest
├── sw.js                   # Service Worker
├── vercel.json             # Vercel config
└── .vercelignore           # Files to ignore
```

### Pola Modular (Rencana, TIDAK JADI REFERENSI SEKARANG)

```
nama-aplikasi/
├── index.html              # HTML shell only
├── style.css               # CSS terpisah
├── dexie.min.js            # Library eksternal
├── assets/
├── manifest.json
├── sw.js
├── vercel.json
├── .vercelignore
└── js/
    ├── app.js              # Entry point
    ├── db.js               # Dexie setup
    ├── license.js          # License logic
    └── ...
```

---

## 🔐 Sistem Lisensi (WAJIB)

Semua aplikasi klien HARUS memiliki validasi lisensi di onboard.
**Konsep 2026-08-10: HYBRID** — offline HMAC + kontrol penuh via control/server.
Detail: lihat section "🎯 Keputusan Strategis Saat Ini" di atas. Intinya:
- Operasional offline (Dexie), **transaksi tidak pernah ke server**.
- Lisensi & profil klien disimpan di server (Supabase) sebagai **database platform**.
- `control/` = satu-satunya sumber kebenaran generate/aktif/revoke/blacklist.
- App klien validasi offline (HMAC) → kawal sync status+blacklist saat online.

### Konstanta yang Harus Diganti per Aplikasi

```javascript
// DI dalam <script> index.html — GANTI untuk setiap aplikasi baru:
const PRODUCT_SALT = "KASIRSOLO-ROSOK-HMAC-V2";  // ← GANTI salt
const TRIAL_DAYS = 7;
const MAX_EXTENSIONS = 20;
const EXTEND_DAYS = 1;
```

### Format Serial

```
KSR-A1B2-C3D4-99-X7K9M2
│   │      │    │  └── HMAC signature (6 char, Base32)
│   │      │    └─────── Expiry code (99=seumur hidup, NN=bulan, ND=hari)
│   │      └──────────── Device Code part 2
│   └─────────────────── Device Code part 1
└─────────────────────── Product Prefix (3-5 huruf kapital)
```

### Algoritma (Copy-Paste dari rosok.zip)

Kode license module lengkap ada di baris ~1056-1170 `rosok/index.html`.
Copy paste dan ganti `PRODUCT_SALT` untuk aplikasi baru.

### Flow Onboarding — SMART GATE (STANDAR semua app klien)

Satu overlay gate (`#licenseGate`) yang **dual-mode** menangani 3 state, sehingga
onboarding, trial jalan, dan trial-habis konsisten di semua app (referensi: kaki5,
`js/app.js` + `js/license.js`).

```
State (getLicenseStatus):
  none     → user baru        → mode ONBOARDING
  trial    → trial jalan      → SKIP gate, langsung masuk app
  active   → lisensi aktif    → SKIP gate, langsung masuk app
  expired  → trial/lisensi habis → mode LISENSI (input serial)
```

**Mode ONBOARDING — 2-LANGKAH (tanpa checkbox)** (`#gateOnboarding`) — untuk `status = none`:
- **Langkah 1**: Input **Nama Usaha** (wajib) → tombol **"🚀 Mulai Masa Percobaan"**
  (`#trialBtn`, handler `_ksr_proceedToTC`). **Trial BELUM dimulai** di sini.
- **Langkah 2**: Modal `#tcModal` (Syarat & Ketentuan) tersaji dengan **2 tombol**:
  **🔙 Batal** (`_ksr_cancelTC` → kembali ke Langkah 1, nama tetap tersimpan)
  / **✓ Setuju & Lanjut** (`_ksr_acceptTC`).
- **Trial mulai DI Langkah 2** (`_ksr_acceptTC` → `startTrial()`), lalu tutup gate + `boot()`.
- Tombol **Batal aman** karena trial belum dimulai — desain ini menggantikan checkbox
  S&K lama (dihapus total karena berulang bikin bug & kurang ramah user gaptek).

**Mode LISENSI** (`#gateLicenseBlock`, di-render dinamis `gateLicenseHtml()`) — untuk `status = expired`:
- Teks "Masa Coba / Lisensi Habis" + input kode lisensi.
- Tombol: **💬 Beli** → `contactViaWA()` · **🔓 Aktifkan** → `activateSerial()`.
- **"Perpanjang masa coba (+1 hari)"** sebagai TEKS link di bawah (share-to-extend, maks `MAX_EXTENSIONS`x) + counter `x/20`.
- Sembarang berhasil → tutup gate + `boot()`.

**Kontrak struktur (index.html):**
```html
<div id="licenseGate">                <!-- overlay full-screen -->
  <div id="gateOnboarding">…</div>    <!-- static: nama usaha + S&K + trial btn -->
  <div id="gateLicenseBlock"></div>   <!-- static: diisi dinamis saat expired -->
</div>
<div class="modal-overlay" id="tcModal">…Syarat & Ketentuan…</div>
```

**Kontrak fungsi (app.js):** `renderGate(status)` pilih mode; `gateLicenseHtml(status)`
render mode lisensi; handler onboarding `_ksr_proceedToTC/_ksr_cancelTC/_ksr_acceptTC`,
mode lisensi `_ksr_buyGate/_ksr_activateGate/_ksr_extendGate`, `resolveLicenseGate()`.
**`init()`**: active/trial → `boot()`; else → `renderGate` + tampilkan gate.

**Aturan anti-double-overlay:** `checkLicenseGate()` (license.js) **skip** `#lockOverlay`
selama `#licenseGate` terlihat (`display !== 'none'`). Aktivasi/perpanjang dari gate
harus memanggil `boot()`.

> Template & catatan adaptasi per app: skill `kasol-ecosystem-apps` → `references/smart-gate.md`.

---

## ✨ Fitur Standar Global (UX & Anti-Gaptek) — WAJIB Semua App Klien

Selain arsitektur & lisensi, ada **standar fitur/UUX** yang wajib diadopsi semua app klien
(referensi & sumber kebenaran implementasi: `kaki5/`). Prinsip inti: **1 layar = 1 keputusan,
narasi ramah, fungsi tersembunyi di balik tombol akses** — targetnya pengguna non-teknis.

| # | Fitur Standar | Kontrak / Detail |
|---|---------------|------------------|
| 1 | **Onboarding 2-langkah tanpa checkbox** | Step1 **Nomor WhatsApp** (tervalidasi strict ID) → Step2 modal S&K (Batal/Setuju); trial mulai di Step2. Nama Usaha diisi belakangan via profil/banner. Lihat section Smart Gate di atas. |
| 2 | **Profil tersruktur (region picker)** | 4 field inti: Nama Usaha, Nama Pemilik, No WhatsApp, Alamat. Alamat pakai rantai dropdown **Provinsi → Kota/Kab → Kecamatan → Desa** (API emsifa, `js/region.js`) + detail. `id` + `nama` disimpan untuk CRM analitik. WAJIB izin `https://raw.githubusercontent.com` di CSP `connect-src`. |
| 3 | **Auto-sync profil (background)** | Tiap simpan profil panggil `ensureSynced()` (di semua handler save). Offline-first tetap — retry saat online. JANGAN tampilkan kartu "Sinkronisasi" di layar (fungsi jalan otomatis). |
| 4 | **Banner "Lengkapi Profil" (center-large immersive)** | `#profileBanner` `position:fixed;inset:0;z-index:520` + backdrop blur, kartu ~420px. Muncul saat profil belum lengkap (`!namaPemilik || !noWhatsapp || (!kabkota && !alamat)`). CTA → halaman Pengaturan; dismiss "Nanti Saja"/✕/klik backdrop. |
| 5 | **Kontrak z-index** | `header 100 < bottom-nav 350 < gate #licenseGate 500 < banner profil 520 < modal-overlay 600 < confirm-overlay 610 < toast 620 < sheet pembelian 640 < #updateOverlay 800` (force-update overlay menutup SEMUA). Modal SESUATU berada DI ATAS gate (jangan sampai tertutup). |
| 6 | **Copy benefit-driven (non-teknis)** | Narasi berfokus KEUNTUNGAN user (bantuan lebih cepat, tips sesuai daerah), bukan teknis (sinkronisasi, statistik, akurasi). Bahasa sederhana, ga pakai jargonya sistem. |
| 7 | **Akorodion tutorial/Bantuan auto-close** | Halaman Bantuan pakai akordeon yang **hanya satu terbuka** (`toggleTutorial` menutup panel lain). Isi tutorial harus **akurat berdasar kode asli** (bukan karangan/perkiraan visual). |
| 8 | **Pengaturan ramping** | Jangan penuhi layar pengaturan dengan kartu/fitur. Fungsi tersembunyi di balik **satu tombol akses** — mis. semua urusan lisensi (status/masa coba/kode/aktifkan/beli) cukup lewat **1 tombol "🎫 Kelola Lisensi"**. Item "🩺 Diagnosa Sinkronisasi" wajib ada di kartu Data & Cadangan (referensi `kaki5/js/sync.health.js`). |
| 9 | **PWA Install Detection** | Deteksi otomatis kalau PWA sudah terinstal (standalone display-mode, iOS standalone, SW controlling, localStorage flag). Tidak tampilkan banner install jika sudah terpasang. Persist flag ke localStorage, listen `display-mode` change. Update versi: **overlay force-update full-screen** (`#updateOverlay`) dengan catatan rilis dari `version.json.notes` + tombol OKE → `performForceUpdate()` (SW update → reload → profil tersinkron). Referensi: `kaki5/js/pwa.js`, `kaki5/js/update.js`. |

**Pola kode wajib (dari kaki5):**
- `settings.js` → `saveOwner/saveWa/saveAlamat/saveNamaUsaha` semua akhiri dengan `ensureSynced(); checkProfileNotification();`.
- `sync.js` → `ensureSynced({force,silent})`; `isSyncConfigured()`.
- `region.js` → `setupRegionPicker({provSel,kabSel,kecSel,desaSel,state})`, state membaca `.provinsi_id/.provinsi/.../.desa_id/.desa`.
- `index.html` → banner `#profileBanner` + kelas `.prof-banner-*`; halaman Bantuan `#bantuanContent`.
- `pwa.js` → `checkPWAInstalled()`, `isPWAInstalled`, `setupPWA()` initial check + `matchMedia` listener.

**Template adaptasi per app:** skill `kasol-ecosystem-apps` → `references/smart-gate.md`
(+ pola banner profil & akordeon bantuan di bagian catatan adaptasi).

---

## 🗄️ Database Schema (Dexie.js)

### Pola Dasar (Copy dari rosok.zip)

```javascript
const db = new Dexie("NamaAplikasiDB");

db.version(1).stores({
  settings: 'key',
  // tabel dasar
});

db.version(2).stores({
  // tabel v1 + tabel baru
});
```

### Tabel Standar yang Harus Ada

| Tabel | Primary Key | Index | Fungsi |
|-------|-------------|-------|--------|
| `settings` | `key` (PK) | — | Pengaturan: bizName, setupDone, trialStart, licenseActivatedAt, deviceCode |
| `transaksi` | `++id` | `tipe, tanggal` | Catatan transaksi |
| `transaksiItem` | `++id` | `transaksiId` | Item per transaksi |

### Tabel Opsional (sesuai kebutuhan aplikasi)

| Tabel | Fungsi |
|-------|--------|
| `kategori` | Kategori barang/produk |
| `produk` | Daftar produk dengan harga |
| `pelanggan` | Data pelanggan |
| `kas` | Catatan kas masuk/keluar |
| `kasShift` | Buka/tutup kas shift |
| `supplier` | Data supplier |

---

## ☁️ Sinkronisasi Profil Klien (CRM → Supabase)

App klien mengirim **profil identitas outlet** (bukan transaksi) ke tabel `clients`
di Supabase, lalu ditampilkan & dikelola di repo `control/` (tab **Klien**). Detail
arsitektur: [`CLOUD-ROADMAP.md`](./CLOUD-ROADMAP.md) (Lapisan A).

### Tabel `clients` (1 baris per outlet)
Kunci natural = `unit_id`. Kolom: `unit_id, app_type, device_code, install_id,`
`nama_usaha, nama_pemilik, no_whatsapp,`
`provinsi_id/provinsi, kabkota_id/kabkota, kecamatan_id/kecamatan, desa_id/desa, alamat_detail,`
`first_seen, last_seen, user_id`.

- **Wilayah tersruktur** (`id` + `nama`) — supaya agregasi analitik (per provinsi/kabupaten)
  akurat, bukan free-text. Data wilayah dari API **emsifa** (`js/region.js`).
- SQL DDL: `supabase/migration-clients.sql`.

### Keamanan — Anonymous Auth + RLS
- Setiap perangkat pakai **anonymous sign-in** (`signInAnonymously`); baris punya
  `user_id = auth.uid()`.
- RLS `clients own select/insert/update` → tiap device cuma bisa ubah barisnya sendiri.
- Admin baca/ubah **semua** baris via **service_role** key (bypass RLS).
- Syarat: Anonymous Auth **harus diaktifkan** di project (config auth
  `external_anonymous_users_enabled=true`).

### Pola modul `sync.js` (contoh: kaki5)
- `ensureSynced()`: `signInAnonymously()` → claim `device_known` RPC →
  **baris belum ada = insert; baris sudah ada = update HANYA lewat jalur
  user-intent (`force`)**. Push otomatis (boot/retry latar) **backfill-only**
  — cloud tidak pernah ditimpa data lokal (aturan pemilik 2026-08-29,
  lihat bagian "Arah Sinkronisasi" di atas).
- **Dua skenario**: user baru push saat onboarding/aktivasi; user lama di-**backfill
  otomatis** sekali di boot lewat flag lokal `sync` (`none`/`pending`/`synced`),
  retry saat online. **Offline-first tetap dijaga.**
- Arah sebaliknya: `pullCloudProfileIfOnline()` / `pullCloudProfileTo()` pull
  profil cloud → lokal di tiap boot (fase 1b), SEBELUM render UI. Nilai kosong
  dari cloud sengaja ikut menimpa lokal (C2v2 — admin bisa membersihkan buffer).
- Konfig (URL + anon key) di `js/supabase-config.js` (anon = public, aman untuk browser);
  fallback anon key di `api/supabase-config.js` WAJIB identik dengan klien
  (insiden `******` 2026-08-29: placeholder menimpa kunci valid → sync mati diam-diam).

### Catatan lisensi
- Prefix produk kaki5 = **`KK5`** (bukan `K5`) — admin product registry wajib
  `KK5` agar serial yang digenerate diterima app. (`KSR/RTL` sesuai app.)
- **Status (2026-08-08):** ke-3 app klien memakai skema **HMAC-V2** dan
  memvalidasi serial yang di-generate admin — prefix `KSR`(rosok),
  `KK5`(kaki5), `RTL`(retail), salt masing-masing
  `KASIRSOLO-{APP}-HMAC-V2`. Device-match memakai `normalizeDeviceCode(deviceId)`
  (uppercase, buang non-alfanumerik, 8 karakter pertama, pad `X`).
- **Enum `license_status` di `clients`** (sumber kebenaran) & perlakuannya di
  `syncLicenseStatus()` (kaki5, sejak 2026-08-29/v102):
  * `aktif` (+ serial) → persist ke lokal + pull profil.
  * `batal` / `nonaktif` / `revoked` → revoke lokal (app terkunci, offline tetap terkunci).
  * `belum` / kosong → lokal `active` diturunkan ke **trial berjangkar `first_seen`** (T12);
    trial/none lokal dibiarkan. Bukan revoke.
  * Error network / baris tak terbaca → JANGAN ubah state lokal (anti revoke palsu, H3).

**Kredensial Supabase** disimpan di env hermes (`C:\Users\Admin\AppData\Local\hermes\.env`):
`SUPABASE_PROJECT_REF`, `SUPABASE_ACCESS_TOKEN`, `SUPABASE_SERVICE_ROLE_KEY`,
`SUPABASE_URL`, `SUPABASE_ANON_KEY`, **`JWT_SECRET`** (kunci JWT admin, sudah ditanam pemilik).

### Supabase Access Token (Hermes Env)

**Access Token Supabase sudah disimpan di Hermes environment** (`C:\Users\Admin\AppData\Local\hermes\.env`):

```bash
SUPABASE_PROJECT_REF=hhywrvedlwljawgxzpkq
SUPABASE_ACCESS_TOKEN=sbp_xxx...  # Personal Access Token dengan scope admin
```

### Kegunaan
Agent/assistant (Hermes) **bisa eksekusi migration SQL langsung** via Supabase Management API tanpa manual ke dashboard:

```bash
# Contoh: Jalankan migration via Management API
curl -X POST "https://api.supabase.com/v1/projects/${SUPABASE_PROJECT_REF}/database/query" \
  -H "Authorization: Bearer ${SUPABASE_ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"query": "CREATE TABLE ..."}'
```

### Workflow Migration (Otomatis)
1. **Agent baca file SQL** dari `supabase/migration-*.sql`
2. **Agent POST ke Management API** pakai `SUPABASE_ACCESS_TOKEN`
3. **Supabase eksekusi query** → return hasil
4. **Agent verifikasi** → update checklist/docs

> **Tidak perlu manual** buka Supabase Dashboard → SQL Editor → paste query. Agent handle end-to-end.

> ⚠️ **Tambahan 2026-10-12:** `SUPABASE_PROJECT_REF` di env hermes (`hhywr...`)
> adalah project **minimarket**. Untuk TPA, ref staging-nya `ozsjflxfkbcygbuxgwyf`
> dan kredensialnya ada di root `.env.local`. Pakai runner siap-pakai
> `tpa/apply-migrations-live.js` (mode `check`/`apply`/`verify` dengan
> `--ref=<ref>`); selalu `check` daftar tabel dulu — satu Management API token
> berlaku lintas project, salah ref = salah target.

## 🌐 PWA

### manifest.json Template

```json
{
  "name": "Kasir Solo - NamaAplikasi",
  "short_name": "NamaAplikasi",
  "description": "Deskripsi singkat aplikasi.",
  "start_url": "./index.html",
  "display": "standalone",
  "background_color": "#FFF8EF",
  "theme_color": "#E85D1F",
  "orientation": "portrait-primary",
  "lang": "id",
  "icons": [
    { "src": "icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

### Service Worker (sw.js)

Network-first untuk HTML, cache-first untuk aset statis.
Naikkan versi **5 titik serentak** tiap rilis: `APP_VERSION`+`CACHE_BUST` (`js/version.js`),
`version`+`cacheBust`+`notes` (`js/version.json` — `notes` = catatan rilis untuk
overlay force-update), `CACHE_NAME` (`sw.js`), `?v=` (`index.html` & README).

---

## 🚀 Deploy

### vercel.json Template

```json
{
  "name": "kasir-nama-aplikasi",
  "buildCommand": null,
  "outputDirectory": ".",
  "framework": null,
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }],
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "X-Frame-Options", "value": "DENY" },
        { "key": "X-XSS-Protection", "value": "1; mode=block" }
      ]
    }
  ]
}
```

### Deployment — Alur 2-Mirror (Vercel Git Integration, tanpa GitHub Actions)

> GitHub Actions **tidak dipakai** lagi. Semua `.github/workflows/*` sudah dihapus. Deploy otomatis lewat **Vercel git integration** (auto-detect).

**Folder kerja TIDAK pernah push langsung ke GitHub.** Setiap app punya **2 proyek Vercel** (dua environment) yang terhubung ke repo GitHub berbeda:

1. **BETA** — mirror `kasol-beta` → push GitHub BETA main → deploy `<app>.vercel.app`. Dijalankan dari folder kerja via `.\push-beta.ps1` (sync worktree, squash 1 commit snapshot, push).
2. **LIVE** — mirror `kasol` → push GitHub LIVE main → deploy `<app>.kasirsolo.com`. Dijalankan dari mirror beta via `.\push-live.ps1` (fetch beta main, sync, squash, push) — hanya dari beta yang **stabil**.
3. Ada error di URL beta? → kembali ke folder kerja, perbaiki, rilis beta lagi (langkah 1) sampai stabil, baru rilis live.

Tidak ada secrets CI (`VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID_*`).

| App | Vercel Project | Root Directory | Build Command |
|-----|----------------|----------------|---------------|
| rosok | `kasir-rosok` | `rosok/` | (kosong) |
| retail | `kasir-retail` | `retail/` | (kosong) |
| shop | `shop` | `shop/` | (kosong) |
| kaki5 | `kasir-kaki5` | `kaki5/` | (kosong) |
| control | `control` | `control/` | `node scripts/build-env-loader.mjs` |

Env var per project (mis. `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` untuk admin) diatur di dashboard Vercel / konektor Vercel+Supabase — **tidak di-commit**.

**Wajib per app:** jika app PWA meng-load `dexie.min.js`, file itu harus ter-track git. Root `.gitignore` meng-ignore `*.min.js` sehingga tiap app butuh pengecualian `!<app>/dexie.min.js`; kalau tidak → deploy = `Dexie is not defined` (app mati).

---

## 📝 Naming Convention

| Elemen | Convention | Contoh |
|--------|-----------|--------|
| Folder | lowercase, tanpa spasi | `rosok/`, `konveksi/` |
| Database Dexie | PascalCase + "DB" | `KasirSoloRosokDB` |
| Product Prefix | 3-5 huruf kapital UNIK | `KSR`, `KKN`, `KSL` |
| Product Salt | `KASIRSOLO-{APP}-HMAC-V2` | `KASIRSOLO-LAUNDRY-HMAC-V2` |
| Vercel project | `kasir-nama-aplikasi` | `kasir-konveksi` |

---

## 📚 Dokumentasi Terkait

| Dokumen | Lokasi |
|---------|--------|
| **Status live ekosistem** (angka DB, deploy, proses, blocker) | **`docs/STATUS-LIVE.md`** |
| **ADR Hub (akun utama & lisensi berbasis akun)** | **`docs/HUB-DESIGN-DECISIONS.md`** |
| Ekosistem overview | `shop/docs/00-ekosistem.md` |
| Arsitektur shop | `shop/docs/02-architecture.md` |
| Arsitektur admin | `control/docs/02-architecture.md` |
| Sistem lisensi | `control/docs/04-license-system.md` |
| Agent AI | `control/docs/12-agent-ai.md` |
| Changelog Control Center | `control/CHANGELOG.md` |
| **Cloud & Dashboard Hub (roadmap)** | **`CLOUD-ROADMAP.md`** |
| Rosok spesifik | `rosok/AGENTS.md` |
| Retail spesifik | `retail/AGENTS.md` |
| Kaki5 spesifik | `kaki5/AGENTS.md`, `kaki5/README.md`, `kaki5/docs/DEVELOPER.md`, `kaki5/docs/REGRESSION-CHECKLIST.md`, `kaki5/DESIGN.md` |
| Kaki5 Stage 6–7 (backup & cloud envelope) | `kaki5/docs/STAGE6-STORAGE-POLICY-PROPOSAL.sql`, `kaki5/docs/STAGE7-BETA-RELEASE.md`, `kaki5/docs/STAGE7-P2-LIVE-CHECKLIST.md` |
| Hardening stage 4–6 (auth, receipt, storage) | `docs/STAGE4-AUTH-SESSION-HARDENING.md`, `docs/STAGE5-RECEIPT-PRIVACY-HARDENING.md`, `docs/STAGE6-STORAGE-POLICY-VERIFICATION.md` |
| TPA spesifik | `tpa/STAGING_DEPLOYMENT.md` (status staging & migrasi), `tpa/IDENTITY-CONTRACT.md` (kontrak identitas), `tpa/PLAN-LOGIN-WHATSAPP-PIN.md` (keputusan login) |
| Website korporat (proyek terpisah) | `C:\Users\Admin\Documents\kasol-v2` (Next.js/Turbo/Firebase, port 3000), `company/README.md` (Astro, port 13131), `mitra/README.md` (Program Mitra, Astro, port 13132) |

---

*CONTEXT.md — KASIRSOLO Ecosystem Standards*
*PT Mesin Kasir Solo — Agustus 2026 · terakhir diperbarui 2026-10-25*
*Referensi utama: rosok.zip (single HTML production build)*
