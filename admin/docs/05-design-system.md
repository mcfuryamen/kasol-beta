# Admin Dashboard — Design System

Panduan desain visual admin dashboard.

---

## 🎨 Color Palette

### Primary (Landing Page Consistency)

```css
--ink:        #2A1B0F    /* Teks utama */
--ink-soft:   #6B5B4D    /* Teks sekunder */
--cream:      #FFF8F0    /* Background halaman */
--cream-2:    #FFF1DE    /* Background aksen */
--line:       #EBDCC6    /* Border */
--orange-400: #F7941D    /* Aksen primer */
--orange-500: #F2661C    /* Gradient primer */
--orange-600: #E14E15    /* Gradient primer gelap */
--red-600:    #E8481F    /* Aksen merah */
```

### Sidebar (Dark Theme)

```css
--sidebar-bg:    #20140B    /* Background sidebar */
--sidebar-line:  rgba(255,255,255,0.08)  /* Border sidebar */
```

### Status Colors

```css
--green-600: #3E8E4F    /* Success / berlangganan */
--green-100: #DCFCE7    /* Background success */
--blue-600:  #2563EB    /* Info / baru */
--blue-100:  #DBEAFE    /* Background info */
--gray-500:  #8C7A69    /* Placeholder / kosong */
```

---

## 🔤 Typography

| Element | Font | Weight | Size |
|---------|------|--------|------|
| Heading (h1) | Plus Jakarta Sans | 800 | 24px |
| Heading (h2-h4) | Plus Jakarta Sans | 700-800 | 15-22px |
| Body | Inter | 400-600 | 13-15px |
| Monospace (serial) | Space Mono | 700 | 19-22px |
| Sidebar link | Inter | 600 | 14px |

---

## 📐 Layout

### App Shell

```
┌──────────────────────────────────────────────────┐
│  SIDEBAR (250px)     │  MAIN CONTENT (fluid)    │
│                      │                          │
│  ┌────────────────┐  │  ┌────────────────────┐  │
│  │  Logo + Brand  │  │  │  Topbar            │  │
│  │                │  │  │  (page title)      │  │
│  ├────────────────┤  │  ├────────────────────┤  │
│  │  Nav Links     │  │  │                    │  │
│  │  • Dashboard   │  │  │  View Content      │  │
│  │  • Leads       │  │  │                    │  │
│  │  • Catalog     │  │  │                    │  │
│  │  • Lisensi     │  │  │                    │  │
│  │  • Settings    │  │  │                    │  │
│  ├────────────────┤  │  │                    │  │
│  │  [Refresh]     │  │  │                    │  │
│  │  [Logout]      │  │  │                    │  │
│  │                │  │  │                    │  │
│  │  Sync status   │  │  │                    │  │
│  └────────────────┘  │  └────────────────────┘  │
└──────────────────────────┴──────────────────────┘
```

### Login Gate

```
┌─────────────────────────┐
│    [Logo]               │
│    Admin Marketing      │
│    KASIRSOLO            │
│                         │
│    [Password ______]    │
│                         │
│    [MASUK]              │
│                         │
│    ⚠️ Password salah    │
└─────────────────────────┘
```

---

## 🧩 Komponen UI

### Buttons

| Class | Background | Text | Border |
|-------|-----------|------|--------|
| `.btn` | White | Ink | `--line` |
| `.btn-primary` | Gradient orange-red | White | None |
| `.btn-danger` | White | Red | Light red border |
| `.btn-sm` | Same | — | — |

### Cards & Panels

| Component | Border | Background | Padding |
|-----------|--------|------------|---------|
| `.panel` | `1px solid --line` | White | 20px |
| `.banner` | `1px solid --line` | `--cream-2` | 14px |
| `.stat-card` | None | `--cream-2` | 20px 24px |

### Table

```css
table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13.5px;
}
th {
  text-align: left;
  padding: 10px 12px;
  border-bottom: 2px solid var(--line);
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--ink-soft);
}
td {
  padding: 12px;
  border-bottom: 1px solid var(--line);
}
tr:hover { background: var(--cream); }
```

### Bar Chart (Leads per App/Status)

```css
.bar-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 10px;
}
.bar-track {
  flex: 1;
  height: 8px;
  background: var(--line);
  border-radius: 4px;
  overflow: hidden;
}
.bar-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--orange-400), var(--red-600));
  border-radius: 4px;
}
```

### Toast Notification

```css
.toast {
  position: fixed;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%);
  background: var(--ink);
  color: #fff;
  padding: 10px 18px;
  border-radius: 30px;
  font-size: 13px;
  font-weight: 600;
  opacity: 0;
  transition: opacity 0.3s;
}
.toast.show { opacity: 1; }
```

---

## 🎛️ Input Elements

```css
input, select, textarea {
  width: 100%;
  padding: 11px 14px;
  border-radius: 12px;
  border: 1.5px solid var(--line);
  background: var(--cream);
  font-size: 14px;
  font-family: 'Inter', sans-serif;
}
input:focus, select:focus, textarea:focus {
  outline: none;
  border-color: var(--orange-400);
  background: #fff;
}
```

---

## 📱 Responsivitas

| Breakpoint | Sidebar | Main Content |
|------------|---------|-------------|
| `> 768px` | 250px fixed | Fluid |
| `≤ 768px` | Hidden (need mobile menu) | Full width |

> **Catatan:** Sidebar saat ini belum responsive untuk mobile. Perlu penambahan toggle menu.

---

*Design System Admin Dashboard — KASIRSOLO*
