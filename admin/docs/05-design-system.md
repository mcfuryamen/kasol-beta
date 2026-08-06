# Admin Dashboard — Design System

Panduan desain visual admin dashboard (kaki5 orange theme + dark sidebar + card-based UI).

---

## 🎨 Color Palette

### CSS Variables (style.css)

```css
:root {
  /* Primary — Orange (kaki5 consistency) */
  --primary: #F7941D;
  --primary-dark: #E14E15;
  --primary-light: #FFB340;
  --orange-50: #FFF3E0;
  --orange-100: #FFE0B2;
  --orange-500: #F7941D;
  --orange-600: #E14E15;

  /* Semantic */
  --green: #3E8E4F;
  --green-bg: #DCFCE7;
  --blue: #2563EB;
  --blue-bg: #DBEAFE;
  --purple: #9333EA;
  --purple-bg: #F3E8FF;
  --red: #E8481F;
  --red-bg: #FEE2E2;

  /* Neutral */
  --bg: #FAFAFA;
  --bg-card: #FFFFFF;
  --bg-elevated: #FFFFFF;
  --text: #1A1A1A;
  --text2: #4A4A4A;
  --text3: #888888;
  --border: #E5E5E5;
  --border-strong: #D0D0D0;

  /* Sidebar (Dark) */
  --sidebar-bg: #1A1A2E;
  --sidebar-text: #FFFFFF;
  --sidebar-text-dim: #A0A0B0;
  --sidebar-line: rgba(255,255,255,0.08);
  --sidebar-hover: rgba(255,255,255,0.06);
  --sidebar-active: rgba(255,255,255,0.12);

  /* Spacing Scale */
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 20px;
  --space-6: 24px;
  --space-8: 32px;

  /* Radius */
  --radius-sm: 8px;
  --radius: 12px;
  --radius-lg: 16px;
  --radius-full: 999px;

  /* Shadows */
  --shadow-sm: 0 1px 2px rgba(0,0,0,0.04);
  --shadow: 0 4px 12px rgba(0,0,0,0.06);
  --shadow-lg: 0 8px 24px rgba(0,0,0,0.08);

  /* Transitions */
  --transition-fast: 150ms ease;
  --transition: 200ms ease;

  /* Z-index */
  --z-dropdown: 100;
  --z-modal: 200;
  --z-toast: 300;
  --z-login: 999;
}
```

### KPI Gradient Cards (Gerobak Pattern)

```css
/* 6 Metrics — each with unique gradient */
.summary-card.brand   { background: linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%); }
.summary-card.green   { background: linear-gradient(135deg, #3E8E4F 0%, #2D6B3A 100%); }
.summary-card.teal    { background: linear-gradient(135deg, #14B8A6 0%, #0D9488 100%); }
.summary-card.purple  { background: linear-gradient(135deg, #9333EA 0%, #7E22CE 100%); }
.summary-card.blue    { background: linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%); }
.summary-card.red     { background: linear-gradient(135deg, #E8481F 0%, #DC2626 100%); }
```

---

## 🔤 Typography

| Element | Font | Weight | Size | Color |
|---------|------|--------|------|-------|
| Page Title (h1) | Inter | 700 | 22px | `--text` |
| Section Label | Inter | 700 | 13px | `--text2` |
| KPI Label | Inter | 600 | 11px | `rgba(255,255,255,0.9)` |
| KPI Value | Inter | 900 | 22px | `#FFFFFF` |
| KPI Emoji (icon) | System | — | 14px | — |
| Body | Inter | 400-500 | 13-15px | `--text` |
| Input/Select | Inter | 500 | 17px | `--text` |
| Monospace (serial/code) | Space Mono / `ui-monospace` | 700 | 15-17px | `--text` |
| Small / Hint | Inter | 400 | 12px | `--text3` |
| Badge | Inter | 700 | 11px | semantic |
| Sidebar Link | Inter | 600 | 14px | `--sidebar-text` |

---

## 📐 Layout

### App Shell

```
┌─────────────────────────────────────────────────────────────────────┐
│  DESKTOP (≥1024px)                                                  │
├──────────────┬──────────────────────────────────────────────────────┤
│  .sidebar    │  .main (margin-left: 250px)                          │
│  250px fixed │                                                      │
│              │  ┌────────────────────────────────────────────────┐  │
│  ┌──────────┐ │  │  #screen-* (active)                          │  │
│  │ .sb-brand│ │  │  ┌─────────┐ ┌─────────┐ ┌─────────┐        │  │
│  ├──────────┤ │  │  │ KPI 1   │ │ KPI 2   │ │ KPI 3   │ ...    │  │
│  │ .sb-nav  │ │  │  └─────────┘ └─────────┘ └─────────┘        │  │
│  │ 5 links  │ │  ├────────────────────────────────────────────┤  │
│  ├──────────┤ │  │  Charts / Tables / Cards / Forms             │  │
│  │ .sb-foot │ │  │                                              │  │
│  └──────────┘ │  └────────────────────────────────────────────────┘  │
└──────────────┴──────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│  HP (<768px)                                                        │
├─────────────────────────────────────────────────────────────────────┤
│  .main (full width)                                                 │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │ #screen-* (active)                                            │ │
│  │  ┌───────┐ ┌───────┐                                         │ │
│  │  │ KPI 1 │ │ KPI 2 │  (2 kolom)                              │ │
│  │  └───────┘ └───────┘                                         │ │
│  │  Content...                                                   │ │
│  └───────────────────────────────────────────────────────────────┘ │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │ .bottomnav (fixed bottom)                                     │ │
│  │ [📊] [👥] [📦] [🔐] [⚙️]                                     │ │
│  └───────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

### Breakpoints (4 Tier)

```css
/* Base = HP (< 768px) */
@media (min-width: 768px) {   /* Tablet: 2-col grids, 3 KPI, bottomnav visible */ }
@media (min-width: 1024px) {  /* Desktop: sidebar 250px, 4 KPI, 3 catalog cols */ }
@media (min-width: 1440px) {  /* Large: 6 KPI single row, 4 catalog cols */ }
```

---

## 🧩 Komponen UI

### Buttons

| Class | Background | Text | Border | Usage |
|-------|------------|------|--------|-------|
| `.btn` | `--bg-card` | `--text` | `--border` | Default |
| `.btn:hover` | `--bg` | — | — | Hover |
| `.btn-primary` | `linear-gradient(var(--primary), var(--primary-dark))` | `#FFF` | None | Primary action |
| `.btn-danger` | `#FFF` | `--red` | `2px solid var(--red-bg)` | Destructive |
| `.btn-outline` | Transparent | `--text` | `--border` | Secondary |
| `.btn-sm` | Same | — | — | Compact (padding 8px 12px) |
| `.btn:disabled` | Opacity 0.5 | — | — | Disabled state |

### Cards & Panels

| Component | Border | Background | Padding | Radius | Shadow |
|-----------|--------|------------|---------|--------|--------|
| `.card` | `1px solid var(--border)` | `--bg-card` | `var(--space-4)` | `var(--radius)` | `--shadow-sm` |
| `.panel` | `1px solid var(--border)` | `--bg-card` | `var(--space-5)` | `var(--radius)` | `--shadow-sm` |
| `.summary-card` (KPI) | None | Gradient | `var(--space-4)` | `var(--radius)` | `--shadow` |
| `.catalog-card` | `1px solid var(--border)` | `--bg-card` | `0` (cover) + `var(--space-3)` | `var(--radius)` | `--shadow-sm` |

### KPI Cards (`.summary-card`)

```html
<div class="summary-card brand">
  <div class="kpi-head">
    <span class="icon">👥</span>
    <span class="label">TOTAL LEADS</span>
  </div>
  <div class="value">1,234</div>
  <div class="bar-row">...</div>  <!-- optional mini chart -->
</div>
```

- `.kpi-head`: flex row, `gap: 8px`, `align-items: center`
- `.icon`: 14px, emoji
- `.label`: 11px, uppercase, tracking 0.5px, white 90% opacity
- `.value`: 22px, weight 900, white

### Tables (`.table`)

```css
.table-wrap { overflow-x: auto; border-radius: var(--radius); border: 1px solid var(--border); background: var(--bg-card); }
.table { width: 100%; border-collapse: collapse; font-size: 13px; }
.table th, .table td { padding: var(--space-3) var(--space-4); text-align: left; border-bottom: 1px solid var(--border); }
.table th { background: var(--bg); font-weight: 700; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text3); white-space: nowrap; }
```

**Leads Table Columns (5):**
1. Nama/Bisnis (`.lead-name`)
2. WhatsApp (`.wa-link` → `wa.me`)
3. Aplikasi
4. Tanggal Daftar
5. Status (dropdown select)

**HP Responsive (`@media max-width: 767px`):**
- Stack: Nama + WhatsApp di `.lead-contact` (flex column)
- Dropdown status full-width
- Action buttons stacked

### Forms (`.field-grid`)

```css
.field-grid { display: grid; grid-template-columns: 1fr; gap: 0 var(--space-5); }
.field-grid .field { margin-bottom: var(--space-4); }
.field-grid .field-span-2 { grid-column: 1 / -1; }

@media (min-width: 768px) {
  .field-grid { grid-template-columns: 1fr 1fr; }
}
```

**Input Styles:**
```css
.field input, .field select, .field textarea {
  width: 100%;
  padding: var(--space-3) var(--space-4);
  border: 2px solid var(--border);
  border-radius: var(--radius-sm);
  font-size: 17px;
  font-weight: 600;
  background: var(--bg-card);
  color: var(--text);
}
.field input:focus, .field select:focus, .field textarea:focus {
  outline: none;
  border-color: var(--primary);
}
.field input::placeholder { color: #bbb; }
.field input[readonly] { background: var(--orange-50); color: var(--text); cursor: default; }
```

**Utility Classes:**
- `.input-mono` — `font-family: ui-monospace, SFMono-Regular, monospace;`
- `.input-mono.uppercase` — + `text-transform: uppercase;`
- `.input-readonly` — readonly styling (cream bg)
- `.field-span-2` — spans both columns in `.field-grid`

### Catalog Cards (`.catalog-card`)

```html
<article class="catalog-card">
  <div class="catalog-card-cover" style="background: var(--orange-50);">📦</div>
  <div class="catalog-card-body">
    <h3 class="catalog-card-title">Nama Aplikasi</h3>
    <p class="catalog-card-meta">Deskripsi singkat...</p>
    <div class="catalog-card-meta">
      <span class="badge badge-hot">Hot</span>
      <span>Bisnis · Rp250.000</span>
    </div>
  </div>
  <div class="catalog-card-actions">
    <button class="btn btn-sm" onclick="editCatalog(...)">Edit</button>
    <button class="btn btn-sm btn-danger" onclick="deleteCatalog(...)">Hapus</button>
  </div>
</article>
```

**Catalog Grid (Responsive):**
```css
.catalog-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: var(--space-3);
}
@media (min-width: 768px) { .catalog-grid { grid-template-columns: repeat(2, 1fr); } }
@media (min-width: 1024px) { .catalog-grid { grid-template-columns: repeat(3, 1fr); } }
@media (min-width: 1440px) { .catalog-grid { grid-template-columns: repeat(4, 1fr); } }
```

### Sheets / Modals (`.overlay` + `.sheet`)

```css
.overlay {
  position: fixed; inset: 0;
  background: rgba(0,0,0,0.4);
  opacity: 0; visibility: hidden; transition: var(--transition);
  z-index: var(--z-modal);
}
.overlay.open { opacity: 1; visibility: visible; }

.sheet {
  position: fixed; left: 50%; bottom: 0; transform: translateX(-50%) translateY(100%);
  width: 100%; max-width: 520px;
  background: var(--bg-card); border-radius: var(--radius-lg) var(--radius-lg) 0 0;
  box-shadow: var(--shadow-lg); z-index: var(--z-modal);
  transition: transform var(--transition);
}
.overlay.open .sheet { transform: translateX(-50%) translateY(0); }

/* Desktop: center modal */
@media (min-width: 1024px) {
  .sheet {
    top: 50%; bottom: auto; left: 50%;
    transform: translate(-50%, -50%) scale(0.95);
    max-height: 90vh; overflow-y: auto;
    border-radius: var(--radius-lg);
  }
  .overlay.open .sheet { transform: translate(-50%, -50%) scale(1); }
  .sheet-handle { display: none; }
}
```

**Usage:**
```javascript
// Open
overlay.classList.add('open');
sheet.classList.add('open');
// or combined
overlay.classList.add('open', 'show');
sheet.classList.add('open', 'show');

// Close
overlay.classList.remove('open', 'show');
sheet.classList.remove('open', 'show');
```

### License Product Registry (`.app-row`)

```css
.app-row {
  display: grid;
  grid-template-columns: 1fr;           /* HP: 1 kolom */
  gap: var(--space-3);
  align-items: center;
}
@media (min-width: 768px) {
  .app-row { grid-template-columns: 1fr 1fr 80px; }  /* Tablet: 3 kolom */
}
@media (min-width: 1024px) {
  .app-row { grid-template-columns: 1fr 1fr 120px 80px; }  /* Desktop: 4 kolom */
}
```

---

## 🏷️ Badges

```css
.badge {
  display: inline-flex; align-items: center; gap: 4px;
  padding: 4px 12px; border-radius: var(--radius-full);
  font-size: 11px; font-weight: 700; line-height: 1.4;
}
.badge-hot      { background: var(--orange-50); color: var(--primary-dark); }
.badge-baru     { background: var(--blue-bg); color: var(--blue); }
.badge-dihubungi{ background: #F3E8FF; color: var(--purple); }
.badge-tertarik { background: var(--orange-50); color: var(--primary-dark); }
.badge-deal     { background: var(--green-bg); color: var(--green); }
.badge-batal    { background: var(--red-bg); color: var(--red); }
.badge-trial    { background: var(--green-bg); color: var(--green); }
.badge-aktif    { background: var(--green-bg); color: var(--green); }
.badge-expired  { background: var(--red-bg); color: var(--red); }
```

---

## 📊 Charts (Bar)

```css
.bar-row { display: flex; align-items: center; gap: 12px; margin-bottom: 10px; }
.bar-label { width: 120px; font-size: 12px; color: var(--text2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.bar-track { flex: 1; height: 8px; background: var(--border); border-radius: 4px; overflow: hidden; }
.bar-fill { height: 100%; background: linear-gradient(90deg, var(--primary), var(--primary-dark)); border-radius: 4px; transition: width 0.3s ease; }
.bar-value { width: 50px; text-align: right; font-size: 12px; font-weight: 700; color: var(--text); }
```

---

## 🔔 Toast Notifications

```css
#toast {
  position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%);
  display: flex; align-items: center; gap: 8px;
  padding: 10px 18px; border-radius: 30px;
  background: var(--text); color: #FFF;
  font-size: 13px; font-weight: 600;
  opacity: 0; pointer-events: none; transition: opacity var(--transition-fast);
  z-index: var(--z-toast);
}
#toast.show { opacity: 1; }
#toast.success { background: var(--green); }
#toast.warning { background: var(--primary-dark); }
#toast.error { background: var(--red); }
```

---

## 🛠️ Utility Classes

```css
/* Spacing */
.mt4  { margin-top: var(--space-2); }
.mt8  { margin-top: var(--space-3); }
.mt12 { margin-top: var(--space-4); }
.mt16 { margin-top: var(--space-5); }
.mt24 { margin-top: var(--space-6); }
.mt32 { margin-top: var(--space-8); }
.mb0  { margin-bottom: 0; }

/* Layout */
.gap4 { gap: var(--space-3); }
.flex { display: flex; }
.items-center { align-items: center; }
.justify-between { justify-content: space-between; }
.text-center { text-align: center; }

/* Inputs */
.input-mono { font-family: ui-monospace, SFMono-Regular, 'SF Mono', Menlo, monospace; }
.input-mono.uppercase { text-transform: uppercase; }
.input-readonly { background: var(--orange-50); color: var(--text); cursor: default; }

/* Verification */
.verify-badge { display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px; border-radius: var(--radius-full); font-size: 13px; font-weight: 700; }
.verify-badge.success { background: var(--green-bg); color: var(--green); }
.verify-badge.error { background: var(--red-bg); color: var(--red); }
.verify-detail { margin-top: var(--space-3); padding: var(--space-3); background: var(--bg); border-radius: var(--radius-sm); }
.verify-row { display: flex; gap: var(--space-3); margin-bottom: var(--space-2); }
.verify-label { font-size: 12px; color: var(--text3); min-width: 100px; }
.verify-value { font-size: 13px; font-weight: 600; color: var(--text); font-family: ui-monospace, monospace; }

/* Text */
.text-xs { font-size: 12px; }

/* Grids */
.two-col-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: var(--space-3); }
@media (min-width: 768px) {
  .two-col-grid { grid-template-columns: repeat(2, 1fr); }
}
.settings-grid { display: grid; grid-template-columns: 1fr; gap: var(--space-3); }
.settings-grid .card { margin-bottom: 0; }
@media (min-width: 768px) {
  .settings-grid { grid-template-columns: 1fr 1fr; }
}

/* Section */
.section-label { font-size: 13px; font-weight: 700; color: var(--text2); margin-bottom: var(--space-3); }
.section-label.mb0 { margin-bottom: 0; }
.hint { font-size: 12px; color: var(--text3); }
.hint-small { font-size: 12px; line-height: 1.6; }
.muted-note { font-size: 12px; color: var(--text3); margin-bottom: var(--space-3); }
.footer-note { text-align: center; padding: var(--space-4); font-size: 11px; color: var(--text3); border-top: 1px solid var(--border); margin-top: var(--space-4); }
.contact-strip { display: flex; align-items: center; gap: var(--space-3); padding: var(--space-3); background: #f5f5f5; border: 1px solid var(--border); border-radius: var(--radius-sm); margin-bottom: var(--space-3); font-size: 13.5px; color: var(--text); }
.contact-strip span { font-size: 18px; flex-shrink: 0; }
.contact-strip a { color: var(--primary); font-weight: 600; }

/* Empty States */
.empty-state { padding: var(--space-6) var(--space-4); text-align: center; color: var(--text3); }
.empty-state[hidden] { display: none; }
.empty-icon { font-size: 48px; margin-bottom: var(--space-3); opacity: 0.5; }
.empty-title { font-size: 15px; font-weight: 700; color: var(--text2); margin-bottom: var(--space-2); }
.empty-desc { font-size: 13px; line-height: 1.5; }
```

---

## 📱 Responsivitas Summary

| Component | HP (<768) | Tablet (768-1023) | Desktop (≥1024) | Large (≥1440) |
|-----------|-----------|-------------------|-----------------|---------------|
| Sidebar | Hidden (drawer) | Hidden (drawer) | 250px fixed | 250px fixed |
| Bottom Nav | Fixed 5 items | Fixed 5 items | Hidden | Hidden |
| KPI Grid | 2 cols | 3 cols | 4 cols | 6 cols (1 row) |
| Catalog Grid | 1 col | 2 cols | 3 cols | 4 cols |
| Forms (`.field-grid`) | 1 col | 2 cols | 2 cols | 2 cols |
| Settings Grid | 1 col | 2 cols | 2 cols | 2 cols |
| License Grid (`.app-row`) | 1 col | 3 cols | 4 cols | 4 cols |
| Leads Table | Stacked (contact) | Normal 5-col | Normal 5-col | Normal 5-col |
| Sheets/Modals | Bottom-sheet | Center modal | Center modal | Center modal |
| Max Content Width | 100% | 820px | 100% (minus sidebar) | 1200px (minus sidebar) |

---

*Design System Admin Dashboard — KASIRSOLO*