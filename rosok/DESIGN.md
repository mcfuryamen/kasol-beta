# DESIGN — Kasir Solo - Rosok

Arsitektur, model data, dan kontrak sinkronisasi cloud. Dokumen referensi
teknik; untuk konvensi kerja agen lihat `AGENTS.md`, riwayat perubahan lihat
`CHANGELOG.md`, SOP bump & verifikasi rilis lihat
`docs/QA-RELEASE-CHECKLIST.md`. (2026-09-14, selaras v1.4.13 / sw v74.)

---

## 1. Arsitektur

### 1.1 Prinsip
- **Offline-first mutlak.** Semua jalur tulis selesai di IndexedDB sebelum ack UI;
  cloud selalu best-effort (try/catch sendiri, gagal = data lokal tetap sah).
- **Vanilla ESM tanpa build step.** Modul dimuat browser langsung (`type="module"`);
  tidak ada bundler, transpiler, atau package runtime (hanya dev `run-local.js`).
- **State satu arah.** `app-state.js` = satu-satunya modul state (zero import);
  modul fitur mengimpor binding read-only + setter. UI bereaksi via event
  `window` (`ksr-satuan-changed`, `ksr-kas-changed`) — bukan re-render framework.
- **Jembatan window.** HTML statis memakai handler global; tiap modul mengekspos
  fungsinya ke `window` di akhir file. `app.js` = entry yang mengimpor semua modul
  (efek samping registrasi) + `initApp()`.

### 1.2 Graf dependensi modul (arah import)
```
                    db.js  (zero import)
                      ↑
                 app-state.js (hanya db)
                      ↑
        utils.js (db, app-state) ←──────────────┐
          ↑        ↑        ↑                   │
  license.sync ──→ license ←→ laporan/riwayat   │
     ↑  ↑  ↑         ↑      (circular aman:     │
     │  │  │         │        pemakaian runtime) │
 purchase backup settings-x app-link             │
          ↑         ↑      ↑                     │
          └──── nav.js ────┴── pos/kas/kategori/dashboard/carousel/onboard/region
                         ↑
                      app.js (entry; mengimpor SEMUA; mengisi window bridge + refs)
```
- `license.js ⇄ license.sync.js` dipecah lewat **parameter `licenseStateApi`**
  (`getLicense`, `saveLicense`, `currentTxMonth`, `getDeviceCode`, `bumpClockAnchor`)
  yang dioper `checkLicenseGate` → `syncLicenseStatusThrottled` — tanpa circular.
- Refs UI (`setLicenseRefs`, `setPosRefs`, `setRiwayatRefs`) diisi `app.js` saat boot.

### 1.3 Urutan boot (`initApp`, event `load`)
1. `cacheDomElements` → ID perangkat (`deviceId` → `deviceCode` HMAC-like base36)
2. `loadSettingsIntoState()` — isi `SETTINGS` + field Pengaturan + header
3. `updateAboutInfo()` (versi + ID perangkat + link situs dinamis via `app-link.js`)
4. `initRegionPicker()` → `_regionState` awal · `loadPayOptions()` · `initPwaInstall()` · `restorePrinterStatus()`
5. listener `online` → kirim `profileSyncPending` yang tertunda
6. realtime lisensi: `subscribeToLicenseUpdates(ensureUnitId())` (dynamic import `purchase.js`)
7. seed kategori & platformMessages → `loadKategori()` → `refreshAll()`
8. `checkLicenseGate()` (awaited): refresh kuota → `syncLicenseStatusThrottled`
   (claim → pull profil → adopsi/downgrade lisensi → reconcile kuota) → chip/kartu/banner
9. `markReady()` → router resolve route awal → `showScreen()` (hook profil & Pengaturan)
10. interval `checkLicenseGate` 60 dtk

Gagal di langkah mana pun = try/catch sendiri, boot lanjut (pola kaki5).

---

## 2. Model data lokal (Dexie `KasirSoloRosokDB` v5)

| Tabel | Kunci | Indeks | Isi penting |
|-------|-------|--------|-------------|
| `settings` | `key` | — | profil usaha (`bizName`,`ownerName`,`bizPhone`,`bizProvinsi*`,`alamatDetail`), `deviceId/deviceCode/unitId`, `license` (objek status), `trialConfig`, `payOptions`, `syncState`, `profileSyncPending`, `clockAnchor`, `txLastPushAt`, `licenseSync`, `lastCloudBackupAt`, `purchaseStatus` |
| `kategori` | `++id` | nama, aktif | nama, emoji, hargaBeli/Jual, stokKg |
| `transaksi` | `++id` | tipe, tanggal | beli/jual, total, metode, dibayarkan, sisa, void, `buktiBayar`(dataURL), `catatanBayar` |
| `transaksiItem` | `++id` | transaksiId, kategoriId | kategoriNama, berat, hargaSatuan, subtotal |
| `kas` | `++id` | tanggal, tipe, **refTransaksiId** | masuk/keluar + relasi transaksi (void/hapus) |
| `kasShift` | `++id` | status, waktuBuka | modalAwal, buka/tutup kas |
| `platformMessages` | `++id` | order, visibleFrom/Until | carousel beranda |
| `tutupBuku` | `++id` | tahun | kunci pembukuan tahunan |

**Objek lisensi** (`settings.license`): `{status:'trial'|'active', txMonth, txUsed,
txAdjust, deviceCode}` atau `{status:'active', startedAt, serial, expCode|expiryDate,
expiryLabel, source:'cloud'?}`. Migrasi sekali dari skema trial-waktu lama.

### 2.1 Identitas perangkat lintas-browser (v1.4.1→v1.4.2, port kaki5 V3/T14 + penyempurnaan V4)

```
fingerprint = b32(SHA256('KSR-FP-V4|cores|ram|touch|WxH'), 12)   # getDeviceFingerprint
deviceCode  = XXXX-XXXX dari simpleHash('DEVICE-' + fingerprint)  # SAMA lintas browser satu perangkat
installId   = 'DEV-<random>' — penanda instalasi (tracking), BUKAN dasar deviceCode
unitId      = 'KSR-' + deviceCode — kanonik; instalasi lama di-RE-ANCHOR ke nilai ini
settings.deviceIdentity = { installId, deviceCode, fingerprint, legacyDeviceCode }
settings.unitReanchor   = { from, to, at, adopted? }              # jejak migrasi
```

- **V4 membuang `platform`** (pelajaran audit 2026-09-04): sinyal itu satu-satunya
  yang bocor antar engine — Chrome/Samsung/WebView `Linux armv8l` vs Firefox
  `Android` pada hardware identik — sementara sumbangan entropinya nol. Canvas/
  WebGL/timezone/DPR tetap diexclude (alasan historis V3/T14 kaki5).
- **Batas jujur:** unifikasi berlaku antar engine yang mengekspos sinyal sama
  (Chrome-family & WebView Android; iOS Safari↔CriOS). deviceMemory tidak ada di
  beberapa engine → '' (konsisten dalam satu engine, beda antar engine bisa
  terjadi). Dan fingerprint TIDAK unik antar perangkat: sesama tipe HP dengan
  RAM/core/layar identik → deviceCode identik (risiko tabrakan — lihat guard).
- **Re-anchor unit_id** (`reanchorUnitId`, boot, sebelum subscribe realtime &
  sync): instalasi lama (unit turunan deviceId acak / V3) dikonvergensikan ke
  kanonik — PATCH baris milik sendiri; duplicate → adopsi lokal (hybrid RLS
  claim memberi akses). DILAKUKAN HANYA bila tidak terikat serial aktif
  (aturan kaki5: unit terikat serial hanya boleh pindah via `device_assign`).
  Fallback adopsi di `syncLicenseStatus`: not-found by unit → query by
  device_code → adopt unit cloud (jangan pernah self-insert baris kembar).
- **Guard tabrakan identitas:** adopsi lisensi cloud (blok (A) &
  `persistCloudLicense`) mensyaratkan `cloudProfileMatchesLocal` — baris kosong
  profil boleh diadopsi; baris terisi harus cocok `nama_usaha`/`no_whatsapp`.
- **Data transaksi TETAP per-browser** (hukum sandbox IndexedDB; kaki5 sama —
  tidak ada auto-restore diam-diam). Jembatan = cadangan cloud, kini dengan
  **penawaran otomatis**: boot DB kosong + lisensi aktif + ada cadangan →
  `#sheetRestoreOffer` (maks 1×/hari, `settings.restoreOfferAt`).
- **Signature backup** terikat unitId; pasca-re-anchor verifikasi mencoba ulang
  dengan `unitReanchor.from` agar file lama tidak yatim.
- Boot: `initApp` langkah 1 = `getDeviceIdentity()` → `reanchorUnitId()` →
  `setSetting('deviceCode')` — semua pembaca sinkron (`getDeviceIdForLicense`,
  About block, purchase, path cadangan) melihat hasil final.

---

## 3. Kontrak Cloud (Supabase `hhywrvedlwljawgxzpkq`, shared lintas app via `app_type='rosok'`)

### 3.1 Aturan dasar (pemilik, 2026-09-04)
> **Cloud = sumber kebenaran mutlak untuk profil & lisensi.** User update →
> dikirim; begitu sampai cloud, cloud yang menimpa perangkat lain.

### 3.2 Arah TULIS (rosok → cloud)

| Target | Kapan | Isi | Catatan |
|--------|-------|-----|---------|
| `clients` (update/insert by `unit_id`+`app_type`) | Simpan Identitas (`pushProfile`); diagnosa "uji sync penuh" | profil penuh + `device_code`,`install_id`,`last_seen`,`browser`,`os`,`device_type`,`user_agent` | insert bila baris belum ada (bukan update 0-baris diam); seed `source='app-rosok'`/`status='baru'` HANYA saat status kosong; **readback** wajib |
| `clients.tx_month/tx_used/tx_updated_at` | reconcile `syncLicenseStatus` (boot + 5 mnt) | penghitung kuota bulan berjalan | push hanya bila lokal > cloud; tidak pernah menimpa tulisan admin (`txLastPushAt` + toleransi 5 dtk) |
| `clients.status='menunggu_verifikasi'` + `bukti_url` | submit beli lisensi | setelah upload bukti | + `updated_at` |
| Storage `bukti/<unitId>_<ts>.jpg` | submit beli | foto bukti transfer lisensi | bucket privat, URL publik |
| Storage `backups/<unitId>/cadangan-latest.json` | Cadangan Cloud (khusus lisensi aktif) | payload v3 tanpa signature | upsert; LIST policy tertutup → tidak ada retensi multi-file |
| `sync_errors` (insert) | tiap kegagalan sync nyata | stage, error, UA | lokal juga: `settings.syncState.recentErrors` (maks 5) |
| RPC `device_known` | sebelum baca/tulis `clients` | klaim `user_id` baris ke sesi anon aktif | idempoten, toleran 23505 |
| RPC `device_assign` | assignment lisensi oleh ADMIN di Control Center | p_serial + profil + unit/device/install baru | jalur "aktivasi kode manual" DI APLIKASI SUDAH DIHAPUS (1.4.12, lisensi terpusat) — RPC tetap dipakai sisi admin; penolakan `profile-mismatch` → `#mismatchLock` |

**Sesi**: `ensureSession()` = `signInAnonymously({data:{unit_id}})` +
`updateUser` bila claim beda — RLS "clients hybrid": `auth.uid()=user_id` ATAU
claim `unit_id` JWT. Anon key publik by design; `isPlaceholderKey` pola kaki5
(tolak `***`/`...`/`PASTE`/`xxxx`/tanpa titik — JANGAN tolak prefix `eyJ`).

### 3.3 Arah BACA (cloud → rosok)

| Sumber | Kapan | Perlakuan |
|--------|-------|-----------|
| `clients` baris unit ini (`readClientRow`) | `syncLicenseStatus` (boot + throttle 5 mnt); `pullCloudProfile` (buka Pengaturan) | **lisensi**: `'aktif'`+serial → adopsi (`persistCloudLicense`/saveLicense); `'belum'`/`''`/`batal`/`nonaktif` + lokal active → **downgrade zombie** ke trial ber-marker. **profil**: non-NULL menimpa lokal termasuk `''`; NULL = jangan sentuh. **kuota**: `tx_adjust` selalu ikut cloud; `tx_used` max(lokal,cloud); `tx_month` null + cloud lebih baru = reset admin |
| `products` (`kode_produk='KSR'`, `app_type='rosok'`) | refresh kuota ≤15 mnt; salt sekali/sesi; harga & link saat perlu | `tx_quota` → `settings.trialConfig` (cache offline); `salt` → validasi V2 (fallback env tak terlihat klien → konstanta); `price_label`,`price_before_label`,`visible`,`store_url`,`vercel_url` |
| `settings` | beli lisensi; app-link | `qris_url {url}`, `bank_info {bank,account_number,account_name}`, `app_links {rosok:url}` |
| Realtime `postgres_changes` UPDATE `clients` filter `unit_id=eq.<unitId>` | channel `license:<unitId>` sejak boot | `license_status` → `'aktif'` adopsi + toast; `'batal'/'nonaktif'` → reset trial |
| Polling `getCloudLicenseStatus` | 30 dtk × 60 pasca-submit beli | aktif → `persistCloudLicense` + gate |

### 3.4 Flag & proteksi state
- `profileSyncPending`: dipasang `pushProfile` di awal, dilepas setelah cloud
  konfirmasi (tulis + readback). Selama terpasang, `applyCloudProfile` skip —
  editan lokal yang belum sampai cloud tidak pernah tertimpa pull.
- `clockAnchor`: waktu tertinggi yang pernah dilihat; jam mundur >2 hari → pakai
  anchor (efek ke rollover kuota & kedaluwarsa lisensi).
- `txLastPushAt`: pemisah "tulisan cloud = control/instance lain" vs echo push sendiri.
- Rate limit: sync penuh throttle 5 mnt; refresh kuota 15 mnt; polling beli 30s×60.
  (Batas "aktivasi manual 5/menit" ikut mati bersama hilangnya jalur manual 1.4.12.)

### 3.5 Garam serial — satu sumber
`products.salt` (dikelola UI Produk Control Center) → env Vercel (`LICENSE_SALT_ROSOK`/
`LICENSE_SALTS`) → konstanta `KASIRSOLO-ROSOK-HMAC-V2`. Konsumen yang WAJIB sama:
klien `fetchProductSalt` (validasi V2), `/api/license` (generate/verify admin),
edge functions `generate-license` & `activate-license`. Rotasi = isi `products.salt`
lalu deploy ulang ketiganya; selama kolom kosong, semua jatuh ke nilai identik.

---

## 4. Model lisensi & gate

- **Tier gratis** = kuota transaksi selesai per bulan kalender. `incrementTxCount()`
  hanya setelah transaksi tersimpan (gagal catat ≠ gagal jual). Lisensi aktif tidak
  dibatasi.
- **Gate** (`checkLicenseGate`): status `expired` (kuota habis ATAU lisensi berbayar
  kedaluwarsa) → `#quotaBanner` closable per sesi + `saveTransaksi` blokir (toast +
  sheet lisensi). Semua layar lain tetap bisa dieksplor — TIDAK ada lock penuh
  (pengecualian: `#mismatchLock` saat cloud menolak profil).
- **TERPUSAT di Control Center (1.4.12):** satu-satunya jalur lisensi di aplikasi =
  Beli Lisensi (`sheetPurchase`: QRIS/rekening live + upload bukti →
  `menunggu_verifikasi` → verifikasi admin → adopsi via realtime/polling). Kolom
  kode manual & tombol WA lisensi DIHAPUS dari klien; validasi HMAC V1/V2 hanya
  tersisa sebagai warisan jalur admin. Guard berbayar WAJIB menjawab dengan CTA:
  terkunci → toast + langsung buka sheet Beli (`ab2dd62`), dan `openPurchaseSheet`
  membuka overlay SEBELUM fetch (placeholder) supaya klik terasa hidup.
- **Chip header**: `GRATIS · N trx` (oranye ≤10 / "Kuota habis") atau `PRO ✓ Aktif`;
  klik → `sheetLicense`.
- **Kartu lisensi Pengaturan** (`renderLicenseInfoCard`, dirender gate): stepper
  1 Gratis → 2 Beli → 3 Proses → 4 Aktif, progress bar kuota **hijau solid**
  (tanpa gradasi — selera pemilik 2026-09-14), keterangan bonus admin, tombol
  Refresh Status saat aktif (`refreshLicenseStatus`: toast periksa → await gate →
  toast dimuat).
- **Penguncian cadangan cloud:** `cloudCtx()` MENGAWALI `await isLicensed()`
  (bug `51a7748`: tanpa await, Promise truthy → pengunci tidak pernah aktif);
  guard dua arah QA = wajib dites tanpa-lisensi DAN ber-lisensi.

---

## 5. UI/UX kunci

- **Filter laporan sticky**: `#screenLaporanFilter` `position:sticky; top:0` +
  `margin-top:-(safe-top+82)` + `padding-top:(safe-top+78)` — tepi atas kartu sampai
  tepi atas header, menyelip di bawahnya (z 49 < 50), tanpa celah bocor; valid per
  breakpoint karena selisih padding `main` ikut tersembunyi.
- **Profil alamat**: satu kotak readonly (komposisi detail+desa→provinsi) → sheet
  `#sheetAlamat` dengan rantai picker emsifa 4 level; kerja di salinan temp
  (Batal tidak mengubah apa pun); persistensi tetap lewat "Simpan Identitas".
- **Transfer**: nominal pas total, input tunai/preset disembunyikan, foto bukti
  wajib (resize maks 900px q0.72 → dataURL di transaksi), tampil di detail riwayat.
- **Pelunasan tempo via form Catat Kas** (port flow kaki5 1.4.12): tombol Lunasi di
  daftar tempo/detail nota → `openKasForm` prefill (tab masuk/keluar sesuai arah,
  kategori "Pelunasan Utang/Piutang", keterangan otomatis, jumlah = sisa); state
  `_lunasiId` dilepas saat pindah tab (objek pindah); simpan = SATU `db.transaction`
  (kas dengan `refTransaksiId` TANPA flag manual + update `dibayarkan`/`sisa`
  clamped); Transfer tidak menggeser laci. Sheet `sheetLunasi` khusus DIHAPUS.
- **Diagnosa 10 langkah** (`settings-x.js`, Pengaturan → Perangkat → 🩺 Diagnosa —
  label lama "Cek Data Online" diganti 1.4.12): skrip→config→internet→client→identitas→
  sesi→klaim→baris server→uji sync penuh (push+readback)→riwayat error; kartu
  ringkasan ok/warn/fail + "Salin Hasil" (kirim ke admin).
- **Susunan blok Pengaturan** (1.4.12+): 👤 Profil Usaha · ⚙️ Fitur Aplikasi (toggle
  metode bayar dll.) · 📱 Perangkat (printer BLE, PWA, Diagnosa) · 💾 Data & Cadangan
  (di ATAS Lisensi) · 🔑 Lisensi Aplikasi · Tentang Aplikasi (paling akhir; nomor WA
  di sini hanya kontak dukungan).
- **Riwayat transaksi per-hari** (`riwayat.js`, port pola kaki5): header tanggal
  akordeon oranye (📅 + hari/tanggal + neto berwarna + N trx), hari terbaru auto-open,
  paging 10 HARI/halaman, guard anti race render ganda (`_renderSeq` cek sebelum &
  setelah await DB); item → sheet Nota detail (whitelist `data:image|https` utk bukti).
- **Detail shift kas** (`kas.js showKasShiftDetail` → `#sheetShiftDetail`): baris
  riwayat buka/tutup kas clickable (badge Berjalan/Tutup + 'Detail ›' + catatan
  italic + selisih berwarna); isi = durasi, modal awal, kas masuk/keluar + jumlah
  transaksi (hitung ulang `hitungRingkasanShift`), kas sistem resmi vs recalculated
  (beda → baris oranye "Hitung ulang dari data", jangan tutupi divergensi), fisik,
  selisih, catatan tutup, hint saat shift masih buka. `waktuTutup` rosok = ISO string
  (berbeda kaki5 epoch ms).
- **Toast** (`utils.js toast(msg)` + elemen `#toast` DI `index.html`): satu elemen
  global, `textContent` (bukan innerHTML), class `show` ±2,2 dtk, last-wins tanpa
  antrean (panggil berurutan dengan await di antaranya = pola loading-toast sah).
  Styling di selector **class** `.toast` — elemen WAJIB `class="toast" id="toast"
  role="status" aria-live="polite" aria-atomic="true"` (paritas kaki5; bug 1.4.13:
  class hilang → tidak ada CSS match → toast tak pernah tampil, dan QA lama lolos
  karena hanya membaca textContent). `pointer-events:none` permanen di rosok
  (toast-nya non-interaktif) — JANGAN port ke kaki5: toast kaki5 bisa berisi
  tombol `.toast-action` yang membutuhkan `auto`.
- **Grafik laporan ala kaki5** (`laporan.js`): harian = kolom per jam DIPANGKAS ke
  rentang aktif ±1 (tanpa data → empty state, bukan 24 stub); bulanan & custom
  >14 hari = pengelompokan minggu kalender M1..Mn (bucket `from/to`); bar
  `--chart-h` 120px HP / 160px desktop, tinggi integer, bar nol = 0px, label
  nilai 'k', subtitle konteks, tooltip rupiah penuh; date picker auto-tutup saat
  klik di luar `#screenLaporanFilter`.
- **Dialog = modal in-app, bukan native**: `showConfirm()` (`js/confirm.js`,
  Promise + antrean) untuk semua konfirmasi destruktif; `#mismatchLock`,
  `#updateOverlay`, `#sheetRestoreOffer` pola `.lock-overlay`/center-overlay.
  `confirm/alert/prompt` native DILARANG (webview tertanam bisa mengembalikan
  nilai bohong — insiden 2026-09-05).
- **Halaman Bantuan** (`bantuan.js`, port kaki5 2026-09-14): layar ke-6 tanpa slot
  bottom-nav — dibuka dari 📖 header / deep link `/bantuan`; 2 tab sticky
  (`top:calc(var(--safe-top)+72px)` menempel di bawah header, tinggi normal)
  Tutorial|Changelog; akordeon TUTORIALS auto-close; `CHANGELOGS` in-file (entri
  baru paling atas tiap bump — slot-5 konvensi rilis), chip TERPASANG mengikuti
  `APP_VERSION` (import langsung `version.js`, bukan `window.APP_VERSION` ala kaki5).
  Label tutorial WAJIB 1-satu dengan UI asli — ubah label, sesuaikan teks.
- **Overlay update rilis** (`js/update.js` + `version.js`/`version.json`): cek
  event-driven (boot+3 dtk, foreground, online); cacheBust beda → `#updateOverlay`
  (hanya bisa OKE) → force SW-update + reload → boot penuh = reanchor+pull+push
  tersinkron paksa. `version.json` di-bypass SW dari cache.

---

## 6. Testing & verifikasi

- Syntax: `cp js/x.js /tmp/x.mjs && node --check /tmp/x.mjs` (ESM).
- Sweep handler & referensi: grep `onclick=` vs `window.`; grep nama fungsi yang
  dihapus/diganti (satu sisa import = modul mati).
- Runtime: `node run-local.js` (8084) + `curl` endpoint; `file://` tidak didukung.
- Cloud: sheet Diagnosa (UI) atau `curl` PostgREST dengan anon key (select `clients`
  milik unit harus lolos RLS hybrid).
- **UI = ukur, jangan percaya state DOM saja.** Pelajaran bug toast 1.4.13:
  assertion `textContent`/`classList` LULUS padahal elemen tidak pernah terlihat.
  Verifikasi visual wajib cek `getComputedStyle` (position/opacity) +
  `getBoundingClientRect` on-viewport; guard berbayar dites DUA ARAH; selector CSS
  yang tidak dipakai markup = dead code yang menipu grep.
- **SW cache bisa menyembunyikan perubahan lokal**: saat QA di 8084, unregister
  SW + reload dulu (lalu biarkan app mendaftarkannya kembali).
- **Anti-drift versi**: pasca-bump, keempat slot harus angka sama — termasuk
  `js/version.js` yang paling sering terlupa (pelajaran beta v73: `version.json`
  naik ke v73 tapi `version.js` tinggal v72 → overlay "versi baru" palsu muncul
  ke semua klien beta). Bandingkan `curl <deploy>/js/version.js` vs
  `curl <deploy>/js/version.json`.

---

*DESIGN.md — Kasir Rosok · 2026-09-14*
