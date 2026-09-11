# Superdesign Init — kasol (target UI: porto/, referensi DNA: kasol-v1/)

## Framework & Stack

- **Target UI (`porto/`)**: Astro 5 statis, vanilla CSS (tanpa Tailwind), 1 halaman (`src/pages/index.astro`), layout `src/layouts/Base.astro`, data `src/data/portfolio.ts`, style `src/styles/global.css`. Dev port 13131.
- **Referensi gaya (`kasol-v1/`)**: React 18 + Vite + Tailwind (custom config), react-router-dom, lucide-react. Tema "MKS Tactical": dark #050505, brand-orange #FF5F1F, font Outfit (sans) + Space Grotesk (display), kartu rounded-3xl, glassmorphism, glow neon oranye.

## Rute porto

- `/` — `porto/src/pages/index.astro` — satu halaman portofolio: Hero → Stats → Aplikasi (3 kartu) → Hardware (2 paket) → Portal R&D (3 kartu) → Problem vs Solution → Jangkauan kota → CTA. Layout `Base.astro` (header sticky + footer).

## Struktur halaman porto saat ini

```
index.astro
├── Base.astro (header sticky: brand KS + nav + CTA; footer 2 baris)
├── section.hero (eyebrow, h1, sub, 2 CTA)
├── div.stats (4 stat kolom)
├── section#aplikasi (grid-3 kartu aplikasi: Rosok, Kaki Lima, Shop)
├── section#hardware (grid-2 paket: Android Lite Rp2.5jt, Resto Pro Rp7.5jt + specs dl)
├── section#portal (grid-3: SIBOS, QALAM, Dapur SPPG)
├── section problem-vs-solution (2 kolom: 3 masalah vs 3 solusi)
├── section#jangkauan (chips 12 kota: 7 kandang + 5 ekspansi)
└── section CTA akhir (kartu radial + tombol WA)
```

## Konten (src/data/portfolio.ts — sumber tunggal konten)

- brand: KASIRSOLO / PT Mesin Kasir Solo / "Pusat Mesin Kasir Terbesar di Solo" / ESTABLISHED 2015 // SURAKARTA
- stats: 500+ Mitra · Se-Indonesia Kirim · 99% Uptime · 24/7 Support
- apps: Rosok, Kaki Lima, Shop (tags: Offline-first, PWA, dst)
- hardware: Paket Kasir Android Lite Rp2.500.000 (specs 6 baris), Paket Resto Pro Windows Rp7.500.000 (specs 6 baris)
- portal: SIBOS ("Teknologi Perang Buat Pedagang Jalanan"), QALAM ("Portal Kepercayaan Pendidikan"), Dapur SPPG ("Manajemen Dapur MBG")
- problems: Duit Bocor Alus / Stok Barang Ghaib / Lo Jadi Tahanan Toko
- solutions: Sistem Anti-Tuyul (Fraud) / Stok Opname Otomatis / Asisten Digital 24 Jam
- cities: 7 Kandang (Solo, Sukoharjo, Klaten, Boyolali, Sragen, Karanganyar, Wonogiri) + 5 Ekspansi (Semarang, Jogja, Surabaya, Madiun, Ngawi)
- CTA: WhatsApp founder (nomor masih placeholder 6281234567890)

## Design DNA kasol-v1 (target adopsi — detail token di theme.md)

- Warna: bg #050505, card #141414, panel #0f0f0f; brand-orange #FF5F1F, glow #FF914D, dim #331000; gradien `135deg #FF5F1F → #DC2626`.
- Tipografi: **Space Grotesk** (display, weight 500/700, tracking-tight, UPPERCASE untuk hero) + **Outfit** (body 300–700).
- Layout khas: hero full-viewport center dengan background "engine" (blur orb oranye/merah + grid 40px putih 5%), badge pill border oranye, tombol h-16 UPPERCASE tracking-widest gradien + shadow-neon, brand overlay "ESTABLISHED 2015 // SURAKARTA" opacity-30, scroll indicator garis vertikal gradien.
- Komponen: Card rounded-3xl border-white/5 hover:border-brand-orange/40; SectionHeader (kicker pill Sparkles + h2 font-display font-black dengan highlight oranye underline blur); Badge pill kecil font-black uppercase; glass-v2 (bg-white/[0.03] blur-xl border-white/10); kartu layanan ikon 14x14 rounded-xl bg-white/5 + hover -translate-y-2; marquee galeri; trust-strip 4 kolom divide-x.
- Animasi: fadeIn (translateY 10px→0), pulse-slow 4s, float 6s, marquee 40s, shine sweep pada tombol.

## Brand asset

- Logo resmi: `kasirsolo-logo.png` (root repo kasol, 600×600 PNG — lingkaran gradasi oranye-kuning dengan person/monumen di tengah, background hitam). Untuk header, favicon, dan ikon PWA porto.
