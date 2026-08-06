# Admin Dashboard — Setup & Deploy

Panduan lengkap development dan deployment admin dashboard.

---

## 🖥️ Local Development

### Prasyarat

- Browser modern (Chrome, Firefox, Safari, Edge)
- Tidak perlu Node.js atau build tool

### Menjalankan Lokal

```bash
# Cara 1: Langsung buka file
open admin/index.html

# Cara 2: Pakai simple HTTP server
cd admin
python3 -m http.server 8080
# Buka http://localhost:8080
```

### Login

Password default: **`admin123`**

```javascript
// Cari di index.html baris ~400
if(val === 'admin123'){
```

---

## ☁️ Deploy ke Vercel

### Langkah 1: Buat Vercel Project

1. Login ke [vercel.com](https://vercel.com)
2. Klik **Add New...** → **Project**
3. Import repository GitHub
4. Atur:
   - **Root Directory**: `admin/`
   - **Framework Preset**: Other
   - **Build Command**: (kosong)
   - **Output Directory**: `.`
5. Klik **Deploy**

### Langkah 2: GitHub Actions

File `.github/workflows/deploy-all.yml` menangani deploy semua folder termasuk `admin/`.

### Langkah 3: Domain Custom

Domain admin bisa menggunakan subdomain: `admin.kasirsolo.com`

---

## 🔐 GitHub Secrets

```
VERCEL_TOKEN        = vc_xxx...
VERCEL_ORG_ID       = org_xxx...
VERCEL_PROJECT_ID_ADMIN = prj_xxx...
VERCEL_SCOPE        = personal (opsional)
```

---

## 🛠️ Mengubah Password

Cari string `admin123` di `admin/index.html` dan ganti:

```javascript
// Baris ~402
if(val === 'admin123'){  // ← GANTI password di sini
```

> **Saran:** Untuk produksi, migrasikan ke Supabase Auth dengan RLS.

---

## 📝 Menambah View Baru

### Langkah 1: Tambah Sidebar Link

Di bagian HTML sidebar:
```html
<button class="sb-link" data-view="new-view">
  <span class="ico">📁</span> Menu Baru
</button>
```

### Langkah 2: Tambah Section View

Di bagian HTML main content:
```html
<section class="view" id="view-new-view">
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

### Langkah 3: Tambah CSS (jika perlu)

Di bagian `<style>`, tambahkan styling untuk komponen baru.

### Langkah 4: Tambah JavaScript

Di bagian `<script>`, tambahkan logika untuk view baru.

---

## 🗺️ Langkah Migrasi ke Supabase

### Fase 1: Setup Supabase

```bash
# 1. Buat project di supabase.com
# 2. Clone repo
git clone https://github.com/supabase/supabase
cd supabase
git checkout versions/20240101XXXXXX

# 3. Jalankan migration SQL
# (lihat admin/docs/03-data-schema.md untuk schema)
```

### Fase 2: Update Admin Dashboard

Ganti helper functions localStorage dengan Supabase client:

```javascript
// SEBELUM (localStorage)
const leads = await storageGetJSON('kasirsolo:leads', []);

// SESUDAH (Supabase)
const { data: leads, error } = await supabase
  .from('leads')
  .select('*')
  .order('created_at', { ascending: false });
```

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

### Fase 4: Landing Page Integration

Landing page juga perlu di-update untuk membaca dari Supabase:
```javascript
// SEBELUM
const catalog = await storageGetJSON('kasirsolo:catalog', DEFAULT_CATALOG);

// SESUDAH
const { data: catalog } = await supabase
  .from('products')
  .select('*')
  .order('price');
```

---

## ✅ Checklist Deploy

- [ ] Test login dengan password
- [ ] Test tambah/edit/hapus lead
- [ ] Test export CSV
- [ ] Test tambah/edit/hapus katalog
- [ ] Test generate serial (pastikan HMAC bekerja)
- [ ] Test verifikasi serial
- [ ] Test simpan pengaturan
- [ ] Refresh landing page — pastikan katalog & settings terupdate
- [ ] Test di mobile browser
- [ ] No console errors

---

*Setup & Deploy — KASIRSOLO Admin Dashboard*
