# Kasir Solo - Multi App Repository

Repository ini berisi semua aplikasi Kasir Solo dalam satu monorepo. Setiap aplikasi adalah single HTML file yang bisa di-deploy secara terpisah ke Vercel.

## 📁 Struktur Aplikasi

```
kasol/
├── .github/workflows/          # GitHub Actions deployment
│   ├── deploy-rosok.yml        # Deploy aplikasi rosok
│   ├── deploy-gerobak.yml      # Deploy aplikasi gerobak
│   ├── deploy-retail.yml       # Deploy aplikasi retail
│   ├── deploy-landing.yml      # Deploy landing page
│   └── deploy-all.yml          # Fallback deploy semua
├── rosok/                      # Aplikasi Kasir Rosok (MODULAR)
│   ├── index.html              # Entry point (loader ESM + HTML)
│   ├── style.css               # Seluruh styling (design tokens CSS)
│   ├── js/                     # Modul ES6+ (state, fitur, utilitas)
│   ├── assets/                 # Logo, icon, favicon, splash
│   ├── sw.js                   # Service Worker (v10, Stale-While-Revalidate)
│   ├── manifest.json           # PWA manifest
│   ├── vercel.json             # Vercel config
│   └── .vercelignore           # Vercel ignore
├── gerobak/                    # Aplikasi Kasir Gerobak
│   ├── index.html              # (akan diisi)
│   ├── vercel.json
│   └── .vercelignore
├── retail/                     # Aplikasi Kasir Retail
│   ├── index.html              # (akan diisi dari landing/)
│   ├── vercel.json
│   └── .vercelignore
├── landing/                    # Landing Page Marketing
│   ├── index.html              # (akan diisi user)
│   ├── vercel.json
│   └── .vercelignore
├── .github/
├── .gitignore
├── .vercelignore
├── README.md
└── CHANGELOG.md
```

## 🚀 Deployment

Setiap aplikasi di-deploy secara independen ke Vercel. Deploy otomatis terjadi ketika ada perubahan di folder aplikasi tersebut.

### ⚠️ Cara deteksi berjalan (penting)

**Vercel tidak melakukan auto-detect dari git monorepo.** Yang menentukan "app mana yang di-deploy"
adalah **GitHub Actions** (`.github/workflows/deploy-*.yml`) lewat **path filter**:

- Setiap app punya file workflow sendiri (`deploy-rosok.yml`, `deploy-gerobak.yml`, ...)
  yang berisi `on: push: paths: 'rosok/**'` (dst) → workflow **hanya jalan** jika ada perubahan
  di folder itu.
- `deploy-all.yml` adalah fallback: memakai `dorny/paths-filter` untuk mendeteksi subrepo mana
  yang berubah, lalu memanggil workflow deploy hanya untuk yang berubah.

Artinya, ketika push berisi perubahan di beberapa folder monorepo sekaligus, hanya folder yang
benar-benar berubah yang akan di-deploy; folder lain tanpa perubahan **tidak ikut deploy**.

### Cara Kerja:
1. **Push ke folder `rosok/`** → Hanya aplikasi Rosok yang deploy
2. **Push ke folder `gerobak/`** → Hanya aplikasi Gerobak yang deploy
3. **Push ke folder `retail/`** → Hanya aplikasi Retail yang deploy
4. **Push ke folder `landing/`** → Hanya Landing Page yang deploy
5. **Push file lain (README, dll)** → TIDAK ada deploy

### Setup Vercel Projects:

Untuk setiap aplikasi, buat Vercel project terpisah:

1. **Kasir Rosok**
   - Vercel Project: `kasir-rosok`
   - Root Directory: `rosok/`
   - Build Command: (kosong)
   - Output Directory: `.`

2. **Kasir Gerobak**
   - Vercel Project: `kasir-gerobak`
   - Root Directory: `gerobak/`
   - Build Command: (kosong)
   - Output Directory: `.`

3. **Kasir Retail**
   - Vercel Project: `kasir-retail`
   - Root Directory: `retail/`
   - Build Command: (kosong)
   - Output Directory: `.`

4. **Landing Page**
   - Vercel Project: `kasir-solo-landing`
   - Root Directory: `landing/`
   - Build Command: (kosong)
   - Output Directory: `.`

### GitHub Secrets yang Dibutuhkan:

Tambahkan secrets berikut di repository settings:

| Secret | Deskripsi | Contoh |
|--------|-----------|--------|
| `VERCEL_TOKEN` | Vercel personal token | `vc_xxx...` |
| `VERCEL_ORG_ID` | Vercel organization ID | `org_xxx...` |
| `VERCEL_PROJECT_ID_ROSOK` | Project ID Vercel Rosok | `prj_xxx...` |
| `VERCEL_PROJECT_ID_GEROBAK` | Project ID Vercel Gerobak | `prj_xxx...` |
| `VERCEL_PROJECT_ID_RETAIL` | Project ID Vercel Retail | `prj_xxx...` |
| `VERCEL_PROJECT_ID_LANDING` | Project ID Vercel Landing | `prj_xxx...` |
| `VERCEL_SCOPE` | Vercel scope (opsional) | `personal` |

**Cara mendapatkan values:**
1. Login ke Vercel dashboard
2. Pilih project → Settings → General
3. Copy `Project ID`
4. Personal Token: User settings → Tokens

## 📝 Development Flow

### Menambah Fitur di Aplikasi Tertentu:
```bash
# Edit file di folder aplikasi
nano rosok/index.html

# Commit & push (hanya rosok yang deploy)
git add rosok/
git commit -m "feat: tambah fitur baru di rosok"
git push
```

### Update Landing Page:
```bash
# Edit landing page
nano landing/index.html

# Commit & push (hanya landing yang deploy)
git add landing/
git commit -m "chore: update landing page"
git push
```

### Update Semua Aplikasi:
```bash
# Edit multiple apps
nano rosok/index.html
nano gerobak/index.html
nano retail/index.html

# Commit & push (semua yang berubah akan deploy)
git add rosok/ gerobak/ retail/
git commit -m "feat: update semua aplikasi"
git push
```

## 🔗 Domain Mapping (Opsional)

Setiap aplikasi bisa punya domain sendiri:
- `rosok.kasirsolo.com` → Kasir Rosok
- `gerobak.kasirsolo.com` → Kasir Gerobak
- `retail.kasirsolo.com` → Kasir Retail
- `kasirsolo.com` → Landing Page

## 🧪 Preview URLs

Setiap Pull Request akan menghasilkan preview URL:
- `xxx--kasir-rosok.vercel.app`
- `xxx--kasir-gerobak.vercel.app`
- `xxx--kasir-retail.vercel.app`
- `xxx--kasir-solo-landing.vercel.app`

## 📊 Monitoring

Setiap Vercel project memiliki dashboard sendiri untuk monitoring:
- Deployment history
- Analytics & traffic
- Environment variables
- Custom domains
- Team collaboration

---

**Total Apps:** 4 (rosok, gerobak, retail, landing)  
**Deployment:** Per-app, isolated  
**Framework:** Single HTML (no build step)
