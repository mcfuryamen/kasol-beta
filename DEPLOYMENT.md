# Kasir Solo - Multiple Apps Repository

Repository ini berisi semua aplikasi Kasir Solo dalam satu monorepo. Setiap aplikasi di-deploy secara terpisah ke Vercel sebagai **static site tanpa build step**.

> **Catatan:** Deploy **TIDAK lagi memakai GitHub Actions.** Semua workflow `.github/workflows/*` sudah dihapus. Deploy sekarang otomatis oleh **Vercel git integration** (auto-detect) per project.
>
> **Catatan (2026-08):** Selective deploy memakai fitur **Vercel "Skip Unaffected Projects"** via **npm workspaces** — bukan `vercel-ignore.sh`. Detail di bawah.
>
> **Catatan (2026-08-28) — ALUR RILIS 2-MIRROR:** Folder kerja TIDAK pernah langsung di-push ke GitHub. Rilis mengalir melalui 2 mirror lokal: **`kasol-beta`** (→ GitHub BETA, subdomain `vercel.app`) dan **`kasol`** (→ GitHub LIVE, custom domain `kasirsolo.com`). Lihat [§ Alur Rilis](#-alur-rilis-2-mirror).

## 📁 Struktur Aplikasi

```
kasol/
├── admin/                      # Dashboard admin marketing (Supabase-connected, PWA)
├── rosok/                      # Aplikasi Kasir Rosok (PWA)
│   ├── index.html
│   ├── sw.js                   # Service Worker
│   ├── manifest.json           # PWA manifest
│   ├── dexie.min.js            # Library Dexie (vendor, Wajib di-track git)
│   ├── assets/                 # Logo, icon
│   ├── vercel.json             # Vercel config
│   └── .vercelignore           # Vercel ignore
├── gerobak/                    # Aplikasi Kasir Gerobak
├── retail/                     # Aplikasi Kasir Retail
├── kaki5/                      # Aplikasi Kasir Kaki Lima (PWA)
├── landing/                    # Landing Page Marketing
├── CONTEXT.md                  # Standar ekosistem (authoritative)
├── DEPLOYMENT.md                # Dokumen ini
├── CLOUD-ROADMAP.md             # Roadmap cloud & dashboard hub
├── .gitignore
├── .vercelignore
└── README.md
```

## 🚀 Deployment (Vercel Git Integration — No GitHub Actions)

Setiap aplikasi = **satu Vercel project terpisah**, terhubung ke repo ini dengan **Root Directory** menunjuk ke folder aplikasinya. Begitu ada **push ke branch utama**, Vercel **otomatis deploy** hanya project yang foldernya berubah.

### Selective Deploy: Skip Unaffected Projects (npm workspaces)

Repo memakai **npm workspaces** supaya Vercel bisa otomatis cuma build project yang foldernya berubah. Konfigurasi ada di `package.json` root:

```json
{
  "name": "kasol",
  "private": true,
  "packageManager": "npm@11.17.0",
  "workspaces": [
    "admin", "gerobak", "kaki5", "landing",
    "landing-new", "retail", "rosok", "fnb"
  ]
}
```

**Syarat wajib (sudah dipenuhi):**
1. `package.json` di root dengan `workspaces` yang nge-list SEMUA folder app.
2. Setiap app punya `package.json` dengan **`name` unik** dan `"private": true`.
3. Semua project Vercel terhubung ke repo GitHub yang sama.
4. **Toggle "Skip deployment" di-settings ENABLED** per project (default): *Settings → Build and Deployment → Root Directory → Skip deployment = On*.

**Kenapa ini bener & cara kerjanya:**
- Vercel narik **dependency graph** antar package via workspaces untuk mutusin project mana yang berubah.
- Hanya project yang source code / dependency / lockfile-nya berubah yang di-deploy.
- Perubahan di root (README, docs, script, API key) → dianggap global → deploy semua (karena bukan bagian workspace).
- Ini **TIDAK mengonsumsi concurrent build slot** (beda sama Ignored Build Step) dan **tidak butuh `vercel-ignore.sh`**.
- `packageManager` di root nge-lock npm supaya Vercel deteksi manager dengan pasti (ngga rely semata pada lockfile).

> ⚠️ **PENTING — jangan pakai `vercel-ignore.sh` lagi.** Kalau project masih punya **Ignored Build Step** yang mengarah ke script itu, hapus field-nya di dashboard (Settings → Build and Deployment → bersihkan kolom *Ignored Build Step*). Karena file `vercel-ignore.sh` nggak ada di repo, kalau dibiarkan script-nya bakal fail dan Vercel fallback deploy semua project.

### Cara Kerja:
1. **Push perubahan di `rosok/`** → project Vercel Rosok deploy otomatis (project lain skip)
2. **Push perubahan di `kaki5/`** → project Vercel Kaki5 deploy otomatis (project lain skip)
3. **Push perubahan di `landing/`** → project Vercel Landing deploy otomatis (project lain skip)
4. **dst.** untuk `admin/`, `gerobak/`, `retail/`, `fnb/`, `landing-new/`
5. Perubahan di file root (README, dll) → dianggap global → deploy semua project

### Setup Vercel Project (sekali saja per app):

Untuk setiap aplikasi, buat Vercel project dan hubungkan ke repo dengan:

| App | Vercel Project | Root Directory | Build Command | Output |
|-----|----------------|----------------|---------------|--------|
| rosok | `kasir-rosok` | `rosok/` | (kosong) | `.` |
| gerobak | `kasir-gerobak` | `gerobak/` | (kosong) | `.` |
| retail | `kasir-retail` | `retail/` | (kosong) | `.` |
| landing | `kasir-solo-landing` | `landing/` | (kosong) | `.` |
| kaki5 | `kasir-kaki5` | `kaki5/` | (kosong) | `.` |
| admin | `kasir-admin` | `admin/` | `node scripts/build-env-loader.mjs` | `.` |

> **Catatan admin:** `admin/` memakai satu build command kecil (`scripts/build-env-loader.mjs`) yang menulis `js/env-loader.js` dari **Vercel environment variables** saat deploy — key Supabase **tidak pernah di-commit**. Env diisi lewat konektor **Vercel + Supabase**.

### Environment Variables

Tidak ada secrets GitHub Actions lagi (`VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID_*` **tidak dipakai**). Cukup:
- Set **env var per project** di dashboard Vercel (mis. admin: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` via konektor Supabase).
- `.env.local` **tidak** di-commit (gitignored); gunakan hanya untuk dev lokal.

## ⚠️ Aturan Penting

- **`dexie.min.js` harus di-track git** untuk tiap app PWA yang meng-load-nya (kaki5, rosok, admin, retail). Root `.gitignore` meng-ignore `*.min.js`, jadi tiap app wajib punya pengecualian `!<app>/dexie.min.js`. Kalau tidak, file tidak masuk repo → deploy = `Dexie is not defined` (app mati).
- **KONVENSI RILIS — satu bump versi = 4 file sekaligus** (jangan pecah — insiden v100, 2026-08-29: `sw.js`+`index.html` dinaikkan tanpa `version.js`/`version.json` → overlay update mati total & cache SW tak pernah invalid):
  1. `<app>/js/version.js` — `APP_VERSION` + `CACHE_BUST`
  2. `<app>/js/version.json` — `version` + `cacheBust` + `notes` (isi overlay update)
  3. `<app>/sw.js` — `CACHE_NAME`
  4. `<app>/index.html` — `?v=` pada script entry
  `push-beta.ps1` kini mencetak `[WARN]` jika `kaki5/` berubah tanpa bump `version.json`.
- **Drift guard otomatis** — `push-beta.ps1` & `push-live.ps1` kini menjalankan `Test-SnapshotDrift` SEBELUM commit: staged index (`git ls-files --cached` = isi persis yang akan di-commit) HARUS identik dengan pohon sumber (`work/main` untuk beta, `beta main` untuk live). Kalau tidak, skrip **exit 1** sebelum push. Mencegah kejadian 13 aset `kaki5/` hilang dari snapshot (404 di kq5beta, 2026-08-29). Non-blocking warning juga untuk version-bump.
- **Alur mirror TANPA branch `preview`** (refactor 2026-08-29): mirror beta/live cukup `git fetch` dari sumbernya, bangun snapshot di branch sementara `_release` (orphan — tanpa history), commit, lalu rename `_release` → `main`, dan push `main` ke GitHub. Tidak ada branch `preview` yang dibuat/di-push ke mana pun. Perhatian encoding: file `.ps1` berisi karakter non-ASCII (em-dash dll) **wajib UTF-8 dengan BOM** — PowerShell 5.1 membaca file tanpa BOM sebagai ANSI dan em-dash jadi "string terminator" palsu (parse error misterius).
- Fallback anon key di `<app>/api/supabase-config.js` **harus identik** dengan `<app>/js/supabase-config.js` — placeholder `'******'` di server menimpa kunci valid klien dan mematikan sinkronisasi diam-diam (insiden 2026-08-29).
- Bump versi cache di `sw.js` setiap ada perubahan aset agar PWA pengguna tidak menyimpan versi lama (tercakup dalam konvensi 4-file di atas).

## 📝 Development Flow (Alur 2-Mirror)

Folder kerja **tidak pernah push langsung ke GitHub**. Semua rilis mengalir
melalui **2 mirror lokal** yang masing-masing mewakili satu lingkungan deploy:

```
┌──────────────────────────────────────────────────────────────────────────┐
│  1. FOLDER KERJA (produksi/kerja harian)                                 │
│     C:\Users\Admin\Documents\kasol\<app>                                 │
│     → edit & uji di sini. Commit WORKING TREE LOKAL bila perlu           │
└────────────────────────────────┬─────────────────────────────────────────┘
                                 │ sync (push-beta.ps1: squash → GitHub BETA main)
                                 ▼
┌──────────────────────────────────────────────────────────────────────────┐
│  2. MIRROR BETA  C:\Users\Admin\Documents\GitHub\kasol-beta              │
│     GitHub utama: BETA (main)                                            │
│     URL (Vercel): https://<app>.vercel.app                               │
│     → push-beta.ps1: sinkron kerja → squash sekali → push GitHub BETA    │
└────────────────────────────────┬─────────────────────────────────────────┘
        ada error?               │ stabil (tes manual di URL beta)?
        ▲                        ▼
        └── kembali ke langkah 1 ┌─────────────────────────────────────────────────┐
            (kerja → beta,       │  3. MIRROR LIVE  C:\Users\Admin\Documents\GitHub\kasol
             ulangi hingga       │     GitHub: LIVE (main)                        │
             stabil)             │     URL: https://<app>.kasirsolo.com           │
                                 │     → push-live.ps1: fetch beta main → sync →  │
                                 │       squash sekali → push GitHub LIVE         │
                                 └─────────────────────────────────────────────────┘
```

```powershell
# 1. Folder kerja — edit & uji, commit lokal bila perlu
# 2. Rilis BETA — jalankan dari folder kerja:
.\push-beta.ps1
#    → sinkron worktree ke mirror kasol-beta, squash pull-request sekali,
#      push GitHub BETA main → Vercel deploy URL <app>.vercel.app (beta)
# 3. Tes di URL beta. Jika ada error → kembali ke langkah 1 & ulangi.
# 4. Rilis LIVE (hanya dari beta yang sudah stabil) — jalankan dari mirror beta:
.\push-live.ps1
#    → fetch beta main → sinkron ke mirror kasol, squash sekali,
#      push GitHub LIVE main → Vercel deploy URL <app>.kasirsolo.com (live)
```

> ⚠️ **Aturan:** Folder kerja **tidak boleh push langsung ke GitHub**.
> - History GitHub selalu bersih: setiap rilis di-squash **satu commit snapshot**,
>   tanpa secret, tanpa riwayat kerja menengah.
> - LIVE hanya menerima snapshot dari BETA yang sudah stabil & lolos uji.
> - Selective deploy ditangani Vercel via **npm workspaces** ("Skip Unaffected
>   Projects") — per-app otomatis, tanpa script `vercel-ignore.sh`.

## 🔗 Domain Mapping (Opsional)

- `rosok.kasirsolo.com` → Kasir Rosok
- `gerobak.kasirsolo.com` → Kasir Gerobak
- `retail.kasirsolo.com` → Kasir Retail
- `kaki5.kasirsolo.com` → Kasir Kaki Lima
- `kasirsolo.com` → Landing Page
- `admin` / `hub.kasirsolo.com` → Dashboard admin

## 🧪 Preview / URL per Lingkungan

Setiap app punya **2 proyek Vercel** (dua environment) yang masing-masing terhubung ke repo GitHub berbeda:

| Lingkungan | Repo GitHub (main) | URL (Vercel) | Isi |
|------------|--------------------|--------------|-----|
| **BETA** | `mcfuryamen/kasol-beta` | `<app>.vercel.app` | Snapshot stabil sementara dari folder kerja, untuk pengujian |
| **LIVE** | `mcfuryamen/kasol` | `<app>.kasirsolo.com` | Snapshot beta yang sudah stabil & disetujui klien |

**Alur kaitannya:** pengembangan berjalan dari folder kerja → `push-beta.ps1` (sync ke mirror beta, squash, push GitHub BETA main → deploy `<app>.vercel.app`). Stabil → `push-live.ps1` (fetch beta main, sync ke mirror live, squash, push GitHub LIVE main → deploy `<app>.kasirsolo.com`). Ini menjaga LIVE tetap bersih & fungsional.

## 📊 Monitoring

Setiap Vercel project punya dashboard sendiri: deployment history, analytics & traffic, environment variables, custom domains, dan peninjauan preview.

---

**Aplikasi:** rosok, gerobak, retail, kaki5, landing, admin
**Deployment:** Vercel git integration (auto-detect), per-app isolated
**Framework:** Static HTML/JS (tanpa build, kecuali admin punya 1 build hook kecil)
