# Admin Dashboard — Fitur Lengkap

Penjelasan detail setiap modul di admin dashboard (modular ESM + kaki5 design system).

---

## 1. Dashboard (Overview)

Menampilkan ringkasan statistik bisnis dengan 6 KPI gradient cards.

### Stat Cards (KPI) — 6 Metrics

| Card | Icon | Metrik | Sumber | Warna Gradient |
|------|------|--------|--------|----------------|
| Total Pipeline | 👥 | `clients.length` | Klien | Brand (orange→red) |
| Deal | 🤝 | status = "Deal" | Leads | Green |
| Aplikasi Aktif | 📦 | `catalog.length` / 8 max | Catalog | Teal |
| Potensial Revenue | 💰 | Σ (harga × klien per app) | Catalog + Klien | Purple |
| Lead Baru | 🆕 | status = "Baru" | Leads | Blue |
| Konversi | 📈 | Deal / Total × 100% | Leads | Red |

**Struktur KPI Card:**
```html
<div class="summary-card brand">
  <div class="kpi-head">
    <span class="icon">👥</span>
    <span class="label">TOTAL LEADS</span>
  </div>
  <div class="value">1,234</div>
</div>
```
- Emoji di kiri label (`.kpi-head` flex row, gap 8px)
- Icon 14px, Label 11px uppercase, Value 22px weight 900

### Bar Charts

**Klien per Aplikasi**
- Mengelompokkan klien berdasarkan kolom `app_type`
- Horizontal bar chart dengan lebar proporsional
- Label dipotong max 22 karakter + ellipsis

**Klien per Status (Pipeline)**
- Mengelompokkan klien berdasarkan kolom `status` (baru/dihubungi/tertarik/menunggu_verifikasi/aktif/batal)
- Horizontal bar chart dengan lebar proporsional

### Empty States

Semua section (KPI, charts, recent activity) pakai `hidden` attribute + semantic classes:
```html
<div id="dashboardEmpty" class="empty-state" hidden>
  <div class="empty-icon">📭</div>
  <div class="empty-title">Belum ada data</div>
  <div class="empty-desc">Data akan muncul otomatis...</div>
</div>
```

### Refresh Data

Tombol **🔄 Refresh Data** di footer sidebar memuat ulang semua data dari storage.

---

## 2. Klien / Pipeline Management

Modul CRM untuk mengelola seluruh pipeline klien (satu tabel `clients`) — dari lead yang
masuk (source `app-kaki5` dll) hingga `aktif`/`batal`, dengan 2 mode tampilan: **List**
(kartu + filter + dropdown status) dan **Kanban** (6 kolom pipeline, drag-drop status).

### Toolbar

| Elemen | Fungsi |
|--------|--------|
| Search input | Filter real-time berdasarkan nama, WA, atau wilayah |
| Status filter | Dropdown pipeline: Semua / Baru / Dihubungi / Tertarik / Menunggu Verifikasi / Aktif / Batal |

### Tabel / Kartu Klien

| Kolom | Isi | Aksi |
|-------|-----|------|
| Warung / Pemilik | `nama_warung`, `nama_pemilik` | — |
| WhatsApp | `no_whatsapp` | Klik buka `wa.me` link |
| Aplikasi | `app_type` | — |
| Wilayah | `kabkota`, `provinsi` | — |
| Status | Dropdown select | Ubah status (List) / drag-drop (Kanban) → auto-save |

**Empty State:**
```html
<div id="clientsEmpty" class="empty-state" hidden>
  <div class="empty-icon">📭</div>
  <div class="empty-title">Belum ada klien</div>
  <div class="empty-desc">Klien akan otomatis muncul saat ada yang mengisi profil di aplikasi klien (landing / app kaki5).</div>
</div>
```

### Export CSV

Tombol **⬇️ Export CSV** menghasilkan file `clients-kasirsolo.csv`:
```csv
Nama,Alamat,WhatsApp,Aplikasi,Status,Tanggal Daftar
"Toko Maju Jaya","Jl. Contoh No.1","081234567890","Kasir Retail - Rp250.000","Baru","01 Agu 2026 10:30"
```

### HP Responsive (<768px)

- Stack: Nama + WhatsApp di `.lead-contact` (flex column)
- Dropdown status full-width
- Action buttons stacked vertically

---

## 3. Katalog Management

Modul CRUD untuk aplikasi yang tampil di landing page.

### Card Grid (Responsive)

| Breakpoint | Kolom |
|------------|-------|
| HP (<768) | 1 |
| Tablet (768-1023) | 2 |
| Desktop (≥1024) | 3 |
| Large (≥1440) | 4 |

### Card Structure

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
    <button class="btn btn-sm" onclick="openCatalogSheet(app)">Edit</button>
    <button class="btn btn-sm btn-danger" onclick="deleteCatalog(app.id)">Hapus</button>
  </div>
</article>
```

### Tambah Aplikasi Baru

Tombol **➕ Tambah Aplikasi** → buka Sheet Modal dengan form kosong (default values).

### Edit Aplikasi (Sheet Modal)

Klik **Edit** pada card → buka **Sheet Modal** (`.overlay` + `.sheet`) dengan form `.field-grid`:

**Form Fields (`.field-grid` 1 kolom HP, 2 kolom Tablet+):**

| Field | Input | Constraints | Grid Span |
|-------|-------|-------------|-----------|
| Ikon | Text (emoji) | Max 4 karakter | 1 |
| Nama | Text | Required | 1 |
| Deskripsi | Textarea (rows=3) | — | 2 (`.field-span-2`) |
| Kategori | Select | bisnis / institusi / kesehatan | 1 |
| Harga | Number | Min 0, step 10000 | 1 |
| Hot | Checkbox | — | 1 |

### Simpan & Hapus

| Aksi | Perilaku |
|------|----------|
| **Simpan** | Update object di array → `storage.set('catalog', ...)` → `setState` → toast "Aplikasi disimpan" |
| **Hapus** | Konfirmasi dialog → splice array → simpan → toast "Aplikasi dihapus" |

### Empty State

```html
<div id="catalogEmpty" class="empty-state" hidden>
  <div class="empty-icon">📭</div>
  <div class="empty-title">Belum ada aplikasi</div>
  <div class="empty-desc">Klik "Tambah Aplikasi" untuk memulai.</div>
</div>
```

---

## 4. Lisensi Management

Modul terintegrasi dari generator lisensi universal (HMAC-SHA256).

### 4a. Product Registry

Daftar produk dengan prefix & salt (grid responsif `.app-row` 3-tier).

**Grid Responsive:**
| Breakpoint | Kolom |
|------------|-------|
| HP (<768) | 1 (stacked) |
| Tablet (768-1023) | 3 (name+prefix, salt, actions) |
| Desktop (≥1024) | 4 (name, prefix, salt, actions) |

**Form Tambah Produk:**

| Field | Input | Constraints |
|-------|-------|-------------|
| Nama Produk | Text | Required |
| Prefix | Text (uppercase) | 3-5 huruf kapital, unik |
| Salt | Text | Minimal 10 karakter |

**Tombol:**
- **➕ Tambah Produk Baru** — membuka form inline
- **🎲 Acak** — generate salt otomatis: `KASIRSOLO-{PREFIX}-{24 random chars}`
- **💾 Simpan Produk** — validasi → push ke array → simpan
- **🗑️ Hapus** — konfirmasi → filter → simpan

### 4b. Generate Serial

Form untuk membuat serial baru (Sheet Modal).

| Field | Input | Contoh |
|-------|-------|--------|
| Pilih Produk | Dropdown | Rosok (KSR) |
| Device Code | Text (auto-format) | A1B2-C3D4 |
| Masa Berlaku | Dropdown | Seumur Hidup / 12 Bulan / 6 Bulan / 7 Hari / 3 Bulan / 1 Bulan |

**Auto-format:** Device code input otomatis dinormalisasi saat blur (uppercase, strip non-alphanum, pad 8 char, insert hyphen).

**Hasil Output:**
```
┌─────────────────────────────────┐
│   KSR-A1B2-C3D4-99-X7K9M2      │  ← monospace, selectable
│                                 │
│   Produk: Rosok (KASIRSOLO)     │
│   Device: A1B2-C3D4             │
│   Exp: Seumur Hidup             │
│                                 │
│   [📋 Salin Serial]             │
└─────────────────────────────────┘
```

### 4c. Verifikasi Serial

Form untuk memvalidasi serial (Sheet Modal).

| Field | Input |
|-------|-------|
| Pilih Produk | Dropdown |
| Nomor Serial | Text (auto-format dengan prefix) |
| Device Code | Text (opsional) |

**Hasil Verifikasi:**

| Status | Tampilan |
|--------|----------|
| ✅ Valid | `.verify-badge.success` + `.verify-detail` rows (Device Code, Expiry, Signature) |
| ❌ Invalid | `.verify-badge.error` + alasan penolakan |

**Alasan invalid:**
- Format serial tidak sesuai
- Signature HMAC tidak cocok
- Device code tidak match

### 4d. Reference Code

Generate blok kode JavaScript universal yang harus disalin ke aplikasi klien.

Tombol **📋 Salin Kode** menyalin ke clipboard.

Kode yang di-generate sesuai dengan produk yang dipilih di dropdown (prefix + salt dari registry).

### 4e. Backup & Restore

| Tombol | Fungsi |
|--------|--------|
| **⬇️ Export JSON** | Download file `kasirsolo-daftar-produk-lisensi-backup.json` |
| **⬆️ Import JSON** | Upload file → replace seluruh product registry |

---

## 5. Pengaturan

Form untuk mengontrol konten landing page + admin backup/restore.

### Info Usaha (`.field-grid` 2 kolom Tablet+)

| Field | ID | Input |
|-------|-----|-------|
| Nama Usaha | `setBizName` | Text (required) |
| Tagline | `setBizTag` | Text |
| Alamat | `setBizAddr` | Textarea (span-2) |
| Telepon | `setBizPhone` | Tel |
| Email | `setBizEmail` | Email (required) |
| WhatsApp (untuk CTA) | `setBizWa` | Tel (required) |
| Instagram (opsional) | `setBizIg` | Text |

### Landing Page Config (`.field-grid` 2 kolom Tablet+)

| Field | ID | Input |
|-------|-----|-------|
| Hero Title | `setHeroTitle` | Text |
| Hero Description | `setHeroDesc` | Textarea (span-2) |
| CTA Button Text | `setHeroCta` | Text |

### Backup & Restore Data Admin (`.two-col-grid`)

| Tombol | Fungsi |
|--------|--------|
| **📥 Export Backup Admin** | Download JSON berisi: settings, catalog, clients pipeline, products, license |
| **📤 Import Backup Admin** | File input → restore semua section → refresh screen |

### Bantuan & Dukungan

Contact strip cards:
- 💬 WhatsApp: 0881-6566-935 (link wa.me)
- ✉️ Email: owner.kasirsolo@gmail.com (mailto)

### Lainnya

| Tombol | Fungsi |
|--------|--------|
| **🗑️ Hapus Semua Data Admin** | Konfirmasi ganda → `storage.clearAll()` → reset STATE → toast |

### Submit Handler

```javascript
// saveBizSettings()
const newSettings = {
  ...STATE.settings,
  bizName: $('#setBizName').value.trim(),
  bizTag: $('#setBizTag').value.trim(),
  // ...
};
await storage.set('settings', newSettings);
setState('settings', newSettings);
showToast('Info usaha disimpan', 2000, 'success');
```

---

## 🔄 Sinkronisasi dengan Landing Page

| Modifikasi di Admin | Efek di Landing |
|---------------------|-----------------|
| Tambah/ubah/hapus aplikasi di Katalog | Katalog di landing berubah (refresh halaman) |
| Ubah pengaturan kontak/alamat | Footer & CTA WhatsApp di landing berubah |
| Ubah statistik hero | Counter di hero berubah (refresh halaman) |
| Lead baru dari form trial | Muncul di tab Leads admin |

> **Catatan:** Perubahan katalog & pengaturan memerlukan refresh halaman landing untuk terlihat.

---

*Product Features — KASIRSOLO Admin Dashboard*