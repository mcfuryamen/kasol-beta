# Theme — porto (adopsi DNA kasol-v1 "MKS Tactical")

## Part 1 — Ringkasan token (ringkas)

### Warna
| Token | Nilai | Pakai |
|---|---|---|
| brand-black (bg) | `#050505` | body background |
| brand-dark (panel) | `#0f0f0f` | section selang-seling |
| brand-card | `#141414` | kartu |
| brand-orange | `#FF5F1F` | aksen utama, CTA, highlight |
| brand-glow | `#FF914D` | glow lembut |
| brand-dim | `#331000` | bg aksen gelap |
| gradien brand | `linear-gradient(135deg, #FF5F1F 0%, #DC2626 100%)` | tombol primary, teks aksen |
| teks body | gray-200/gray-400/gray-500 | `#e5e5e5` / `#a3a3a3` / `#737373` |

### Tipografi
- Display (h1–h6, angka besar): **Space Grotesk** 500/700 — `tracking-tight`, hero UPPERCASE `font-black leading-[1.1] tracking-tighter`, ukuran hero `clamp ~ text-5xl→8xl`.
- Body/sans: **Outfit** 300/400/600/700.
- Kicker/eyebrow: 10–12px, `font-black uppercase tracking-widest`, warna brand-orange.

### Layout & radius
- Container `max-w` lebar (container mx-auto px-4); section padding `py-24`.
- Kartu `rounded-3xl` (24px), input/badge `rounded-xl`, pill `rounded-full`.
- Kartu layanan: ikon 14×14 `rounded-xl bg-white/5`, hover `-translate-y-2 border-brand-orange/30`.
- Hero: `min-h-[100dvh]` center, background = 2 blur-orb (orange/10 + red/5) + grid garis 40px `#ffffff05`, badge pill, 2 CTA (primary gradien `h-16 px-12 uppercase shadow-neon-strong` + outline border-2 oranye), brand overlay bawah opacity-30 `tracking-[1em]`, scroll indicator garis 1×48px gradien.
- Trust strip: 4 kolom `divide-x divide-white/5`, angka font-display bold + label uppercase kecil.
- SectionHeader: pill kicker (ikon + teks 10px uppercase) + h2 font-display font-black dengan highlight span oranye (underline blur 1px) + subjudul italic gray-500.

### Efek
- `shadow-neon: 0 0 10px rgba(255,95,31,.3), 0 0 20px rgba(255,95,31,.1)`; `neon-strong` ×1.5/×2.
- `glass-v2: bg-white/[0.03] backdrop-blur-xl border border-white/10 shadow[0_8px_32px_rgba(0,0,0,.8)]`.
- Animasi: fadeIn (translateY 10px→0, .5s), pulse-slow 4s, float 6s, marquee 40s linear, shine sweep 1.5s di tombol primary.

## Part 2 — Sumber mentah

### tailwind.config.js (kasol-v1)
```js
export default {
  theme: { extend: {
    fontFamily: {
      sans: ['Outfit', 'sans-serif'],
      display: ['Space Grotesk', 'sans-serif'],
    },
    colors: { brand: {
      black: '#050505', dark: '#0f0f0f', card: '#141414',
      orange: '#FF5F1F', glow: '#FF914D', dim: '#331000',
      action: '#FF5F1F', actionGlow: '#FF914D',
    }},
    backgroundImage: {
      'brand-gradient': 'linear-gradient(135deg, #FF5F1F 0%, #DC2626 100%)',
      'brand-gradient-hover': 'linear-gradient(135deg, #FF7A45 0%, #EF4444 100%)',
    },
    boxShadow: {
      'neon': '0 0 10px rgba(255,95,31,0.3), 0 0 20px rgba(255,95,31,0.1)',
      'neon-strong': '0 0 15px rgba(255,95,31,0.6), 0 0 30px rgba(255,95,31,0.4)',
      'neon-text': '0 0 10px rgba(255,95,31,0.8)',
    },
    animation: { 'pulse-slow': 'pulse 4s cubic-bezier(0.4,0,0.6,1) infinite', 'fade-in': 'fadeIn 0.5s ease-out forwards', 'marquee': 'marquee 40s linear infinite' },
    keyframes: { fadeIn: { '0%': {opacity:'0', transform:'translateY(10px)'}, '100%': {opacity:'1', transform:'translateY(0)'} }, marquee: { '0%': {transform:'translateX(0)'}, '100%': {transform:'translateX(-100%)'} } },
  }}
}
```

### index.css (kasol-v1) — potongan base
```css
@layer base {
  body { @apply bg-brand-black text-gray-200 font-sans; -webkit-font-smoothing: antialiased; scroll-behavior: smooth; overflow-x: hidden; }
  h1,h2,h3,h4,h5,h6 { @apply font-display tracking-tight; }
}
.glass-v2 { @apply bg-white/[0.03] backdrop-blur-xl border border-white/10 shadow-[0_8px_32px_0_rgba(0,0,0,0.8)]; }
```

### Font loading (index.html kasol-v1)
```html
<link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;700&family=Space+Grotesk:wght@500;700&display=swap" rel="stylesheet">
```

### ui.tsx primitives inti (kasol-v1)
```jsx
// Button — base: rounded-xl font-black uppercase tracking-widest text-[10px] md:text-xs h-12 px-6,
// variant primary: bg-brand-gradient text-white shadow-neon hover:shadow-neon-strong + shine sweep overlay
// variant outline: bg-transparent border-2 border-brand-orange text-brand-orange hover:bg-brand-orange hover:text-white
// Card: bg-brand-card border border-white/5 rounded-3xl hover:border-brand-orange/40 (glass: glass-v2)
// SectionHeader: pill kicker (Sparkles + "Premium Arsenal" 10px font-black uppercase) + h2 text-4xl md:text-6xl
//   font-display font-black + highlight <span text-brand-orange> dengan underline blur bg-brand-orange/30
// Badge: px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border (orange/blue/green/red)
```

### current porto global.css (yang akan dirombak)
- Saat ini: bg #0a0a0a, brand #f97316, font Plus Jakarta Sans, kartu radius 18px, tanpa glow/animasi — akan diganti penuh ke DNA di atas.
