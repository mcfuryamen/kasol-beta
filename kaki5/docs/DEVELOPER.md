# Developer Guide — kaki5 (Kasir Solo Kaki Lima)

Panduan mendalam untuk yang **mengubah kode** `kaki5`.
Versi acuan: **v167 / 1.0.99 (2026-09-04)**. Setiap klaim disertai `file:baris`.

Baca juga: [`../AGENTS.md`](../AGENTS.md) (aturan singkat untuk agen AI),
[`../README.md`](../README.md) (fitur & cara menjalankan),
[`REGRESSION-CHECKLIST.md`](REGRESSION-CHECKLIST.md) (daftar periksa sebelum rilis),
[`../../CONTEXT.md`](../../CONTEXT.md) (standar ekosistem — atasan dokumen ini).

---

## 1. Arsitektur & Boot

### Model aplikasi

SPA vanilla ES modules, tanpa framework, tanpa build step. `index.html` hanya memuat:

```html
<meta http-equiv="Content-Security-Policy" ...>   <!-- index.html:16, script-src 'self' -->
<script src="dexie.min.js"></script>              <!-- :32  global Dexie -->
<script src="js/dev-unregister-sw.js"></script>   <!-- :34  lepas SW saat dev -->
<script type="module" src="js/app.js?v=166"></script>  <!-- :999 entry -->
<script src="js/supabase.min.js"></script>        <!-- :1000 vendor -->
<script src="js/supabase-config.js"></script>     <!-- :1001 global config -->
```

Konsekuensi: **`db.js` memakai global `Dexie`**, bukan impor npm. Harness QA berdiri
sendiri yang lupa `<script src="dexie.min.js">` akan gagal dengan
`Dexie is not defined` dan gejalanya menipu (`kas.refreshShiftCache is not a function`).

### Urutan boot nyata — `js/app.js:1135-1246`

```
boot()
 ├─ ensureUnitId()                        :1136   ID perangkat stabil
 ├─ FASE 1 — cloud lebih dulu (aturan pemilik, CONTEXT.md:91)
 │    runLicenseSync()                    :1145   status lisensi dari cloud
 │    verifyBootLicenseAssignment()       :1151
 │    pullCloudProfileIfOnline()          :1158   cloud = kebenaran profil
 │    ensureSynced()                      :1168   push backfill-only
 ├─ FASE 2 — render
 │    ensureNomorBackfill()               :1176   penomoran TRX/MSK/BLJ
 │    refreshShiftCache()                 :1180   status shift kas terbuka
 │    loadBeranda()                       :1182
 │    modal S&K (tcAcceptedAt)            :1189   non-blocking
 ├─ FASE 3
 │    startSyncRetryLoop()                :1212   retry tiap 5 menit
 │    Promise.race(_settingsReady, 8 dtk) :1216-1225  + toast error bila timeout
 │    setupPWA()                          :1235
 │    subscribeToLicenseUpdates()         :1243   Realtime channel
 initRouter()                             :1267
 startUpdateWatcher()                     :1274   delay 3 dtk + visibilitychange + online
 window.APP_VERSION / #appVersionLabel    :1285-1290
```

> **Yang berubah dari dokumen lama:** tidak ada lagi `checkOnboarding()` — file
> `js/onboarding.js` **tidak ada** di repo dan gerbang onboarding 2-langkah dihapus
> 2026-08-29. Yang tersisa hanya modal S&K sekali-jalan non-blocking
> (`js/app.js:245-253`).

### State global — `js/app-state.js`

Satu-satunya pemegang state modul. Binding diekspor **read-only**; mutasi wajib lewat
setter (`app-state.js:76`). Modul fitur tidak boleh menulis properti objek state langsung.

---

## 2. Event Delegation & `data-action`

**Aturan keras:** `index.html` memuat **0** atribut `onclick`/`onchange`/`oninput`.
CSP `script-src 'self'` (`index.html:16`) menolak script inline, jadi inline handler tidak
hanya dilarang — ia memang tidak akan jalan.

Semua interaksi memakai atribut `data-action="nama-aksi"` yang dikirim ke satu dispatcher:

```js
async function handleDataAction(action, el, event) { /* js/app.js:330-948 */ }
```

Empat listener delegasi di `document`:

| Event | Listener | Panggil dispatcher | Alasan ada |
|---|---|---|---|
| `click` | `app.js:953` | `:974` | utama; sekalian menutup backdrop/modal (`:962-969`) |
| `keydown` Enter/Space | `app.js:982` | `:992` | aksesibilitas; elemen native dilewati (`:990`) |
| `input` | `app.js:1004` | `:1002` | `data-action` pada `<input>` tidak pernah memicu `click` |
| `change` | `app.js:1005` | `:1002` | `<select>`, `<input type=file>`, dan **saklar** |

`#lockOverlay` dikecualikan dari perilaku tutup-klik (`app.js:959,963`) karena revoke
admin harus tetap terkunci.

**Menambah aksi baru = dua tempat wajib:** atribut `data-action` di HTML/render JS, dan
`case '...'` di `handleDataAction`. `test-data-actions.js` menjaga pasangan ini
(lihat §10 dan baseline merahnya).

---

## 3. Peta Modul (`js/` — 45 file)

### Lapis murni (tanpa DOM, tanpa DB) — paling aman diuji tanpa browser

| File | Isi | Bukti |
|---|---|---|
| `helpers.pure.js` | `todayStr:37`, `formatRp:42`, `getWeekRange:79`, `getMonthRange:88`, `validatePhone:195`, `formatPhoneDisplay:225`, rate limiter `:186`, logika keranjang & validasi penjualan, kalkulasi laporan | dibaca langsung |
| `pos.logic.js` | harga efektif, topping, harga ojol, total baris | `:1` |
| `kas.logic.js` | `TIPE_PEMASUKAN:21`, `KATEGORI_NON_LABA:70` = `['Modal Tambahan','Setor Bank / Prive']`, `hitungLaba:127`, `hitungKasSistem:155`, `rinciDompetDigital:178`, `hitungSelisih:223`, `durasiStr:229`, `rekapTahun:253` | `:1` |
| `version.js` | `APP_VERSION:7`, `APP_VERSION_LABEL:11`, `CACHE_BUST:18` | — |
| `templates.js` | `initPage` / `cleanupPage` | `:1` |
| `region.js` | `getKabupaten:54`, `getKecamatan:55`, `getDesa:56`, `setupRegionPicker({provSel,kabSel,kecSel,desaSel,state}):74` | — |

> **Koreksi dokumen lama:** `todayStr`, `formatRp`, `getWeekRange`, `getMonthRange`,
> `validatePhone`, `formatPhoneDisplay` tinggal di **`helpers.pure.js`**, bukan
> `helpers.js`. `helpers.js` hanya DOM/toast/loading (`escapeHtml`, `buildSafeHtml`,
> `showToast`, `showLoading`, `withPageLoading`, `getDeviceInfo`, `trapFocus`,
> `setupModalFocusTrap`) lalu **`export * from './helpers.pure.js'`** (`helpers.js:118`).
> Nama API wilayah juga sudah berganti: `initRegionModal` / `getRegencies` /
> `getDistricts` / `getVillages` **tidak ada** lagi.

### Infrastruktur

| File | Peran |
|---|---|
| `db.js` (189 baris) | Dexie v1..v8, `db.on('blocked'):14-23`, `getSetting:178`, `setSetting:183`, `export const DB = db:189` |
| `app-state.js` | state terpusat + setter |
| `modal.js` | `openModal`/`closeModal`/focus trap + `registerModalSelector` (`app.js:40` memuat `tcModal`) |
| `confirm.js` | `showConfirm` / `closeConfirm` |
| `navigation.js` | router hash, `initRouter` / `navigateTo` |
| `nomor.js` | `NOMOR_PREFIX:11` = `{penjualan:'TRX', pemasukan:'MSK', pengeluaran:'BLJ'}`, `nextNomor:29`, `backfillNomor:48`, `ensureNomorBackfill:82`; format `PREFIX-YYYYMMDD-NNN` |

### Domain 3-layer + facade

| Domain | Facade/coordinator | logic | ui | sync |
|---|---|---|---|---|
| Settings | `settings.js` (43 baris) | `settings.logic.js` | `settings.ui.js` | `settings.sync.js` |
| License | `license.js` (56 baris) | `license.logic.js` | `license.ui.js` | `license.sync.js` |
| POS | `pos.js` (694 baris) | `pos.logic.js` | `pos.ui.js` | `pos.sync.js` |

Facade hanya berisi `export { ... } from './x.logic.js'` dan seterusnya. **Inilah sumber
jebakan v166** — lihat §4.

### Modul fitur / halaman

`beranda.js`, `menu.js`, `laporan.js`, `pengeluaran.js`, `bantuan.js`, `kas.js`,
`trxdetail.js`, `expensedetail.js`, `printer.js`, `carousel.js`, `pwa.js`, `update.js`,
`backup.js`.

### Modul cloud

`sync.js`, `sync.health.js`, `app-link.js`, `purchase.js`, `supabase-config.js`,
`api/supabase-config.js`.

### Non-ESM

`supabase-config.js` (mengisi global `KASIRSOLO_SUPABASE_URL` / `_ANON_KEY`),
`dev-unregister-sw.js`, `supabase.min.js`, `dexie.min.js` (root).

### Siklus impor nyata (sengaja, jangan "diperbaiki" tanpa paham)

- `license.logic.js ↔ license.sync.js` — siklus dua arah sungguhan.
- `sync.js → license.js → license.sync.js → sync.js` — siklus tiga simpul lewat facade.
- `navigation.js → settings.ui.js → sync.js` — bukan siklus, tapi membuat `sync.js`
  dimuat lebih awal dari yang terlihat.

Aman karena semua pemakaian lewat **pemanggilan fungsi** (TDZ-safe), bukan konstanta
top-level. Ini juga alasan `test-modules.js` menguji **real ESM import**, bukan hanya
`node --check`.

---

## 4. State, Facade & Wire-Map — Jebakan v166

`app.js` membuat fungsi modul bisa dipanggil dari HTML dengan menyalinnya ke `window`
lewat **wire-map per domain**:

| Konstanta | Baris | Modul yang di-`import()` | Baris import | Guard |
|---|---|---|---|---|
| `_posWireMap` | 56 | `pos.js` | 69 | 72 |
| `_berandaWireMap` | 62 | `beranda.js` | 78 | 81 |
| `_kasWireMap` | 66 | `kas.js` | 88 | 91 |
| `_menuWireMap` | 57 | `menu.js` | 98 | 101 |
| `_laporanWireMap` | 58 | `laporan.js` | 108 | 111 |
| `_settingsWireMap` | 59 | **`settings.js` (facade)** | 118 | **121** |
| `_bantuanWireMap` | 60 | `bantuan.js` | 129 | 132 |
| `_pengeluaranWireMap` | 61 | `pengeluaran.js` | 139 | 142 |

Total **92 nama global** di-wire lewat peta ini. Pola bakunya identik di 8 blok:

```js
for (const [key, modKey] of Object.entries(_xWireMap))
  if (modKey !== '__wired' && m[modKey] !== undefined) window[key] = m[modKey];
//  ^ guard di app.js:72,81,91,101,111,121,132,142 — lalu __wired = true
```

**Kunci peta = nama global di `window`; nilai = nama export di modul target.**
Kalau modul target tidak mengekspor nama itu, guard **lolos diam-diam tanpa error** dan
`window[key]` tetap `undefined`.

### Studi kasus nyata (v166)

Saklar "Buka / Tutup Kas" tidak berfungsi sama sekali, tanpa satu pun pesan error:

1. `saveFiturKas` ditambahkan ke `_settingsWireMap` (`app.js:59`) dan ke `case
   'save-fitur-kas'` (`app.js:737`).
2. `app.js:118` mengimpor **`./settings.js`** (facade), **bukan** `settings.ui.js`.
3. `settings.js` tidak me-re-export `saveFiturKas` → guard `app.js:121` melewatinya
   diam-diam → `window.saveFiturKas` `undefined` → saklar mati.
4. Harness QA saat itu **lolos** karena mengimpor `settings.ui.js` langsung.

**Perbaikan:** `saveFiturKas` masuk daftar re-export (`js/settings.js:38`).

**Aturan yang harus dipegang:** setiap nama di `_*WireMap` wajib ada di set ekspor modul
yang benar-benar di-import `app.js` — termasuk yang hanya lewat re-export facade.
Pengecualian sah: `_laporanWireMap` memetakan dua kunci ke satu export
(`setReportPeriod: 'setReportPeriodUI'` dan `setReportPeriodUI: 'setReportPeriodUI'`) agar
tab laporan dini tetap jalan (`app.js:184-190`). `_kasWireMap` sengaja **tidak** memuat 4
fungsi "catat kas manual" lama karena fiturnya dihapus di v164 (`app.js:63-65`).

Semua modul di-*import* **eager** saat `app.js` dimuat — komentar "Lazy-loaded" di
`app.js:42` sudah tidak sesuai perilaku.

---

## 5. Database (Dexie / IndexedDB)

Nama DB `KasirSoloKakiLima` (`db.js:6`). Versi tertinggi **v8**. Blok
`db.version(N).stores({...})` di `db.js:26,35,44,56,69,83,101,137`.

| v | Perubahan |
|---|---|
| 1 | `menu`, `penjualan`, `pengeluaran`, `pengaturan` |
| 2 | + `settings:'key'` |
| 3 | + `platformMessages:'++id, order, visibleFrom, visibleUntil'` |
| 4 | = v3 |
| 5 | index `suplayer` di `menu` |
| 6 | index `status` di `penjualan` |
| 7 | + `kasShift:'++id, status, tanggalBuka, waktuBuka'`, `kas:'++id, tanggal, tipe, shiftId'`, `tutupBuku:'++id, tahun'` |
| 8 | `pengeluaran` + index `jenis, metodeBayar` **dan `.upgrade()`** migrasi `kas` → `pengeluaran` |

**Migrasi v8** (`db.js:147-174`): tiap baris `kas` jadi catatan — `tipe:'masuk'` →
kategori `Modal Tambahan` + `jenis:'pemasukan'`; `tipe:'keluar'` → `Setor Bank / Prive`;
`metodeBayar:'tunai'`; penanda `sumber:'migrasi-kas-v164'` (`:168`); `jumlah<=0` dilewati
(`:155`); diakhiri `kasTabel.clear()` (`:172`). Tabel `kas` **tidak di-drop**
(`db.js:124-127`). Helper `tanggalDariMs` (`db.js:131-135`).

**Aturan:** migrasi selalu aditif. Jangan pernah menghapus tabel/kolom — pengguna lama
harus bisa membuka DB-nya. `test-db-migrations.js` menjaga versi berurutan, tabel tidak
hilang, dan index tidak menyusut.

**Catatan praktis**
- Index Dexie tidak bisa memuat boolean → `getActiveMenus()` menyaring di JS
  (`pos.js:343-349`).
- `pengaturan` legacy: tidak dibaca kode, hanya dibersihkan di `confirmClearAll`
  (`backup.js:374-380`).
- `db.on('blocked')` me-reload halaman sekali via `sessionStorage['ksr:db-blocked-reload']`.
- Di harness, `DB` **bukan** global: `const DB = (await import('./js/db.js')).DB`.

### Isi `settings` (key-value) — dibaca/ditulis via `getSetting`/`setSetting`

| Kunci | Default | Dibaca | Ditulis |
|---|---|---|---|
| `fiturKas` | `'1'` (ON) | `kas.js:48` (segar tiap transaksi), `settings.ui.js:40` (tampilan), `settings.ui.js:143` (keputusan saklar) | `settings.ui.js:173` |
| `payOptTunai` / `payOptQris` / `payOptTransfer` | `'1'` | `pos.js:388-390`, `settings.ui.js:39-40` | `settings.ui.js:107-109` |
| `tcAcceptedAt` | `null` | `app.js:1189` | `app.js:249` (ISO) |
| `namaUsaha` | `''` | `beranda.js:15`, `printer.js:358,378`, `settings.logic.js:82`, `sync.js:142`, `license.sync.js:508` | `settings.logic.js:76,87` |
| `namaWarung` *(legacy)* | `'Warung Saya'` | `beranda.js:16`, `printer.js:359,379`, `sync.js:142,233` | — (alias baca saja) |
| `namaPemilik` / `noWhatsapp` / `alamat` | `''` | `settings.logic.js:92-93,99`, `sync.js:143-148`, `license.sync.js:511-515` | `settings.logic.js:56,60,64` |
| `provinsiId`,`provinsi`,`kabkotaId`,`kabkota`,`kecamatanId`,`kecamatan`,`desaId`,`desa` | `''` | `settings.logic.js:19-22,95-98`, `settings.ui.js:281-288`, `sync.js:144-148` | `settings.logic.js:65-72` |
| `kategoriCustom` / `suplayerCustom` | `[]` | `menu.js:346,355,370,385,500,518,520` | `menu.js:503,522` |
| `sync` (objek `{status,syncedAt,verifiedAt,recentErrors,lastError,lastStage,lastTryAt}`) | `{status:'none'}` | `sync.js:110`, `settings.logic.js:94` | `sync.js:123,221,308,318` |
| `deviceInfo` | — | — | `sync.js:175` |
| `unitId` | `null` | `license.logic.js:423` | `license.logic.js:434,439`, `sync.js:448` |
| `installId` / `deviceIdentity` | `null` / `{}` | `license.logic.js:129,128` | `license.logic.js:132,136` |
| `license` | `null` | `license.logic.js:268` | `license.logic.js:274,296` |
| `trialConfig` | `null` | `license.logic.js:32` | `license.sync.js:156` |
| `clockAnchor` | `0` | `license.logic.js:213,220` | `license.logic.js:222` |
| `txLastPushAt` | `0` | `license.sync.js:367` | `license.sync.js:392` |
| `licenseSync` | — | — | `license.sync.js:460` (`LICENSE_SYNC_KEY:12`) |
| `nomorBackfill:v1` | — | `nomor.js:85` | `nomor.js:87` |
| 12 kunci profil hasil mapping cloud | — | `sync.js:361-374` | `sync.js:387` |

> **Koreksi dokumen lama:** `setupDone`, `licenseActivatedAt`, dan `deviceCode` **tidak
> ada** di kode.

### `localStorage` / `sessionStorage` (bukan `settings`)

`kaki5-cart` & `kaki5-cart-held-id` (`pos.sync.js:9,13`) · `kasirsolo:order-note`
(`pos.ui.js:636`, `app.js:379`) · `kasirsolo:order-type` (`app.js:1192`, `pos.js:654`) ·
`kasirsolo:ojol-platform` (`pos.ui.js:290`) · `kasirsolo:pay-method` (`pos.ui.js:333`) ·
`kasirsolo:pwa-installed` (`pwa.js:32,72,137,194`) · `printer_bluetooth_state`
(`printer.js:16`) · `kasirsolo:kaki5:license` (`license.logic.js:252`) ·
`ksr:update-reloading` / `ksr:update-acked-version` (`update.js:20-21`) ·
`ksr:db-blocked-reload` (`db.js:17-18`).

---

## 6. Lisensi & Kuota

Model lama "trial 7 hari + perpanjangan" **sudah dihapus**. Yang ada sekarang:

- Tier gratis = **kuota transaksi per bulan kalender**. `DEFAULT_TX_QUOTA = 100`
  (`license.logic.js:20`), `currentTxMonth:23`, `getTxQuota:30` (cache `trialConfig:32`),
  `incrementTxCount:32` dipanggil dari `pos.sync.js:92,181`.
- Angka kuota diambil dari cloud: `products.tx_quota` (`license.sync.js:147`),
  penyesuaian per perangkat `clients.tx_adjust`.
- `getLicenseStatus()` (`license.logic.js:380`) mengembalikan
  `{ status, deviceCode, txRemaining, txQuota, txUsed }` dengan
  `status ∈ none | trial | active | expired | revoked`.
  **Tidak ada lagi** `daysLeft`, `expiry`, `extensions`, atau status `'unknown'`/`'trial_extended'`.
- `isLicensed:411`, `validateSerial:234` (HMAC-SHA256 + Base32 6 karakter, `:170-177,44`).
  Salt: `products.salt` dari cloud (`license.sync.js:102`), fallback lokal
  `KASIRSOLO-KAKI5-HMAC-V2` (`license.logic.js:157`). `unitId = 'K5-' + deviceCode`
  (`license.logic.js:430,438`).
- Anti-rollback jam: `clockAnchor` + `getEffectiveNow()`.
- Rate limit (`helpers.pure.js:186`): `activateLicense` 5/menit, `submitPurchase` 3/menit,
  `syncLicense` 30/menit, `grantExtension` 10/menit (kunci limiter ini masih ada walau
  fitur perpanjangan trial sudah dicabut).
- **Tidak ada full-screen license gate lagi** (`app.js:255-259`). Kuota habis → banner
  `#quotaBanner` (`index.html:920`, `app.js:260-276`) yang bisa ditutup + blokir transaksi
  (`pos.js:552-557`). Revoke admin → `lockOverlay` (`license.ui.js:178`, `enforceRevoked`).
- Chip lisensi di header memanggil `open-license-sheet` (`index.html:42`,
  `app.js:341-343`), **bukan** membuka halaman Pengaturan.
- Alur beli: 4 langkah `1 Gratis → 2 Beli → 3 Proses → 4 Aktif` (`license.ui.js:41-47`);
  badge `"Sisa N transaksi"` / `"Habis bulan ini"` (`license.ui.js:67`).

---

## 7. Kas & Tutup Buku — `kas.js` (535 baris) + `kas.logic.js` (290 baris)

| Fungsi | Baris | Peran |
|---|---|---|
| `fiturKasAktif` | 39 | **baca SEGAR tiap dipanggil** (`getSetting('fiturKas','1') !== '0'`, `:48`); `_fiturKas` hanya penampung + fallback saat baca gagal — gagal baca tanpa pernah sukses = **AKTIF** (`:53`) |
| `setFiturKasAktif` | 60 | isi `_fiturKas` dari settings.ui (cermin, bukan sumber kebenaran) |
| `refreshShiftCache` | 69 | query `kasShift.where('status').equals('buka')`, dipanggil boot `app.js:1180` |
| `getOpenShift` / `isKasOpen` | 84 / 88 | gerbang POS |
| `dataShift` (privat) | 95 | agregasi satu shift |
| `hitungShift` | 107 | kas sistem vs fisik |
| `refreshKasViews` | 123 | render ulang; `import('./laporan.js')` `:127` |
| `openBukaKasModal` / `closeBukaKasModal` / `bukaKas` | 135 / 150 / 154 | modal `#bukaKasModal` (`index.html:709`) |
| `renderDompetDigital` (privat) | 196 | rincian QRIS/transfer per metode |
| `openTutupKasModal` / `closeTutupKasModal` / `perbaruiSelisihUI` / `tutupKas` | 217 / 248 / 253 / 269 | modal `#tutupKasModal` (`index.html:724`) |
| `catatKasDariBeranda` | 312 | redirect ke form Laporan (`import('./pengeluaran.js')` `:314`) |
| `renderKasCard` | 324 | kartu Beranda; tombol `open-buka-kas:341`, `kas-catat:357`/`open-tutup-kas:358`, `open-tutup-buku:427` |
| `kasReportBlocksHtml` | 371 | blok Laporan |
| `kasTutupBukuBlockHtml` | 407 | blok rekap tahunan |
| `openTutupBukuModal` / `closeTutupBukuModal` / `simpanTutupBuku` | 433 / 469 / 473 | modal `#tutupBukuModal` (`index.html:763`) |
| `tahunTertutup` / `peringatanTahunTertutup` | 515 / 528 | gerbang tahun; dipakai `trxdetail.js:10`, `expensedetail.js:16` |

**Gerbang `fiturKasAktif()` — 7 titik:** `kas.js:136, 158, 218, 273, 329, 374` +
`pos.js:529` (di `simpanPenjualan`).
Dua di antaranya (`kas.js:158` di `bukaKas`, `kas.js:273` di `tutupKas`) adalah **guard
penulis `DB.kasShift`** yang ditambahkan di v166.
Sejak v167 saklar Pengaturan TIDAK lagi lewat `fiturKasAktif()` — ia membaca
`getSetting('fiturKas','1')` langsung (`settings.ui.js:143`, di dalam `saveFiturKas`
`:126`), supaya keputusan
"ada perubahan / tidak" dibandingkan dengan DB, bukan dengan cache.

**⚠️ Jangan pernah mengembalikan cache "baca sekali" di `fiturKasAktif()`.** IndexedDB
dipakai bersama semua tab/jendela pada satu origin, jadi cache apa pun pasti bisa
menyimpang dari DB. Gejala nyatanya (bug 2026-09-04): gerbang POS dilewati diam-diam
sehingga kios bisa jualan tanpa buka kas, padahal Pengaturan menampilkan "aktif".

**Tutup Buku** (`kas.js:473-507`): validasi tahun 2000–2100 (`:476`), tolak tahun duplikat
(`:480`), `showConfirm` (`:490`), lalu `DB.tutupBuku.add({tahun, tanggalTutup, waktuTutup,
jumlahTransaksi, omzet, totalModal, totalExpense, totalIncome, laba, kasAkhir,
nonLabaKeluar, nonLabaMasuk, nonTunai})`.

**Nomor transaksi:** `nextNomor` dipanggil **di dalam** `DB.transaction('rw', …)`
(`pos.sync.js:86-89,110-122`) supaya anti-duplikat; form catatan memanggilnya lewat
`pengeluaran.js:22`. Backfill idempoten saat boot (`ensureNomorBackfill`).

**Anti-FOUC:** `#kasCard` diberi `style="display:none"` di HTML (`index.html:92`) supaya
kartu kas tidak sempat muncul sebelum `fiturKasAktif()` terbaca.

---

## 8. POS, Laporan, Backup

### POS — `pos.js` (coordinator + facade) / `pos.ui.js` / `pos.sync.js` / `pos.logic.js`

- **Persistensi keranjang** ada di **`pos.sync.js`**, bukan `pos.js`:
  `CART_KEY:9`, `saveCart:15`, `loadCart:39`, `clearCartStorage:78`.
- `renderCartModal` di `pos.ui.js` (~`:659-701`); `refreshCartModalTotals` `:729-741`
  mengandalkan `row.querySelector('.cart-price')`.
- CSS keranjang: `css/style.css:157-169, 949-951, 971-992, 995-1011` (blok terakhir menang
  karena source order). Tidak ada override media-query untuk `.cart-*`.
- Gerbang kas saat simpan penjualan: `pos.js:529`.
- Gerbang kuota: `pos.js:552-557`.

### Laporan — `laporan.js`

Empat periode (Harian/Mingguan/Bulanan/**Custom**, `index.html:185`, `laporan.js:864`),
kartu statistik, grafik, blok kas dari `kasReportBlocksHtml`, konsinyasi (aksi
Retur/Setor, `laporan.js:492-493`).

### Backup — `backup.js`

`buildBackupPayload()` → `version: 4` berisi `menu, penjualan, pengeluaran, kasShift,
tutupBuku` (`backup.js:61-71`). **`settings` dan `pengaturan` tidak dicadangkan.**
Signature HMAC device-bound (`:36-50`). `PROTECTED = ['installId','unitId',
'deviceIdentity','license','onboarded','sync']` dibuang dari ekspor & impor (`:27`).
Cadangan cloud: bucket `backups`, `CLOUD_KEEP = 10` (`:304-305,323-345`).

---

## 9. Cloud / Supabase

Project `https://hhywrvedlwljawgxzpkq.supabase.co` (`js/supabase-config.js:10`); anon key
punya fallback ter-hard-code di `:11` (jangan disalin ke dokumen/commit lain).
Identitas: `APP_TYPE='kaki5'` (`sync.js:31`, `license.sync.js:13`, `app-link.js:15`),
`PRODUCT_PREFIX='KK5'` (`license.sync.js:14`), `VERIFY_TTL_MS=24 jam` (`sync.js:33`).

| Objek cloud | Operasi | Bukti |
|---|---|---|
| tabel `clients` | upsert profil, baca status lisensi | `sync.js:185,263-295,431,439`; `license.sync.js:33,324`; `purchase.js:54,321`; `sync.health.js:98` |
| tabel `sync_errors` | catat kegagalan sync | `sync.js:129` |
| tabel `products` | `salt` (`kode_produk='KK5'`), `tx_quota`, `store_url`/`vercel_url`, daftar produk | `license.sync.js:102,147`; `app-link.js:26`; `purchase.js:90` |
| tabel `settings` (cloud) | `qris_url`, `bank_info`, `app_links` | `purchase.js:88-89`; `app-link.js:43`; `license.sync.js:624` |
| RPC `device_known` | verifikasi perangkat | `sync.js:255,420`; `license.sync.js:49,600`; `purchase.js:310`; `sync.health.js:82` |
| RPC `device_assign` | reassign serial antar perangkat (Opsi 3) | `license.sync.js:541` |
| Storage `backups` | cadangan cloud | `backup.js:304-345` |
| Storage `bukti` | bukti transfer pembelian | `purchase.js:284,291` |
| Realtime | channel `license:${unitId}`, `postgres_changes` UPDATE `clients` filter `unit_id=eq.` | `purchase.js:404-407`, dilanggan `app.js:1243` |

**`sync.js`** — `ensureSynced()` (dipanggil `app.js:1168`, `settings.ui.js:22`,
`sync.health.js:8`): baca 12 kunci profil (`:142-148`) → upsert `clients` → verifikasi
`device_known` → tulis state `sync`. `startSyncRetryLoop()` retry tiap **5 menit**
(`:334-349`, dipasang `app.js:1212`). `pullCloudProfileTo()` mapping snake_case→camelCase
(`:361-374`) dan hanya menulis bila berubah (`:386-387`).

**`sync.health.js`** — diagnosa 10 langkah berurutan (`:27-149`), modal `#syncDiagModal`
(`index.html:929`), tombol salin "Kirim ke Admin" (`:938`, `copy-sync-diag` → `app.js:776`).

**Arah kebenaran (WAJIB, `../../CONTEXT.md:87-101`):** cloud = sumber kebenaran lisensi &
profil. Data lokal **tidak boleh** menimpa cloud, kecuali tulisan eksplisit user dari form
profil. Internet mati → pakai data lokal; error jaringan **tidak boleh** mengubah atau
menghapus state lokal.

---

## 10. QA & Rilis

### Harness (semua di-gitignore, jalankan dengan CWD `kaki5`)

| File | Yang dijaga | Exit 1 bila |
|---|---|---|
| `test-shim.js` | stub browser (Proxy `safeAny:12`, Dexie stub `:29`, document `:53`, storage `:83`, globals `:96`) | — |
| `test-modules.js` | `node --check` **+ real ESM import** tiap `js/*.js` (`:35-54`), lalu child `test-html-refs.js` (`:67`) & `test-css-drift.js` (`:81`); gate `:89` | impor gagal ATAU html-refs ATAU css-drift gagal |
| `test-imports.js` | muat semua `js/*.js` di shim (`:25-36`) | `failCount>0` (`:41`) |
| `test-dynamic-imports.js` | semua `import('./x')` literal (`:33-44`); non-literal → WARN (`:67-69`) | target tidak ada |
| `test-html-refs.js` | setiap `getElementById('…')` (`:55`) harus ada di `id="…"` HTML (`:32`) atau dibuat dinamis (`:38`) | ada ref yatim (`:83-84`) |
| `test-css-drift.js` | 1 link `css/style.css` (`:31-36`), folder `css/` hanya `style.css` (`:39-42`), brace seimbang (`:47-53`), presisi precache SW (`:56-60`) | salah satu gagal (`:66`) |
| `test-db-migrations.js` | parse `db.version(N).stores({...})` (`:32`): versi berurutan, tabel tidak hilang, index tidak menyusut, baseline v1 + `suplayer`, smoke load `db.js` | ada pelanggaran (`:102`) |
| `test-data-actions.js` | setiap `data-action` literal punya `case` di `app.js` (`:33-52`), dinamis via `renderPOSError`/`renderMenuError` (`:45-48`), tidak ada case mati (`:81-82`) | ada yang tidak berpasangan (`:91`) |
| `test-import.mjs` | smoke manual `import('./app.js')` | tidak pernah exit≠0 |

### ⚠️ Baseline merah yang diketahui (sejak rilis 1.0.97)

Tiga harness **sudah gagal sebelum perubahan terakhir**, jadi kegagalan mereka **bukan**
regresi baru. Penyebabnya spesifik:

1. **`test-html-refs.js`** — tepat 1 ref yatim: `getElementById('posCatTabs')` di
   `js/pos.ui.js:527`. Elemen `#posCatTabs` memang dihapus dari layout (lihat komentar
   `pos.ui.js:528`) tapi referensinya tertinggal.
2. **`test-modules.js`** — jatuh **bukan** karena gagal impor, melainkan karena child
   `test-html-refs.js` di atas (gate `test-modules.js:89`).
3. **`test-data-actions.js`** — dua kelas:
   - *MISSING handler*: `add-ojol-row` (`index.html:571`) dan `remove-ojol-row`
     (`js/menu.js:303`) tidak punya `case` di `app.js`; keduanya ditangani **listener
     `window.click` kedua di `js/menu.js:318-335`**, sedangkan `DELEGATED_OK`
     (`test-data-actions.js:66-69`) hanya memuat `add-topping-row` & `remove-topping-row`.
   - *DEAD case*: `navigate-pengaturan` (`app.js:336`), `select-topping` (`:608`),
     `remove-topping` (`:627`), `save-expense` (`:668`); `DEAD_OK` hanya mengizinkan
     `open-income-form` (`test-data-actions.js:59`). Catatan: `retry-pos` **tidak** mati —
     terdeteksi dinamis dari `renderPOSError('retry-pos')` (`pos.js:366,420`). Komentar
     `pengeluaran.js:313` ("masih dipanggil lewat case 'save-expense'") sudah tidak benar;
     tombol kini memakai `save-txn` (`index.html:702`).

**Prosedur yang benar:** sebelum menyalahkan kode sendiri, bandingkan sinyal kegagalan
dengan blob `HEAD` (`git show HEAD:kaki5/<path>`). Kalau string pemicunya sama di HEAD,
itu baseline. **Jangan blokir rilis** karena tiga harness ini, dan **jangan tambah korban
baru**.

Harness yang **hijau**: `test-css-drift.js`, `test-db-migrations.js`,
`test-dynamic-imports.js`, `test-imports.js`, `test-shim.js`.

### Dev server

`node server.cjs` → `PORT = 8086` (`server.cjs:9`), bind `127.0.0.1` (`:46`),
`Cache-Control: no-store` (`:34`) sehingga JS tidak mungkin basi saat dev, `/api/*` → 404
JSON (`:29`), SPA fallback → `index.html` (`:30,37`).

### Rilis

Lihat `../../AGENTS.md` § Rilis dan `../../DEPLOYMENT.md:127-181`. Ringkas:
`push-beta.ps1` → mirror `kasol-beta` → GitHub BETA; setelah stabil `push-live.ps1` →
mirror `kasol` → GitHub LIVE. Guard `Test-SnapshotDrift` memaksa staged index mirror
identik dengan pohon sumber **sebelum** commit (`push-beta.ps1:64-90`), dan secret scan
(`:37-58`) memblokir pola prefix token. Kedua skrip berhenti di `Read-Host`
(`push-beta.ps1:144`, `push-live.ps1:128`) di lingkungan non-interaktif — push manual
setelah itu adalah jalur normal, bukan kegagalan.

---

## 11. Common Pitfalls & Troubleshooting

| Gejala | Penyebab paling mungkin | Cara memastikan |
|---|---|---|
| Tombol/saklar mati **tanpa error di konsol** | nama di `_*WireMap` tidak di-export modul yang di-import `app.js` (facade tidak me-re-export) — lihat §4 | cek `window.<fn>` di konsol; cek daftar re-export facade |
| `Dexie is not defined` di harness | lupa `<script src="dexie.min.js">` di head harness | bandingkan dengan head `index.html` |
| App mati setelah deploy, `Dexie is not defined` | `dexie.min.js` ter-ignore `*.min.js` global | `git ls-files kaki5/dexie.min.js` |
| Overlay "Versi Baru Tersedia" tidak muncul | salah satu dari 6 slot versi tidak di-bump; atau tab sudah di-reload ke versi baru (`update.js:79` bail bila `cacheBust` sama) | bandingkan `version.js`, `version.json`, `sw.js`, `index.html` |
| Cache lama menyajikan JS basi saat dev | SW aktif | pastikan `js/dev-unregister-sw.js` dimuat (`index.html:34`) |
| Reload berulang saat buka app | `db.on('blocked')` karena tab lain membuka DB versi lama | tutup tab lain (`db.js:14-23`) |
| `getElementById` mengembalikan `null` senyap | id dihapus dari layout tapi referensinya tertinggal (`#posCatTabs`) | `node test-html-refs.js` |
| Aksi `data-action` tidak tertangani | tidak ada `case` di `handleDataAction`, atau ditangani listener lokal yang tidak terdaftar di `DELEGATED_OK` | `node test-data-actions.js` |
| Dokumen/klaim menyebut `test_validate.js` / `test_pos.js` | kedua file itu **sudah tidak ada** | `Get-ChildItem kaki5\test-*.js` |
| `git add -A` ikut membawa `rosok/` atau artefak `_qa-*` | stage terlalu lebar | gunakan `git add -u kaki5` |

---

## 12. Diagram

```
                    ┌──────────────────────────────────────────┐
                    │  index.html  (CSP script-src 'self')     │
                    │  6 .page · 17 modal/sheet · 91 data-action│
                    └───────────────┬──────────────────────────┘
                                    │ dexie.min.js (global) → app.js?v=166 (ESM)
                    ┌───────────────▼──────────────────────────┐
                    │  app.js  — entry                          │
                    │  • 8 _*WireMap → window (guard silent-skip)│
                    │  • handleDataAction (click/keydown/input/change)
                    │  • boot(): cloud → render → PWA/realtime  │
                    └──┬────────────┬─────────────┬─────────────┘
             facade    │            │             │   facade
        ┌──────────────▼──┐  ┌──────▼──────┐  ┌───▼────────────┐
        │ settings.js     │  │ pos.js      │  │ license.js     │
        │ .logic .ui .sync│  │ .logic .ui  │  │ .logic .ui .sync
        └──────┬──────────┘  │ .sync       │  └───┬────────────┘
               │             └──────┬──────┘      │
        ┌──────▼──────┐  ┌──────────▼────────┐    │
        │ sync.js     │◄─┤ kas.js + kas.logic│    │  (siklus: sync→license→license.sync→sync)
        │ sync.health │  │ nomor.js          │    │
        │ purchase    │  └──────────┬────────┘    │
        │ app-link    │             │             │
        └──────┬──────┘  ┌──────────▼──────────┐  │
               │         │  db.js  (Dexie v8)  │  │
               │         │  app-state.js       │  │
               │         └─────────────────────┘  │
        ┌──────▼──────────────────────────────────▼──┐
        │  SUPABASE  clients · products · settings    │
        │  sync_errors · RPC device_known/assign      │
        │  Storage backups/bukti · Realtime           │
        └─────────────────────────────────────────────┘
                    sw.js: API network-only · HTML cache-first · aset network-first
```

---

*Terakhir diselaraskan dengan kode: **v167 / 1.0.99, 2026-09-04**.*
*Sebelumnya dokumen ini merujuk `js/onboarding.js`, port 8123, trial 7 hari + perpanjangan,
dan `rosok.zip` — semuanya sudah tidak ada di kode.*
