# DESAIN UI/UX MODUL LISENSI KAKI5

> **Status**: diselaraskan dengan kode **v167 / 1.0.99 (2026-09-04)**.
> Mencerminkan model **kuota transaksi per bulan kalender** (pengganti trial berbasis waktu).
> Cakupan dokumen ini khusus **lisensi & kuota**; desain modul lain ada di
> [`README.md`](README.md) dan [`docs/DEVELOPER.md`](docs/DEVELOPER.md).
> Saklar fitur kas v166 (`#fiturKasToggle`) bukan bagian sistem lisensi — lihat
> `docs/DEVELOPER.md` §7.

---

## 1. Alur Pengguna (User Flow)

```
[Buka Aplikasi]
        |
        v
[boot() FASE 1 → runLicenseSync() → getLicenseStatus()]   (app.js:1145, license.logic.js:380)
        |
        +---> [status 'active']  → chip header "LISENSI · ✓ Aktif"
        |                         Kartu kuota di Pengaturan
        |                         Semua fitur terbuka, termasuk CADANGAN CLOUD
        |
        +---> [status 'trial']   → chip "GRATIS · Sisa N transaksi"
        |                         Kuota = products.tx_quota (default 100) + clients.tx_adjust
        |                         Kuota habis → banner closable + transaksi diblok
        |                         Aplikasi TETAP bisa dieksplorasi
        |                         Kuota segar otomatis tiap awal bulan kalender
        |
        +---> [status 'expired'] → chip "LISENSI · KEDALUARSA" (kelas warn)
        |                         Banner bisa-ditutup + transaksi diblok
        |                         Cadangan cloud terkunci (hanya export file)
        |
        +---> [status 'revoked'] → full-lock overlay (#lockOverlay)
        |                         Tidak bisa ditutup user — satu-satunya kondisi lock penuh
        |
        +---> [status 'none']    → dianggap tier gratis, chip "GRATIS · —"
```

### Status & Hak Akses

Nilai `status` yang benar-benar ada di kode (`license.logic.js:380-405`):
`none | trial | active | expired | revoked`.

| `status` | Sumber validasi | Transaksi | Cadangan cloud | Lock |
|----------|-----------------|-----------|----------------|------|
| `active` | HMAC + Supabase | unlimited | ✅ backup & restore | — |
| `trial` (gratis) | kuota lokal + reconcile cloud | `tx_quota`/bulan | ❌ export file saja | — |
| `expired` | HMAC + Supabase | ❌ diblok | ❌ export file saja | banner saja |
| `revoked` | perintah admin via cloud | ❌ | ❌ | **`lockOverlay`** |
| `none` | belum ada data lisensi | mengikuti kuota | ❌ | — |

> **Koreksi dari dokumen lama:** string `licensed-active`, `free-tier`, dan status
> `'unknown'` / `'trial_extended'` **tidak ada** di kode. Satu-satunya protokol ber-string
> `licensed-*` yang masih muncul adalah `licensed-expired`. Full-screen **license gate juga
> sudah dihapus** (keputusan pemilik 2026-08-29, `app.js:255-259`).

### Flow Kuota Transaksi

1. User menyelesaikan transaksi → `simpanPenjualanSync()` (`pos.sync.js:92`) memanggil
   `incrementTxCount()` (`license.logic.js:32`).
2. Kuota efektif = `max(txQuota + txAdjust, 0)`; `txQuota` dari cloud `products.tx_quota`
   (`license.sync.js:147`), fallback `DEFAULT_TX_QUOTA = 100` (`license.logic.js:20`).
3. Bila `txUsed >= kuota efektif` → transaksi **ditolak** (`pos.js:552-557`) dengan toast +
   sheet pembelian; **aplikasi tetap bisa dipakai**.
4. Bila kuota masih ada → proses normal.
5. Reconcile cloud saat online: adopsi `clients.tx_used` bila lebih besar, push lokal bila
   lebih besar (LWW).
6. Bulan kalender baru → penghitung mulai dari 0 (`currentTxMonth()`, `license.logic.js:23`).

---

## 2. Deskripsi Layar UI

### 2.1. Kartu Status Kuota (di Pengaturan)
- **Lokasi**: bagian bawah halaman Pengaturan, di atas tombol aksi.
- **Isi**:
  - Header: ikon ✅ (lisensi aktif) atau ⏳ (gratis).
  - **Progress bar** `.license-progress span`
    (`css/style.css:735-736`): `background: linear-gradient(90deg, var(--green-light), var(--green))`,
    lebar = pemakaian. Nilai lama `#388e3c` **tidak ada** di proyek ini.
  - **Badge kuota** (`license.ui.js:67`): teks **"Sisa N transaksi"**, atau
    **"Habis bulan ini"** saat habis. Kelas warna: `red` (habis) → `orange`
    (sisa ≤ 10) → `green`.
  - Bonus admin: tampilkan `txAdjust` bila ≠ 0.
  - **Langkah pipeline** (`licenseSteps()`, `license.ui.js:41-47`):
    **`1 Gratis → 2 Beli → 3 Proses → 4 Aktif`** (bukan "Trial → Gratis → Lisensi").
    Langkah selesai diberi `is-done` + centang ✓.
- **Tombol aksi** (sejajar horizontal, di luar kartu):
  - 💳 Beli Lisensi (WhatsApp ke admin)
  - 💬 Tanya Admin (WhatsApp)
- **Catatan implementasi**: `animation:none` pada style inline agar keyframe CSS lama tidak
  bertabrakan.

### 2.2. Chip Lisensi di Header (ID: `trialChip`)
- **Letak**: kanan header (`index.html:42`), di sebelah tombol "❓ Bantuan" (`:43`).
- **Sumber data**: `updateTrialChip()` → `getLicenseStatus()` — satu sumber kebenaran untuk
  semua permukaan UI lisensi.
- **Tampilan**:
  - Gratis: `GRATIS · Sisa N transaksi` — oranye saat N ≤ 10, abu-abu default.
  - Gratis tanpa data: `GRATIS · —`
  - Aktif: `LISENSI · ✓ Aktif`
  - Expired: `LISENSI · KEDALUARSA` + kelas `warn`
  - Revoked: `LISENSI · ✕ Dicabut` + kelas `warn`
- **Interaksi**: `data-action="open-license-sheet"` → membuka **bottom sheet lisensi**
  (`app.js:341-343`), **bukan** halaman Pengaturan.

### 2.3. Banner Kuota (ID: `quotaBanner`, `index.html:920`)
- **Kapan muncul**: kuota habis (gratis) atau lisensi expired (berbayar).
  Logika di `app.js:260-276`.
- **Posisi**: fixed di bawah header (`top: calc(var(--header-h) + 10px)`), `z-index:850`.
- **Isi**:
  - Gratis: "🚫 Kuota transaksi bulan ini habis — eksplorasi tetap bebas, transaksi terkunci."
  - Expired: "🔑 Lisensi berbayar Anda sudah kedaluwarsa — eksplorasi tetap bebas,
    transaksi terkunci."
  - ID Perangkat (device code / fingerprint).
  - Tombol 🛒 Lisensi (WhatsApp) dan ✕ tutup.
- **CSS**: card `background:#fff7ed`, `border:1px solid #fdba74`, radius 14px, shadow;
  `pointer-events:auto` pada card.

### 2.4. Overlay Lock (ID: `lockOverlay`)
- **Kapan muncul**: **hanya** `status = revoked` (`enforceRevoked`, `license.ui.js:178`).
- **Perilaku**: full-screen, tidak bisa ditutup user — sengaja dikecualikan dari perilaku
  tutup-klik global (`app.js:959,963`).
- **Beda dengan kuota habis**: kuota habis = banner + blokir transaksi; **bukan** lock.

### 2.5. Modal Syarat & Ketentuan (ID: `tcModal`, `index.html:945`)
- **Kapan muncul**: sekali saat boot bila `tcAcceptedAt` belum diset (`app.js:1189`).
- **Perilaku**: **non-blocking** — bisa ditutup ("✕ Nanti Saja"), muncul lagi di boot
  berikutnya bila belum setuju, dan bisa dibuka ulang dari Bantuan → 📜 Dokumen.
  Setuju → `setSetting('tcAcceptedAt', ISO)` (`app.js:249`).
- **Isi**: 4 poin, termasuk kuota transaksi per bulan dan cadangan cloud khusus lisensi aktif.
- **Registrasi**: `registerModalSelector('tcModal', …)` (`app.js:40`).

### 2.6. Bottom Sheet Pembelian (`purchase.js`)
- Alur 4 langkah mengikuti `licenseSteps()`.
- Sumber pembayaran: cloud `settings.qris_url` & `settings.bank_info` (`purchase.js:88-89`).
- Unggah **bukti transfer** ke Storage bucket `bukti` (`purchase.js:284,291`).
- Konfirmasi aktivasi lewat **Realtime** (`license:${unitId}`, `purchase.js:404-407`)
  dengan polling sebagai cadangan; keduanya memanggil `_ksr_updateTrialChip`
  (`app.js:245`) supaya chip & kartu langsung refresh tanpa menunggu interval 60 detik.

---

## 3. Gaya Visual (mengacu `css/style.css`)

- **Warna primer**: `--primary:#D6501C` (oranye tua).
- **Warna status**:
  - Hijau `--green` (+ `--green-light` untuk gradien) — lisensi aktif, progress bar kuota.
  - Merah `--red` — badge saat habis, revoked.
  - Oranye `--primary` — chip peringatan, border banner.
- **Kartu**: `.card` dengan `var(--card:#FFFFFF)`, `var(--shadow)`, `var(--radius:16px)`.
- **Progress bar kuota**: gradien hijau (lihat §2.1), keyframe **dinonaktifkan**.
- **Banner kuota**: `#fff7ed` + border `#fdba74`, radius 14px.
- **Tombol aksi lisensi**: flex row `justify-content:center`, gap 12px, di luar kartu kuota.

---

## 4. Detail Interaksi

| Aksi | UI Feedback | Catatan implementasi |
|------|-------------|----------------------|
| Transaksi selesai (kuota ada) | `txUsed++` + progress bar & chip naik-turun | disimpan **hanya** di baris `settings.license` IndexedDB (`license.logic.js:327-328`) — **bukan** localStorage |
| Transaksi selesai (kuota habis) | Toast + sheet pembelian terbuka | checkout ditolak (`pos.js:552-557`), menu tetap bisa dibuka |
| Klik chip header | **Bottom sheet lisensi** terbuka | `open-license-sheet` (`app.js:341-343`) |
| Tutup banner kuota | banner tersembunyi | bisa muncul lagi di boot berikutnya |
| Klik 🛒 Lisensi di banner | WhatsApp ke admin | nomor dari cloud `products.store_url` / fallback (`app-link.js:15-38`) |
| Bantuan → 📜 Dokumen | Modal S&K terbuka | kapan saja |
| Reconcile cloud (online) | adopsi/push `txUsed` sesuai LWW | anti-reset lewat `txLastPushAt` (`license.sync.js:227,252`) |
| Admin reset kuota | `tx_month=null` + `tx_updated_at` baru → reset lokal ke 0 | terdeteksi sebagai "admin reset" |
| Aktivasi serial di perangkat baru | RPC `device_assign` → reassign atau tolak + lock "hubungi admin" | Opsi 3: 1 serial = 1 `unit_id` = 1 profil (`license.sync.js:394`) |

---

## 5. Integrasi dengan Supabase

### Objek yang dipakai modul lisensi

| Objek | Kolom/field | Keterangan |
|-------|-------------|------------|
| `products` | `kode_produk` (`'KK5'`), `salt`, `tx_quota`, `store_url`, `vercel_url` | salt & kuota **bersumber dari cloud** |
| `clients` | `tx_month`, `tx_used`, `tx_adjust`, `tx_updated_at`, `device_code`, `unit_id`, `license_status` | kuota per perangkat + status lisensi |
| `settings` (cloud) | `qris_url`, `bank_info`, `app_links` | data pembelian & tautan |
| RPC `device_known` | — | verifikasi perangkat |
| RPC `device_assign` | — | reassign serial (Opsi 3) |
| Realtime | `postgres_changes` UPDATE `clients` filter `unit_id=eq.<unitId>` | notifikasi aktivasi |

### Flow Sync Kuota (`license.sync.js`)

1. **Fetch** baris `clients` berdasarkan `device_code`.
2. **Reconcile LWW**:
   - `tx_adjust` → **selalu** adopsi dari cloud.
   - Admin reset (`!cloudMonth && cloudNewer`) → reset lokal ke 0.
   - Bulan cloud lebih baru → adopsi `cloudMonth` + `cloudUsed`.
   - Bulan sama, `cloudUsed > local` → adopsi `cloudUsed`.
   - Lokal lebih besar → push ke cloud.
3. **Rate limit** `syncLicense` 30/menit (`license.sync.js:176` ← `helpers.pure.js:186`).
4. **Offline-first**: kegagalan jaringan **tidak boleh** mengubah/menghapus state lisensi
   lokal — revoke dari ketidakpastian dilarang (`../../CONTEXT.md:93-95`).

### Device Code & Unit ID

- `deviceCode` = fingerprint perangkat — **sama di semua browser** pada perangkat yang sama
  (bukan `installId`, yang per-browser).
- `unitId = 'K5-' + deviceCode` (`license.logic.js:430,438`), disimpan di `settings.unitId`.
- Validasi serial: format `KK5-XXXX-XXXX-XX-XXXXXX`, HMAC-SHA256 + Base32 6 karakter
  (`license.logic.js:234,170-177`); salt dari cloud `products.salt`
  (`license.sync.js:102`), fallback lokal `KASIRSOLO-KAKI5-HMAC-V2`
  (`license.logic.js:157`).
- Anti-rollback jam: `clockAnchor` + `getEffectiveNow()` (`license.logic.js:213-222`).

---

## 6. Arsitektur File (modul lisensi)

```
kaki5/js/
├── license.js            ← FACADE (56 baris): re-export logic + ui + sync
├── license.logic.js      ← kuota, HMAC, getLicenseStatus(), clockAnchor
├── license.ui.js         ← render chip, kartu kuota, banner, lockOverlay, sheet
├── license.sync.js       ← cloud: aktivasi, verifyAndAssignSerial, reconcile LWW
├── purchase.js           ← alur beli: QRIS/transfer, bukti, realtime
├── app.js                ← boot FASE 1, guardLicensedThen() (lokal, :320), gate cadangan cloud (:524)
├── pos.js                ← gate transaksi (cek kuota sebelum checkout)
└── pos.sync.js           ← simpan penjualan + incrementTxCount()
```

### Dependency & jebakan

- `license.js` adalah **facade tanpa `export *`**. `app.js` mengimpor `license.js`, sehingga
  fungsi apa pun yang dibutuhkan lewat `window[...]` **wajib** ada di daftar re-exportnya —
  kalau tidak, ia dilewati **diam-diam** (kelas bug v166; lihat `docs/DEVELOPER.md` §4).
- `getLicenseStatus()` bersifat **async** dan satu-satunya sumber kebenaran status.
- `guardLicensedThen` **didefinisikan lokal di `app.js:320`** — tidak diekspor dari modul mana
  pun. Dokumen lama mengklaim `app.js` mengimpornya dari `license.logic.js`: itu salah.
- Siklus impor nyata `license.logic.js ↔ license.sync.js` dan
  `sync.js → license.js → license.sync.js → sync.js` aman karena semua pemakaian lewat
  pemanggilan fungsi (TDZ-safe).
- `license.ui.js` **tidak** mengimpor `daysLeft` / `MAX_EXTENSIONS` / `grantExtension`
  (fitur perpanjangan trial sudah dicabut; hanya kunci rate-limiter `grantExtension` yang
  tersisa di `helpers.pure.js:186`).

---

## 7. Riwayat Keputusan Desain

| Tanggal | Rilis | Keputusan |
|---|---|---|
| 2026-08-29 | v116-era | Trial berbasis waktu (7 hari + perpanjangan) **diganti** kuota transaksi per bulan kalender. |
| 2026-08-29 | v119-era | Gate onboarding 2-langkah **dihapus**; S&K jadi modal non-blocking. Full-screen license gate **dihapus**. |
| 2026-08-29 | v119-era | **Keputusan pemilik:** kuota habis tidak mengunci aplikasi; hanya revoke admin yang boleh full-lock. |
| 2026-08 (Opsi 3) | — | 1 serial = 1 `unit_id` = 1 profil; penegakan lewat RPC `device_assign` di server. |
| 2026-09-04 | v166 / 1.0.98 | Saklar fitur "Buka / Tutup Kas" di Pengaturan (di luar sistem lisensi, tapi memakai mekanisme `data-action` + wire-map yang sama — sumber bug facade). |
| 2026-09-04 | v167 / 1.0.99 | Gerbang saklar kas diperketat: `fiturKasAktif()` baca DB tiap transaksi, saklar disinkronkan sebelum panggilan cloud, dan `saveFiturKas()` membandingkan dengan nilai tersimpan. Tidak mengubah model lisensi/kuota. |

---

**Terakhir diperbarui**: 2026-09-04 (v167 / 1.0.99)
