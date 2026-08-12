# Admin Dashboard — Arsitektur

Modular Vanilla ESM SPA architecture dengan 5 tab navigasi, integrasi sistem lisensi HMAC-SHA256, dan design system kaki5.

> ⚠️ **Pipeline (2026-08-11):** tabel `leads` & `pembelian` di-DROP dari Supabase.
> Seluruh funnel kini digarap di **satu tabel `clients`** (baru → dihubungi → tertarik →
> menunggu_verifikasi → aktif/batal) lewat UI Klien **List + Kanban**. `js/leads.js` &
> `js/pembelian.js` sudah dihapus — referensi `leads` di dokumen ini bagian dari
> arsitektur lama (pre-1.4.0).

> ⚠️ **Arah Arsitektur Cloud (2026):** Admin adalah **Lapisan Meta/CRM**. Sistem
> lisensi melakukan **generate + validasi via Supabase** (menggantikan offline saat
> ini). Data Bisnis transaksi klien & Dashboard Hub termasuk **Lapisan B** — bukan
> bagian admin. Rujukan: **`../CLOUD-ROADMAP.md`**.

---

## 🏛️ Arsitektur 3-Layer

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        index.html (Entry Point)                         │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  HTML STRUCTURE                                                 │   │
│  │  ├── #loginScreen (login gate, z-index 999)                    │   │
│  │  └── #app (main shell)                                         │   │
│  │      ├── .sidebar (desktop: sticky 250px, dark theme)          │   │
│  │      │   ├── .sb-brand (logo + nama)                           │   │
│  │      │   ├── .sb-nav (5 tab links)                             │   │
│  │      │   └── .sb-foot (refresh + logout buttons)               │   │
│  │      ├── .main (content area, margin-left: 250px desktop)      │   │
│  │      │   ├── #screen-dashboard (6 KPI + charts)                │   │
│  │      │   ├── #screen-klien (tab Outlet / Leads)                │   │
│  │      │   ├── #screen-catalog (card grid + actions + sheet)     │   │
│  │      │   ├── #screen-license (registry + generate/verify)      │   │
│  │      │   └── #screen-settings (forms + backup)                 │   │
│  │      ├── .bottomnav (HP: fixed bottom, 5 items)                │   │
│  │      ├── .overlay + .sheet (modals: catalog, license)          │   │
│  │      └── #toast (notification)                                  │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  CSS (style.css — ~940 lines)                                   │   │
│  │  ├── CSS Variables (color, spacing, radius, sidebar, breakpoints)│   │
│  │  ├── Reset & Base                                               │   │
│  │  ├── Layout: app shell, sidebar, bottomnav, main               │   │
│  │  ├── Components: buttons, cards, tables, forms, badges         │   │
│  │  ├── KPI Cards (gradient, 6 metrics, .kpi-head emoji-left)     │   │
│  │  ├── Charts: .bar-row, .bar-track, .bar-fill                   │   │
│  │  ├── Catalog: .catalog-grid, .catalog-card, .catalog-card-actions│   │
│  │  ├── Forms: .field-grid, .field-span-2, .input-mono, .input-readonly│   │
│  │  ├── Sheets/Modals: .overlay.open.show, .sheet, desktop center │   │
│  │  ├── License: .app-row grid (3-tier responsive)                │   │
│  │  ├── Utility: .mt4/.mt8/.mt12/.mt24, .mb0, .gap4, .flex,      │   │
│  │  │         .items-center, .justify-between, .hidden (attr)     │   │
│  │  └── Media Queries: 768px / 1024px / 1440px (4 tiers)         │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  JAVASCRIPT (ES Modules — 12 files)                             │   │
│  │                                                                 │   │
│  │  ENTRY LAYER                                                    │   │
│  │  ├── app.js                  # Boot, routing, screen switching │   │
│  │                                                                 │   │
│  │  STATE/DATA LAYER                                             │   │
│  │  ├── app-state.js            # STATE object, setState, getState│   │
│  │  ├── storage.js              # Storage abstraction (localStorage│   │
│  │  │                            → Supabase ready interface)      │   │
│  │                                                                 │   │
│  │  CORE/UI/UTILS LAYER                                          │   │
│  │  ├── utils.js                # escapeHtml, formatRupiah,       │   │
│  │  │                            formatDate, showToast            │   │
│  │  ├── toast.js                # Toast notification system       │   │
│  │  ├── auth.js                 # doLogin, doLogout, checkAuth    │   │
│  │  ├── navigation.js           # showScreen, sidebar/bottomnav   │   │
│  │  ├── license-core.js         # Pure HMAC-SHA256 (no DOM)       │   │
│  │                                                                 │   │
│  │  MODULE LAYER (screens)                                       │   │
│  │  ├── dashboard.js            # 6 KPI + bar charts + empty      │   │
│  │  ├── clients.js              # CRM pipeline + List/Kanban (leads.js dihapus) │   │
│  │  ├── catalog.js              # Card grid + actions + sheet     │   │
│  │  ├── license-ui.js           # Registry + generate/verify/ref  │   │
│  │  └── settings.js             # Forms + backup/restore/reset    │   │
│  └─────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 🔄 Data Flow

```
┌────────────────────────────────────────────────────────────────────────────┐
│                           DATA FLOW                                        │
│                                                                            │
│   ┌─────────────────────┐                                                 │
│   │   Landing Page      │                                                 │
│   │                     │                                                 │
│   │  Membaca:          │                                                   │
│   │  • kasirsolo:cat   │                                                   │
│   │  • kasirsolo:set  ├──────────────────────────────────────┐            │
│   │  • kasirsolo:lea   │                                      │            │
│   │  • kasirsolo:sta   │                                      │            │
│   └─────────────────────┘                                      │            │
│            ▲                                                   │            │
│            │ tulis (form submit)                               │            │
│            │                                                   ▼            │
│   ┌─────────────────────────────────────────────────────────────────┐       │
│   │                    localStorage (browser)                        │       │
│   │                                                                 │       │
│   │  kasirsolo:catalog    ◄── tulis ──┐                            │       │
│   │  kasirsolo:settings   ◄── tulis ──┤  Admin Dashboard           │       │
│   │  kasirsolo:leads      ──► baca   ─┤  (read/write via storage.js)│      │
│   │  kasirsolo:stats      ──► baca   ─┘                            │       │
│   │  license_products     ◄── tulis ──┘                            │       │
│   └─────────────────────────────────────────────────────────────────┘       │
│            ▲                                                   │            │
│            │                                                   │            │
│            │                                                   │            │
│   ┌─────────────────────┐                                  ┌───────────┐   │
│   │   Aplikasi Klien    │                                  │ SUPABASE  │   │
│   │   (rosok, gerobak,  │                                  │ (rencana) │   │
│   │   retail, dll)     │                                  │           │   │
│   │                     │                                  │ users     │   │
│   │  Dexie.js (offline) │                                  │ businesses│   │
│   │  + HMAC validation  │                                  │ licenses  │   │
│   └─────────────────────┘                                  │ leads     │   │
│            │                                               │ products  │   │
│            │ license validation                            │ settings  │   │
│            ▼                                               └───────────┘   │
│   ┌─────────────────────┐                                                 │
│   │  License Generator  │  (sudah terintegrasi di admin)                  │
│   │  HMAC-SHA256        │                                                 │
│   └─────────────────────┘                                                 │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

---

## 📦 Module Dependencies (ESM)

```
app.js (entry)
├── app-state.js
├── storage.js
├── utils.js
├── toast.js
├── auth.js
├── navigation.js
├── license-core.js
├── dashboard.js
├── clients.js
├── catalog.js
├── license-ui.js
└── settings.js
```

**Import pattern:**
```javascript
// app.js
import { STATE, setState, getState } from './app-state.js';
import { storageGetJSON, storageSetJSON, storageClearAll } from './storage.js';
import { escapeHtml, formatRupiah, formatDate } from './utils.js';
import { showToast } from './toast.js';
import { doLogin, doLogout, checkAuth } from './auth.js';
import { showScreen } from './navigation.js';
import { renderDashboard } from './dashboard.js';
import { initClients } from './clients.js';
import { renderCatalog, openCatalogSheet } from './catalog.js';
import { renderLicenseScreen, openProductForm, openLicenseSheet } from './license-ui.js';
import { renderSettingsForm } from './settings.js';
```

---

## 🔐 Sistem Lisensi

Lisensi terintegrasi langsung di tab **Lisensi** pada admin dashboard.
Algoritma yang digunakan adalah **HMAC-SHA256** (sama seperti generator universal).

### Flow Penerbitan Lisensi

```
  1. Admin buka tab "Lisensi"
         │
         ▼
  2. Pilih produk dari dropdown (daftar dari product registry)
         │
         ▼
  3. Minta pembeli mengirim Device Code dari aplikasi mereka
         │
         ▼
  4. Admin masukkan Device Code + pilih masa berlaku
         │
         ▼
  5. Klik "Buat Nomor Serial"
         │
         ▼
  6. Sistem generate serial HMAC-SHA256 (license-core.js)
         │
         ▼
  7. Serial ditampilkan + tombol salin
         │
         ▼
  8. [target] Serial + device + expiry disimpan ke Supabase `licenses` (status active)
         │
         ▼
  9. Admin kirim serial ke pembeli (via WhatsApp)
         │
         ▼
 10. Pembeli masukkan serial di aplikasi → validasi HMAC lokal
         │
         ▼
 11. [target] App klien validasi tambahan server-side via Supabase → aktivasi
```

> **Saat ini:** langkah 8 & 11 masih offline (validasi HMAC lokal penuh) sampai
> `admin/` & app klien sinkron ke Supabase. **Arah target:** keduanya via Supabase,
> memungkinkan revoke/reset terpusat. Lihat `04-license-system.md` & `../CLOUD-ROADMAP.md`.

### Format Serial

```
KSR-A1B2-C3D4-99-X7K9M2
│   │      │    │  └── HMAC signature (6 char, Base32)
│   │      │    │
│   │      │    └─────── Expiry code (99 = seumur hidup)
│   │      │
│   │      └──────────── Device Code part 2 (4 char)
│   │
│   └─────────────────── Device Code part 1 (4 char)
│
└─────────────────────── Product Prefix (KSR = Rosok)
```

---

## 📡 Rencana Migrasi ke Supabase (Lapisan Meta/CRM)

> Migrasi ini mencakup **Lapisan A (Meta/CRM)** — data admin/CRM. **Data Bisnis**
> transaksi klien & Dashboard Hub (Lapisan B) adalah proyek terpisah, didokumentasikan
> di `../CLOUD-ROADMAP.md`.

### Tahap 1: Setup Supabase

1. Buat project di [supabase.com](https://supabase.com)
2. Clone repo Supabase di root project
3. Jalankan migration SQL untuk membuat tabel

### Tahap 2: Migrasi Data

| Dari (localStorage) | Ke (Supabase) |
|---------------------|---------------|
| `kasirsolo:leads` | ~~Tabel `leads`~~ → `clients` (pipeline satu-tabel, 2026-08-11) |
| `kasirsolo:catalog` | Tabel `products` |
| `kasirsolo:settings` | Tabel `settings` |
| `kasirsolo:stats` | Tabel `stats` |
| `kasirsolo_license_products_v3` | Tabel `products` (with salt) |

### Tahap 3: Implementasi RLS

```sql
-- Owner bisa read/write semua
CREATE POLICY "owner_all" ON clients FOR ALL
  USING (auth.uid() = (SELECT user_id FROM businesses WHERE id = business_id));

-- Team hanya bisa read
CREATE POLICY "team_read" ON clients FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM users WHERE id = auth.uid() AND role = 'team'
  ));
```

### Tahap 4: Update Admin Dashboard

Ganti semua `localStorage` calls dengan Supabase client di `storage.js`:

```javascript
// SEBELUM (di storage.js)
export async function storageGetJSON(key, fallback) {
  const raw = localStorage.getItem(key);
  return raw ? JSON.parse(raw) : fallback;
}

// SESUDAH (di storage.js — interface sama, implementasi beda)
export async function storageGetJSON(key, fallback) {
  const { data, error } = await supabase.from(key.replace('kasirsolo:', '')).select('*');
  if (error) return fallback;
  return data;
}
```

**Keuntungan abstraction layer:** Hanya `storage.js` yang perlu diubah, semua module lain (`dashboard.js`, `clients.js`, `catalog.js`, `license-ui.js`, `settings.js`) tidak perlu disentuh.

---

## 📐 Navigasi (Screen System)

```javascript
// navigation.js — Simple screen switching
window.showScreen = function(screenId) {
  // Update bottom nav active state
  document.querySelectorAll('.bottomnav .nav-item').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.screen === screenId);
  });
  // Update sidebar active state (desktop)
  document.querySelectorAll('.sb-link').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.view === screenId);
  });
  // Hide all screens
  document.querySelectorAll('.main > .screen').forEach(s => s.classList.remove('active'));
  // Show target screen
  const target = document.getElementById('screen-' + screenId);
  if (target) target.classList.add('active');
  // Scroll to top
  window.scrollTo(0, 0);
  // Trigger render if needed
  if (screenId === 'dashboard') renderDashboard();
  if (screenId === 'klien') initClients();
  if (screenId === 'catalog') renderCatalog();
  if (screenId === 'license') renderLicenseScreen();
  if (screenId === 'settings') renderSettingsForm();
};
```

5 Screen (Nav — setara 5 menu sidebar):
| Screen | data-screen | ID Element | Catatan |
|--------|-------------|------------|---------|
| Dashboard | `dashboard` | `screen-dashboard` | |
| Katalog | `catalog` | `screen-catalog` | |
| Lisensi | `license` | `screen-license` | |
| Klien | `klien` | `screen-klien` | toggle **List** & **Kanban** (6 kolom pipeline) — `#listView`/`#kanbanView` |
| Pengaturan | `settings` | `screen-settings` | |

---

## 🎨 Responsive Breakpoints (4 Tiers)

| Tier | Breakpoint | Sidebar | Bottom Nav | KPI Grid | Catalog Grid | Sheets |
|------|------------|---------|------------|----------|--------------|--------|
| **HP** | `< 768px` | Hidden (drawer) | Fixed bottom 5 items | 2 kolom | 1 kolom | Bottom-sheet (full) |
| **Tablet** | `768-1023px` | Hidden (drawer) | Fixed bottom 5 items | 3 kolom | 2 kolom | Center modal |
| **Desktop** | `≥ 1024px` | Fixed 250px | Hidden | 4 kolom | 3 kolom | Center modal |
| **Large** | `≥ 1440px` | Fixed 250px | Hidden | 6 kolom | 4 kolom | Center modal |

**CSS Media Queries:**
```css
/* Base = HP (< 768px) */
@media (min-width: 768px) { /* Tablet */ }
@media (min-width: 1024px) { /* Desktop */ }
@media (min-width: 1440px) { /* Large Desktop */ }
```

---

## 🔧 Key Technical Decisions

| Decision | Rationale |
|----------|-----------|
| **Vanilla ESM (no build)** | Zero config, runs in browser, easy to debug |
| **3-layer architecture** | Separation of concerns, testable, Supabase-ready |
| **Storage abstraction** | Swap localStorage → Supabase by changing only `storage.js` |
| **license-core.js pure** | No DOM, no side-effects — reusable in client apps (Dexie) |
| **kaki5 design system** | Consistent with other KASIRSOLO apps (orange, bottom nav, sheets) |
| **Gerobak KPI pattern** | 6 gradient metrics, proven UX |
| **4-tier responsive** | Covers all device classes properly |
| **Utility classes CSS** | No inline styles, maintainable, consistent |
| **Sheet modal pattern** | `.overlay.open.show` + `.sheet` — works HP & Desktop |
| **Hidden attribute** | Semantic empty states, no inline `display:none` |
| **Local mirror deploy** | No GitHub Actions, simple rsync + commit |

---

*Architecture Admin Dashboard — KASIRSOLO*