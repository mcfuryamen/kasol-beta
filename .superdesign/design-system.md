# Design System — Porto (Kasir Solo Portfolio)

> Mode: **inspired-by** — DNA visual kasol-v1 ("MKS Tactical") diadopsi penuh sebagai identitas,
> diterapkan ke konten portofolio porto. Desktop = situs portofolio; **mobile = konsep aplikasi
> native** (bukan situs yang dikecilkan): layar penuh per section, bottom tab bar, kartu, safe-area,
> interaksi sentuh, tanpa hover-dependency.

## Identitas & Logo
- Logo resmi: **kasirsolo-logo.png** (lingkaran gradasi oranye→kuning, person/monumen di tengah).
  WAJIB dipakai di: header desktop, bottom bar mobile (sebagai avatar brand), favicon, ikon PWA.
- DILARANG mengganti logo dengan inisial "KS", emoji, SVG buatan, atau teks saja.
- Brand text: **KASIRSOLO** (display font, tracking lebar) + legal "PT MESIN KASIR SOLO".

## Warna (token)
| Token | Nilai |
|---|---|
| bg (brand-black) | #050505 |
| panel (brand-dark) | #0f0f0f |
| card (brand-card) | #141414 |
| primary (brand-orange) | #FF5F1F |
| glow | #FF914D |
| dim | #331000 |
| gradient | linear-gradient(135deg, #FF5F1F 0%, #DC2626 100%) |
| text-primary | #f5f5f5 (gray-200) |
| text-secondary | #a3a3a3 (gray-400) |
| text-muted | #737373 (gray-500) |
| line/border | rgba(255,255,255,.05–.1) |
| success / info / danger | #4ade80 / #60a5fa / #f87171 |

## Tipografi
- Display: **Space Grotesk** 500/700 — semua heading, angka stat, harga. `tracking-tight`.
  Hero UPPERCASE `font-black leading-[1.05–1.1] tracking-tighter` (clamp 40px→96px).
- Body: **Outfit** 300/400/600/700.
- Kicker/eyebrow: 10–12px `font-black uppercase tracking-widest` warna #FF5F1F.
- Narasi khas brand: bahasa "gue/lo" tegas & lugas (diwariskan apa adanya dari konten).

## Layout Desktop
- Hero `min-h-100dvh` center: background engine (orb blur orange/10 + red/5, grid 40px #ffffff05),
  badge pill "OFFICIAL SITE: PT MESIN KASIR SOLO", 2 CTA (`h-16 px-12` UPPERCASE — primary gradien
  shadow-neon-strong + outline border-2 orange), overlay "ESTABLISHED 2015 // SURAKARTA" opacity-30,
  scroll indicator garis gradien.
- Section `py-24`, container lebar; SectionHeader: pill kicker + h2 display font-black dengan
  highlight oranye underline blur + subjudul italic gray-500.
- Trust strip 4 kolom divide-x; grid kartu 3/2 kolom; kartu rounded-3xl border-white/5,
  ikon tile 14×14 rounded-xl bg-white/5, hover: border-orange/40 + -translate-y-2 + ikon scale-110.

## Layout Mobile (konsep APLIKASI NATIVE — wajib)
- **Bottom tab bar app-style**: fixed bottom, glass-dark (blur + rgba(5,5,5,.85)), safe-area-inset-bottom,
  4–5 tab ikon+label kecil (Beranda, Aplikasi, Mesin, Portal, WA), tab aktif = oranye + glow.
  Header desktop TIDAK dipakai di mobile; diganti top bar tipis logo + badge.
- **Layar penuh per section** (snap-feel): hero 100dvh seperti splash app; section berikut = "screen"
  dengan judul display besar + horizontal scroll-snap untuk kartu (aplikasi/portal: kartu 78vw,
  peek kartu berikutnya; pagination dots oranye).
- **Kartu native-feel**: rounded-2xl/3xl, border-white/5, tanpa hover (ganti active:scale-[.98]),
  CTA berupa tombol full-width gradien h-14 UPPERCASE dengan ikon.
- **Stat "widget"**: grid 2×2 kartu (bukan divide-x tipis), angka display besar + label kecil.
- **Specs hardware**: accordion/expandable card atau sheet style; harga besar display font oranye.
- **Chips kota**: horizontal scroll dua baris (Kandang oranye / Ekspansi biru) — bukan wrap panjang.
- Interaksi: `active:scale`, transisi 150–200ms; tanpa dependensi hover; font ≥14px untuk teks isi;
  target sentuh ≥44px.

## Efek & Motion
- shadow-neon `0 0 10px rgba(255,95,31,.3), 0 0 20px rgba(255,95,31,.1)`; neon-strong ×1.5/×2.
- glass: `bg-white/[0.03] backdrop-blur-xl border-white/10`.
- Animasi: fadeIn-up 0.5s bertahap (delay 0.15s), pulse-slow 4s pada orb, float 6s pada elemen
  dekoratif, marquee 40s (strip logo/kota), shine sweep 1.5s di tombol primary.
- Ikon: garis (lucide-style), stroke 2, dikawal tile rounded.

## Konten (jangan diubah narasinya)
Hero: "PUSAT MESIN KASIR TERBESAR DI SOLO." + sub "Aset Digital & sistem POS…". Stats 500+/Se-Indonesia/
99%/24-7. Aplikasi: Rosok, Kaki Lima, Shop. Hardware: Android Lite Rp2,5jt, Resto Pro Rp7,5jt.
Portal: SIBOS, QALAM, Dapur SPPG. Problem vs Solution & 12 kota + CTA WhatsApp — sesuai portfolio.ts.
