---
version: alpha
name: KASIRSOLO Admin
description: Professional admin dashboard with warm orange accent and clear hierarchy
colors:
  primary: "#E65100"
  secondary: "#555555"
  tertiary: "#2E7D32"
  accent: "#8E44AD"
  neutral: "#FFFAF5"
  ink: "#1A1A1A"
  success: "#2E7D32"
  warning: "#F97316"
  danger: "#C62828"
  info: "#1565C0"
typography:
  h1:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
    fontSize: 2rem
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.01em"
  h2:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
    fontSize: 1.5rem
    fontWeight: 700
    lineHeight: 1.3
  body-lg:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
    fontSize: 1.125rem
    fontWeight: 400
    lineHeight: 1.6
  body-md:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
    fontSize: 1rem
    fontWeight: 400
    lineHeight: 1.5
  body-sm:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
    fontSize: 0.875rem
    fontWeight: 400
    lineHeight: 1.5
  caption:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
    fontSize: 0.75rem
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: "0.03em"
  mono:
    fontFamily: "'SF Mono', 'Space Mono', monospace"
    fontSize: 0.875rem
    fontWeight: 500
rounded:
  sm: 12px
  md: 16px
  lg: 20px
  full: 9999px
spacing:
  xs: 4px
  sm: 8px
  md: 12px
  lg: 16px
  xl: 20px
  xxl: 24px
  xxxl: 32px
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "#FFFFFF"
    typography: "{typography.body-md}"
    rounded: "{rounded.sm}"
    padding: 12px 24px
  button-primary-hover:
    backgroundColor: "#BF360C"
    textColor: "#FFFFFF"
  button-secondary:
    backgroundColor: "#FFFFFF"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: 12px 24px
  card:
    backgroundColor: "#FFFFFF"
    rounded: "{rounded.md}"
    padding: 16px
  kpi-card:
    backgroundColor: "{colors.primary}"
    textColor: "#FFFFFF"
    rounded: "{rounded.md}"
    padding: 16px
  input:
    backgroundColor: "#FFFFFF"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: 12px 16px
---

## Overview

KASIRSOLO Admin adalah dashboard profesional untuk mengelola ekosistem aplikasi kasir. Design system ini menggabungkan kehangatan warna oranye sebagai identitas brand dengan hierarki visual yang jelas dan responsif di semua perangkat.

**Prinsip desain:**
- **Warm & Professional** — Orange accent memberikan kehangatan tanpa mengorbankan kredibilitas
- **Clear Hierarchy** — Typography scale dan spacing yang konsisten memandu mata user
- **Data-Dense** — Mengakomodasi 6 KPI cards, tables, dan charts tanpa terasa sesak
- **Mobile-First** — Layout responsif dengan breakpoint 768px, 1024px, 1440px

## Colors

- **Primary (#E65100):** Orange yang kuat untuk CTA dan elemen interaktif utama
- **Secondary (#555555):** Gray untuk teks sekunder dan elemen pendukung
- **Tertiary (#2E7D32):** Green untuk indikator sukses dan status positif
- **Accent (#8E44AD):** Purple untuk highlight data penting di KPI cards
- **Neutral (#FFFAF5):** Warm white background yang lembut di mata
- **Ink (#1A1A1A):** Hitam hangat untuk body text

**Semantic colors:**
- Success: Green (#2E7D32) — deals, active status
- Warning: Orange (#F97316) — pending actions
- Danger: Red (#C62828) — errors, cancelled status
- Info: Blue (#1565C0) — informational badges

## Typography

**Font stack:** System fonts (-apple-system, Segoe UI, Roboto) untuk performa optimal dan konsistensi cross-platform.

- **H1 (2rem/700):** Page titles — Dashboard, Leads, Katalog
- **H2 (1.5rem/700):** Section headers — "Statistik Bisnis", "Daftar Leads"
- **Body-lg (1.125rem):** Emphasized content, KPI values
- **Body-md (1rem):** Default body text, form labels
- **Body-sm (0.875rem):** Table cells, secondary info
- **Caption (0.75rem/500):** Timestamps, metadata, uppercase labels
- **Mono (0.875rem/500):** Serial numbers, device codes

## Layout

**Grid system:**
- Mobile (<768px): 1 column, bottom nav fixed
- Tablet (768-1023px): 2-3 columns, bottom nav fixed
- Desktop (≥1024px): Sidebar 250px + main content, no bottom nav
- Large (≥1440px): Same as desktop, wider KPI grid (6 cols)

**Spacing scale:** 4px increment (xs=4, sm=8, md=12, lg=16, xl=20, xxl=24, xxxl=32)

## Components

### Button Primary
Orange background (#E65100), white text, 12px vertical padding. Hover darkens to #BF360C. Used for main actions: Simpan, Tambah Aplikasi, Generate Serial.

### Button Secondary
White background with subtle border, ink text. Used for Cancel, Batal, secondary actions.

### KPI Card
Gradient background (primary/green/purple/red), white text, 16px radius. Contains emoji icon (14px), uppercase label (caption typography), and large value (body-lg or custom 22px/900).

### Card
Standard white card, 16px padding, 16px radius, subtle shadow. Used for forms, tables, product registry.

### Input
White background, ink text, 12px radius, 12px vertical + 16px horizontal padding. 2px border on focus (orange).

## Do's and Don'ts

**Do:**
- Use orange sparingly — only for primary CTAs and active states
- Pair KPI gradient cards with white cards for visual balance
- Stack forms vertically on mobile, 2-column grid on tablet+
- Use emoji icons (👥📦💰) for quick visual recognition in KPI cards

**Don't:**
- Overuse gradients — limit to KPI cards only
- Mix rounded corners — stick to 12px (inputs/buttons) and 16px (cards)
- Place more than 6 KPI cards on one screen
- Use pure black (#000000) — always use warm ink (#1A1A1A)
