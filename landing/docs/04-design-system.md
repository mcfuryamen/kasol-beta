# Landing Page — Design System

Panduan lengkap desain visual landing page.

---

## 🎨 Color Palette

### Primary Colors

```css
--ink:        #2A1B0F    /* Warna teks utama — coklat gelap */
--ink-soft:   #5C4A3C    /* Warna teks sekunder */
--cream:      #FFF8F0    /* Background utama — krem hangat */
--cream-2:    #FFF1DE    /* Background aksen — krem lebih gelap */
--line:       #F0DFC8    /* Border & garis pemisah */
```

### Accent Colors

```css
--orange-400: #F7941D    /* Aksen primer — orange cerah */
--orange-500: #F2661C    /* Gradient primer — orange medium */
--orange-600: #E14E15    /* Gradient primer — orange gelap */
--red-600:    #E8481F    /* Gradient sekunder — merah */
--yellow-300: #FDE68A   /* Highlight — kuning lembut */
--yellow-400: #F9C23C   /* Accent kuning */
--green-600:  #3E8E4F   /* Success / positif */
--white:      #FFFFFF   /* Background kartu */
```

### Usage Mapping

| Elemen | Color Variable |
|--------|---------------|
| Headline utama | `--ink` |
| Subheadline / body | `--ink-soft` |
| Background halaman | `--cream` |
| Background kartu | `--white` |
| Border / garis | `--line` |
| CTA button primary | Gradient `--orange-400` → `--red-600` |
| Badge "Hot" | `--red-600` |
| Harga | `--orange-600` |
| Success / positif | `--green-600` |
| Eyebrow / label kecil | `--orange-600` |

---

## 🔤 Typography

### Font Families

| Font | Weight | Penggunaan |
|------|--------|-----------|
| **Plus Jakarta Sans** | 400, 500, 600, 700, 800 | Semua heading (h1-h4), brand, CTA |
| **Inter** | 400, 500, 600, 700 | Body text, label, input, link |

### Type Scale

| Element | Font | Size | Weight | Line Height |
|---------|------|------|--------|-------------|
| H1 (Hero) | Plus Jakarta Sans | 52px desktop / 36px mobile | 800 | 1.15 |
| H2 (Section) | Plus Jakarta Sans | 36px | 800 | 1.15 |
| H3 (Card title) | Plus Jakarta Sans | 22px | 700 | 1.2 |
| H4 (Card title) | Plus Jakarta Sans | 16.5px | 700 | 1.3 |
| Body lead | Inter | 17.5px | 400 | 1.6 |
| Body | Inter | 14.5-15px | 400-600 | 1.6 |
| Small / label | Inter | 12.5-13px | 700 | 1.4 |
| Eyebrow | Inter | 13px | 700 | 1 |

### Gradient Text

```css
.grad-text {
  background: linear-gradient(100deg, var(--orange-500), var(--red-600));
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}
```

Digunakan pada kata kunci di headline hero untuk penekanan visual.

---

## 📐 Spacing & Layout

### Container

```css
max-width: 1180px;
padding: 0 24px;
margin: 0 auto;
```

### Section Padding

```css
/* Desktop */
section { padding: 88px 0; }

/* Mobile */
@media (max-width: 620px) {
  section { padding: 64px 0; }
}
```

### Grid Gaps

| Layout | Gap |
|--------|-----|
| App catalog grid | 22px |
| Problem/Solution grid | 28px |
| Steps grid | 24px |
| Advantages grid | 22px |
| Footer grid | 36px |

### Border Radius

| Size | Value | Penggunaan |
|------|-------|-----------|
| `--radius-sm` | 10px | Input, tombol kecil, badge |
| `--radius-md` | 14-16px | Kartu aplikasi, panel |
| `--radius-lg` | 20-24px | Card utama, form, section |
| `999px` | Full rounded | Tombol CTA, badge, pill |

### Shadow System

```css
--shadow-soft:  0 20px 40px -20px rgba(226, 90, 20, 0.28);
--shadow-card:  0 2px 10px rgba(42, 27, 15, 0.06);
```

---

## 📱 Responsive Breakpoints

### Desktop (> 980px)

- Nav links visible
- Hero: 2 kolom (text + phone mockup)
- App grid: 4 kolom
- Steps: 4 kolom horizontal
- Advantages: 3 kolom
- Trial: 2 kolom (perks + form)
- Footer: 4 kolom

### Tablet (≤ 980px)

- Burger menu aktif
- Hero: 1 kolom (stacked)
- App grid: 2 kolom
- Steps: 2 kolom
- Advantages: 2 kolom
- Trial: 1 kolom
- Footer: 2 kolom
- Floating cards disembunyikan

### Mobile (≤ 620px)

- App grid: 1 kolom
- Steps: 1 kolom
- Advantages: 1 kolom
- Price features: 1 kolom
- Field row: 1 kolom
- Footer: 1 kolom
- Final CTA: margin & padding dikurangi

### Reduced Motion

```css
@media (prefers-reduced-motion: reduce) {
  html { scroll-behavior: auto; }
  .reveal { opacity: 1; transform: none; transition: none; }
  .btn, .app-card, .final-cta { transition: none; }
}
```

---

## ✨ Animasi

### Scroll Reveal

```javascript
const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('in'); });
}, { threshold: 0.15 });
```

Class `.reveal` → `.reveal.in` menambah `opacity: 1` dan `transform: translateY(0)`.

### Counter Animation

```javascript
// Easing: cubic ease-out
const eased = 1 - Math.pow(1 - progress, 3);
```

Hanya berjalan sekali per session (flag `counted`).

### Hover Effects

```css
/* App card */
.app-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 22px 34px -20px rgba(42, 27, 15, 0.22);
}

/* Button primary */
.btn-primary:hover {
  transform: translateY(-2px);
  box-shadow: 0 24px 44px -18px rgba(226, 90, 20, 0.42);
}
```

---

## 🧩 Komponen UI

### Buttons

| Class | Background | Text | Border |
|-------|-----------|------|--------|
| `.btn-primary` | Gradient orange-red | White | None |
| `.btn-ghost` | White | Ink | `--line` |
| `.btn-sm` | Same as parent | — | — |

### Cards

| Component | Border | Background | Padding |
|-----------|--------|------------|---------|
| `.app-card` | `1px solid --line` | White | 26px |
| `.ps-card` | `1px solid --line` | `--cream` / `--cream-2` | 36px |
| `.adv-card` | `1px solid --line` | White | 28px |
| `.price-card` | None | Dark gradient | 44px |

### Form Elements

```css
input, select {
  padding: 12px 14px;
  border: 1.5px solid var(--line);
  border-radius: 10px;
  background: var(--cream);
  font-size: 14px;
}
input:focus, select:focus {
  outline: none;
  border-color: var(--orange-400);
  background: #fff;
}
```

---

*Design System Landing Page — KASIRSOLO*
