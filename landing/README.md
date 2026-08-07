# 🪂 Kasir Solo — Landing Page

Landing page pemasaran / funnel calon pelanggan ekosistem **KASIRSOLO** (PT Mesin Kasir Solo).
Satu halaman statis (`index.html`) yang menampilkan katalog & info produk, dikoneksikan ke
**Supabase** (anon key, read-only) untuk daftar produk.

## 🚩 Nama & Port

| Field | Nilai |
|---|---|
| **PORT RESMI** | **`8081`** |
| Port Registry | `kasol/CONTEXT.md` → "🚪 Port Dev Server (REGISTRY)" |
| Kategori | Ekosistem (bukan app klien) — port permanen |

> Landing memegang port ekosistem permanen `8081`. Jangan ganti-ganti port.

## 🚀 Menjalankan Lokal

Aplikasi statis murni — cukup server statis sederhana:

```bash
# PORT RESMI = 8081
python -m http.server 8081
# atau
npx serve -l 8081
```

Lalu buka: `http://localhost:8081`

> Supabase: landing membaca daftar produk via anon key (read-only). Fallback ke
> `localStorage`, lalu `DEFAULT_CATALOG` jika Supabase tidak tersedia.

## 📁 Struktur

```
landing/
├── index.html        # Satu halaman (konten + inline JS/CSS)
├── logo.png
├── test-mobile.html  # Preview tampilan mobile
├── docs/             # Dokumentasi (arsitektur, skema, desain, setup-deploy)
└── vercel.json
```

## 📦 Deploy

- **Vercel git integration** — auto-detect dari folder `landing/`, project `kasir-solo-landing`.
- Deploy model resmi: lihat `kasol/DEPLOYMENT.md` (Vercel git, bukan GitHub Actions).

## 📚 Dokumentasi

Detail lengkap di `docs/`: `01-overview.md`, `02-architecture.md`, `03-data-schema.md`,
`04-design-system.md`, `05-product-catalog.md`, `06-setup-deploy.md`.

---
*Ekosistem KASIRSOLO — lihat `kasol/CONTEXT.md` untuk standar semua app.*
