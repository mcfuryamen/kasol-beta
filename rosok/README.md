# Kasir Solo - Rosok

Aplikasi kasir PWA **offline-first** untuk usaha pengepul rosok / barang bekas.
Catat pembelian & penjualan timbangan, stok, kas, laporan — dengan lisensi
berbasis kuota transaksi dan sinkronisasi cloud (Supabase), satu keluarga
ekosistem dengan **Kaki Lima (kaki5)**; banyak pola UI/bisnis diadopsi darinya ("ala kaki5").

- **Live:** https://rosok.kasirsolo.com (Vercel project `rosok`, repo `mcfuryamen/kasol`, Root Directory `rosok/`; domain `rosok.vercel.app` dihapus sengaja pemilik 2026-09-05)
- **Beta:** https://rosok-beta.vercel.app (Vercel project `rosok-beta`, repo `mcfuryamen/kasol-beta`)
- **Versi:** 1.4.13 · **Service Worker:** v74 · **Dexie:** `KasirSoloRosokDB` v5

> **Peta dokumen:** `README.md` (halaman ini — fitur & cara pakai) ·
> [`DESIGN.md`](DESIGN.md) (arsitektur, model data, kontrak cloud — referensi teknis) ·
> [`AGENTS.md`](AGENTS.md) (konvensi kerja + prosedur rilis untuk agen/developer) ·
> [`CHANGELOG.md`](CHANGELOG.md) (riwayat rilis) ·
> [`docs/QA-RELEASE-CHECKLIST.md`](docs/QA-RELEASE-CHECKLIST.md) (SOP bump & verifikasi rilis) ·
> `docs/` lainnya = arsip laporan audit/QA sekali-pakai.

## 📦 Installation (PWA)

### HP (Chrome/Android)
1. Buka aplikasi di browser
2. Pengaturan → Perangkat → **📲 Pasang Aplikasi**, atau menu → "Add to Home Screen"

### Desktop (Chrome/Edge)
Klik icon install di address bar, atau Menu → More Tools → Create Shortcut.

## 🚀 Running Locally

> **PORT RESMI app ini = `8084`** (Port Registry — sumber kebenaran: `kasol/CONTEXT.md`). Jangan ganti-ganti.

```bash
# Development server bawaan repo (MIME + CORS utk ESM) — default port 8084
node run-local.js
# Buka: http://localhost:8084
```

`file://` TIDAK bisa dipakai (modul ESM ditolak browser). PWA butuh HTTPS/localhost.
Saat QA di localhost, ingat Service Worker bisa menyajikan cache lama —
unregister SW + reload dulu (lihat checklist QA).

## 📱 Features

### Transaksi (POS wizard 2 langkah)
- Pembelian dari penjual & penjualan ke bandar, timbang kg/ons/kuintal dengan keypad
- Keranjang multi-item, preset nominal, kembalian otomatis
- **Metode bayar** (bisa di-toggle di Pengaturan → Fitur Aplikasi): **Tunai**, **Transfer** (nominal pas + foto bukti transfer wajib, tampil di riwayat), **Tempo** (uang muka opsional → utang/piutang)
- **Bayar utang/piutang ala kaki5**: tombol Lunasi membuka form Catat Kas lengkap dengan prefill (tab benar, kategori "Pelunasan Utang/Piutang", jumlah = sisa) — bisa sebagian; pelunasan atomik (kas + sisa transaksi satu transaksi DB)
- Nota: cetak browser (dual-path: printer BLE aktif → struk thermal 38 kolom auto-cut), share WhatsApp, dan **printer thermal Bluetooth** (BLE chunking ala kaki5, koneksi persist)

### Stok & Kategori
- 10 kategori default pengepul (kardus, besi, aluminium, tembaga, dll), emoji picker, stok real-time anti-minus

### Kas (buku kas harian ala kaki5)
- Buka/tutup kas (shift + modal awal + selisih), hanya catatan Tunai menggeser laci
- Catat kas masuk/keluar: satu sheet dua tab, jenis, tanggal boleh mundur (validasi), sumber Tunai/Transfer; catatan manual bisa diubah/dihapus, catatan sistem (Modal Awal/Pelunasan) terkunci
- **Riwayat Buka/Tutup Kas clickable** → sheet Detail: durasi, modal awal, masuk/keluar + jumlah transaksi, kas sistem vs fisik, selisih, catatan tutup, peringatan "hitung ulang" bila data diubah setelah tutup kas
- Tutup buku tahunan = gerenti: transaksi/shift tahun terkunci tidak bisa diutak-atik (peringatan saat mencoba)

### Laporan + Riwayat (satu halaman mengalir)
- Filter periode sticky menyelip di bawah header: Harian/Mingguan/Bulanan/Custom (klik-2x kalender, swap otomatis) + navigasi ‹ ›
- Statistik omzet/laba/utang/piutang; grafik kolom per jam (harian, dipangkas ke rentang aktif) atau mingguan M1..Mn (bulanan/custom), label nilai 'k', tooltip rupiah penuh
- **Riwayat Transaksi dikelompokkan per hari** (header akordeon, paging 10 hari) mengikuti filter periode
- Rosok Terlaris ranked, daftar Utang & Piutang dengan tombol Lunasi

### Lisensi & Kuota (model kaki5 — TERPUSAT di Control Center sejak 1.4.12)
- **Gratis = kuota transaksi per bulan** (default 100; angka dari cloud `products.tx_quota` + bonus admin `clients.tx_adjust`), kuota segar tiap awal bulan, TANPA batas waktu
- Kuota habis → banner bisa ditutup + transaksi terkunci; eksplorasi tetap bebas
- **Satu jalur beli**: sheet Beli Lisensi — QRIS/rekening live dari Supabase (dikelola Control Center), upload bukti → `menunggu_verifikasi` → diverifikasi admin → aktif otomatis (realtime `license:<unitId>` + polling 30 dtk × 60), stepper 1 Gratis → 2 Beli → 3 Proses → 4 Aktif
- **TIDAK ADA lagi** kolom aktivasi kode manual & tombol WhatsApp lisensi (dihapus 1.4.12) — semua proses lisensi lewat admin/Control; kartu lisensi tetap punya tombol Refresh Status
- **Cloud = sumber kebenaran mutlak**: adopsi assignment admin, downgrade bila dicabut, anti-rollback jam (`clockAnchor`)

### Cloud Sync (Supabase, proyek shared ekosistem kasirsolo)
- **Profil usaha dua-arah** di tabel `clients`: push penuh saat simpan (nama, pemilik, telepon, wilayah emsifa 4 level + telemetri perangkat), pull saat boot/buka Pengaturan/tiap 5 menit; flag pending melindungi editan offline
- **Cadangan cloud** (terkunci sampai lisensi aktif — guard kini benar-benar berfungsi, pelajaran bug `await` 1.4.12): bucket `backups`, file `cadangan-latest.json` per unit; konfirmasi Pulihkan menampilkan tanggal cadangan
- **Backup lokal**: export/import JSON bertanda tangan HMAC-device (payload v3, validasi 3 lapis, restore atomik)
- **Penawaran pulih otomatis** saat boot DB kosong + lisensi aktif + ada cadangan cloud (maks 1×/hari)
- **Diagnosa 10 langkah** (Pengaturan → Perangkat → 🩺 Diagnosa): rantai sync diperiksa berurutan + hasil bisa disalin ke admin

### Notifikasi in-app (toast)
- Satu elemen `#toast` global (bottom-center, 2,2 dtk, non-interaktif — tap menembus)
- ⚠️ Catatan sejarah: sejak 3 Agu sampai 14 Sep (1.4.13) toast **tidak pernah tampil** karena bug markup (lihat CHANGELOG 1.4.13) — semua feedback aplikasi kini kembali visual

### Bantuan (port kaki5 — commit `2ad32af`, ikut rilis berikutnya)
- Halaman khusus dibuka dari tombol **📖** di header (atau deep link `/bantuan`) — 2 tab sticky: **📖 Tutorial** (15 topik akordeon sesuai label UI asli, kartu hero + blok dukungan WA/Diagnosa/ID Perangkat) dan **🕓 Changelog** (riwayat versi bahasa user, chip "TERPASANG" pada versi berjalan)
- Perawatan: tutorial hanya boleh menyebut label yang benar-benar ada di UI; entri changelog baru ditambahkan di PALING ATAS `js/bantuan.js` tiap bump (lihat CHANGELOG)

## 🏗️ Tech Stack

- **Frontend:** Vanilla HTML5 + CSS3 + JavaScript ES6+ Modules (tanpa framework, tanpa build step)
- **Database:** Dexie.js (IndexedDB) — `KasirSoloRosokDB`, schema v1→v2→v3→v5
- **Cloud:** Supabase (PostgREST + Storage + Realtime + Edge Functions) via `supabase.min.js` + `supabase-config.js` (anon key dari Edge Function/`/api/supabase-config`, fallback konstanta)
- **PWA:** Service Worker SPA-fallback + network-first (HTML & aset) dengan cache offline — `CACHE_VERSION` di `sw.js`; overlay update paksa via `version.js`/`version.json` + `update.js`
- **Wilayah:** API wilayah Indonesia emsifa (statis JSON, fallback lokal `assets/region/provinces.json`)

## 📂 Project Structure

```
rosok/
├── index.html          # Entry point (HTML + loader ESM, cache-bust ?v=)
├── style.css           # Seluruh styling (design tokens CSS)
├── sw.js               # Service Worker (network-first, CACHE_VERSION)
├── manifest.json       # PWA manifest
├── dexie.min.js        # Library Dexie (wajib negasi .gitignore!)
├── run-local.js        # Dev server lokal (node run-local.js, port 8084)
├── sync-to-mirror.sh   # Salin produksi -> mirror GitHub kasol (whitelist)
├── vercel.json / .vercelignore
├── README.md / AGENTS.md / CHANGELOG.md / DESIGN.md
├── docs/               # SOP checklist rilis + arsip laporan audit/QA sekali-pakai
├── assets/             # Logo, icon, favicon, splash, region/provinces.json
└── js/
    ├── app.js          # Entry — wire window handlers, boot, profil UI, hook cloud
    ├── app-state.js    # State terpusat + setter (binding ESM read-only)
    ├── db.js           # Dexie ONLY (zero import)
    ├── utils.js        # fmt, toast, overlay, getSetting/setSetting, getDeviceInfo
    ├── router.js       # pushState SPA + deep link
    ├── nav.js          # showScreen, sticky bars, hook Pengaturan/diagnosa
    ├── pos.js          # Timbang, keranjang, pembayaran (tunai/transfer/tempo), nota
    ├── kategori.js     # Stok & kategori
    ├── kas.js          # Buka/tutup kas, catat kas 2-tab, pelunasan tempo atomik
    ├── laporan.js      # Laporan + periode + grafik + daftar tempo
    ├── riwayat.js      # Riwayat per-hari (akordeon, paging 10 hari, guard void/hapus)
    ├── dashboard.js    # Beranda & statistik
    ├── carousel.js     # Platform messages carousel
    ├── bantuan.js      # Halaman Bantuan — tab Tutorial (akordeon) + Changelog in-app (port kaki5)
    ├── onboard.js      # Emoji picker kategori (wizard onboarding sudah dihapus)
    ├── license.js      # Kuota + gate + chip + kartu lisensi (HMAC V1/V2 legacy admin)
    ├── license.sync.js # Kontrak Supabase: clients/products/settings, claim, pull/push
    ├── purchase.js     # Beli lisensi: QRIS/rekening, bukti, polling, realtime
    ├── settings-x.js   # Toggle fitur/metode bayar, PWA install, Diagnosa 10 langkah
    ├── printer.js      # Printer thermal BLE (chunking + persist)
    ├── backup.js       # Export/import + cadangan cloud (payload v3, validasi 3 lapis)
    ├── region.js       # Picker wilayah 4 level (emsifa API)
    ├── app-link.js     # Link situs aplikasi dari cloud (fallback lama)
    ├── version.js      # SUMBER VERSI TUNGGAL (APP_VERSION + CACHE_BUST)
    ├── version.json    # Sinyal rilis di server (cacheBust + notes) — tak pernah di-cache SW
    ├── update.js       # Overlay update paksa + refresh (port kaki5)
    ├── confirm.js      # Modal konfirmasi in-app showConfirm() (pengganti confirm() native)
    └── supabase-config.js  # URL+anon key (Edge Function / fallback, skip di dev host)
```

## 🔐 Security

- XSS prevention `escapeHtml()` di semua render input user; entity-map penuh di region picker. **Aturan template:** setiap interpolasi ke `innerHTML` WAJIB lewat `escapeHtml` di posisi teks — jangan menaruhnya di dalam atribut berpetik (escapeHtml tidak meng-escape kutip; audit 2026-09-14 mendapati 3 titik bolong di `pos.js` dan sudah ditutup + dibuktikan via PoC)
- Data transaksi 100% lokal (IndexedDB) — cloud hanya profil, lisensi, kuota, cadangan
- Lisensi: penerbitan & validasi berpusat di server/admin (Control Center). Kolom `products.salt` TIDAK lagi terbaca anon (dicabut 2026-09-14, defense-in-depth). ⚠️ Kalau mau rotasi salt: cabut dulu jalur fetch/verifikasi klien — setelah revoke, klien hanya punya konstanta fallback
- Anon key publik by design; akses `clients` per perangkat via RLS hybrid (`user_id` ATAU claim `unit_id` di JWT sesi anon) — terverifikasi: select anon mengembalikan `[]`
- Backup lokal: checksum HMAC device-bound (unitId+payload) — melindungi dari file korup/rusak & ubahan tak sengaja, BUKAN jaminan anti-pemalsuan teknis (kunci ikut ter-bundle di klien). Proteksi lintas-unit cadangan cloud = RLS bucket `backups` (privat, anon tak bisa list/GET)
- Bucket `bukti` public-read; nama file membawa suffix acak anti-enumerasi (`unitId_ts_rnd.jpg`) sejak audit 2026-09-14 — siapa pun dengan URL tetap bisa melihat, jangan bagikan URL bukti transfer
- Whitelist skema URL: bukti transfer, QRIS, dan app-link hanya `data:image|https` (M6 port + regex `app-link.js`)

## 🚢 Release & Deploy (ringkas — detail di AGENTS.md + docs/QA-RELEASE-CHECKLIST.md)

1. Ubah kode → **bump 4 slot sinkron** (`version.js` + `version.json` + `sw.js` + `?v=` index.html) + entri `CHANGELOG.md`
2. QA lokal (`node run-local.js`, bypass SW) → commit
3. Beta: `../push-beta.ps1` → mirror `mcfuryamen/kasol-beta` → Vercel auto-deploy `rosok-beta`
4. Live: HANYA atas perintah eksplisit pemilik → `../push-live.ps1` → mirror `kasol` → Vercel `rosok`
5. Verifikasi via domain publik (curl versi ke-4 slot + vendor content-type) — lihat checklist

## 📝 License

Copyright © 2026 PT Mesin Kasir Solo

## 🤝 Support

- WhatsApp: 0881-6566-935
- Email: owner.kasirsolo@gmail.com

---

**Versi:** 1.4.13 · **Last Updated:** 2026-09-14
