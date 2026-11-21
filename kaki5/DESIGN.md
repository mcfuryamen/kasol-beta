# DESAIN UI/UX MODUL LISENSI KAKI5

> **Status**: diselaraskan dengan kode **v217 / 1.0.142-beta.1 (2026-11-08)**.
> Mencerminkan model **kuota transaksi per bulan kalender** (pengganti trial berbasis waktu).
> Cakupan dokumen ini khusus **lisensi & kuota**; desain modul lain ada di
> [`README.md`](README.md) dan [`docs/DEVELOPER.md`](docs/DEVELOPER.md).
> Saklar fitur kas v166 (`#fiturKasToggle`) bukan bagian sistem lisensi — lihat
> `docs/DEVELOPER.md` §7.
>
> **Catatan v181 — gerbang kas bukan gerbang lisensi, dan bukan lagi hard gate.**
> Sejak v170 `bukaKasModal` sempat menjadi overlay hard-gate KEDUA selain `lockOverlay`.
> **Sejak v181 ia dikeluarkan dari `HARD_GATE_OVERLAYS`** (`js/modal.js:48` — kini hanya
> `lockOverlay` + `updateOverlay`) atas permintaan pemilik: gerbang kas hanya mengunci
> halaman Jualan. Escape/backdrop/navigasi bisa menutupnya; watcher MutationObserver
> `kas.js:175-191` menegakkan ulang modal selama masih di Jualan tanpa shift terbuka, dan
> guard "Bayar" tanpa shift (pos.js) tetap ada sebagai jaring pengaman. Gerbang lisensi
> (`lockOverlay`) tidak berubah: tetap hard gate penuh.

---

## 1. Alur Pengguna (User Flow)

```
[Buka Aplikasi]
        |
        v
[boot() FASE 1 → runLicenseSync() → getLicenseStatus()]   (app.js:1365, license.logic.js:592)
        |
        +---> [status 'active']  → chip header "LISENSI · ✓ Aktif"
        |                         Kartu kuota di Pengaturan
        |                         Semua fitur terbuka, termasuk CADANGAN CLOUD
        |
        +---> [status 'trial']   → chip "GRATIS · Sisa N transaksi"
        |                         Kuota = products.tx_quota (default 0, diisi cloud) + clients.tx_adjust
        |                         Kuota habis → banner closable + transaksi diblok
        |                         Aplikasi TETAP bisa dieksplorasi
        |                         Kuota segar otomatis tiap awal bulan kalender
        |
        +---> [status 'expired'] → chip "LISENSI · KEDALUARSA" (kelas warn)
        |                         Banner bisa-ditutup + transaksi diblok
        |                         Cadangan cloud terkunci (hanya export file)
        |
        +---> [status 'revoked'] → full-lock overlay (#lockOverlay)
        |                         Tidak bisa ditutup user — satu-satunya lock karena lisensi
        |                         (sejak v170 ada hard gate non-lisensi juga: #bukaKasModal)
        |
        +---> [status 'none']    → dianggap tier gratis, chip "GRATIS · —"
```

### Status & Hak Akses

Nilai `status` yang benar-benar ada di kode (`getLicenseStatus()`, `license.logic.js:592`):
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
> sudah dihapus** (keputusan pemilik 2026-08-29, komentar `app.js:294-298`).

### Flow Kuota Transaksi

1. User menyelesaikan transaksi → `simpanPenjualanSync()` (`pos.sync.js:98`, pemanggilan
   kuota `:107`) memanggil `incrementTxCount()` (`license.logic.js:507`).
2. Kuota efektif = `max(txQuota + txAdjust, 0)`; `txQuota` dari cloud `products.tx_quota`
   (`license.sync.js:153-174`), fallback `DEFAULT_TX_QUOTA = 0` (`license.logic.js:28`).
3. Bila `txUsed >= kuota efektif` → transaksi **ditolak** (`pos.js:633-650`) dengan toast +
   sheet pembelian; **aplikasi tetap bisa dipakai**.
4. Bila kuota masih ada → proses normal.
5. Reconcile cloud saat online: adopsi `clients.tx_used` bila lebih besar, push lokal bila
   lebih besar (LWW).
6. Bulan kalender baru → penghitung mulai dari 0 (`currentTxMonth()`, `license.logic.js:31`).

---

## 2. Deskripsi Layar UI

### 2.1. Kartu Status Kuota (di Pengaturan)
- **Lokasi**: bagian bawah halaman Pengaturan, di atas tombol aksi.
- **Isi**:
  - Header: ikon ✅ (lisensi aktif) atau ⏳ (gratis).
  - **Progress bar** `.license-progress span`
    (`css/style.css:874`): `background: linear-gradient(90deg, var(--green-light), var(--green))`,
    lebar = pemakaian. Nilai lama `#388e3c` **tidak ada** di proyek ini. Baris ini sengaja
    TIDAK ikut tema gradasi v170 — ia sudah gradien, dan arahnya 90° untuk animasi bolak-balik.
  - **Badge kuota** (`license.ui.js:80`): teks **"Sisa N transaksi"**, atau
    **"Habis bulan ini"** saat habis. Kelas warna: `red` (habis) → `orange`
    (sisa ≤ 10) → `green`.
  - Bonus admin: tampilkan `txAdjust` bila ≠ 0.
  - **Langkah pipeline** (`licenseSteps()`, `license.ui.js:42-46`):
    **`1 Gratis → 2 Beli → 3 Proses → 4 Aktif`** (bukan "Trial → Gratis → Lisensi").
    Langkah selesai diberi `is-done` + centang ✓.
- **Tombol aksi** (sejajar horizontal, di luar kartu):
  - 💳 Beli Lisensi (WhatsApp ke admin)
  - 💬 Tanya Admin (WhatsApp)
- **Catatan implementasi**: `animation:none` pada style inline agar keyframe CSS lama tidak
  bertabrakan.

### 2.2. Chip Lisensi di Header (ID: `trialChip`)
- **Letak**: kanan header (`index.html:44`), di sebelah tombol "❓ Bantuan" (`:43`).
- **Sumber data**: `updateTrialChip()` → `getLicenseStatus()` — satu sumber kebenaran untuk
  semua permukaan UI lisensi.
- **Tampilan**:
  - Gratis: `GRATIS · Sisa N transaksi` — oranye saat N ≤ 10, abu-abu default.
  - Gratis tanpa data: `GRATIS · —`
  - Aktif: `LISENSI · ✓ Aktif`
  - Expired: `LISENSI · KEDALUARSA` + kelas `warn`
  - Revoked: `LISENSI · ✕ Dicabut` + kelas `warn`
- **Interaksi**: `data-action="open-license-sheet"` → membuka **bottom sheet lisensi**
  (`app.js:452`), **bukan** halaman Pengaturan.

### 2.3. Banner Kuota (ID: `quotaBanner`, `index.html:1083`)
- **Kapan muncul**: kuota habis (gratis) atau lisensi expired (berbayar).
  Logika di `showQuotaBanner()` `app.js:299-317`.
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
- **Kapan muncul**: **hanya** `status = revoked` (`enforceRevoked`, `license.ui.js:183`).
- **Perilaku**: full-screen, tidak bisa ditutup user — sengaja dikecualikan dari perilaku
  tutup-klik global karena ada di `HARD_GATE_OVERLAYS` (`app.js:1153-1167`).
- **Beda dengan kuota habis**: kuota habis = banner + blokir transaksi; **bukan** lock.

### 2.5. Syarat & Ketentuan — TAB di halaman Bantuan (bukan modal lagi)
> **Modal `tcModal` SUDAH DIHAPUS** (restruktur 2026-09-14, selaras rosok). Jangan cari
> `#tcModal` di `index.html` — tidak ada. `registerModalSelector('tcModal', ...)` juga
> sudah dibuang dari `app.js` (lihat komentar di `app.js:41-42`).

- **Letak**: tab ketiga di halaman Bantuan — Tutorial | Video | **S & K**
  (`#bantuanTabTc` → `#bantuanPanelTc`, `index.html:336-383`).
- **Kapan "Saya Setuju" tampil**: baris `#tcAcceptRow` (`index.html:380`) hanya ditampilkan
  selama `tcAcceptedAt` belum tercatat; tombolnya `data-action="accept-tc"`.
- **Aksi setuju**: `window._ksr_acceptTC` (`app.js:280-292`) → `setSetting('tcAcceptedAt', ISO)`,
  lalu baris disembunyikan + toast. Tidak ada lagi auto-muncul saat boot — satu pintu = tab S&K.
- **Isi**: 6 pasal (Layanan, Kuota Gratis & Lisensi, Data Anda, Profil & Sinkronisasi,
  Tanggung Jawab, Bantuan & Perubahan), termasuk kuota transaksi per bulan dan cadangan
  cloud khusus lisensi aktif.
- **⚠️ STAMP manual**: teks "🕒 Terakhir diperbarui: 14 September 2026 · v1.2"
  (`index.html:367`) di-hardcode — **wajib di-bump manual** setiap konten S&K diubah,
  tidak ikut `APP_VERSION`.

### 2.6. Bottom Sheet Pembelian (`purchase.js`)
- Alur 4 langkah mengikuti `licenseSteps()`.
- Sumber pembayaran: cloud `settings.qris_url` & `settings.bank_info` (`purchase.js:100-101`).
- Unggah **bukti transfer** ke Storage bucket `bukti` (`purchase.js:335`).
- Konfirmasi aktivasi lewat **Realtime** (`license:${unitId}`, `purchase.js:439-441`)
  dengan polling sebagai cadangan; keduanya memanggil `_ksr_updateTrialChip`
  (`app.js:272`) supaya chip & kartu langsung refresh tanpa menunggu interval 60 detik.

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
| Transaksi selesai (kuota ada) | `txUsed++` + progress bar & chip naik-turun | disimpan **hanya** di baris `settings.license` IndexedDB (`saveLicense()`, `license.logic.js:453`) — **bukan** localStorage |
| Transaksi selesai (kuota habis) | Toast + sheet pembelian terbuka | checkout ditolak (`pos.js:633-650`), menu tetap bisa dibuka |
| Klik chip header | **Bottom sheet lisensi** terbuka | `open-license-sheet` (`app.js:452`) |
| Tutup banner kuota | banner tersembunyi | bisa muncul lagi di boot berikutnya |
| Klik 🛒 Lisensi di banner | WhatsApp ke admin | nomor dari cloud `products.store_url` / fallback (`app-link.js:15-38`) |
| Bantuan → tab 📜 S & K | Panel S&K terbuka | kapan saja; bukan modal lagi (§2.5) |
| Reconcile cloud (online) | adopsi/push `txUsed` sesuai LWW | anti-reset lewat `txLastPushAt` (`license.sync.js:427,452`) |
| Admin reset kuota | `tx_month=null` + `tx_updated_at` baru → reset lokal ke 0 | terdeteksi sebagai "admin reset" |
| Aktivasi serial di perangkat baru | RPC `device_assign` → reassign atau tolak + lock "hubungi admin" | Opsi 3: 1 serial = 1 `unit_id` = 1 profil (`license.sync.js:618`) |

---

## 5. Integrasi dengan Supabase

### Objek yang dipakai modul lisensi

| Objek | Kolom/field | Keterangan |
|-------|-------------|------------|
| `products` | `kode_produk` (`'KK5'`), `salt`, `tx_quota`, `store_url`, `vercel_url` | kuota **bersumber dari cloud**; `salt` TIDAK lagi terbaca anon (revoke per-kolom 2026-09-14 — klien selalu pakai konstanta fallback; lihat §Identitas) |
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
3. **Rate limit** `syncLicense` 30/menit (`license.sync.js:359-363` ← `helpers.pure.js:186`).
4. **Offline-first**: kegagalan jaringan **tidak boleh** mengubah/menghapus state lisensi
   lokal — revoke dari ketidakpastian dilarang (`../../CONTEXT.md:93-95`).

### Device Code & Unit ID

- `deviceCode` = fingerprint perangkat — **sama di semua browser** pada perangkat yang sama
  (bukan `installId`, yang per-browser).
- `unitId = 'K5-' + deviceCode` (`license.logic.js:660,668`), disimpan di `settings.unitId`.
- Validasi serial: format `KK5-XXXX-XXXX-XX-XXXXXX`, HMAC-SHA256 + Base32 6 karakter
  (`license.logic.js:343-350`, `validateSerial:407`); **sejak hardening 2026-09-14** jalur cloud
  `products.salt` mati (grant anon di-revoke per-kolom, lihat
  `../rosok/docs/supabase-hardening-2026-09-14.sql`) → yang efektif selalu
  konstanta fallback `KASIRSOLO-KAKI5-HMAC-V2` (`license.logic.js:329-330`) — nilainya
  memang identik dengan cloud saat revoke, TIDAK ada perubahan perilaku; validasi
  ini sendiri kini dead-path (aktivasi manual dihapus v195, cloud = SSoT).
  ⚠️ Rotasi salt = operasi sadar dua langkah (umumkan + update klien/server dulu).
- Anti-rollback jam: `clockAnchor` + `getEffectiveNow()` (`license.logic.js:384-397`).

---

## 6. Arsitektur File (modul lisensi)

```
kaki5/js/
├── license.js            ← FACADE (59 baris): re-export logic + ui + sync
├── license.logic.js      ← kuota, HMAC, getLicenseStatus(), clockAnchor
├── license.ui.js         ← render chip, kartu kuota, banner, lockOverlay, sheet
├── license.sync.js       ← cloud: aktivasi, verifyAndAssignSerial, reconcile LWW
├── purchase.js           ← alur beli: QRIS/transfer, bukti, realtime
├── app.js                ← boot FASE 1, guardLicensedThen() (lokal, :365), gate cadangan cloud (:682)
├── pos.js                ← gate transaksi (cek kuota sebelum checkout)
└── pos.sync.js           ← simpan penjualan + incrementTxCount()
```

### Dependency & jebakan

- `license.js` adalah **facade tanpa `export *`**. `app.js` mengimpor `license.js`, sehingga
  fungsi apa pun yang dibutuhkan lewat `window[...]` **wajib** ada di daftar re-exportnya —
  kalau tidak, ia dilewati **diam-diam** (kelas bug v166; lihat `docs/DEVELOPER.md` §4).
- `getLicenseStatus()` bersifat **async** dan satu-satunya sumber kebenaran status.
- `guardLicensedThen` **didefinisikan lokal di `app.js:365`** — tidak diekspor dari modul mana
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
| 2026-09-05 | v169 / 1.0.101 | Gerbang "buka kas dulu" pindah ke **klik tab 🛒 Jualan** (`loadPOS()`), plus modal "🕐 Detail Riwayat Kas". Pada titik ini modal Buka Kas masih punya tombol "Batal" dan masih bisa ditutup Escape. |
| 2026-09-05 | v170 / 1.0.102 | **Modal Buka Kas jadi gerbang penuh**: tombol "Batal" dihapus, `.modal-center` (tengah, tinggi ikut isi), dan satu registry `HARD_GATE_OVERLAYS` (`modal.js:48`) dipakai bersama oleh Escape, klik backdrop, klik navbar, dan `closeAllModals()`. Alasannya: selama masih ada jalan keluar, "dashboard terkunci sampai modal awal dimasukkan" hanya formalitas. `bukaKas()` juga menolak input kosong (kosong ≠ 0). Tidak mengubah model lisensi/kuota. |
| 2026-09-05 | v170 / 1.0.102 | **Tema gradasi diadopsi dari rosok** untuk permukaan terisi saja (header, tombol, FAB, tab, pemilih tanggal, banner, kartu statistik, bar keranjang, saklar, badge). Konsekuensi desain: stop gradien disusun **gelap→terang** (rosok memakai terang→gelap) supaya teks putih lolos kontras, dan `--primary` tetap `#D6501C` agar 67 pemakaian warna teks/border tidak ikut berubah. `.btn-wa` dikecualikan atas permintaan user. |
| 2026-09-07 | v181 / 1.0.106 | **Gerbang Buka Kas dilonggarkan jadi per-halaman** (revisi v170, permintaan pemilik): `bukaKasModal` keluar dari `HARD_GATE_OVERLAYS`; Escape/backdrop/navigasi bisa menutup; watcher `kas.js` menegakkan ulang selama di Jualan tanpa shift; `#bukaKasModal.show` z 340 < navbar 350 agar bottom-nav tetap klik-able. Model lisensi/kuota tidak berubah. |
| 2026-09-07 | v182 / 1.0.107 | **Fix ikon splash PWA**: `icon-192.png`/`icon-512.png` punya CRC IHDR korup (header ditulis ulang tanpa hitung CRC) → browser menolak decode → splash fallback ke ikon kecil di-scale up = buram. Diregenerate dari `icon.png` 12542 dengan padding 80% kanvas (resep batch sehat, aman "maskable"). Pelajaran: verifikasi CRC per-chunk saat menyentuh aset PNG. |
| 2026-09-14 | v18x-era | **S&K pindah dari modal (`tcModal`) ke TAB Bantuan** (selaras rosok): auto-muncul saat boot dihapus, satu pintu = tab "📜 S & K", "✓ Saya Setuju" hanya tampil bila `tcAcceptedAt` belum tercatat. `registerModalSelector('tcModal', …)` dibuang. Lihat §2.5. |
| 2026-11-07/08 | v216–v217 / 1.0.141–1.0.142 | **Lapisan akses Akun Kasol** (di luar sistem lisensi, tapi menentukan siapa boleh membuka aplikasi): gerbang login + peran `owner/manajer/kasir` (`js/account.js`, `ROLE_RANK:30`), "Kelola Pegawai" bertab (`js/account.ui.js`), dan lisensi jalur akun lewat `app_my_license` (`license.sync.js:860`). Gerbang lisensi (`lockOverlay`) **tidak berubah** — akun mengatur peran, lisensi mengatur kuota. |

---

**Terakhir diperbarui**: 2026-11-08 (v217 / 1.0.142-beta.1)
