# Landing Page — Setup & Deploy

Panduan lengkap development dan deployment landing page.

---

## 🖥️ Local Development

### Prasyarat

- Browser modern (Chrome, Firefox, Safari, Edge)
- Tidak perlu Node.js atau build tool

### Menjalankan Lokal

```bash
# Cara 1: Langsung buka file
open landing/index.html

# Cara 2: Pakai simple HTTP server
cd landing
python3 -m http.server 8080
# Buka http://localhost:8080

# Cara 3: Pakai VS Code Live Server extension
```

### Struktur File

```
landing/
├── index.html          # Semua kode (HTML + CSS + JS)
├── logo.png            # Logo (inline base64 di HTML)
├── vercel.json         # Konfigurasi Vercel
├── .vercelignore       # File yang diabaikan
└── docs/               # Dokumentasi
    ├── 00-ekosistem.md
    ├── 01-overview.md
    ├── 02-architecture.md
    ├── 03-data-schema.md
    ├── 04-design-system.md
    ├── 05-product-catalog.md
    └── 06-setup-deploy.md
```

---

## ☁️ Deploy ke Vercel

### Langkah 1: Buat Vercel Project

1. Login ke [vercel.com](https://vercel.com)
2. Klik **Add New...** → **Project**
3. Import repository GitHub yang berisi folder `landing/`
4. Atur:
   - **Framework Preset**: Other
   - **Build Command**: (kosong)
   - **Output Directory**: `.`
   - **Install Command**: (kosong)
5. Klik **Deploy**

### Langkah 2: Hubungkan Git (Alur 2-Mirror)

Hubungkan project `kasir-solo-landing` ke repo **BETA `kasol-beta`** (URL `landing.vercel.app`) dan repo **LIVE `kasol`** (URL `kasirsolo.com`), keduanya dengan **Root Directory = `landing/`** (Vercel → Project → Settings → Git). **GitHub Actions tidak dipakai** (workflow sudah dihapus). Rilis mengalir 2 mirror (folder kerja **tidak** push langsung ke GitHub) — via `push-beta.ps1` → GitHub BETA main, lalu stabil → `push-live.ps1` → GitHub LIVE main.

### Langkah 3: Domain Custom

1. Buka Vercel Dashboard → Project Settings → Domains
2. Tambahkan domain (contoh: `kasirsolo.com`)
3. Update DNS records sesuai instruksi Vercel

---

## 🔐 Environment Variables

Tidak ada GitHub Actions secrets. Vercel environment variables (mis. `SUPABASE_URL`, `SUPABASE_ANON_KEY` untuk landing) diatur di dashboard Vercel → Project → Settings → Environment Variables. `.env.local` hanya untuk dev lokal (gitignored).

---

## 🔄 Flow Deployment (Alur 2-Mirror)

```
  Folder kerja            Mirror Beta                 Mirror Live
  (produksi)              kasol-beta                  kasol
     │                         │                         │
     │  edit & uji             │                         │
     │────────────────────────►│  push-beta.ps1          │
     │                         │  (sync+squash)          │
     │                         │  push BETA main ───────►│
     │                         │  deploy -> *.vercel.app │
     │                         │                         │
     │                         │  stabil? ──────────────►│ push-live.ps1
     │                         │                         │ (sync+squash)
     │                         │                         │ push LIVE main
     │                         │                         │ deploy -> kasirsolo.com
```

Folder kerja **tidak pernah push langsung ke GitHub**. Semua rilis melewati
mirror beta (`push-beta.ps1`) dulu untuk pengujian; baru setelah stabil
di-promote ke live (`push-live.ps1`). Referensi lengkap: [`DEPLOYMENT.md`](../../DEPLOYMENT.md).

---

## 📝 Checklist Sebelum Deploy

- [ ] Semua link WhatsApp & email sudah benar
- [ ] Harga aplikasi sudah sesuai
- [ ] Alamat legal & operasional sudah update
- [ ] Logo tampil di semua device
- [ ] Form trial berfungsi (cek localStorage)
- [ ] Mobile responsive di 320px, 375px, 414px
- [ ] No console errors
- [ ] Google Fonts ter-load

---

## 🐛 Troubleshooting

### Katalog tidak muncul di landing page

Cek apakah Admin Dashboard sudah pernah menyimpan data ke localStorage.
Jika kosong, landing page akan menampilkan `DEFAULT_CATALOG` dari source code.

### Form trial tidak menyimpan lead

Pastikan browser mengizinkan localStorage. Coba buka console dan ketik:
```javascript
localStorage.setItem('kasirsolo:leads', JSON.stringify([]));
```

### Logo tidak tampil

Logo di-encode sebagai base64 inline di HTML. Jika rusak, regenerate base64:
```bash
base64 -i logo.png  # atau pakai tool online
```

---

*Setup & Deploy — KASIRSOLO Landing Page*
