# DESAIN UI/UX MODUL LISENSI KAKI5

> **Status**: Dokumen ini diperbarui per 2026-08-29 (v116+) — mencerminkan model **kuota transaksi per bulan** menggantikan trial waktu 7 hari.

---

## 1. Alur Pengguna (User Flow)

```
[Buka Aplikasi]
        |
        v
[Cek Status Lisensi — syncLicenseStatus()]
        |
        +---> [Lisensi AKTIF] → chip header "LISENSI ✓ Aktif"
        |                        Kartu kuota di Pengaturan
        |                        Semua fitur terbuka (termasuk cadangan cloud)
        |
        +---> [Lisensi EXPIRED] → chip header "LISENSI KEDALUARSA" (merah)
        |                         Banner bisa-ditutup (kuota transaksi terkunci)
        |                         Cadangan cloud terkunci (hanya export file)
        |
        +---> [Lisensi REVOKED] → full-lock overlay (lockOverlay)
        |                         Tidak bisa diakses sama sekali
        |
        +---> [Tier Gratis (belum ada lisensi)]
                    chip header "GRATIS · N trx" (N = sisa kuota bulan ini)
                    Kuota = `products.tx_quota` (default 100) + `clients.tx_adjust`
                    Kuota habis → banner closable + blok transaksi
                    Aplikasi tetap bisa dieksplorasi
                    Kuota segar otomatis tiap awal bulan kalender
```

### Status & Protokol

| Status | Protokol | Quota Akses | Cadangan Cloud |
|--------|----------|-------------|----------------|
| `licensed-active` | HMAC + Supabase | ∞ (unlimited) | ✅ Bisa backup & restore |
| `licensed-expired` | HMAC + Supabase | 0 (transaksi terkunci) | ❌ Export file saja |
| `revoked` | — | 0 (full lock) | ❌ |
| `free-tier` (default) | LWW cloud sync | `tx_quota` / bulan | ❌ Export file saja |

### Flow Kuota Transaksi

1. User selesaikan transaksi → `pos.sync.simpanPenjualanSync()` naikkan `txUsed`
2. Cek kuota: `effectiveQuota = max(txQuota + txAdjust, 0)` (dari local cache atau cloud)
3. Jika `txUsed >= effectiveQuota` → **blok transaksi** (toast + sheet pembelian muncul, tapi checkout ditolak)
4. Jika kuota masih ada → proses normal
5. Reconcile cloud saat online: adopsi `clients.tx_used` bila lebih besar, push lokal bila lebih besar

---

## 2. Deskripsi Layar UI

### 2.1. Kartu Status Kuota (di Pengaturan)
- **Lokasi**: bawah halaman Pengaturan, di atas tombol aksi
- **Isi**:
  - Header: ikon ✅ (lisensi aktif) atau ⏳ (gratis)
  - Progress bar: `linear-gradient(90deg, var(--green), #388e3c)` — lebar = `min(txUsed/quota, 100)%`
  - Badge kuota: "12/100 transaksi terpakai"
  - Bonus admin: tampilkan `txAdjust` jika != 0
  - Langkah pipeline status: "Trial" → "Gratis" → "Lisensi"
- **Tombol aksi** (sejajar horizontal di bawah kartu):
  - 💳 Beli Lisensi (WhatsApp ke admin)
  - 💬 Tanya Admin (WhatsApp)
- **Catatan**: `animation:none` di inline style agar keyframe CSS lama tidak bertabrakan

### 2.2. Chip Header Trial (ID: `trialChip`)
- **Letak**: sebelah kanan header, sebelah tombol "❓ Bantuan"
- **Sumber data**: `updateTrialChip()` → `getLicenseStatus()` — satu sumber kebenaran untuk semua UI
- **Tampilan**:
  - Gratis: `GRATIS · N trx` — warna oranye saat N ≤ 10, default abu-abu
  - Gratis (tanpa data): `GRATIS · —`
  - Aktif (lisensi berbayar): `LISENSI · ✓ Aktif`
  - Expired: `LISENSI · KEDALUARSA` + kelas `warn`
  - Revoked: `LISENSI · ✕ Dicabut` + kelas `warn`
- **Interaksi**: klik membuka Pengaturan

### 2.3. Banner Kuota (ID: `quotaBanner`)
- **Kapan muncul**: kuota habis (gratis) atau lisensi expired (berbayar)
- **Posisi**: fixed, di bawah header (top: `calc(var(--header-h) + 10px)`)
- **Isi**:
  - Pesan: "🚫 Kuota transaksi bulan ini habis — eksplorasi tetap bebas, transaksi terkunci." (gratis) atau "🔑 Lisensi berbayar Anda sudah kedaluwarsa — eksplorasi tetap bebas, transaksi terkunci." (expired)
  - ID Perangkat (fingerprint)
  - Tombol 🛒 Lisensi (WhatsApp)
  - Tombol ✕ (tutup banner — bisa dibuka ulang)
- **CSS**: card dengan background `#fff7ed`, border `#fdba74`, shadow, `z-index:850`

### 2.4. Overlay Lock (ID: `lockOverlay`)
- **Kapan muncul**: status = `revoked` (dicabut admin)
- **Perilaku**: full-screen overlay, tidak bisa ditutup user
- **Berbeda dari kuota habis**: kuota habis hanya menampilkan banner + blok transaksi

### 2.5. Modal Syarat & Ketentuan (ID: `tcModal`)
- **Kapan muncul**: sekali saat boot jika `tcAcceptedAt` belum diset
- **Perilaku**: non-blocking — bisa ditutup, dibuka ulang dari Bantuan → 📜 Dokumen
- **Isi**: 4 poin — termasuk kuota transaksi per bulan dan cadangan cloud khusus lisensi aktif
- **Tombol**: "✕ Nanti Saja" / "✓ Saya Setuju"

---

## 3. Gaya Visual (mengacu ke css/style.css)

- **Warna Primer**: `--primary:#D6501C` (oranye tua)
- **Warna Status**:
  - Hijau: `--green:#2E7D32` (progress bar kuota, lisensi aktif)
  - Merah: `--red:#C62828` (kuota ≤ 10, revoked)
  - Oranye: `--primary` (trial chip warning, banner border)
- **Background**: kartu `.card` dengan `var(--card:#FFFFFF)`, shadow `var(--shadow)`, radius `var(--radius:16px)`
- **Progress bar kuota**: `background: linear-gradient(90deg, var(--green), #388e3c)` — animasi keyframe DINONAKTIFKAN (`animation:none`)
- **Banner kuota**: background `#fff7ed`, border `1px solid #fdba74`, border-radius 14px, pointer-events auto pada card
- **Tombol aksi lisensi**: flex row, `justify-content: center`, gap 12px, di luar kartu kuota

---

## 4. Detail Interaksi

| Aksi | UI Feedback | Catatan |
|------|-------------|---------|
| Transaksi selesai (kuota masih ada) | `txUsed++` + update progress bar | Counter di IndexedDB + localStorage |
| Transaksi selesai (kuota habis) | Toast "Kuota transaksi bulan ini sudah habis" + sheet pembelian muncul | Checkout ditolak, kartu tetap bisa dijual |
| Klik chip header | Buka halaman Pengaturan | |
| Tutup banner kuota | `hideQuotaBanner()` — banner tersembunyi | Bisa muncul lagi saat boot berikutnya |
| Klik 🛒 Lisensi di banner | Buka WhatsApp ke admin | |
| Buka Bantuan → 📜 Dokumen | Modal S&K terbuka | Bisa diakses kapan saja |
| Reconcile cloud (online) | Adopt/push txUsed sesuai LWW | Anti-reset via `txLastPushAt` |
| Admin reset kuota | `tx_month=null` + `tx_updated_at` baru → cloud reset terdeteksi | txUsed = 0 di bulan baru |

---

## 5. Integrasi dengan Supabase

### Tabel yang Digunakan

| Tabel | Kolom terkait | Keterangan |
|-------|---------------|------------|
| `products` | `kode_produk`, `salt`, `tx_quota` | Produk lisensi + kuota default |
| `clients` | `tx_month`, `tx_used`, `tx_adjust`, `tx_updated_at`, `device_code` | Per-device kuota + adjust admin |

### Flow Sync Cloud (`license.sync.js`)

1. **Fetch**: ambil baris `clients` berdasarkan `device_code`
2. **Reconcile LWW**:
   - `tx_adjust` → selalu adopsi dari cloud
   - Admin reset: `!cloudMonth && cloudNewer` → reset lokal ke 0
   - Cloud newer month → adopsi `cloudMonth` + `cloudUsed`
   - Same month, cloudUsed > local → adopsi `cloudUsed`
   - Local lebih besar → push ke cloud
3. **Push profil**: backfill-only saat boot (otomatis), full update saat user intent (form profil)

### Device Code

- Fingerprint hardware (SAMA di semua browser pada perangkat yang sama)
- Bukan `installId` — konsisten lintas browser

---

## 6. Arsitektur File

```
kaki5/js/
├── license.logic.js      ← Validasi HMAC lokal (offline)
├── license.sync.js       ← Sync cloud + reconcile LWW kuota
├── license.ui.js         ← Render UI (chip, kartu kuota, banner, lock)
├── app.js                ← Koordinator boot + guardLicensedThen()
├── pos.js                ← Gate transaksi (cek kuota sebelum checkout)
└── pos.sync.js           ← Simpan penjualan + naikkan txUsed
```

### Dependency

- `license.ui.js` tidak import `daysLeft` atau `MAX_EXTENSIONS` (sudah dihapus)
- `license.logic.js` export `getLicenseStatus()` (async) — satu sumber kebenaran
- `app.js` import `guardLicensedThen` dari `license.logic.js` untuk gate cadangan cloud

---

**Terakhir diperbarui**: 2026-08-29 (v119/1.0.50)
