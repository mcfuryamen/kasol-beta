# Admin Dashboard — Setup & Deploy

Panduan lengkap development dan deployment admin dashboard (modular ESM, local mirror deploy).

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
python3 -m http.server 8083
# Buka http://127.0.0.1:8083

# Cara 2: Node.js http-server (jika Python tidak ada)
npx http-server -p 8083
# Buka http://127.0.0.1:8083

# Catatan: ESM modules butuh HTTP server (tidak bisa pakai file:// protocol)
```

### Login

Password default: **`admin123`**

```javascript
// Di js/auth.js (atau index.html inline script untuk login gate)
if (val === 'admin123') { ... }
```

> **Saran:** Untuk produksi, migrasikan ke Supabase Auth dengan RLS.

---

## ☁️ Deploy ke Vercel

### Strategi Deploy: Local Mirror Only

**Tidak menggunakan GitHub Actions.** Deploy dilakukan melalui mirror lokal:

```
Produksi (source of truth)     →     Mirror (GitHub)     →     Vercel
C:\Users\Admin\Documents\kasol\admin    →    C:\Users\Admin\Documents\GitHub\kasol\admin    →    Vercel auto-deploy
```

### Setup Vercel Project (Sekali Saja)

1. Login ke [vercel.com](https://vercel.com)
2. Klik **Add New...** → **Project**
3. Import repository GitHub: `mcfuryamen/kasol`
4. Atur:
   - **Root Directory**: `admin/`
   - **Framework Preset**: Other
   - **Build Command**: *(kosong)*
   - **Output Directory**: `.`
5. Klik **Deploy**

### GitHub Secrets (Sudah Dikonfigurasi)

```bash
VERCEL_TOKEN                 = vc_xxx...
VERCEL_ORG_ID                = org_xxx...
VERCEL_PROJECT_ID_ADMIN      = prj_xxx...
VERCEL_SCOPE                 = personal (opsional)
```

### Deploy Workflow (Manual, Satu Perintah)

```bash
# 1. Sync produksi ke mirror (dari folder produksi)
cd /c/Users/Admin/Documents/kasol/admin
./sync-to-mirror.sh

# Atau manual:
cp -r . /c/Users/Admin/Documents/GitHub/kasol/admin/

# 2. Commit & push dari mirror root (monorepo)
cd /c/Users/Admin/Documents/GitHub/kasol
git add admin/
git commit -m "admin: <deskripsi perubahan>"
git push origin main

# 3. Vercel auto-deploy triggered by push to main (path filter: admin/**)
```

> **Catatan:** User preference: "ga usah push github" — commit ke mirror lokal saja, push manual saat diperlukan.

---

## 📁 File Konfigurasi Vercel

### `vercel.json` (di folder admin/)

```json
{
  "version": 2,
  "framework": "none",
  "buildCommand": "",
  "outputDirectory": ".",
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ],
  "headers": [
    {
      "source": "/sw.js",
      "headers": [
        { "key": "Service-Worker-Allowed", "value": "/" },
        { "key": "Cache-Control", "value": "public, max-age=0, must-revalidate" }
      ]
    },
    {
      "source": "/manifest.json",
      "headers": [
        { "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }
      ]
    }
  ]
}
```

### `.vercelignore`

```
# Vercel ignore - JANGAN ignore .git (dibutuhkan untuk vercel-ignore.sh)
# .git
node_modules
*.log
.DS_Store
Thumbs.db
*.md
docs/
```

---

## 🔐 Mengubah Password

Cari string `admin123` di `js/auth.js` dan ganti:

```javascript
// js/auth.js
export const ADMIN_PASSWORD = 'admin123';  // ← GANTI password di sini
```

Atau jika masih pakai inline di `index.html` (login gate):
```javascript
// index.html ~line 400
if (val === 'admin123') { ... }
```

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

// Auto-render when screen is shown (if needed)
// window.addEventListener('screen-new-screen', renderNewScreen);
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

export async function storageClearAll() {
  Object.keys(localStorage)
    .filter(k => k.startsWith(PREFIX))
    .forEach(k => localStorage.removeItem(k));
}

// js/storage.js - SESUDAH (Supabase)
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const supabaseUrl = 'YOUR_SUPABASE_URL';
const supabaseAnonKey = 'YOUR_SUPABASE_ANON_KEY';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

const TABLE_MAP = {
  catalog: 'products',
  settings: 'settings',
  leads: 'leads',
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
  // Upsert logic depends on data structure
  const { error } = await supabase.from(table).upsert(value);
  if (error) {
    console.error('Supabase set error:', error);
    return false;
  }
  return true;
}

export async function storageClearAll() {
  // Admin only - hapus semua data user
  for (const table of Object.values(TABLE_MAP)) {
    await supabase.from(table).delete().neq('id', '00000000-0000-0000-0000-000000000000');
  }
}
```

**Keuntungan:** Semua module lain (`dashboard.js`, `leads.js`, `catalog.js`, `license-ui.js`, `settings.js`) **tidak perlu diubah** — mereka memanggil `storageGetJSON`/`storageSetJSON` yang interface-nya sama.

### Fase 3: Implementasi RLS

```sql
-- Contoh policy untuk leads
CREATE POLICY "team_read_leads" ON leads
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role IN ('owner', 'team')
    )
  );

CREATE POLICY "owner_write_leads" ON leads
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
import { supabase } from './storage.js'; // atau buat supabase-client.js terpisah

export async function doLogin(password) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: 'admin@kasirsolo.com', // atau input email
    password
  });
  if (error) return false;
  // Set session, redirect to app
  return true;
}

export async function doLogout() {
  await supabase.auth.signOut();
  // Redirect to login
}

export async function checkAuth() {
  const { data: { session } } = await supabase.auth.getSession();
  return !!session;
}
```

---

## ✅ Checklist Deploy

- [ ] Test login dengan password `admin123`
- [ ] Test Dashboard: 6 KPI cards + bar charts render benar
- [ ] Test Leads: tabel 5 kolom, search, filter, export CSV
- [ ] Test Katalog: card grid responsif, tambah/edit/hapus, sheet modal `.field-grid`
- [ ] Test Lisensi: product registry grid 3-tier, generate/verify serial, reference code
- [ ] Test Pengaturan: Info Usaha (field-grid 2 kolom), Landing Config, Backup/Restore
- [ ] Test Responsive: HP (<768), Tablet (768-1023), Desktop (≥1024), Large (≥1440)
- [ ] Test Sheets/Modals: HP bottom-sheet, Desktop center modal
- [ ] Test Empty States: semua pakai `hidden` attribute + semantic classes
- [ ] Test Toast notifications: success/warning/error
- [ ] Refresh landing page — pastikan katalog & settings terupdate
- [ ] No console errors
- [ ] Sync ke mirror lokal & commit

---

## 📂 Struktur File Deploy

```
admin/
├── index.html          # Entry (loads all modules via type=module)
├── style.css           # Full design system
├── js/
│   ├── app.js          # Entry point
│   ├── app-state.js    # State management
│   ├── storage.js      # Storage abstraction (swap target for Supabase)
│   ├── utils.js        # Shared utilities
│   ├── toast.js        # Toast system
│   ├── auth.js         # Auth gate
│   ├── navigation.js   # Screen switching
│   ├── license-core.js # Pure HMAC (reusable)
│   ├── dashboard.js
│   ├── leads.js
│   ├── catalog.js
│   ├── license-ui.js
│   └── settings.js
├── vercel.json         # Vercel config
├── manifest.json       # PWA
├── sw.js               # Service Worker
├── .vercelignore       # Vercel ignore
└── docs/               # Dokumentasi (8 files)
```

---

*Setup & Deploy — KASIRSOLO Admin Dashboard*