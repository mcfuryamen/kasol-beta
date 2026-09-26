# Layouts — porto

## src/layouts/Base.astro (satu-satunya layout; full source)
```astro
---
import '../styles/global.css';
import { site } from '../data/portfolio';

interface Props {
  title?: string;
  description?: string;
}
const {
  title = `${site.brand} — ${site.tagline}`,
  description = site.heroSubtitle,
} = Astro.props;
---
<!doctype html>
<html lang="id">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="description" content={description} />
    <meta name="generator" content={Astro.generator} />
    <title>{title}</title>
  </head>
  <body>
    <header class="site-header">
      <div class="container header-inner">
        <a href="/" class="brand">
          <span class="brand-mark">KS</span>
          <span class="brand-text">
            <strong>{site.brand}</strong>
            <small>{site.legalName}</small>
          </span>
        </a>
        <nav class="nav">
          <a href="/#aplikasi">Aplikasi</a>
          <a href="/#hardware">Mesin Kasir</a>
          <a href="/#portal">Portal</a>
          <a href="/#jangkauan">Jangkauan</a>
          <a href={`https://wa.me/${site.whatsapp}`} class="btn btn-primary" target="_blank" rel="noopener">Tanya Founder</a>
        </nav>
      </div>
    </header>

    <main>
      <slot />
    </main>

    <footer class="site-footer">
      <div class="container">
        <p><strong>{site.legalName}</strong> — {site.tagline}</p>
        <p class="muted">{site.established}</p>
      </div>
    </footer>
  </body>
</html>

```

## src/styles/global.css (styling layout & semua section; full source — AKAN DIROMBAK ke DNA kasol-v1)
```css
:root {
  --bg: #0a0a0a;
  --bg-2: #111111;
  --card: #161616;
  --line: #262626;
  --text: #f5f5f4;
  --muted: #a3a3a3;
  --brand: #f97316;
  --brand-2: #fb923c;
  --brand-dark: #ea580c;
  --grad: linear-gradient(135deg, #fb923c, #f97316, #ea580c);
}

* { box-sizing: border-box; margin: 0; padding: 0; }

html { scroll-behavior: smooth; }

body {
  background: var(--bg);
  color: var(--text);
  font-family: 'Plus Jakarta Sans', 'Segoe UI', system-ui, -apple-system, sans-serif;
  line-height: 1.6;
}

.container { max-width: 1120px; margin: 0 auto; padding: 0 20px; }
.muted { color: var(--muted); }

/* Header */
.site-header {
  position: sticky; top: 0; z-index: 50;
  background: rgba(10,10,10,.85);
  backdrop-filter: blur(10px);
  border-bottom: 1px solid var(--line);
}
.header-inner {
  display: flex; align-items: center; justify-content: space-between;
  height: 64px; gap: 16px;
}
.brand { display: flex; align-items: center; gap: 10px; text-decoration: none; color: var(--text); }
.brand-mark {
  width: 36px; height: 36px; border-radius: 10px;
  background: var(--grad); color: #fff;
  display: grid; place-items: center; font-weight: 800; font-size: 14px;
}
.brand-text { display: flex; flex-direction: column; line-height: 1.15; }
.brand-text strong { font-size: 16px; letter-spacing: .04em; }
.brand-text small { color: var(--muted); font-size: 11px; }

.nav { display: flex; align-items: center; gap: 20px; }
.nav a { color: var(--muted); text-decoration: none; font-size: 14px; font-weight: 600; }
.nav a:hover { color: var(--text); }

.btn {
  display: inline-flex; align-items: center; gap: 8px;
  padding: 9px 18px; border-radius: 999px;
  font-size: 14px; font-weight: 700; text-decoration: none;
  border: 1px solid var(--line); color: var(--text);
  transition: all .15s ease;
}
.btn-primary { background: var(--grad); border: none; color: #fff; }
.btn-primary:hover { filter: brightness(1.08); }
.btn-ghost { background: transparent; }
.btn-ghost:hover { border-color: var(--brand); color: var(--brand-2); }

/* Hero */
.hero {
  padding: 96px 0 72px;
  background:
    radial-gradient(600px 300px at 20% 0%, rgba(249,115,22,.14), transparent),
    radial-gradient(600px 300px at 80% 0%, rgba(59,130,246,.08), transparent);
}
.eyebrow {
  display: inline-block; padding: 6px 14px; border-radius: 999px;
  border: 1px solid rgba(249,115,22,.4); color: var(--brand-2);
  font-size: 12px; font-weight: 700; letter-spacing: .18em; text-transform: uppercase;
  margin-bottom: 20px;
}
.hero h1 {
  font-size: clamp(34px, 6vw, 60px); line-height: 1.12;
  font-weight: 800; letter-spacing: -.02em; max-width: 760px;
}
.hero h1 .accent {
  background: var(--grad);
  -webkit-background-clip: text; background-clip: text; color: transparent;
}
.hero p.sub {
  margin-top: 18px; max-width: 640px;
  color: var(--muted); font-size: 17px;
}
.hero .cta { margin-top: 28px; display: flex; gap: 12px; flex-wrap: wrap; }

/* Stats */
.stats {
  border-top: 1px solid var(--line); border-bottom: 1px solid var(--line);
  background: var(--bg-2);
}
.stats-grid {
  display: grid; grid-template-columns: repeat(4, 1fr);
  padding: 28px 0;
}
.stat { text-align: center; padding: 0 12px; }
.stat + .stat { border-left: 1px solid var(--line); }
.stat b { display: block; font-size: 24px; font-weight: 800; }
.stat span { color: var(--muted); font-size: 12px; text-transform: uppercase; letter-spacing: .12em; }

/* Sections */
section.block { padding: 72px 0; }
.section-head { max-width: 680px; margin-bottom: 40px; }
.section-head .kicker {
  color: var(--brand-2); font-size: 12px; font-weight: 800;
  letter-spacing: .2em; text-transform: uppercase;
}
.section-head h2 { font-size: clamp(26px, 4vw, 38px); font-weight: 800; margin-top: 8px; }
.section-head p { color: var(--muted); margin-top: 10px; }

/* Cards */
.grid { display: grid; gap: 16px; }
.grid-3 { grid-template-columns: repeat(3, 1fr); }
.grid-2 { grid-template-columns: repeat(2, 1fr); }
@media (max-width: 800px) { .grid-3, .grid-2 { grid-template-columns: 1fr; } .stats-grid { grid-template-columns: repeat(2, 1fr); row-gap: 20px; } }

.card {
  background: var(--card); border: 1px solid var(--line);
  border-radius: 18px; padding: 22px;
  transition: border-color .15s ease, transform .15s ease;
}
.card:hover { border-color: rgba(249,115,22,.5); transform: translateY(-2px); }
.card .type { color: var(--brand-2); font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: .14em; }
.card h3 { font-size: 19px; margin: 8px 0 6px; }
.card p { color: var(--muted); font-size: 14px; }
.tags { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 14px; }
.tag {
  font-size: 11px; font-weight: 700; padding: 4px 10px; border-radius: 999px;
  background: rgba(249,115,22,.1); color: var(--brand-2);
  border: 1px solid rgba(249,115,22,.25);
}

/* Hardware */
.hw-card .cat { color: var(--brand-2); font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: .14em; }
.hw-card .price { font-size: 26px; font-weight: 800; margin: 6px 0 2px; color: var(--brand-2); }
.hw-card .desc { color: var(--muted); font-size: 14px; }
.specs { margin-top: 14px; border-top: 1px dashed var(--line); padding-top: 12px; display: grid; gap: 6px; }
.specs div { display: flex; justify-content: space-between; font-size: 13px; }
.specs dt { color: var(--muted); }
.specs dd { font-weight: 600; }

/* Problems vs solutions */
.vs { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
@media (max-width: 800px) { .vs { grid-template-columns: 1fr; } }
.vs .col-title { font-size: 13px; font-weight: 800; letter-spacing: .14em; text-transform: uppercase; margin-bottom: 12px; }
.vs .bad .col-title { color: #f87171; }
.vs .good .col-title { color: #4ade80; }
.vs .card p { font-size: 14px; }

/* Cities */
.cities { display: flex; flex-wrap: wrap; gap: 8px; }
.city {
  padding: 8px 14px; border-radius: 999px; font-size: 13px; font-weight: 600;
  border: 1px solid var(--line); background: var(--card);
}
.city.ekspansi { border-color: rgba(59,130,246,.4); color: #93c5fd; }
.city.kandang { border-color: rgba(249,115,22,.4); color: var(--brand-2); }

/* Footer */
.site-footer {
  border-top: 1px solid var(--line); padding: 32px 0 40px;
  background: var(--bg-2); margin-top: 40px;
}
.site-footer p { font-size: 14px; }
.site-footer .muted { font-size: 12px; letter-spacing: .12em; text-transform: uppercase; }

```

## Kasol-v1 layout pattern (referensi adopsi)
- Tidak ada navbar fixed terpisah: halaman home langsung full-viewport hero; brand hadir sbg badge + overlay + logo footer.
- Nav bila perlu: teks uppercase kecil font-black tracking-widest, hover brand-orange.
- Footer kasol-v1: dark, kolom brand + legal, teks kecil gray-500.
