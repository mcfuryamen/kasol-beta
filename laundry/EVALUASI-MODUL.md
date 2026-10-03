# EVALUASI PER MODUL — Kasir Solo Laundry

> **Tanggal:** 2026-09-27 · **Objek:** `laundry/index (1).html` (1108 baris, single-file, vanilla JS, localStorage `ksldry_db_v1`)
> **Acuan ekosistem:** `CONTEXT.md` (standar resmi 2026-08-10 + keputusan strategis terbaru) & implementasi nyata `kaki5/` (referensi arsitektur app klien, diverifikasi 2026-09-27), plus pelajaran historis rosok/tpa/minimarket.
> **Tujuan:** gap analysis per modul sebagai dasar penyempurnaan agar menyesuaikan arsitektur ekosistem.

---

## Ringkasan Eksekutif

Draft laundry ini **sehat secara fitur bisnis** (alur order kiloan/satuan, status cucian 5 tahap, DP/piutang, stok, pembelian, pelanggan, laporan — lengkap dan masuk akal), tetapi **seluruh lapisan fondasi (lisensi, storage, keamanan, waktu, backup, PWA, cloud) masih pola "generasi lama"** yang sudah ditinggalkan ekosistem. Skor kesiapan:

| Modul | Kesiapan | Gap utama |
|---|---|---|
| 1. Lisensi & Trial | 🔴 1/10 | Serial forgeable (checksum+ salt hardcoded); model trial+share sudah dihapus ekosistem |
| 2. Storage/DB | 🔴 2/10 | localStorage JSON utuh; tanpa migrasi, tanpa transaksi atomik |
| 3. POS/Order Baru | 🟡 6/10 | Nomor urut tidak aman; tanpa gerbang kuota/shift; tanpa bukti non-tunai |
| 4. Antrian & Status | 🟢 7/10 | Desain bagus & unik; kurang deteksi keterlambatan + validasi transisi |
| 5. Layanan & Stok | 🟡 5/10 | Hapus tanpa konfirmasi; tanpa toggle aktif/nonaktif |
| 6. Pembelian | 🟡 5/10 | Hanya 1 item/transaksi; tanpa riwayat detail; pola baru di ekosistem |
| 7. Pelanggan & Supplier | 🟡 5/10 | CRUD dasar; tanpa riwayat order & piutang per pelanggan |
| 8. Laporan & Piutang | 🟡 5/10 | "Minggu" = rolling 7 hari; omzet accrual tanpa KPI kas masuk; tanpa filter custom |
| 9. Backup & Restore | 🔴 2/10 | JSON mentah tanpa validasi/signature/cloud — vektor XSS & overwrite |
| 10. Pengaturan/Profil | 🔴 3/10 | Tanpa profil emsifa, banner, auto-sync, kartu lisensi standar |
| 11. Keamanan | 🔴 1/10 | **Nol escapeHtml di semua innerHTML**; CSP tidak ada |
| 12. Waktu | 🔴 2/10 | `toISOString()` UTC → tanggal geser di WIB (bug fungsional) |
| 13. UI/UX & Navigasi | 🟡 6/10 | Sudah mirip design system; belum kontrak z-index, gate, bantuan 3 tab |
| 14. PWA/Offline/Update | 🔴 0/10 | Tidak ada manifest/SW/ikon/update overlay |
| 15. Sync/Cloud | 🔴 0/10 | Murni lokal; tanpa identitas/RLS/clients |

---

## ✅ STATUS EKSEKUSI P0 — TUNTAS 2026-09-28

Semua item P0 sudah dieksekusi di `index (1).html` (single-file, DB dinaikkan ke `ksldry_db_v2` dengan migrasi otomatis dari v1) dan terverifikasi:

| # | Item P0 | Implementasi | Bukti QA |
|---|---|---|---|
| 1 | **escapeHtml penuh + restore aman** | `escapeHtml` (full-map `& < > " '`) diterapkan di SELURUH render data user (POS, keranjang, order, layanan, pembelian, pelanggan, supplier, laporan, value form). Restore: payload v2 tanpa lisensi + validasi (struktur, id ketat `^[A-Za-z0-9_-]{1,48}$`, angka ≥0, tanggal valid, status whitelist) + konfirmasi in-app + whitelist key + rebuild nomor counter. | XSS nama produk & catatan tampil **literal** tanpa eksekusi; backup ber-lisensi/id nakal **ditolak** |
| 2 | **Waktu lokal** | Helper `toMs/todayLocal/monthLocal/isSameLocalDay/addDaysLocalStr`; tanggal baru disimpan **epoch ms**; dashboard/laporan/filter pakai perbandingan lokal; data lama ISO (UTC) tetap kompatibel lewat `toMs`. | order `tanggalMasuk` number + `isSameLocalDay` benar di TZ Asia/Jakarta |
| 3 | **Lisensi baru** | Kuota GRATIS **100 transaksi/bulan** (rollover otomatis); serial `KSL-XXXX-XXXX-EE-SSSSSS` **HMAC-SHA256 device-bound** (SubtleCrypto + fallback murni JS, teruji identik dgn Node crypto); `deviceCode` beku sekali + `installId`; **smart gate 2 langkah** (WA divalidasi → modal S&K Batal/Setuju, tanpa checkbox); chip GRATIS/kuota di header; banner kuota habis (closable, blok transaksi saja); sheet 🎫 Kelola Lisensi (status, kuota, ID Perangkat, aktivasi, tombol WA). **Trial 7 hari + share +1 + serial checksum lama DIHAPUS.** | gate/QA: onboarding, aktivasi sukses, serial perangkat lain ditolak, kuota habis blok POS |
| 4 | **Nomor order aman** | `nextOrderNumber()`: `LD{yy}{mm}-{nnnn}` bulan lokal, pindai nomor max + counter bulanan → tahan restore/impor, tidak dobel. | nomor lanjut dari max & reset aman setelah restore |

**Alat generator lokal DIHAPUS (2026-09-28)** — lisensi langsung terhubung ke Supabase (lihat bagian di bawah).

**QA total: 92 uji lulus** — 47 unit (SHA-256/HMAC murni = Node crypto, serial, kuota, validasi backup, waktu, escape) + 38 browser Playwright (gate, order, XSS, aktivasi, kuota habis, restore, tanpa page error) + 7 generator E2E. Port dev: **8088** (app klien berikutnya; 8087 sudah dipakai TPA — `python -m http.server 8087 --directory kasol\tpa`). Skrip QA tersimpan di `tmp/` (`test-pure.mjs`, `qa-browser.mjs`, `qa-generator.mjs`, `serve.mjs`).

---

## ✅ LISENSI TERPUSAT SUPABASE — TUNTAS 2026-09-28

Perintah pemilik: *"file generator lisensi udah ga dipake — di ekosistem kasol, lisensi langsung terhubung ke supabase."* Generator lokal dihapus; aplikasi laundry kini **terhubung ke sistem lisensi terpusat** yang sama dengan kaki5/rosok.

### Yang dikerjakan

| Bagian | Detail |
|---|---|
| **Aset klien cloud** | `js/supabase.min.js` (vendor @supabase/supabase-js 2.112.2, identik kaki5) + `js/supabase-config.js` (URL + anon key, dev pakai fallback, produksi `fetch /api/supabase-config`) + `api/supabase-config.js` (serverless, fallback identik). |
| **Identitas** | `deviceCode` beku sekali (XXXX-XXXX) + `installId`; **`unitId = KSL-<deviceCode>`** immutable; RPC `device_known` untuk klaim kepemilikan baris; auth anonim Supabase (`signInAnonymously` + claim `unit_id`). |
| **Serial** | Format & HMAC **diselaraskan penuh dengan `control/js/license-core.js`**: alfabet base32 `23456789ABCDEFGHJKLMNPQRSTUVWXYZ`, pesan `salt + deviceCode(8) + exp`, format `KSL-XXXX-XXXX-EE-SSSSSS`. Terverifikasi dua arah (serial Control diterima laundry, serial laundry diterima Control). Salt dari `products.salt` (KSL = `KASIRSOLO-LAUNDRY-HMAC-V2`) dengan fallback lokal — `SELECT salt` sengaja tidak terbuka untuk anon. |
| **Sinkron lisensi** | Boot & berkala (60 dtk + event online/visible): pull status cloud → `aktif` (verifikasi serial, hormati `license_expires_at`) · `menunggu_verifikasi` (chip/banner "menunggu verifikasi") · `batal/nonaktif/revoked` (kunci transaksi + banner dicabut) · `belum`/kosong (turunkan aktif→GRATIS, aturan T12, **bukan** revoke). Error jaringan **tidak pernah** mengubah state lokal. |
| **Kuota cloud** | Kuota efektif = `products.tx_quota` (100) + `clients.tx_adjust`; pemakaian lokal direkonsiliasi adu-max dengan `clients.tx_used`/`tx_month` dan **ditulis balik** saat bertambah. Admin bisa reset/extend dari Control. |
| **Profil** | `ensureSyncedProfile`: insert baris `clients` saat onboarding selesai (nama usaha/WA/alamat), backfill-only untuk push otomatis, `force` hanya dari form Pengaturan (jalur user-intent). |
| **Pembelian** | Sheet "🛒 Beli Lisensi": harga dari `products`, QRIS (`settings.qris_url`) + info bank (`settings.bank_info`), upload bukti ke bucket **`bukti`** (`KSL-…_<ts>_<rnd8>.jpg`), update baris `clients` (status/bukti_url/nama_pembayar) → polling 30 dtk (maks 60×) → aktif otomatis setelah admin verifikasi. |
| **Aktivasi manual & jalur WA-dijual DIHAPUS** | Mengikuti keputusan ekosistem 2026-09-14: tidak ada input serial manual di klien; semua lewat pembelian → verifikasi admin di Control. Serial tetap divalidasi klien saat ditarik dari cloud. |

### Data Supabase yang disiapkan (additive)

Baris produk baru di `products`: `app_type='laundry'`, `kode_produk='KSL'`, name "Kasir Laundry", `tx_quota=100`, `salt='KASIRSOLO-LAUNDRY-HMAC-V2'`, `visible=true`, `status='development'`, `price_label='Rp 500.000'`.

### QA (semua lulus)

- **53 unit** — SHA-256/HMAC murni = Node crypto, skema serial Control, kuota cloud (+tx_adjust), revoked, validasi backup, waktu, escape.
- **11 kompatibilitas** — `license-core` Control ⇄ laundry dua arah (lifetime & bulanan, kasus negatif salt/device/prefix).
- **37 browser lokal** — onboarding, order, XSS literal, sheet lisensi tanpa input serial, kuota habis, restore.
- **24 CLOUD E2E (Supabase nyata)** — baris `clients` ter-insert otomatis, admin aktifkan → app menarik & aktif, `tx_adjust 50 → kuota 150`, `tx_used 7` diadopsi, cabut → revoked+blokir, aktif ulang, "belum"→GRATIS (T12), menunggu verifikasi, pembelian (QRIS tampil, bukti terunggah, `nama_pembayar` tersimpan), verifikasi admin → aktif. **Data uji dibersihkan otomatis** (0 residu terverifikasi).

### Catatan & saran berikutnya

- **Control perlu 1 entri** di `control/js/clients.js` → `APP_META` (`laundry: { prefix:'KSL' }`) agar tombol Aktivasi/Cabut Lisensi di UI Control bekerja untuk laundry. Belum dieksekusi (menyentuh app produksi lain — menunggu keputusan pemilik). Sementara ini aktivasi bisa lewat SQL/edge function (`activate-license` juga butuh `SALT_BY_APP` entri baru).
- Serial lama (skema draft, alfabet beda) tidak kompatibel — sudah tidak relevan karena generator lokal dihapus.
- File `index (1).html` masih single-file + folder `js/` vendor; restrukturisasi ESM penuh = P1.
- Temuan lain (belum dieksekusi): halaman *Layanan & Stok* belum punya tombol "+ Tambah" (tambah layanan hanya via panggilan internal `openProdukForm()`); konfirmasi hapus produk; toggle `aktif` produk; **teks S&K pasal 3 masih menyebut "aktifkan lisensi dengan kode resmi" — alur kini beli QRIS/transfer di aplikasi, teks perlu disesuaikan.**

---

## ✅ MODUL LISENSI KAKI5 DIADOPSI — TUNTAS 2026-09-29

Perintah pemilik: *"adopsi modul lisensi dari aplikasi kaki5."* Implementasi inline (buatan tahap P0/P1 sendiri) **diganti penuh** oleh modul kaki5 yang benar-benar diadopsi + lapisan shim adaptasi.

### Struktur baru (multi-modul di `js/`)
- **Modul disalin dari kaki5** (konstanta & label diadaptasi ke laundry): `license.js` (barrel), `license.logic.js`, `license.ui.js`, `license.sync.js`, `quota.offline.js`, `purchase.js`, `helpers.pure.js`.
- **Shim adaptasi laundry**: `db.js` (getSetting/setSetting → DB.settings untuk kunci profil + store terpisah `ksldry_license_settings_v1` untuk kunci teknis; migrasi SEKALI dari DB.license v2), `helpers.js` (escapeHtml/showToast varian warna), `modal.js` (openModal/closeModal → class `open` pada `#lockOverlay` / `#sheetLicense` / `#sheetPurchase`), `version.js`, `settings.js` (loadSettings), `sync.js` (ensureAuthSession / ensureSynced / pullCloudProfileTo).
- **Bootstrap** `js/laundry-license.js`: migrasi → wiring refs ala kaki5 → delegasi `data-action` (open-purchase-sheet, check-license-status, buy-gate, trigger-bukti-input **dua fase**, handle-bukti-upload) → boot sequence standar (ensureUnitId → reanchorUnitId → syncLicenseStatus → verifyAndAssignSerial → ensureSynced → checkLicenseGate → realtime + interval 60 dtk) → `window.LicenseAPI` untuk POS & QA.
- **index.html**: blok lisensi inline lama (±570 baris) dihapus; menyisakan gate onboarding 2 langkah (WA → S&K), gerbang kuota POS async (`canCreateTx`/`bumpTx`), jembatan `window.LaundryCore`, DOM modul (`#lockOverlay` + `#lockRevokedPage`, `#sheetLicense` + `#licenseSheetBody`, `#sheetPurchase` + `#purchaseSheetBody`, `#licenseInfoCard`) + CSS kompat (kelas k-text/kfs/kfw, stepper lisensi, badge, sheet/modal overlay, toast varian warna).
- Vendor cloud: `js/supabase.min.js` (2.112.2) + `js/supabase-config.js` + `api/supabase-config.js`.

### Fitur ekosistem yang IKUT masuk (sebelumnya belum ada di laundry)
1. **Jatah offline anti-bocor** (`quota.offline`): meta tersegel HMAC; offline ≥30 hari DAN (≥300 trx ATAU usia ≥3 bulan) → terkunci sampai check-in online.
2. **Clock guard** (`getEffectiveNow`/`bumpClockAnchor`, toleransi 2 hari) — anti-rollback jam.
3. **Re-anchor unitId** (konvergensi kanonik + pagar anti-osilasi + blokir profil-tidak-cocok) dan **verifyAndAssignSerial** (RPC `device_assign`).
4. **Realtime** `subscribeToLicenseUpdates` (channel `license:<unitId>`) + polling 30 dtk pada alur pembelian.
5. **Rate limit** (sync 30/mnt, kirim bukti 3/mnt) + pelaporan `sync_errors`.
6. **UI standar kaki5**: stepper 4 tahap (Gratis → Beli → Proses → Aktif), kartu status trial/aktif/dicabut/menunggu, halaman "Licenti Dicabut" penuh, lockOverlay, banner kuota + ID Perangkat, chip "LISENSI ✓ Aktif" / "GRATIS n trx".

### Adaptasi kritis
- **Identitas beku lintas-skema**: migrasi menulis `deviceIdentity {deviceCode lama, fpVersion:'KSL-IMPORT'}` + `unitId 'KSL-<kode>'`; `getDeviceIdentity` diberi guard agar kode hasil migrasi TIDAK pernah dikonvergensi ke fingerprint V5 kaki5 — unitId & baris cloud perangkat pemilik tetap (teruji: `8VGG-7RVZ` bertahan lintas boot & terlihat di kartu).
- Skema serial tetap selaras `license-core` Control (diuji dua arah di 28 uji modul).
- **Revoke TIDAK dipulihkan oleh cloud `belum`** (desain ekosistem: admin harus mengaktifkan ulang) — perilaku ini terkonfirmasi saat QA.

### QA (semua lulus)
- **28 uji modul** (Node): migrasi + identitas beku, kompatibilitas Control dua arah, kuota trial, clock guard, jatah offline (3 ambang), aktivasi/revoke/clear.
- **26 uji browser lokal**: onboarding gate, POS + kuota modul, XSS, sheet lisensi modul, kuota habis → banner + blok POS, restore.
- **27 cloud E2E (Supabase nyata)**: baris `clients` otomatis (WA & nama usaha tersinkron), aktivasi admin → app aktif, `tx_adjust 50 → kuota 150`, `tx_used 7` diadopsi, cabut → revoked + blok, kartu "Menunggu Verifikasi" (784 ms), pembelian QRIS + unggah bukti + verifikasi admin → aktif. Data uji dibersihkan (0 residu).
- Bukti visual live (in-app browser): chip `GRATIS · 99/100 trx` (pemakaian lama ikut termigrasi) + sheet Status Lisensi modul.

**Catatan**: QA lama pre-modul (`test-pure.mjs`, `test-license-compat.mjs`) diarsipkan ke `tmp/arsip-pre-modul/` (menguji kode inline yang sudah dihapus); suite aktif: `tmp/test-module.mjs`, `tmp/qa-browser.mjs`, `tmp/qa-cloud.mjs`. Control tetap butuh entri `APP_META` laundry→KSL (belum dieksekusi).

---

## ✅ PENYEMPURNAAN UI DARI UJI LIVE — 2026-09-28

Uji live penuh di browser sungguhan (in-app browser, port 8088, klik koordinat nyata) + 2 permintaan pemilik yang langsung dieksekusi dan terbukti visual:

1. **Tombol S&K proporsional** — "🔙 Batal" auto-size mengikuti label (95 px) + "✓ Setuju & Lanjut" mengisi sisa area (251 px); mengikuti pola standar tombol modal ekosistem (sekunder auto-size, aksi utama isi sisa).
2. **Bottom nav maksimal 5 tombol (pola rosok)** — `Beranda | Antrian | ＋ Order (tengah) | Laporan | Lainnya`; tombol tengah berupa tombol bulat gradien menonjol (border 4 px warna background + shadow, persis pola `.fab-wrap` rosok) yang membuka alur Order Baru lengkap dengan gerbang kuota.

**Bukti live (screenshot):** gate onboarding → S&K (tombol baru) → dashboard + nav 5 tombol → keranjang → **detail order LD2609-0001** (chip GRATIS 1/100, tanggal lokal 28 Sep 19.12, ETA +3 hari) → sheet Status Lisensi (ID Perangkat `8VGG-7RVZ`) → sheet pembelian **live dari Supabase** (harga Rp 500.000 + QRIS asli + rekening OCBC NISP).

**Catatan teknis uji live:** klik Playwright tidak lolos pemeriksaan fokus di pane in-app browser → dipakai jalur koordinat (CUA) seperti pengguna nyata; screenshot surface kadang timeout saat halaman sibuk (diulang dengan jeda).

---


---



### 1. Lisensi & Trial — 🔴

**Saat ini** (`index (1).html:501-548`):
- Trial 7 hari + "bagikan +1 hari trial (maks 20x)" — `shareApp()` menambah `shareCount` tanpa verifikasi apa pun.
- Serial `KSL-XXXX-XXXX-XXXX`; validasi `checksumBlock` = `simpleHash(LICENSE_SALT + b1 + b2)` dengan `LICENSE_SALT='KASIRSOLO-LAUNDRY-2026'` **hardcoded di file**. Siapa pun yang membuka DevTools bisa generate serial valid → **lisensi forgeable**, tidak bisa dijual.
- `isLicensed()` hanya cek flag `DB.license.status==='full'` di localStorage → bisa diedit manual.
- Lock screen sederhana; tidak ada S&K gate saat onboarding.

**Standar ekosistem (kaki5 aktual):**
- **Tier GRATIS = kuota transaksi/bulan kalender** (default 100; `currentTxMonth`, `getTxQuota`, `incrementTxCount`; admin reset via `tx_adjust`, rollover bulan) — bukan trial berbasis hari.
- Serial HMAC-SHA256 **device-bound**, salt dinamis dari tabel Supabase `products` (fallback `KASIRSOLO-{APP}-HMAC-V2`).
- **Lisensi terpusat** (sejak 2026-09-14): aktivasi manual & WA dihapus; pembelian satu jalur → sheet QRIS/transfer → upload bukti → diverifikasi admin di Control → polling/realtime `subscribeToLicenseUpdates`.
- **Jatah offline anti-bocor** (`quota.offline.js`): meta disegel HMAC; offline ≥30 hari DAN (trx ≥300 ATAU usia ≥3 bln) → terkunci sampai check-in online.
- **Smart gate 2-langkah**: Step 1 No. WhatsApp (validasi strict) → Step 2 modal S&K (Batal/Setuju); trial mulai di Step 2. `status: none/trial/active/expired/revoked`; overlay revoked + kartu lisensi dengan **ID Perangkat** di semua state.
- Prefix serial per produk: `KK5`/`KSR`/`GBK`/`RTL`.

**Gap:** total redesign. Fitur share +1 hari dihapus. Gate onboarding belum ada.

**Rekomendasi:** ikut model kuota transaksi + lisensi terpusat; prefix **`KSL`** (sudah dipakai draft ini & cocok dengan naming convention CONTEXT.md); salt `KASIRSOLO-LAUNDRY-HMAC-V2`; smart gate 2-langkah; kartu lisensi + ID perangkat (`unitId = KSL-<deviceCode>`).

---

### 2. Storage / Data — 🔴

**Saat ini** (`:399-426`): satu objek JSON di `localStorage` (`ksldry_db_v1`); `loadDB` = `Object.assign(defaultDB(), d)` (partial-migrate kasar); tanpa versi skema, tanpa migrasi, tanpa transaksi atomik, tanpa blocked-handler.

**Standar (kaki5):** Dexie/IndexedDB `KasirSoloKakiLima`, 8 tabel (`menu, penjualan, pengeluaran, pengaturan, settings, platformMessages, kasShift, tutupBuku`), migrasi **additif** + upgrade sekali, guard `db.on('blocked')` reload, helper `getSetting/setSetting`.

**Mapping skema laundry → Dexie (usulan):**

| Konsep laundry | Tabel Dexie (usulan) | Index |
|---|---|---|
| `settings` | `settings` (key-value) | — |
| `license` | `settings` (kv) | — |
| `products` | `menu` (+ `kategori`, `tipe: 'kiloan'\|'satuan'`, `durasiHari`, `aktif`, `stok`, `minStok`) | nama, kategori |
| `orders` | `pesanan` (noOrder, tanggalMasuk epoch, status, statusBayar, metode, totalKg, eta, catatan, items array, total, laba, tanggalSelesai) | tanggalMasuk, status, statusBayar |
| `purchases` | `pembelian` (+ `pembelianItem` bila multi-item) | tanggal |
| `customers` | `pelanggan` | nama |
| `suppliers` | `supplier` | nama |

**Gap:** migrasi dari localStorage (jika data lama ada) → Dexie; waktu simpan epoch ms (bukan ISO string).

**Rekomendasi:** tiru `js/db.js` + `helpers.pure.js`; buat migrasi v1 (localStorage → Dexie) 1x untuk draft ini; tabel transaksi pakai `++id` + `nomor` tersendiri (lihat modul 3).

---

### 3. POS / Order Baru — 🟡

**Saat ini** (`:582-754`): grid produk + pencarian + tab (Semua/Layanan/Produk); keranjang array; **input berat kg via modal** untuk kiloan (nilai desimal); qty control untuk satuan/produk; pilih/buat pelanggan inline; estimasi selesai; status bayar Lunas/DP/Belum; metode Tunai/Transfer/QRIS; catatan. Bagus: snapshot nama & harga item per order (aman terhadap perubahan produk).

**Masalah:**
- **Nomor order tidak aman** (`:716-720`): `LD{yy}{mm}-{orders.length+1}` — counter global tidak reset per bulan (bulan baru mulai dari angka lanjutan) & bisa duplikat bila data di-restore/impor ulang. Standar: `js/nomor.js` (nomor per jenis + `ensureNomorBackfill`, anti-bentrok).
- Tanpa **gerbang berantai** kuota lisensi → kas shift → stok (kaki5: `_simpanPenjualanCore`).
- Non-tunai tanpa **bukti transfer/QRIS wajib** (kaki5 `pos.ui.js:336-349`).
- Tidak ada order "Tahan" (held); validasi stok hanya saat add, bukan saat checkout (aman-ish, karena qty cek ulang di `addToCart`/`changeQty`, tapi stok bisa berubah antar dua penambahan — minor).
- Tidak ada tombol kembali ke grid setelah pesan modal total (UX minor).

**Rekomendasi:** port pola `pos.js` + `nomor.js`; pertahankan model **kiloan input-kg** (unik laundry, kaki5 tidak punya timbangan — `tipe:'kiloan'` di menu cukup, harga per kg). Tambah gerbang kuota/shift bila lisensi & kas shift diadopsi.

---

### 4. Antrian & Status Cucian — 🟢

**Saat ini** (`:756-834`): progress track 5 langkah (`diterima→dicuci→disetrika→siap→diambil`), badge warna per status & pembayaran, tab Aktif/Selesai/Semua, ubah status cepat, batalkan, update pembayaran, dashboard "Siap Diambil / Perlu Perhatian". **Ini keunggulan domain laundry yang tidak dimiliki kaki5** (kaki5 hanya status biner held/completed).

**Gap kecil:**
- Tanpa deteksi **keterlambatan** (ETA lewat & belum siap → badge/label khusus).
- Transisi status bebas (bisa lompat `diterima`→`diambil` tanpa tahap tengah) — keputusan desain, sah untuk fleksibilitas, tapi overdue tetap perlu.
- `tanggalSelesai` di-set saat `diambil` — bagus; pertimbangkan simpan juga `waktu` epoch saat tiap transisi (riwayat status) untuk laporan.

**Rekomendasi:** pertahankan; tambah overdue badge (eta < hari ini && status < siap) + riwayat timestamp per transisi (opsional).

---

### 5. Layanan & Stok — 🟡

**Saat ini** (`:836-910`): CRUD produk (kategori layanan kiloan/satuan dengan durasi hari & harga modal/jual; produk eceran dengan stok & min-stok); toggle field otomatis; daftar + pencarian + tab. **Masalah: hapus langsung tanpa konfirmasi** (`deleteProduk`), tanpa toggle `aktif` (produk yang sudah dipakai order lama tetap dirender di grid POS walau mau disembunyikan).

**Standar (kaki5):** `menu.js` CRUD + **toggle aktif/nonaktif** + kategori custom + validasi harga + **dialog konfirmasi** (`confirm.js`); grid POS hanya menampilkan menu `aktif`.

**Rekomendasi:** tambah field `aktif` (default 1) + toggle; konfirmasi sebelum hapus; refactor ke pola menu.js. Snapshot nama/harga di item order sudah benar (aman terhadap edit/hapus produk).

---

### 6. Pembelian / Restock — 🟡

**Saat ini** (`:915-952`): catat pembelian **1 item per transaksi** (pilih supplier + produk + qty + harga); update stok & HPP (`p.hargaBeli = harga` — HPP = harga pembelian terakhir, bukan rata-rata tertimbang); riwayat list sederhana.

**Standar:** **tidak ada** modul pembelian di kaki5 → pola baru di ekosistem (kaki5 cuma punya `purchase.js` = beli lisensi). Kontrak dasar CONTEXT.md: tabel `transaksi` + `transaksiItem` (multi-item, atomik).

**Rekomendasi:** jadikan multi-item (1 pembelian = N produk) + tanggal + catatan; update stok & HPP dalam satu transaksi Dexie; dokumentasikan metode HPP (kasih pilihan: terakhir vs rata-rata — rekomendasi: rata-rata tertimbang sederhana, atau pertahankan "terakhir" untuk kesederhanaan laundry kecil, konsisten saja).

---

### 7. Pelanggan & Supplier — 🟡

**Saat ini** (`:957-1019`): CRUD pelanggan (nama/telp/alamat) & supplier; pelanggan baru bisa dibuat inline saat checkout. **Masalah:** tidak ada **riwayat order per pelanggan**; tidak ada **piutang per pelanggan** (padahal DP/piutang sudah jadi fitur order); tidak ada pencarian supplier.

**Standar:** kaki5 **tidak punya** modul pelanggan konsumen → pola dari luar. Untuk laundry (piutang), modul pelanggan adalah nilai inti.

**Rekomendasi:** tampilkan di profil pelanggan: jumlah order, total belanja, **sisa piutang**, riwayat order (klik → detail). Filter/sort piutang per pelanggan di list.

---

### 8. Laporan & Piutang — 🟡

**Saat ini** (`:1024-1053`): tab Hari/Minggu/Bulan; KPI omzet/laba/kg/piutang; layanan terlaris; stok menipis. **Masalah konsep:**
- **Omzet = accrual** (`orders.reduce(total)` tanpa filter statusBayar) — termasuk yang belum bayar. Ini label yang menyesatkan; lebih tepat tambah KPI **"Diterima"** (pembayaran aktual per metode) supaya omzet vs kas masuk jelas.
- **"Minggu" = rolling 7 hari** (`diff<=7`), bukan kalender minggu (Senin–Minggu) seperti standar `getWeekRange` kaki5.
- Piutang (`lapPiutang`) dihitung **global** (tanpa filter periode) — justru benar untuk "piutang kini", tapi perlu label jelas.
- Tanpa filter **custom + kalender** (kaki5: `buildDayCalendar/buildMonthCal/buildCustomPicker`; pelajaran: validasi rentang sebelum tulis state), tanpa chart, tanpa porsi transaksi/metode.

**Rekomendasi:** port pola `laporan.js` (period + kalender custom + KPI + chart); untuk laundry tambah KPI kg/minggu & piutang aging sederhana (0–7, 8–30, >30 hari); definisikan omzet accrual vs kas masuk secara eksplisit.

---

### 9. Backup & Restore — 🔴

**Saat ini** (`:1070-1095`): `JSON.stringify(DB)` mentah → file; restore `Object.assign(defaultDB(), data)` **tanpa validasi apa pun** — vektor: (a) file asing menimpa total (insiden pemilik 2026-09-08), (b) nama produk jahat di file backup → XSS saat render (lihat modul 11), (c) settings/lisensi bisa diselundupkan.

**Standar (kaki5):** payload ber-version + **validasi 3 lapis** (struktur per tabel → field per row: tanggal `YYYY-MM-DD`, angka ≥0, id unik; **settings profil/lisensi dilarang masuk file cadangan** → HMAC signature) + **restore atomik** dalam satu `DB.transaction` (clear+bulkAdd) + cloud bucket `backups` keep 10 + `maybeOfferCloudRestore` + kartu "💾 Data & Cadangan" + **🩺 Diagnosa** (`sync.health.js`, 13 langkah).

**Rekomendasi:** port penuh `backup.js` (payload v1 laundry + signature HMAC + validasi 3 lapis + cloud); konfirmasi sebelum restore; QA restore hanya di origin isolasi 127.0.0.1 (pelajaran insiden).

---

### 10. Pengaturan / Profil Usaha — 🔴

**Saat ini** (`:1058-1069`): nama toko/alamat/WA plain + kartu lisensi inline + backup + tentang.

**Standar (kaki5):** profil **terstruktur Provinsi→Kota→Kecamatan→Desa** (API emsifa + fallback lokal + cache) → **auto-sync ke `clients`** (`ensureSynced` wajib di tiap save profil) → **banner "Lengkapi Profil"** (center-immersive z-520; muncul saat `!namaPemilik || !noWhatsapp || (!kabkota && !alamat)`); header baris-1 = **nama usaha dinamis**; kartu "🎫 Kelola Lisensi" satu tombol; "🩺 Diagnosa" di Data & Cadangan; Pengaturan ramping.

**Rekomendasi:** port profil emsifa (`region.js`) + banner + auto-sync; tambah Nama Pemilik; header nama usaha dinamis (`applyHeaderBizName`).

---

### 11. Keamanan — 🔴 (PRIORITAS TERTINGGI)

**Saat ini:** **tidak ada `escapeHtml` sama sekali**. Semua data user dirender mentah via innerHTML: nama produk (grid POS, list layanan, cart), nama pelanggan (`orderRowHTML`, checkout), `catatan` (detail order), nama supplier, dll (`:594-598, 655-669, 773-777, 801, 847-848, 922-923, 963-966, 994-996`). Pelajaran ekosistem: di rosok vektor serupa (nama kategori → keranjang/nota) **terbukti eksekusi XSS** dan difix `841ca35`; kaki5 aman karena `escapeHtml` **full-map 5 karakter** (`& < > " '`) + `buildSafeHtml` + `escapeAttr`.

**Rekomendasi (WAJIB sebelum produksi):** `escapeHtml` di setiap interpolasi string user; bila port ke arsitektur modular: adopsi **CSP `script-src 'self'` + dispatcher `data-action`** (konsekuensi: semua `onclick` inline dibungkam — yang sekarang dipakai massal di draft ini). Restore file backup juga harus melewati validasi (modul 9) agar bukan saluran XSS.

---

### 12. Waktu / Timezone — 🔴

**Saat ini** (`:400-401`): `nowISO()`/`todayStr()` pakai `new Date().toISOString()` — **UTC**. Antara pukul 00.00–07.00 WIB, "hari ini" adalah kemarin → omzet dashboard, laporan hari, dan filter salah. Tanggal disimpan sebagai string ISO.

**Standar (kaki5):** `todayStr()` lokal manual (bukan `toISOString`); DB pakai **epoch ms** (`helpers.pure.js`); **anti-rollback jam** `getEffectiveNow`/`bumpClockAnchor` (CLOCK_TOLERANCE 2 hari) untuk integritas kuota/jatah.

**Rekomendasi:** `todayLocal()`/`monthLocal()` (pola tpa), epoch ms, dan clock-guard saat port lisensi kuota.

---

### 13. UI/UX & Navigasi — 🟡

**Saat ini:** header gradien + bottom nav + sheet + modal + toast sudah mirip design system (warna & radius konsisten). `navStack` sederhana. Inline `onclick` (valid selama tanpa CSP). Trial chip di header.

**Standar (kaki5/CONTEXT.md):** **kontrak z-index** `header 100 < bottom-nav 350 < gate 500 < banner profil 520 < modal 600 < confirm 610 < toast 620 < sheet 640 < #updateOverlay 800`; smart gate 2 langkah; banner profil; PWA install deteksi; bantuan **3 tab** (Tutorial/Video/S&K) dengan isi akurat berdasar kode nyata + changelog (pemicu baris "Versi…" di Tentang); header nama usaha dinamis; toast konsisten (kaki5: `window.showToast` + throttle).

**Rekomendasi:** terapkan kontrak z-index; chip trial → chip **GRATIS/kuota**; port bantuan 3 tab + changelog; header baris-1 nama usaha.

---

### 14. PWA / Offline / Update — 🔴 (belum ada)

**Saat ini:** tidak ada manifest, ikon, service worker, mekanisme update. App offline by desain (localStorage) tapi **tidak bisa di-install** dan **tidak pernah ter-update otomatis**.

**Standar (kaki5):** manifest + ikon (home **full-bleed persegi**; splash = `background_color` solid + ikon — aturan pemilik: ikon wajib preview & accuan visual, flood-fill "buang cincin" ditolak); `sw.js` **tanpa `skipWaiting` otomatis** + terima pesan `SKIP_WAITING`, HTML cache-first, aset statis cache-first `ignoreSearch` + precache `cache:'reload'`, `version.json` network-only; **5 titik sinkron** rilis (`APP_VERSION`, `cacheBust`, `CACHE_NAME`, `?v=`, `notes`); overlay force-update **OKE-satunya penutup** (jangan auto-dismiss konvergensi; aturan final 2026-09-15); deteksi install (`display-mode`/standalone/iOS + flag) + panduan manual + mesin state idle→installing→installed.

**Rekomendasi:** port lengkap pola `pwa.js`/`update.js`/`sw.js`/`version.js` — bagian wajib agar "menyesuaikan arsitektur ekosistem".

---

### 15. Sync / Cloud — 🔴 (belum ada)

**Saat ini:** murni lokal.

**Standar (kaki5):** cloud = **lisensi + profil + backup** (data transaksi tetap lokal — klausul S&K); identitas `fingerprint → deriveDeviceCode (beku V5) → unitId`, `install_id`; anon JWT + RLS baris sendiri (`clients` keyed `unit_id`); `ensureSynced` backfill-only (push otomatis tidak menimpa cloud; `force` hanya dari form profil); `pullCloudProfileIfOnline` di boot sebelum render; retry loop 5 menit; `supabase-config.js` publik + fallback `/api/supabase-config`; **boot sequence** standar.

**Rekomendasi:** port boot sequence + identitas + sync klien; `app_type='laundry'`, `unitId='KSL-<deviceCode>'`; modul bantuan video dari cloud (`products.tutorials`) bila perlu.

---

## Peta Prioritas Penyempurnaan

**P0 — fondasi (jangan rilis sebelum ini):**
1. `escapeHtml` full-map di semua interpolasi (+ eskort validasi restore) — keamanan.
2. Waktu lokal (`todayLocal`/epoch ms).
3. Lisensi baru: kuota transaksi + HMAC device-bound + lisensi terpusat (hapus share +1) + smart gate 2 langkah.
4. Nomor order aman (`nomor.js` pola).

**P1 — paritas ekosistem:**
5. Dexie/migrasi + restruktur modul ESM (`js/*.js` + shell) + CSP + dispatcher `data-action`.
6. Backup v5 pola (validasi 3 lapis + signature + cloud + Diagnosa).
7. Profil emsifa + banner + sync `clients` + boot sequence.
8. PWA (manifest/ikon/SW/update overlay OKE-only, 5-titik versi).
9. Bantuan 3 tab + changelog + kontrak z-index + header nama usaha dinamis.

**P2 — penyempurnaan domain laundry (pola baru ekosistem):**
10. Gerbang kas shift + held order + bukti non-tunai.
11. Pelanggan: riwayat order + piutang per pelanggan + aging.
12. Laporan: kalender custom + KPI omzet/terima/piutang + chart.
13. Pembelian multi-item atomik.
14. Overdue badge + riwayat transisi status.

---

## Catatan Arsitektur yang Wajib Ditiru (dari kaki5)

- **Boot sequence** `app.js:1235-1357`: `ensureUnitId` → `reanchorUnitId` → `runLicenseSync` → `verifyBootLicenseAssignment` → `pullCloudProfileIfOnline` → `applyHeaderBizName` → `ensureSynced` → `ensureNomorBackfill` → `refreshShiftCache` → `loadBeranda` → wait settings (race 8s) → `checkProfileNotification` → `setupPWA` → `subscribeToLicenseUpdates` → retry loop → `maybeOfferCloudRestore` → `startUpdateWatcher`.
- **Dispatcher `data-action`** (CSP): semua interaktivitas via delegasi + wire-map lazy ke `window`; try/catch tunggal + toast "Aksi gagal"; `HARD_GATE_OVERLAYS` tak bisa ditutup backdrop.
- **Release 5 titik** & CHANGELOG.md manual per rilis.
- Aturan rilis: default commit + BETA; LIVE wajib perintah eksplisit pemilik per rilis; jangan improve di luar permintaan.

*Dokumen evaluasi — 2026-09-27 — dasar penyempurnaan laundry ke arsitektur ekosistem.*