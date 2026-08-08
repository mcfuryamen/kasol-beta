# Kasir Solo - Multi App Repository

Repository ini berisi semua aplikasi Kasir Solo dalam satu monorepo. Setiap aplikasi di-deploy secara terpisah ke Vercel sebagai **static site tanpa build step**.

> **Catatan:** Deploy **TIDAK lagi memakai GitHub Actions.** Semua workflow `.github/workflows/*` sudah dihapus. Deploy sekarang otomatis oleh **Vercel git integration** (auto-detect) per project.

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

### Cara Kerja:
1. **Push perubahan di `rosok/`** → project Vercel Rosok deploy otomatis
2. **Push perubahan di `kaki5/`** → project Vercel Kaki5 deploy otomatis
3. **Push perubahan di `landing/`** → project Vercel Landing deploy otomatis
4. **dst.** untuk `admin/`, `gerobak/`, `retail/`
5. Perubahan di file root (README, dll) → **tidak memicu deploy** (tidak memengaruhi folder project mana pun)

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

Tidak ada path-filter per-app di CI — **Vercel git integration** yang menangani per-app secara otomatis via Root Directory.

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
