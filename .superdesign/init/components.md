# Components — porto (Astro) & primitives kasol-v1

## porto (target) — komponen Astro saat ini

### src/layouts/Base.astro (layout shell — full source dipindah ke layouts.md)
Header sticky (brand mark "KS" teks + nav 4 link + CTA pill), slot main, footer 2 baris. Akan dirombak: brand mark diganti **logo kasirsolo.png**, gaya mengikuti kasol-v1.

### src/pages/index.astro
Satu halaman, 7 section inline (hero, stats, aplikasi, hardware, portal, vs, jangkauan, CTA). Data dari `src/data/portfolio.ts`.

### src/data/portfolio.ts
Sumber tunggal konten — TIDAK diubah saat redesign (hanya presentasi).

## kasol-v1 — primitives (referensi adopsi; kode inti ada di theme.md Part 2)

### components/ui.tsx — Button
- Base: `rounded-xl font-black uppercase tracking-widest text-[10px] md:text-xs h-12 px-6 active:scale-95`
- primary: `bg-brand-gradient shadow-neon hover:shadow-neon-strong` + overlay shine `-translate-x-full group-hover:animate-[shine_1.5s_infinite]`
- outline: `border-2 border-brand-orange text-brand-orange hover:bg-brand-orange hover:text-white`

### components/ui.tsx — Card
- `bg-brand-card border border-white/5 rounded-3xl hover:border-brand-orange/40`; varian `glass` pakai `.glass-v2`

### components/ui.tsx — SectionHeader
- Pill kicker (ikon pulse + label 10px font-black uppercase tracking-widest, `bg-brand-orange/10 border-brand-orange/20 rounded-full`)
- h2 `text-4xl md:text-6xl font-display font-black` + highlight `<span class="text-brand-orange">` dengan underline `h-1 bg-brand-orange/30 blur-sm`
- Subjudul `text-gray-500 italic max-w-2xl`

### components/ui.tsx — Badge
- `px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border` — varian warna orange/blue/green/red

## Komponen home kasol-v1 (pola layout yang diadopsi)

### hero.tsx (full-viewport)
- Background engine: 2 orb blur (`bg-brand-orange/10 rounded-full blur-[120px] animate-pulse-slow`, `bg-red-600/5 blur-[100px]`) + grid `linear-gradient 40px #ffffff05`
- Badge pill `border-brand-orange/40 bg-brand-orange/5 backdrop-blur-md shadow-neon` (ikon Target + "OFFICIAL SITE: PT MESIN KASIR SOLO")
- h1 `text-4xl md:text-7xl lg:text-8xl font-display font-black uppercase whitespace-pre-line tracking-tighter`
- 2 CTA: `h-16 px-12 shadow-neon-strong` (primary) + outline
- Brand overlay `opacity-30 tracking-[1em]` + scroll indicator garis vertikal

### trust-strip.tsx
- `grid-cols-2 md:grid-cols-4 divide-x divide-white/5`, angka `text-2xl md:text-3xl font-display font-bold`, label `text-xs uppercase tracking-wider`

### problem-solution.tsx
- Judul merah + 2 kolom (CARA LAMA vs CARA GUE), kartu dengan judul bold + desc gray-400

### services.tsx
- Kartu: ikon 14×14 `rounded-xl bg-white/5 shadow-neon-text` (hover scale-110), subtitle uppercase kecil, judul hover:text-brand-orange, desc `border-t border-white/5 pt-4`

### innovation.tsx (portal teaser)
- Badge "R&D DIVISION 2025" biru, h2 display, grid portal button (p-4 rounded-2xl bg-white/5 hover:border-brand-orange)
