# Extractable Components — porto

## Layout Components (layak diekstrak sbg DraftComponent)
- **SiteHeader** — porto/src/layouts/Base.astro (bagian <header>): logo + nav + CTA. POSISI LOGO -> WAJIB logo kasirsolo.png (brand asset), bukan inisial "KS".
- **SiteFooter** — porto/src/layouts/Base.astro (bagian <footer>): brand + tagline + established.

## Basic Components (inline saja di draft, tak perlu ekstraksi)
- Button (primary gradien / outline) — pola kasol-v1 ui.tsx
- Card, Badge, SectionHeader, StatCell, SpecList, CityChip

## Sumber ekstraksi kasol-v1 (untuk gaya, bukan kode mentah)
- components/ui.tsx (Button/Card/SectionHeader/Badge)
- components/home/sections/*.tsx (hero, trust-strip, problem-solution, services, innovation)
