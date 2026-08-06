# Admin Dashboard — Arsitektur

SPA architecture dengan 5 tab navigasi dan integrasi sistem lisensi HMAC-SHA256.

> ⚠️ **Arah Arsitektur Cloud (2026):** Admin adalah **Lapisan Meta/CRM**. Sistem
> lisensi melakukan **generate + validasi via Supabase** (menggantikan offline saat
> ini). Data Bisnis transaksi klien & Dashboard Hub termasuk **Lapisan B** — bukan
> bagian admin. Rujukan: **`../CLOUD-ROADMAP.md`**.

---

## 🏛️ Arsitektur

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        index.html (SPA)                                 │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  HTML STRUCTURE                                                 │   │
│  │  ├── #loginScreen (login gate, z-index 999)                    │   │
│  │  └── #app (main shell, grid 250px + 1fr)                       │   │
│  │      ├── .sidebar (sticky, dark theme)                         │   │
│  │      │   ├── .sb-brand (logo + nama)                           │   │
│  │      │   ├── .sb-nav (5 tab links)                             │   │
│  │      │   └── .sb-foot (refresh + logout buttons)               │   │
│  │      └── .main (content area)                                  │   │
│  │          ├── #view-dashboard (overview stats)                   │   │
│  │          ├── #view-leads (table + search + filter)              │   │
│  │          ├── #view-catalog (CRUD apps)                          │   │
│  │          ├── #view-license (generate + verify + reference)      │   │
│  │          └── #view-settings (form)                              │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  CSS (internal)                                                 │   │
│  │  ├── CSS Variables (color, sidebar, radius)                     │   │
│  │  ├── Login gate styles                                         │   │
│  │  ├── Sidebar styles                                            │   │
│  │  ├── Main content styles                                       │   │
│  │  ├── Table & form styles                                       │   │
│  │  ├── Chart (bar) styles                                        │   │
│  │  └── Toast notification styles                                 │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  JAVASCRIPT (internal)                                          │   │
│  │  ├── Utilities (formatRupiah, formatDate, showToast)            │   │
│  │  ├── Auth (doLogin, doLogout)                                  │   │
│  │  ├── Navigation (tab switching)                                │   │
│  │  ├── Data Loading (loadAllData from localStorage)              │   │
│  │  ├── Dashboard (renderOverview)                                │   │
│  │  ├── Leads (renderLeads, search, filter, delete, export CSV)   │   │
│  │  ├── Catalog (renderCatalog, addApp, saveApp, removeApp)        │   │
│  │  ├── License (renderProductList, doGenerate, doVerify,         │   │
│  │  │            renderRefCode, exportProducts, importProducts)    │   │
│  │  ├── Settings (renderSettingsForm, saveSettings)               │   │
│  │  └── License Algorithm (hmacSignature, b32Encode,             │   │
│  │             generateSerial, verifySerial, normalizeDeviceCode)  │   │
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
│   │  kasirsolo:leads      ──► baca   ─┤  (read/write)              │       │
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
  6. Sistem generate serial HMAC-SHA256
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
| `kasirsolo:leads` | Tabel `leads` |
| `kasirsolo:catalog` | Tabel `products` |
| `kasirsolo:settings` | Tabel `settings` |
| `kasirsolo:stats` | Tabel `stats` |
| `kasirsolo_license_products_v3` | Tabel `products` (with salt) |

### Tahap 3: Implementasi RLS

```sql
-- Owner bisa read/write semua
CREATE POLICY "owner_all" ON leads FOR ALL
  USING (auth.uid() = (SELECT user_id FROM businesses WHERE id = business_id));

-- Team hanya bisa read
CREATE POLICY "team_read" ON leads FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM users WHERE id = auth.uid() AND role = 'team'
  ));
```

### Tahap 4: Update Admin Dashboard

Ganti semua `localStorage` calls dengan Supabase client:
```javascript
// Sebelum
await storageGetJSON('kasirsolo:leads', []);

// Sesudah
const { data } = await supabase.from('leads').select('*');
```

---

## 📐 Navigasi (Tab System)

```javascript
// Simple tab switching — tidak ada routing framework
document.querySelectorAll('.sb-link').forEach(btn => {
  btn.addEventListener('click', () => {
    // Remove active from all links
    document.querySelectorAll('.sb-link').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    // Hide all views
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    // Show target view
    document.getElementById('view-' + btn.dataset.view).classList.add('active');
  });
});
```

5 Tab:
| Tab | data-view | ID Element |
|-----|-----------|------------|
| Dashboard | `dashboard` | `view-dashboard` |
| Leads | `leads` | `view-leads` |
| Katalog | `catalog` | `view-catalog` |
| Lisensi | `license` | `view-license` |
| Pengaturan | `settings` | `view-settings` |

---

*Architecture Admin Dashboard — KASIRSOLO*
