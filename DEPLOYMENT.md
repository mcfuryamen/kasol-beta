# Kasir Solo - Multi App Repository

Repository ini berisi semua aplikasi Kasir Solo dalam satu monorepo. Setiap aplikasi di-deploy secara terpisah ke Vercel sebagai **static site tanpa build step**.

> **Catatan:** Deploy **TIDAK lagi memakai GitHub Actions.** Semua workflow `.github/workflows/*` sudah dihapus. Deploy sekarang otomatis oleh **Vercel git integration** (auto-detect) per project.
>
> **Catatan (2026-08):** Selective deploy memakai fitur **Vercel "Skip Unaffected Projects"** via **npm workspaces** — bukan `vercel-ignore.sh`. Detail di bawah.

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
- Bump versi cache di `sw.js` setiap ada perubahan aset agar PWA pengguna tidak menyimpan versi lama.

## 📝 Development Flow

```bash
# Edit file di folder aplikasi (produksi: C:\Users\Admin\Documents\kasol\<app>)
# Sync → mirror: jalankan script sync (sync-to-mirror.sh, whitelist)
# Commit ke mirror (manual, di folder mirror):
git add <app>/
git commit -m "feat: ..."
# Push ke GitHub (manual, dilakukan oleh pengguna):
```

Selective deploy ditangani Vercel via **npm workspaces** ("Skip Unaffected Projects") — per-app otomatis, tanpa script `vercel-ignore.sh`.

## 🔗 Domain Mapping (Opsional)

- `rosok.kasirsolo.com` → Kasir Rosok
- `gerobak.kasirsolo.com` → Kasir Gerobak
- `retail.kasirsolo.com` → Kasir Retail
- `kaki5.kasirsolo.com` → Kasir Kaki Lima
- `kasirsolo.com` → Landing Page
- `admin` / `hub.kasirsolo.com` → Dashboard admin

## 🧪 Preview URLs

Setiap **push ke branch non-utama / Pull Request** menghasilkan preview URL Vercel (mis. `xxx--kasir-rosok.vercel.app`). Deploy production terjadi pada push ke branch utama.

## 📊 Monitoring

Setiap Vercel project punya dashboard sendiri: deployment history, analytics & traffic, environment variables, custom domains, dan peninjauan preview.

---

**Aplikasi:** rosok, gerobak, retail, kaki5, landing, admin
**Deployment:** Vercel git integration (auto-detect), per-app isolated
**Framework:** Static HTML/JS (tanpa build, kecuali admin punya 1 build hook kecil)
