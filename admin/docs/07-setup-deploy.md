# Admin Dashboard — Setup & Deploy

Panduan lengkap development dan deployment admin dashboard (modular ESM, Vercel deployment).

> ⚠️ **Pipeline (2026-08-11):** tabel `leads` & `pembelian` di-DROP dari Supabase.
> Funnel kini satu tabel `clients` (baru/dihubungi/tertarik/menunggu_verifikasi/aktif/batal)
> dengan UI Klien List + Kanban.

---

## 🖥️ Local Development

### Prasyarat

- Browser modern (Chrome, Firefox, Safari, Edge) dengan ES Modules support
- Python 3 (untuk HTTP server) atau Node.js (http-server)
- **Tidak perlu build tool, bundler, atau Node.js dependencies**

### Menjalankan Lokal

```bash
# Masuk ke folder admin
cd /c/Users/Admin/Documents/kasol/admin

# Cara 1: Python HTTP server (recommended untuk ESM)
python3 -m http.server 8082
# Buka http://127.0.0.1:8082

# Cara 2: Node.js http-server (jika Python tidak ada)
npx http-server -p 8082
# Buka http://127.0.0.1:8082

# Catatan: ESM modules butuh HTTP server (tidak bisa pakai file:// protocol)
```

### Login

Login **sengaja dinonaktifkan** — dashboard langsung terbuka tanpa layar login
(lihat `js/auth.js`, fungsi `initAuth` langsung memanggil `showApp()`).
Jangan aktifkan tanpa permintaan eksplisit, karena cek password di `auth.js`
masih hardcoded dan belum aman.

> **Rencana:** Untuk produksi, migrasikan ke Supabase Auth + JWT admin
> (`JWT_SECRET` sudah disiapkan di env) supaya `ADMIN_API_KEY` tidak perlu
> lagi dikirim dari browser.

---

## ☁️ Deploy ke Vercel

### Setup Vercel Project (Sekali Saja)

1. Login ke [vercel.com](https://vercel.com)
2. Klik **Add New...** → **Project**
3. Import repository GitHub: `mcfuryamen/kasol`
4. Atur:
   - **Root Directory**: `admin/`
   - **Framework Preset**: Other
   - **Build Command**: *(kosong — static deploy, tidak ada build step env)*
   - **Output Directory**: `.`
   - **Install Command**: *(kosong)*
5. Klik **Deploy**

### Deploy Workflow (Alur 2-Mirror)

> Referensi alur lengkap: [`DEPLOYMENT.md`](../../DEPLOYMENT.md). Folder kerja
> **tidak pernah push langsung ke GitHub**; rilis mengalir 2 mirror.

```powershell
# 1. Rilis BETA — jalankan di folder kerja (root kasol):
.\push-beta.ps1
#    → sync admin/ ke mirror kasol-beta → squash 1 commit → push GitHub BETA main
#    → Vercel deploy URL beta: https://admin.vercel.app (mis.)
#    Tes di URL beta. Jika ada error → perbaiki di folder kerja, rilis beta lagi.

# 2. Rilis LIVE (hanya dari beta yang sudah stabil) — jalankan di folder mirror kasol-beta:
.\push-live.ps1
#    → fetch GitHub BETA main → sync ke mirror kasol → squash 1 commit
#    → push GitHub LIVE main → Vercel deploy URL live: https://admin.kasirsolo.com (mis.)
```

> **Note:** GitHub Actions workflows sudah dihapus. Rilis dilakukan via
> `push-beta.ps1`/`push-live.ps1` (squash 1 commit snapshot) → Vercel
> auto-detect. LIVE hanya menerima snapshot dari BETA yang sudah stabil & lolos uji.

### File Konfigurasi Vercel

**`vercel.json`** (di folder admin/)

```json
{
  "version": 2,
  "framework": null,
  "outputDirectory": ".",
  "rewrites": [
    { "source": "/((?!api/).*)", "destination": "/index.html" }
  ],
  "headers": [
    { "source": "/sw.js", "headers": [
      { "key": "Service-Worker-Allowed", "value": "/" },
      { "key": "Cache-Control", "value": "public, max-age=0, must-revalidate" } ] },
    { "source": "/manifest.json", "headers": [
      { "key": "Cache-Control", "value": "public, max-age=31536000, immutable" } ] },
    { "source": "/js/(.*)", "headers": [
      { "key": "Cache-Control", "value": "public, max-age=31536000, immutable" } ] },
    { "source": "/assets/(.*)", "headers": [
      { "key": "Cache-Control", "value": "public, max-age=31536000, immutable" } ] }
  ]
}
```

**`.vercelignore`**

```
node_modules
*.log
.DS_Store
Thumbs.db
*.md
docs/
.env*
*.backup*
```

---

## 📂 Struktur File Deploy

```
admin/
├── index.html          # Entry (loads all modules via type=module)
├── style.css           # Full design system
├── DESIGN.md           # Design tokens spec
├── js/
│   ├── app.js          # Entry point
│   ├── app-state.js    # State management
│   ├── storage.js      # Cache lokal (localStorage)
│   ├── api.js          # Klien /api/rest & /api/license (proxy Supabase)
│   ├── utils.js        # Shared utilities
│   ├── toast.js        # Toast system
│   ├── auth.js         # Auth gate (login dinonaktifkan)
│   ├── navigation.js   # Screen switching
│   ├── license-core.js # Pure HMAC (reusable)
│   ├── emoji-picker.js # Picker ikon katalog
│   ├── overlay-a11y.js # Fokus trap & Esc untuk sheet
│   ├── dashboard.js
│   ├── clients.js
│   ├── catalog.js
│   └── settings.js
├── api/                # Serverless Vercel (proxy + gate)
│   ├── _gate.js        # Cek ADMIN_API_KEY (fail-closed, constant-time)
│   ├── rest.js         # Proxy Supabase (whitelist tabel)
│   └── license.js      # Generate/verifikasi serial (salt server-side)
├── scripts/            # util dev (env-loader dibuat STATIS, di-commit; bukan build step)
├── tests/              # license-integration.test.mjs
├── vercel.json         # Vercel config
├── .vercelignore       # Vercel ignore
├── manifest.json       # PWA
├── sw.js               # Service Worker
└── docs/               # Dokumentasi (12 files)
```

---

## 🔐 Mengubah Password

Login saat ini **dinonaktifkan** (layar login tidak dirender — lihat
`js/auth.js`). Cek password di `auth.js` masih hardcoded (`'admin123'`),
jadi jangan diaktifkan begitu saja. Jika suatu saat login dihidupkan,
ganti dulu dengan Supabase Auth / JWT, jangan pakai password hardcoded.

---

## 📝 Menambah Screen Baru

### 1. Tambah HTML di `index.html`

**Sidebar Link (Desktop):**
```html
<button class="sb-link" data-view="new-screen">
  <span class="ico">📁</span> Menu Baru
</button>
```

**Bottom Nav Item (HP):**
```html
<div class="nav-item" data-screen="new-screen" onclick="showScreen('new-screen')">
  <div class="ic">📁</div>
  <div class="lbl">Menu Baru</div>
</div>
```

**Screen Section:**
```html
<section class="screen" id="screen-new-screen">
  <div class="topbar">
    <div>
      <h1>Menu Baru</h1>
      <p>Deskripsi menu baru.</p>
    </div>
  </div>
  <div class="panel">
    <!-- Konten di sini -->
  </div>
</section>
```

### 2. Buat Module JS Baru

`js/new-screen.js`:
```javascript
/**
 * New Screen Module
 */

import { STATE, getState, setState } from './app-state.js';
import { storageGetJSON, storageSetJSON } from './storage.js';
import { escapeHtml, formatRupiah, formatDate } from './utils.js';
import { showToast } from './toast.js';

/**
 * Render new screen content
 */
export function renderNewScreen() {
  const container = document.getElementById('screen-new-screen');
  if (!container) return;
  
  // Render logic here
  container.querySelector('.panel').innerHTML = `
    <div class="card">
      <h3>New Screen</h3>
      <p>Content goes here.</p>
    </div>
  `;
}
```

### 3. Import di `app.js`

```javascript
// app.js - add to imports
import { renderNewScreen } from './new-screen.js';

// app.js - add to showScreen handler
if (screenId === 'new-screen') renderNewScreen();
```

### 4. Tambah CSS (jika perlu)

Di `style.css`, tambahkan styling untuk komponen baru mengikuti design system.

---

## 🗺️ Langkah Migrasi ke Supabase

> ✅ **Migrasi sudah SELESAI (2026-08).** Data kini tersimpan di Supabase dan
> semua operasi lewat proxy serverless `api/rest.js` (service role key hanya
> di server, whitelist tabel `clients`/`products`/`settings`). Fase-fase di
> bawah adalah catatan historis saat migrasi dikerjakan — bukan langkah yang
> perlu dijalankan lagi.

### Fase 1: Setup Supabase

```bash
# 1. Buat project di supabase.com
# 2. Dapatkan URL & anon key
# 3. Jalankan migration SQL (lihat docs/03-data-schema.md untuk schema)
```

### Fase 2: Update `storage.js` (Satu File Saja!)

Karena storage abstraction layer, hanya `storage.js` yang perlu diubah:

```javascript
// js/storage.js - SEBELUM (localStorage)
import { STATE } from './app-state.js';

const PREFIX = 'kasirsolo:';

export async function storageGetJSON(key, fallback = null) {
  const raw = localStorage.getItem(PREFIX + key);
  return raw ? JSON.parse(raw) : fallback;
}

export async function storageSetJSON(key, value) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
    return true;
  } catch (e) {
    console.error('Storage set error:', e);
    return false;
  }
}

// js/storage.js - SESUDAH (Supabase)
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const supabaseUrl = 'YOUR_SUPABASE_URL';
const supabaseAnonKey = 'YOUR_SUPABASE_ANON_KEY';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

const TABLE_MAP = {
  catalog: 'products',
  settings: 'settings',
  clients: 'clients',
  stats: 'stats',
  products: 'license_products'
};

export async function storageGetJSON(key, fallback = null) {
  const table = TABLE_MAP[key] || key;
  const { data, error } = await supabase.from(table).select('*');
  if (error) {
    console.error('Supabase get error:', error);
    return fallback;
  }
  return data || fallback;
}

export async function storageSetJSON(key, value) {
  const table = TABLE_MAP[key] || key;
  const { error } = await supabase.from(table).upsert(value);
  if (error) {
    console.error('Supabase set error:', error);
    return false;
  }
  return true;
}
```

**Keuntungan:** Semua module lain (`dashboard.js`, `clients.js`, `catalog.js`, `license-ui.js`, `settings.js`) **tidak perlu diubah**.

### Fase 3: Implementasi RLS

```sql
-- Contoh policy untuk clients
CREATE POLICY "team_read_clients" ON clients
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role IN ('owner', 'team')
    )
  );

CREATE POLICY "owner_write_clients" ON clients
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role = 'owner'
    )
  );
```

### Fase 4: Auth Integration

Ganti `js/auth.js` untuk menggunakan Supabase Auth:

```javascript
// js/auth.js - Supabase version
import { supabase } from './storage.js';

export async function doLogin(password) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: 'admin@kasirsolo.com',
    password
  });
  if (error) return false;
  return true;
}

export async function doLogout() {
  await supabase.auth.signOut();
}

export async function checkAuth() {
  const { data: { session } } = await supabase.auth.getSession();
  return !!session;
}
```

---

## ✅ Checklist Testing

- [ ] Test Dashboard: KPI cards + bar charts
- [ ] Test Klien: analitik, pipeline kanban, detail klien, generate/verifikasi lisensi
- [ ] Test Katalog: card grid responsif, tambah/edit/hapus, sheet modal
- [ ] Test Pengaturan: forms, upload QRIS, backup/restore
- [ ] Test Responsive: HP/Tablet/Desktop/Large
- [ ] Test Sheets/Modals: HP bottom-sheet, Desktop center modal
- [ ] Test Empty States: `hidden` attribute + semantic classes
- [ ] Test Toast notifications: success/warning/error
- [ ] No console errors
- [ ] Vercel deployment working

---

*Setup & Deploy — KASIRSOLO Admin Dashboard*
