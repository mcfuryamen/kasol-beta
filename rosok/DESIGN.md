# DESIGN — Kasir Solo - Rosok

Arsitektur, model data, dan kontrak sinkronisasi cloud. Dokumen referensi
teknik; untuk konvensi kerja agen lihat `AGENTS.md`, riwayat perubahan lihat
`CHANGELOG.md`. (2026-09-04, selaras v1.4.0 / sw v54.)

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
| RPC `device_assign` | aktivasi kode manual ONLINE | p_serial + profil + unit/device/install baru | penolakan `profile-mismatch` → `#mismatchLock`; `serial-not-found` → blokir (cloud harus kenal); offline → lewati, HMAC lokal |

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
- `txLastPushAt`: pemisah "tulisan cloud = admin/instance lain" vs echo push sendiri.
- Rate limit: aktivasi manual 5/menit (klien); sync penuh throttle 5 mnt; refresh
  kuota 15 mnt; polling beli 30s×60.

### 3.5 Garam serial — satu sumber
`products.salt` (dikelola UI Produk admin) → env Vercel (`LICENSE_SALT_ROSOK`/
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
- **Chip header**: `GRATIS · N trx` (oranye ≤10 / "Kuota habis") atau `PRO ✓ Aktif`;
  klik → `sheetLicense` (kartu + kode manual + WA/email).
- **Kartu lisensi Pengaturan** (`renderLicenseInfoCard`, dirender gate): progress
  bar kuota, badge status, ⏳ menunggu verifikasi, tombol Beli (sheet purchase).

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
- **Diagnosa 10 langkah** (`settings-x.js`): skrip→config→internet→client→identitas→
  sesi→klaim→baris server→uji sync penuh (push+readback)→riwayat error; kartu
  ringkasan ok/warn/fail + "Salin Hasil" (kirim ke admin).

---

## 6. Testing & verifikasi

- Syntax: `cp js/x.js /tmp/x.mjs && node --check /tmp/x.mjs` (ESM).
- Sweep handler & referensi: grep `onclick=` vs `window.`; grep nama fungsi yang
  dihapus/diganti (satu sisa import = modul mati).
- Runtime: `node run-local.js` (8084) + `curl` endpoint; `file://` tidak didukung.
- Cloud: sheet Diagnosa (UI) atau `curl` PostgREST dengan anon key (select `clients`
  milik unit harus lolos RLS hybrid).

---

*DESIGN.md — Kasir Rosok · 2026-09-04*
