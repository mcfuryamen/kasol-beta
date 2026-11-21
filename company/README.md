# 🏢 Company — Situs Publik Kasir Solo

Situs utama PT Mesin Kasir Solo (kasirsolo.com): portofolio proyek, aplikasi kasir,
mesin, portal R&D, dan jangkauan layanan — dibangun dengan **Astro**.
Konten diadopsi dari `kasol-v1` + `kasol-v2` (Next.js) dan disederhanakan jadi statis.

## Menjalankan Lokal

```bash
cd company
npm install        # WAJIB dari root monorepo (zod tak ter-hoist)
npm run dev        # http://localhost:13131
```

> **PORT RESMI: 13131** (bukan di registry 8081–8089 — proyek Astro terpisah; awali rentang dev baru).

## Build

```bash
npm run build      # output ke dist/ (19 halaman statis)
npm run preview    # preview build di port 13131
```

## Struktur

```
company/
├── astro.config.mjs         # site = https://www.kasirsolo.com (canonical/sitemap), port 13131
├── package.json
├── public/
│   ├── robots.txt           # allow all + sitemap
│   └── (favicon, ikon PWA, manifest)
└── src/
    ├── data/portfolio.ts    # SEMUA konten (brand, proyek 17, aplikasi, hardware, portal, kota)
    ├── layouts/Base.astro   # shell + SEO (canonical, OG, JSON-LD LocalBusiness)
    ├── pages/
    │   ├── index.astro      # home (hero, trust, aplikasi, mesin, portal, vs, portfolio preview, jangkauan, CTA)
    │   ├── portfolio.astro  # grid jejak perang (PHYSICAL + DIGITAL)
    │   ├── portfolio/[slug].astro  # 17 halaman detail proyek
    │   └── sitemap.xml.ts   # sitemap dinamis dari data
    └── styles/global.css    # tema gelap MKS Tactical + CSS portfolio
```

Konten hanya di satu file (`src/data/portfolio.ts`) — edit di sana, halaman ikut berubah.
