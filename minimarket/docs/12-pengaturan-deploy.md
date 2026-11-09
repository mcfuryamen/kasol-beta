# Pengaturan & Deploy

Panduan konfigurasi toko, deployment, dan troubleshooting.

---

## Halaman Pengaturan

Akses via sidebar: **Pengaturan**. Tersedia untuk semua role.

### Tab Informasi Toko

| Setting | Default | Keterangan |
|---------|---------|------------|
| Nama Toko | Kasir Solo - Minimarket | Tampil di header, struk, login |
| Alamat | Jl. Solo Raya No. 1, Surakarta | Tampil di struk |
| Telepon | 0271-123456 | Tampil di struk |
| Tarif PPN | 11% | Pajak per transaksi |
| Footer Struk | Terima kasih... | Teks bawah struk |

### Tab Printer

Lihat [Printer](11-printer.md) untuk detail.

### Tab Tampilan

| Setting | Pilihan |
|---------|---------|
| Dark Mode | Toggle gelap/terang |
| Bahasa | Indonesia / English |
| Sidebar | Expanded / Collapsed |

---

## Deploy ke Produksi

### Prasyarat

- Node.js v18+ terinstall
- Akun hosting (Vercel/Netlify/Cloudflare Pages, atau VPS)
- (Opsional) Akun Supabase untuk database

### Alur Rilis (Ekosistem Kasol — 2-Mirror)

> Jika `minimarket` rilis sebagai bagian ekosistem kasol, ikut alur **2-mirror**
> (folder kerja **tidak push langsung ke GitHub**; referensi
> [`DEPLOYMENT.md`](../../DEPLOYMENT.md)):
>
> 1. **BETA** — `.\push-beta.ps1` di folder kerja → sync ke mirror `kasol-beta` →
>    squash 1 commit → push GitHub BETA main → deploy URL `*.vercel.app`. Tes di sini.
> 2. Error? → perbaiki di folder kerja, rilis beta lagi.
> 3. **LIVE** — dari mirror beta, `.\push-live.ps1` → fetch BETA main → sync ke
>    mirror `kasol` → squash → push GitHub LIVE main → deploy custom domain
>    `kasirsolo.com`. Hanya dari beta yang stabil.

### Build

```bash
# Build produksi
npm run build

# Preview lokal (opsional)
npm run preview
```

Output build di folder `dist/`:
```
dist/
├── index.html
├── assets/
│   ├── index-xxxxx.js
│   ├── index-xxxxx.css
│   └── ...
├── logo.png
├── manifest.json
├── sw.js
└── registerSW.js
```

### Deploy ke Vercel (Recommended)

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel --prod

# Atau via GitHub:
# 1. Push ke GitHub
# 2. Import repo di vercel.com
# 3. Set environment variables
# 4. Deploy otomatis
```

**Vercel Settings:**
- Framework Preset: Vite
- Build Command: `npm run build`
- Output Directory: `dist`

### Deploy ke Netlify

```bash
# Install Netlify CLI
npm i -g netlify-cli

# Deploy
netlify deploy --prod --dir=dist
```

Atau drag & drop folder `dist/` ke [app.netlify.com](https://app.netlify.com).

### Deploy ke Cloudflare Pages

```bash
npx wrangler pages deploy dist --project-name kasir-solo-minimarket
```

### Deploy ke VPS (Nginx)

```bash
# Build di lokal
npm run build

# Upload ke server
scp -r dist/* user@server:/var/www/kasir-solo/

# Konfigurasi Nginx
sudo nano /etc/nginx/sites-available/kasir-solo
```

**Nginx config:**
```nginx
server {
    listen 80;
    server_name kasir.yourdomain.com;
    root /var/www/kasir-solo;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # Cache static assets
    location /assets {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

### Deploy via Docker

```dockerfile
# Dockerfile
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

```bash
docker build -t kasir-solo-minimarket .
docker run -p 80:80 kasir-solo-minimarket
```

---

## Environment Variables

### Untuk Supabase (Production)

Buat file `.env`:

```env
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIs...
```

### Di Hosting Platform

Set environment variables di dashboard hosting:
- Vercel: Project Settings → Environment Variables
- Netlify: Site Settings → Environment Variables
- Cloudflare: Pages → Settings → Environment Variables

---

## PWA Installation

### Desktop (Chrome/Edge)

1. Buka aplikasi di browser
2. Klik ikon install di address bar (atau menu → "Install app")
3. Aplikasi terinstall sebagai shortcut desktop
4. Bisa dijalankan tanpa browser, tampil seperti native app

### Mobile (Android)

1. Buka di Chrome
2. Banner "Add to Home Screen" muncul
3. Atau: menu (⋮) → "Install app" / "Add to Home Screen"
4. Icon muncul di home screen

### Mobile (iOS)

1. Buka di Safari
2. Tap ikon Share (↑)
3. Pilih "Add to Home Screen"
4. Tap "Add"

---

## Keamanan

### Row Level Security (RLS)

Supabase RLS memastikan:
- User hanya bisa akses data sesuai role
- Data antar toko tidak bisa diakses silang
- Operasi sensitif butuh role Owner/Manager

### Data Sensitive

Jangan commit file berikut ke git:
- `.env` — berisi Supabase credentials
- `node_modules/` — dependencies
- `dist/` — build output

Tambahkan ke `.gitignore`:
```
node_modules/
dist/
.env
.env.local
```

---

## Troubleshooting

### Masalah Umum

| Masalah | Solusi |
|---------|--------|
| `npm install` error | Pastikan Node.js v18+. Hapus `node_modules` dan `package-lock.json`, lalu install ulang |
| Blank page setelah deploy | Pastikan redirect rule ke `index.html` untuk SPA |
| Environment variables tidak terbaca | Prefix harus `VITE_`. Restart dev server setelah ubah `.env` |
| PWA tidak update | Clear browser cache, atau tekan Ctrl+Shift+R |
| Data hilang setelah refresh (demo) | Normal — demo mode tidak persist. Gunakan Supabase untuk persistent |
| Build gagal TypeScript error | Jalankan `npx tsc --noEmit` untuk cek error, fix sebelum build |
| Tailwind styles tidak muncul | Pastikan `tailwind.config.js` content path benar |

### Performance Tips

- **Lazy load** halaman yang jarang diakses
- **Compress images** sebelum upload sebagai foto produk
- **Cache API** responses di client
- **Gunakan CDN** untuk static assets
- **Monitor** Web Vitals (LCP, FID, CLS)

---

## Backup & Restore

### Backup Database (Supabase)

1. Buka Supabase Dashboard → Settings → Database
2. Klik "Download backup"
3. Simpan file SQL backup

### Backup via CLI

```bash
# Export semua data
pg_dump -h db.xxxxx.supabase.co -U postgres -d postgres > backup.sql

# Restore
psql -h db.xxxxx.supabase.co -U postgres -d postgres < backup.sql
```

### Backup Demo Data

Untuk demo mode, data tersimpan di memory (Preact Signals). Tidak ada backup yang perlu dilakukan.

---

**Selanjutnya:** [Referensi API →](13-referensi-api.md)
