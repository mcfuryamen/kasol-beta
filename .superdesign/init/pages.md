# Pages — porto

## / (Portofolio — satu-satunya halaman)
Entry: porto/src/pages/index.astro
Dependencies:
- porto/src/layouts/Base.astro (header sticky + nav + CTA pill + footer)
  - porto/src/styles/global.css (semua styling)
- porto/src/data/portfolio.ts (seluruh konten: site, apps, hardware, portal, problems, solutions, cities)
- inline sections: hero, stats, #aplikasi (grid-3), #hardware (grid-2 + dl specs), #portal (grid-3), problem-vs-solution (2 kolom), #jangkauan (chips), CTA akhir

Catatan: hanya satu route; tidak ada router. Data page = TIDAK diubah saat redesign.

## Referensi visual kasol-v1 (bukan route porto, tapi sumber DNA)
- pages/home.tsx -> components/home/index.tsx -> sections/{hero,trust-strip,problem-solution,services,innovation,gallery-marquee,founder-cta,live-pulse}.tsx
- pages/{sibos,qalam,dapur-sppg}.tsx (portal landing: h1 UPPERCASE display + gradien teks, narasi "gue/lo")
- components/ui.tsx (Button/Card/SectionHeader/Badge)
