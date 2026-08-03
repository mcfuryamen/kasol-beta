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
│   └── deploy-all.yml          # Fallback MANUAL (workflow_dispatch saja)
├── rosok/                      # Aplikasi Kasir Rosok (MODULAR)
│   ├── index.html              # Entry point (loader ESM + HTML)
│   ├── style.css               # Seluruh styling (design tokens CSS)
│   ├── js/                     # Modul ES6+ (state, fitur, utilitas)
│   ├── assets/                 # Logo, icon, favicon, splash
│   ├── dexie.min.js            # Library Dexie (WAJIB ikut deploy)
│   ├── sw.js                   # Service Worker (Stale-While-Revalidate)
│   ├── manifest.json           # PWA manifest
│   ├── vercel.json             # Vercel config
│   └── .vercelignore           # ⚠️ TANPA .git — lihat "Aturan Wajib"
├── gerobak/                    # Aplikasi Kasir Gerobak
│   ├── index.html
│   └── vercel.json             # (tanpa .vercelignore → pakai punya root)
├── retail/                     # Aplikasi Kasir Retail
│   └── vercel.json
├── landing/                    # Landing Page Marketing
│   ├── index.html
│   ├── vercel.json
│   └── .vercelignore           # ⚠️ TANPA .git
├── vercel-ignore.sh            # Ignored Build Step (deteksi per-app)
├── push-to-github.sh           # Commit + push ke origin/main
├── .gitignore                  # ⚠️ ada negasi !rosok/dexie.min.js
├── .vercelignore               # ⚠️ TANPA .git — dipakai app tanpa file sendiri
├── DEPLOYMENT.md
└── README.md
```

## 🚀 Deployment

Setiap aplikasi di-deploy secara independen ke Vercel. Deploy otomatis terjadi ketika ada perubahan di folder aplikasi tersebut.

### ⚠️ Cara deteksi berjalan (penting)

Ada **dua lapis** yang menentukan app mana yang di-deploy. Keduanya harus benar.

**Lapis 1 — GitHub Actions path filter.** Setiap app punya workflow sendiri
(`deploy-rosok.yml`, dst) dengan `on: push: paths: 'rosok/**'` → workflow hanya jalan
kalau folder itu berubah. `deploy-all.yml` **hanya** `workflow_dispatch` (manual);
kalau dia juga jalan `on: push`, setiap push memicu **dua** deploy untuk app yang sama.

**Lapis 2 — Vercel Ignored Build Step.** Vercel sendiri **tidak** auto-detect per-folder.
Tiap project menjalankan `bash ../vercel-ignore.sh`, yang membandingkan `git diff HEAD^ HEAD .`
untuk foldernya sendiri lalu membatalkan build kalau tidak ada perubahan.

Hasilnya: hanya folder yang benar-benar berubah yang kedeploy; app lain **tidak ikut**.

---

## 🔒 Aturan Wajib — berlaku untuk SEMUA app (sekarang & yang akan datang)

Empat aturan di bawah ini pernah dilanggar dan menyebabkan production rusak total.
**Wajib dipatuhi setiap kali menambah app baru atau mengubah konfigurasi.**

### 1. `.vercelignore` TIDAK BOLEH memuat `.git`

Ignored Build Step butuh `.git` untuk menjalankan `git diff HEAD^ HEAD .`.
Kalau `.git` di-ignore, perintah itu gagal (`warning: Not a git repository`), Vercel
menganggapnya error dan **melanjutkan build** → deteksi per-app mati → **semua app kedeploy**.

Vercel membuang `.git` dari output akhir secara otomatis, jadi tidak ada risiko ter-serve.

```gitignore
# Vercel
.vercel

# Git - JANGAN ignore .git
# Vercel butuh .git untuk Ignored Build Step (git diff HEAD^ HEAD .).
# Kalau .git dihapus, deteksi perubahan per-app gagal -> SEMUA app kedeploy.
.gitignore
```

> **Hati-hati:** ada beberapa `.vercelignore` di repo ini (root, `rosok/`, `landing/`).
> App **tanpa** file sendiri (mis. `gerobak/`) memakai yang **root**. Memperbaiki satu file
> tidak memperbaiki app lain. Build log menyebut mana yang dipakai:
> `Found .vercelignore (repository root)`.
>
> Audit semuanya sekaligus:
> ```bash
> for f in $(find . -name ".vercelignore" -not -path "./.git/*"); do
>   echo "--- $f"; grep -n "^\.git$" "$f" || echo "  OK bersih"
> done
> ```

### 2. Library vendor harus lolos dari `.gitignore`

Root `.gitignore` punya pola generik `*.min.js` untuk file hasil build. Pola itu **juga**
menelan library yang dibutuhkan aplikasi. `rosok/dexie.min.js` pernah tidak ikut ter-commit
karena ini → di production `Dexie is not defined` → seluruh app mati, padahal di localhost normal.

Setiap library vendor `.min.js` / `.min.css` **wajib** diberi negasi:

```gitignore
# Generated files
*.min.js
*.min.css

# Library vendor — WAJIB di-deploy (bukan file generated)
!rosok/dexie.min.js
```

Verifikasi sebelum percaya sudah aman:

```bash
git ls-files rosok/ | grep dexie      # harus muncul
git check-ignore -v rosok/dexie.min.js # tunjukkan aturan yang menelan (harus kosong)
```

> Skrip `sync-to-mirror.sh` **berhasil menyalin** file ke folder mirror walaupun git
> meng-ignore-nya. Folder terlihat lengkap tapi commit-nya tidak — jangan pakai `ls`
> folder mirror sebagai bukti, pakai `git ls-files`.

### 3. `run:` di workflow wajib block scalar

YAML plain scalar tidak boleh memuat titik-dua diikuti spasi. `run: echo "Preview URL: ..."`
membuat GitHub menolak seluruh file (**Invalid workflow file**) → Actions **tidak jalan sama
sekali**, commit masuk tapi tidak ada deploy.

```yaml
# ❌ Invalid workflow file
run: echo "Preview URL: ${{ steps.vercel.outputs.preview-url }}"

# ✅ block scalar + bracket notation untuk nama ber-hyphen
run: |
  echo "Preview URL: ${{ steps.vercel.outputs['preview-url'] }}"
```

Step yang output-nya dibaca juga wajib punya `id:`:

```yaml
- name: Deploy to Vercel
  id: vercel          # tanpa ini, steps.vercel.outputs selalu kosong
  uses: amondnet/vercel-action@v25
```

### 4. Bump `CACHE_VERSION` di `sw.js` setiap deploy

Service Worker menyajikan aset dari cache. Tanpa bump versi, klien lama tetap melihat
versi rusak meski site sudah benar. Naikkan `CACHE_VERSION` (`v11` → `v12`) di
`rosok/sw.js` pada setiap perubahan yang menyentuh aset.

### Verifikasi setelah deploy

Jangan berhenti di "sudah di-push". Cek yang benar-benar ter-serve:

```bash
# Content-Type harus application/javascript, BUKAN text/html
curl -sI "https://rosok.vercel.app/dexie.min.js" | grep -i content-type

# Versi yang aktif memang commit terbaru?
curl -s "https://rosok.vercel.app/sw.js" | grep -oE "CACHE_VERSION = '[^']+'"
```

`Content-Type: text/html` pada file `.js` berarti file **tidak ada** di deployment —
rewrite catch-all `/(.*)` menangkapnya dan membalas HTML dengan status 200, bukan 404.

Untuk memastikan app lain tidak ikut kedeploy: catat `ETag` app itu **sebelum** push,
lalu setelah push pastikan ETag-nya identik dan `Age` terus naik (kalau ikut kedeploy,
cache CDN di-purge → `Age` reset ke 0 + ETag baru).

### Cara Kerja:
1. **Push ke folder `rosok/`** → Hanya aplikasi Rosok yang deploy
2. **Push ke folder `gerobak/`** → Hanya aplikasi Gerobak yang deploy
3. **Push ke folder `retail/`** → Hanya aplikasi Retail yang deploy
4. **Push ke folder `landing/`** → Hanya Landing Page yang deploy
5. **Push file lain (README, dll)** → TIDAK ada deploy

### Setup Vercel Projects:

Untuk setiap aplikasi, buat Vercel project terpisah. **Keempat setting ini wajib sama
untuk semua project** — hanya Root Directory yang berbeda:

| Setting | Nilai |
|---------|-------|
| Build Command | (kosong) |
| Output Directory | `.` |
| Framework Preset | Other / None |
| **Ignored Build Step** | **Command:** `bash ../vercel-ignore.sh` |

| Aplikasi | Vercel Project | Root Directory |
|----------|----------------|----------------|
| Kasir Rosok | `kasir-rosok` | `rosok/` |
| Kasir Gerobak | `kasir-gerobak` | `gerobak/` |
| Kasir Retail | `kasir-retail` | `retail/` |
| Landing Page | `kasir-solo-landing` | `landing/` |

> ⚠️ **Ignored Build Step harus diisi manual** di dashboard tiap project
> (Settings → Git → Ignored Build Step → pilih **Command**).
> Ini satu-satunya langkah yang tidak bisa dikontrol dari dalam repo — kalau kolomnya
> kosong, `vercel-ignore.sh` tidak pernah dipanggil dan **semua app kedeploy** setiap push.

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

### Rosok — dua skrip (folder produksi terpisah dari repo)

Kode aktif rosok ada di `C:\Users\Admin\Documents\kasol\rosok\` (bukan di repo ini).
Folder `rosok/` di repo adalah **mirror**. Alurnya dua perintah:

```bash
# 1. Salin produksi -> mirror (whitelist file aplikasi, sampah dev dikecualikan)
cd /c/Users/Admin/Documents/kasol/rosok
bash sync-to-mirror.sh

# 2. Commit + push dari ROOT monorepo
cd /c/Users/Admin/Documents/GitHub/kasol
bash push-to-github.sh
```

Jangan mengedit `Documents/GitHub/kasol/rosok/` langsung — isinya ditimpa total
setiap kali `sync-to-mirror.sh` jalan.

### App lain (gerobak, retail, landing) — edit langsung di repo

```bash
cd /c/Users/Admin/Documents/GitHub/kasol
# edit gerobak/index.html
bash push-to-github.sh
```

`push-to-github.sh` melakukan `git add -A` + commit auto-timestamp + push ke `origin/main`.
Path filter dan Ignored Build Step yang memutuskan app mana yang kedeploy — tidak perlu
memilih file secara manual.

### Push yang tidak menyentuh folder app

Perubahan pada `README.md`, `DEPLOYMENT.md`, atau `.github/workflows/**` **tidak** memicu
deploy app mana pun. Kalau perlu memaksa deploy setelah mengubah workflow, buat perubahan
kecil di folder app (mis. bump `CACHE_VERSION` di `rosok/sw.js`) atau jalankan
`deploy-all.yml` manual dari tab Actions.

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

## ✅ Checklist Menambah App Baru

Ikuti berurutan. Setiap langkah pernah menjadi penyebab kegagalan nyata.

**Di repo:**

1. Buat folder `<app>/` dengan `index.html` dan `vercel.json`
   (`buildCommand: null`, `outputDirectory: "."`)
2. **Jangan** buat `<app>/.vercelignore` kecuali benar-benar perlu beda dari root.
   Kalau dibuat: **tanpa** `.git` (lihat Aturan Wajib #1)
3. Buat `.github/workflows/deploy-<app>.yml` — salin dari `deploy-rosok.yml`, ganti
   nama folder & secret. Pastikan ada:
   - `on: workflow_call:` (syarat agar bisa dipanggil `deploy-all.yml`)
   - `push: paths: '<app>/**'` dan `pull_request: paths:` yang sama
   - `id: vercel` di step deploy
   - semua `run:` pakai block scalar `run: |`
4. Kalau app memuat library `.min.js` / `.min.css`: tambah negasi di root `.gitignore`
   (`!<app>/nama-library.min.js`), lalu `git add` file itu
5. Validasi YAML sebelum push:
   ```bash
   python -c "import yaml,sys; yaml.safe_load(open(sys.argv[1],encoding='utf-8'))" \
     .github/workflows/deploy-<app>.yml
   ```

**Di GitHub:**

6. Tambah secret `VERCEL_PROJECT_ID_<APP>` (Settings → Secrets and variables → Actions)

**Di Vercel:**

7. Buat project baru, import repo `kasol`
8. Root Directory = `<app>/`, Build Command kosong, Output Directory `.`
9. **Settings → Git → Ignored Build Step → Command:** `bash ../vercel-ignore.sh`

**Verifikasi:**

10. Push perubahan kecil di `<app>/` saja, lalu pastikan:
    - `<app>` kedeploy (cek penanda versi lewat `curl`)
    - app lain **tidak** kedeploy (ETag identik + `Age` naik)
    - semua aset kritis balas `Content-Type` yang benar, bukan `text/html`

---

## 🧯 Troubleshooting cepat

| Gejala | Penyebab paling mungkin | Aturan terkait |
|--------|------------------------|----------------|
| `Refused to execute script ... MIME type ('text/html')` | file tidak ada di deployment (ditelan `.gitignore`) | #2 |
| `<Lib> is not defined` padahal normal di localhost | sama seperti di atas | #2 |
| Semua app kedeploy padahal satu folder berubah | `.vercelignore` memuat `.git`, atau Ignored Build Step belum diisi | #1 |
| Commit masuk GitHub tapi tidak ada deploy | workflow **Invalid workflow file** | #3 |
| Satu push memicu dua deploy untuk app yang sama | `deploy-all.yml` jalan `on: push` tanpa path filter | Lapis 1 |
| Site sudah benar tapi browser masih lihat versi rusak | Service Worker cache | #4 |

---

**Total Apps:** 4 (rosok, gerobak, retail, landing)  
**Deployment:** Per-app, isolated (path filter + Ignored Build Step)  
**Framework:** Static, no build step  
**Last Updated:** 2026-08-03
