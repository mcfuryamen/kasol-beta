# Developer Guide — kaki5 (Kasir Solo Kaki Lima)

Panduan mendalam untuk yang **mengubah kode** `kaki5`.
Versi acuan: **v217 / 1.0.142-beta.1 (2026-11-08)**. Setiap klaim disertai `file:baris`.
> ⚠️ **Nomor baris bergeser setiap kali kode berubah.** Kalau angka di dokumen ini tidak
> cocok lagi, **cari nama fungsinya** (`grep -n 'namaFungsi' js/<file>.js`) — jangan
> menyimpulkan perilakunya berubah. Rujukan yang paling tahan lama: nama fungsi + nama id.

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
<script type="module" src="js/app.js?v=208"></script>  <!-- :1038 entry -->
<script src="js/supabase.min.js"></script>        <!-- :1015 vendor -->
<script src="js/supabase-config.js"></script>     <!-- :1016 global config -->
```

Konsekuensi: **`db.js` memakai global `Dexie`**, bukan impor npm. Harness QA berdiri
sendiri yang lupa `<script src="dexie.min.js">` akan gagal dengan
`Dexie is not defined` dan gejalanya menipu (`kas.refreshShiftCache is not a function`).

### Urutan boot nyata — `js/app.js:1150-1267`

```
boot()
 ├─ ensureUnitId()                        :1136   ID perangkat stabil
 ├─ FASE 1 — cloud lebih dulu (aturan pemilik, CONTEXT.md:91)   :1369
 │    runLicenseSync()                    :1381   status lisensi dari cloud
 │    verifyBootLicenseAssignment()       :1387
 │    pullCloudProfileIfOnline()          :1394   cloud = kebenaran profil
 │    applyHeaderBizName()                :1402
 │    ensureSynced({silent:true})         :1407   push backfill-only
 ├─ FASE 2 — render                                            :1410
 │    ensureNomorBackfill()               :1415   penomoran TRX/MSK/BLJ
 │    refreshShiftCache()                 :1419   status shift kas terbuka
 │    loadBeranda()                       :1421
 │    restorePrinterStatus()              :1424
 ├─ FASE 3                                                     :1434
 │    loadSettings()                      :1441
 │    startSyncRetryLoop()                :1447   retry tiap 5 menit
 │    Promise.race(_settingsReady, 8 dtk) :1456   + toast error bila timeout
 │    setupPWA()                          :1473
 │    subscribeToLicenseUpdates(unitId)   :1481   Realtime channel
 initRouter()                             :1513
 startUpdateWatcher()                     :1538   delay 3 dtk + visibilitychange + online
 window.APP_VERSION / #appVersionLabel    :1549 / 1552
```

> **Yang berubah dari dokumen lama:** tidak ada lagi `checkOnboarding()` — file
> `js/onboarding.js` **tidak ada** di repo dan gerbang onboarding 2-langkah dihapus
> 2026-08-29. **Modal S&K sekali-jalan juga sudah dihapus** (2026-09-14): S&K kini
> **tab** di halaman Bantuan, dan `#tcAcceptRow` hanya tampil bila `tcAcceptedAt`
> belum tercatat (`js/app.js:276-292`).

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
async function handleDataAction(action, el, event) { /* js/app.js:391-1137 */ }
```

Empat listener delegasi di `document`:

| Event | Listener | Panggil dispatcher | Alasan ada |
|---|---|---|---|
| `click` | `app.js:1153` | `:1176` | utama; sekalian menutup backdrop/modal (`:1162-1171`) |
| `keydown` Enter/Space | `app.js:1184` | `:1194` | aksesibilitas; elemen native dilewati (`:1192`) |
| `input` | `app.js:1206` | `:1204` | `data-action` pada `<input>` tidak pernah memicu `click` |
| `change` | `app.js:1207` | `:1204` | `<select>`, `<input type=file>`, dan **saklar** |

Overlay **hard gate** dikecualikan dari semua perilaku tutup: `lockOverlay` (revoke admin)
dan `updateOverlay` (force update). Satu sumber daftarnya `HARD_GATE_OVERLAYS`
(`js/modal.js:35-48`, diekspor) — dipakai listener Escape (`modal.js:54-60`),
`closeAllModals()` (`modal.js:163-165`), klik backdrop/navbar (`app.js:1164,1169`), dan
`navigation.js:70`. **Jangan** menambah jalur tutup dengan daftar `except:` sendiri; itu
persis celah yang membuat gerbang bisa dilewati lewat Escape sebelum v170.
**Sejak v181 `bukaKasModal` TIDAK lagi hard gate** (permintaan pemilik): gerbang kas hanya
mengunci halaman Jualan — Escape/backdrop/navigasi bisa menutupnya, dan watcher
MutationObserver di `kas.js:175-191` menegakkan ulang modal selama masih di Jualan tanpa
shift terbuka (debounce 80ms); navbar selalu di atas backdrop gerbang
(`#bukaKasModal.show` z 340 < `.bottom-nav` 350).

**Menambah aksi baru = dua tempat wajib:** atribut `data-action` di HTML/render JS, dan
`case '...'` di `handleDataAction`. `test-data-actions.js` menjaga pasangan ini
(lihat §10 dan baseline merahnya).

---

## 3. Peta Modul (`js/` — 49 file)

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
> `setupModalFocusTrap`) lalu **`export * from './helpers.pure.js'`** (`helpers.js:82`).
> Nama API wilayah juga sudah berganti: `initRegionModal` / `getRegencies` /
> `getDistricts` / `getVillages` **tidak ada** lagi.

### Infrastruktur

| File | Peran |
|---|---|
| `db.js` (189 baris) | Dexie v1..v8, `db.on('blocked'):14-23`, `getSetting:178`, `setSetting:183`, `export const DB = db:189` |
| `app-state.js` | state terpusat + setter |
| `modal.js` | `openModal`/`closeModal`/focus trap + `registerModalSelector` (`modal.js:11`) + **`HARD_GATE_OVERLAYS:48`** — satu daftar overlay yang tidak boleh ditutup dari UI (`lockOverlay`, `updateOverlay`; `bukaKasModal` dikeluarkan sejak v181 — gerbang kas ditegakkan per-halaman oleh watcher `kas.js`). **`tcModal` sudah dihapus 2026-09-14** — S&K kini tab di Bantuan, `registerModalSelector('tcModal', …)` tidak ada lagi |
| `confirm.js` | `showConfirm` / `closeConfirm` |
| `navigation.js` | router hash, `initRouter` / `navigateTo`; `navigateTo:69` memanggil `closeAllModals()` **tanpa** `except:` karena hard gate sudah dikecualikan di dalam `modal.js` |
| `nomor.js` | `NOMOR_PREFIX:11` = `{penjualan:'TRX', pemasukan:'MSK', pengeluaran:'BLJ'}`, `nextNomor:29`, `backfillNomor:48`, `ensureNomorBackfill:82`; format `PREFIX-YYYYMMDD-NNN` |

### Domain 3-layer + facade

| Domain | Facade/coordinator | logic | ui | sync |
|---|---|---|---|---|
| Settings | `settings.js` (42 baris) | `settings.logic.js` | `settings.ui.js` | `settings.sync.js` |
| License | `license.js` (59 baris) | `license.logic.js` | `license.ui.js` | `license.sync.js` |
| POS | `pos.js` (796 baris) | `pos.logic.js` | `pos.ui.js` | `pos.sync.js` |

Facade hanya berisi `export { ... } from './x.logic.js'` dan seterusnya. **Inilah sumber
jebakan v166** — lihat §4.

### Modul fitur / halaman

`beranda.js`, `menu.js`, `laporan.js`, `pengeluaran.js`, `bantuan.js`, `kas.js`,
`trxdetail.js`, `expensedetail.js`, `printer.js`, `carousel.js`, `pwa.js`, `update.js`,
`backup.js`.

### Modul Akun Kasol (gerbang login + peran) — **bukan** lewat wire-map

| File | Baris | Isi |
|---|---|---|
| `account.js` | 278 | Logika akun & peran: `ROLE_RANK:30`, `ROLE_LABEL:31`, `masuk:113`, `daftarAkun:134`, `keluar:166`, `gateBypassed:179`, `applyAksesPerangkatLink:203`, `daftarPegawai:218`, `tambahPegawai:227`, `ubahRolePegawai:241`, `hapusPegawai:250`, `peran:261`, `boleh:267`, `sudahLogin:272`, `infoAkun:276` |
| `account.ui.js` | 405 | UI: `applyRoleUI:38`, `renderAkunCard:50`, `openAkunModal:115`, `showAkunLock:139`, `akunTab:183`, `akunLogin:235`, `akunLogout:262`, `staffTab:296`, `openStaffModal:301`, `tambahStaff:342`, `hapusStaff:368`, `ubahRoleStaff:378`, `initAkun:390` |

Keduanya di-`import` **statis** di `app.js:38-39` (bukan lazy wire-map), dan dipanggil
dari HTML lewat `window._ksr_*`. Detail aturan peran ada di
[`../README.md`](../README.md) §11.

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
| `_posWireMap` | 58 | `pos.js` | 83 | 86 |
| `_berandaWireMap` | 64 | `beranda.js` | 92 | 95 |
| `_kasWireMap` | 68 | `kas.js` | 102 | 105 |
| `_menuWireMap` | 59 | `menu.js` | 112 | 115 |
| `_laporanWireMap` | 60 | `laporan.js` | 122 | 125 |
| `_settingsWireMap` | 61 | **`settings.js` (facade)** | 132 | **135** |
| `_bantuanWireMap` | 62 | `bantuan.js` | 143 | 146 |
| `_pengeluaranWireMap` | 63 | `pengeluaran.js` | 153 | 156 |

Total **97 nama global** di-wire lewat peta ini (26+1+14+18+11+16+4+7). Pola bakunya identik di 8 blok:

```js
for (const [key, modKey] of Object.entries(_xWireMap))
  if (modKey !== '__wired' && m[modKey] !== undefined) window[key] = m[modKey];
//  ^ guard di app.js:86,95,105,115,125,135,146,156 — lalu __wired = true
```

**Kunci peta = nama global di `window`; nilai = nama export di modul target.**
Kalau modul target tidak mengekspor nama itu, guard **lolos diam-diam tanpa error** dan
`window[key]` tetap `undefined`.

### Studi kasus nyata (v166)

Saklar "Buka / Tutup Kas" tidak berfungsi sama sekali, tanpa satu pun pesan error:

1. `saveFiturKas` ditambahkan ke `_settingsWireMap` (`app.js:61`) dan ke `case
   'save-fitur-kas'` (`app.js:910`).
2. `app.js:132` mengimpor **`./settings.js`** (facade), **bukan** `settings.ui.js`.
3. `settings.js` tidak me-re-export `saveFiturKas` → guard `app.js:135` melewatinya
   diam-diam → `window.saveFiturKas` `undefined` → saklar mati.
4. Harness QA saat itu **lolos** karena mengimpor `settings.ui.js` langsung.

**Perbaikan:** `saveFiturKas` masuk daftar re-export (`js/settings.js:38`).

**Aturan yang harus dipegang:** setiap nama di `_*WireMap` wajib ada di set ekspor modul
yang benar-benar di-import `app.js` — termasuk yang hanya lewat re-export facade.
Pengecualian sah: `_laporanWireMap` memetakan dua kunci ke satu export
(`setReportPeriod: 'setReportPeriodUI'` dan `setReportPeriodUI: 'setReportPeriodUI'`) agar
tab laporan dini tetap jalan (`app.js:198-204`). `_kasWireMap` sengaja **tidak** memuat 4
fungsi "catat kas manual" lama karena fiturnya dihapus di v164 (`app.js:66-67`), dan sejak
v170 juga **tidak** memuat `closeBukaKasModal` — tidak ada tombol tutup di dalam modal
(`app.js:69-71`, `case 'close-buka-kas'` dihapus dari dispatcher). Sejak v181 modal ini bisa
ditutup lewat jalur generik (Escape/backdrop/navigasi memanggil `closeModal`), tetapi
watcher `kas.js:175-191` menegakkannya kembali selama masih di halaman Jualan tanpa shift.

Semua modul di-*import* **eager** saat `app.js` dimuat — komentar "Lazy-loaded" di
`app.js:44` sudah tidak sesuai perilaku.

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
(`db.js:145`). Helper `tanggalDariMs` (`db.js:131-135`).

**Aturan:** migrasi selalu aditif. Jangan pernah menghapus tabel/kolom — pengguna lama
harus bisa membuka DB-nya. `test-db-migrations.js` menjaga versi berurutan, tabel tidak
hilang, dan index tidak menyusut.

**Catatan praktis**
- Index Dexie tidak bisa memuat boolean → `getActiveMenus()` menyaring di JS
  (`pos.js:353-357`).
- `pengaturan` legacy: tidak dibaca kode, hanya dibersihkan di `confirmClearAll`
  (`backup.js:558-569`).
- `db.on('blocked')` me-reload halaman sekali via `sessionStorage['ksr:db-blocked-reload']`.
- Di harness, `DB` **bukan** global: `const DB = (await import('./js/db.js')).DB`.

### Isi `settings` (key-value) — dibaca/ditulis via `getSetting`/`setSetting`

| Kunci | Default | Dibaca | Ditulis |
|---|---|---|---|
| `fiturKas` | `'1'` (ON) | `kas.js:48` (segar tiap transaksi), `settings.ui.js:39` (tampilan, `setChk:45`), `settings.ui.js:147` (keputusan saklar) | `settings.ui.js:177` |
| `payOptTunai` / `payOptQris` / `payOptTransfer` | `'1'` | `pos.js:402-404`, `settings.ui.js:38-39` | `settings.ui.js:111-113` |
| `tcAcceptedAt` | `null` | `bantuan.js:731` | `app.js:282` (ISO) |
| `namaUsaha` | `''` | `beranda.js:18`, `printer.js:368,388`, `settings.logic.js:82`, `sync.js:178`, `license.sync.js:585` | `settings.logic.js:76,87` |
| `namaWarung` *(legacy)* | `'Warung Saya'` | `beranda.js:19`, `printer.js:369,389`, `sync.js:178,269` | — (alias baca saja) |
| `namaPemilik` / `noWhatsapp` / `alamat` | `''` | `settings.logic.js:92-93,99`, `sync.js:179,180,184`, `license.sync.js:589,590` | `settings.logic.js:56,60,64` |
| `provinsiId`,`provinsi`,`kabkotaId`,`kabkota`,`kecamatanId`,`kecamatan`,`desaId`,`desa` | `''` | `settings.logic.js:19-22,95-98`, `settings.ui.js:300-307`, `sync.js:180-184` | `settings.logic.js:65-72` |
| `kategoriCustom` / `suplayerCustom` | `[]` | `menu.js:346,355,370`, `menu.js:448-449,473-474`, `menu.js:569,594-596` | `menu.js:451,476,573,599` |
| `sync` (objek `{status,syncedAt,verifiedAt,recentErrors,lastError,lastStage,lastTryAt}`) | `{status:'none'}` | `sync.js:144`, `settings.logic.js:94` | `sync.js:157,354,364` |
| `deviceInfo` | — | `sync.js:208` | `sync.js:210` — snapshot diagnostik lokal (browser/major/OS/tipe + `diagnosticUserAgent` teredaksi maksimal 300 karakter; raw UA tidak dikirim ke profil cloud) |
| `unitId` | `null` | `license.logic.js:653` | `license.logic.js:664,669`, `sync.js:508` |
| `installId` / `deviceIdentity` | `null` / `{}` | `license.logic.js:291` / `:248` | `license.logic.js:294` / `:309` |
| `license` | `null` | `license.logic.js:448` | `license.logic.js:454,476` |
| `trialConfig` | `null` | `license.logic.js:40` | `license.sync.js:173` |
| `clockAnchor` | `0` | `license.logic.js:386,393` | `license.logic.js:395` |
| `txLastPushAt` | `0` | `license.sync.js:427` | `license.sync.js:452` |
| `licenseSync` | — | — | `license.sync.js:536` (`LICENSE_SYNC_KEY:29`) |
| `nomorBackfill:v1` | — | `nomor.js:85` | `nomor.js:87` |
| 12 kunci profil hasil mapping cloud | — | `sync.js:416-429,438` | `sync.js:442` |

> **Koreksi dokumen lama:** `setupDone`, `licenseActivatedAt`, dan `deviceCode` **tidak
> ada** di kode.

### `localStorage` / `sessionStorage` (bukan `settings`)

`kaki5-cart` & `kaki5-cart-held-id` (`pos.sync.js:18,22`) · `kasirsolo:order-note`
(`pos.ui.js:644`, `app.js:525`) · `kasirsolo:order-type` (`pos.js:372,753` — `app.js`
tidak memegang kunci ini) · `kasirsolo:ojol-platform` (`pos.ui.js:293`) ·
`kasirsolo:pay-method` (`pos.ui.js:336`) · `kasirsolo:pwa-installed`
(`pwa.js:36,87,260,270`) · `printer_bluetooth_state` (`printer.js:16`) ·
`kasirsolo:kaki5:license` (`license.logic.js:432`) · `ksr:update-reloading`
(`update.js:20`) / `ksr:update-pending` (`update.js:30`) · `ksr:db-blocked-reload`
(`db.js:17-18`).

---

## 6. Lisensi & Kuota

Model lama "trial 7 hari + perpanjangan" **sudah dihapus**. Yang ada sekarang:

- Tier gratis = **kuota transaksi per bulan kalender**. `DEFAULT_TX_QUOTA = 0`
  (`license.logic.js:28` — tanpa fallback kuota ter-hard-code), `currentTxMonth:31`,
  `getTxQuota:38` (cache `trialConfig:40`), `incrementTxCount:507` dipanggil dari
  `pos.sync.js:107,204`.
- Angka kuota diambil dari cloud: `products.tx_quota` (`license.sync.js:164-170`),
  penyesuaian per perangkat `clients.tx_adjust`.
- `getLicenseStatus()` (`license.logic.js:592`) mengembalikan
  `{ status, deviceCode, txRemaining, txQuota, txUsed }` dengan
  `status ∈ none | trial | active | expired | revoked`.
  **Tidak ada lagi** `daysLeft`, `expiry`, `extensions`, atau status `'unknown'`/`'trial_extended'`.
- `isLicensed:641`, `validateSerial:407` (HMAC-SHA256 `:343-350`, Base32 6 karakter `:349`, alfabet `B32_ALPHABET:20`).
  Salt: `products.salt` dari cloud (`license.sync.js:119-137`), fallback lokal
  `KASIRSOLO-KAKI5-HMAC-V2` (`license.logic.js:329-330`). `unitId = 'K5-' + deviceCode`
  (`license.logic.js:660,668`).
- Anti-rollback jam: `clockAnchor` + `getEffectiveNow()`.
- Rate limit (`helpers.pure.js:178-187`): `activateLicense` 5/menit, `submitPurchase` 3/menit,
  `syncLicense` 30/menit, `grantExtension` 10/menit (kunci limiter ini masih ada walau
  fitur perpanjangan trial sudah dicabut).
- **Tidak ada full-screen license gate lagi** (`app.js:294-298`). Kuota habis → banner
  `#quotaBanner` (`index.html:1083`, `app.js:299-321`) yang bisa ditutup + blokir transaksi
  (`pos.js:633-650`). Revoke admin → `lockOverlay` (`license.ui.js:169-171`,
  `enforceRevoked:183`).
- Chip lisensi di header memanggil `open-license-sheet` (`index.html:44`,
  `app.js:452`), **bukan** membuka halaman Pengaturan.
- Alur beli: 4 langkah `1 Gratis → 2 Beli → 3 Proses → 4 Aktif` (`license.ui.js:42-46`);
  badge `"Sisa N transaksi"` / `"Habis bulan ini"` (`license.ui.js:80`).

---

## 7. Kas & Tutup Buku — `kas.js` (707 baris) + `kas.logic.js` (290 baris)

| Fungsi | Baris | Peran |
|---|---|---|
| `fiturKasAktif` | 39 | **baca SEGAR tiap dipanggil** (`getSetting('fiturKas','1') !== '0'`, `:48`); `_fiturKas` hanya penampung + fallback saat baca gagal — gagal baca tanpa pernah sukses = **AKTIF** (`:53`) |
| `setFiturKasAktif` | 60 | isi `_fiturKas` dari settings.ui (cermin, bukan sumber kebenaran) |
| `refreshShiftCache` | 69 | query `kasShift.where('status').equals('buka')`, dipanggil boot `app.js:1419` |
| `getOpenShift` / `isKasOpen` | 90 / 94 | gerbang POS |
| `dataShift` (privat) | 101 | agregasi satu shift |
| `hitungShift` | 121 | kas sistem vs fisik |
| `refreshKasViews` | 137 | render ulang; `import('./laporan.js')` `:141` |
| `openBukaKasModal` / `closeBukaKasModal` / `bukaKas` | 149 / 164 / 199 | modal `#bukaKasModal` (`index.html:760`, `.modal-center` sejak v170). **`closeBukaKasModal` TIDAK di-wire ke `window`** (tidak ada tombol tutup di dalam modal); sejak v181 modal bisa ditutup via Escape/backdrop/navigasi (jalur generik `closeModal`) dan watcher `kas.js:175-191` menegakkannya kembali selama di Jualan tanpa shift; fungsi tetap diekspor & dipanggil internal `bukaKas()` setelah shift tersimpan |
| `dompetDigitalHtml` / `renderDompetDigital` (privat) | 268 / 286 | rincian QRIS/transfer per metode |
| `openTutupKasModal` / `closeTutupKasModal` / `perbaruiSelisihUI` / `tutupKas` | 292 / 323 / 328 / 344 | modal `#tutupKasModal` (`index.html:774`) |
| `catatKasDariBeranda` | 395 | redirect ke form Laporan (`import('./pengeluaran.js')` di dalam fungsinya) |
| `renderKasCard` | 407 | kartu Beranda |
| `kasDetailRow` / `tanggalDariMs` (privat) | 460 / 468 | baris detail; `tanggalDariMs` lahir di v169 karena `formatDate()` melempar `TypeError` saat menerima epoch ms |
| `showKasShiftDetail` / `closeKasShiftDetail` | 474 / 530 | modal `#kasShiftDetailModal` (`index.html:1023`), satu baris per riwayat shift (v169) |
| `kasReportBlocksHtml` | 535 | blok Laporan |
| `kasTutupBukuBlockHtml` | 571 | blok rekap tahunan |
| `openTutupBukuModal` / `closeTutupBukuModal` / `simpanTutupBuku` | 597 / 633 / 637 | modal `#tutupBukuModal` (`index.html:813`) |
| `tahunTertutup` / `peringatanTahunTertutup` | 687 / 700 | gerbang tahun; dipakai `trxdetail.js:10`, `expensedetail.js:16` |

**Gerbang `fiturKasAktif()` — 9 titik:** definisi `kas.js:39`, pemanggil
`kas.js:150,186,213,293,348,412,538` + `pos.js:415` (buka tab 🛒 Jualan → munculkan modal
Buka Kas, v169) + `pos.js:612` (guard `simpanPenjualan`). Dua di antaranya (`kas.js:213` di
`_bukaKasCore`, `kas.js:348` di
`tutupKas`) adalah **guard penulis `DB.kasShift`** yang ditambahkan di v166.
Sejak v167 saklar Pengaturan TIDAK lagi lewat `fiturKasAktif()` — ia membaca
`getSetting('fiturKas','1')` langsung (`settings.ui.js:147`, di dalam `saveFiturKas`
`:130`), supaya keputusan
"ada perubahan / tidak" dibandingkan dengan DB, bukan dengan cache.

**v170 — `_bukaKasCore()` menolak input kosong** (`kas.js:228-232`, alasannya di
komentar `kas.js:224-227`; `bukaKas():199` hanya wrapper guard in-flight). Setelah tombol "Batal"
dihapus, membiarkan submit dengan field kosong berarti satu klik bisa membuka shift
bermodal nol tanpa niat. Aturan yang harus dipertahankan: **kosong ≠ 0**; laci nol harus
diketik.

**⚠️ Jangan pernah mengembalikan cache "baca sekali" di `fiturKasAktif()`.** IndexedDB
dipakai bersama semua tab/jendela pada satu origin, jadi cache apa pun pasti bisa
menyimpang dari DB. Gejala nyatanya (bug 2026-09-04): gerbang POS dilewati diam-diam
sehingga kios bisa jualan tanpa buka kas, padahal Pengaturan menampilkan "aktif".

**Tutup Buku** (`kas.js:637-684`): validasi tahun 2000–2100 (`:640`), tolak tahun duplikat
(`:644`), `showConfirm` (`:654`), lalu `DB.tutupBuku.add({tahun, tanggalTutup, waktuTutup,
jumlahTransaksi, omzet, totalModal, totalExpense, totalIncome, laba, kasAkhir,
nonLabaKeluar, nonLabaMasuk, nonTunai})`.

**Nomor transaksi:** `nextNomor` dipanggil **di dalam** `DB.transaction('rw', …)`
(`pos.sync.js:101-102,125-126`) supaya anti-duplikat; form catatan memanggilnya lewat
`pengeluaran.js:22`. Backfill idempoten saat boot (`ensureNomorBackfill`).

**Anti-FOUC:** `#kasCard` diberi `style="display:none"` di HTML (`index.html:92`) supaya
kartu kas tidak sempat muncul sebelum `fiturKasAktif()` terbaca.

---

## 8. POS, Laporan, Backup

### POS — `pos.js` (coordinator + facade) / `pos.ui.js` / `pos.sync.js` / `pos.logic.js`

- **Persistensi keranjang** ada di **`pos.sync.js`**, bukan `pos.js`:
  `CART_KEY:18`, `saveCart:24`, `loadCart:51`, `clearCartStorage:93`.
- Modal keranjang dibangun `openCartModal` di `pos.ui.js:646` (harga baris `.cart-price`
  `:713`); `refreshCartModalTotals:746` mengandalkan `row.querySelector('.cart-price')`
  (`:754`).
- CSS keranjang: `css/style.css:158-165, 226-230, 906, 1144-1157, 1303-1318` (blok terakhir
  menang karena source order). Tidak ada override media-query untuk `.cart-*`.
- Gerbang kas saat simpan penjualan: `pos.js:612`.
- Gerbang kuota: `pos.js:633-650`.

### Laporan — `laporan.js`

Empat periode (Harian/Mingguan/Bulanan/**Custom**, `index.html:183-186`,
`laporan.js:866-868`), kartu statistik, grafik, blok kas dari `kasReportBlocksHtml`,
konsinyasi (aksi Retur/Setor, `laporan.js:529-530`).

### Backup — `backup.js`

`buildBackupPayload()` → `version: 5` berisi `menu, penjualan, pengeluaran, kasShift,
tutupBuku`, plus `settings` tersaring `kategoriCustom`/`suplayerCustom` (`backup.js:163-182`).
**`pengaturan` tidak dicadangkan.** Signature HMAC device-bound (`:36-62`).
`PROTECTED = ['installId','unitId','deviceIdentity','license','onboarded','sync']` dibuang
dari ekspor & impor (`:27`). Cadangan cloud: bucket `backups`, `CLOUD_KEEP = 10` (`:436`),
housekeeping sisakan 10 versi terbaru (`:457-470`).

---

## 9. Cloud / Supabase

Project `https://hhywrvedlwljawgxzpkq.supabase.co` (`js/supabase-config.js:10`); anon key
punya fallback ter-hard-code di `:11` (jangan disalin ke dokumen/commit lain).
Identitas: `APP_TYPE='kaki5'` (`sync.js:31`, `license.sync.js:30`, `app-link.js:15`),
`PRODUCT_PREFIX='KK5'` (`license.sync.js:31`), `VERIFY_TTL_MS=24 jam` (`sync.js:54`).

| Objek cloud | Operasi | Bukti |
|---|---|---|
| tabel `clients` | upsert profil, baca status lisensi | `sync.js:221,299-341,491-503`; `license.sync.js:50,297,334`; `purchase.js:56,345`; `sync.health.js:107` |
| tabel `sync_errors` | catat kegagalan sync | `sync.js:163` |
| tabel `products` | `salt` (`kode_produk='KK5'`), `tx_quota`, `store_url`/`vercel_url`, daftar produk | `license.sync.js:119-137,164-170`; `app-link.js:26`; `purchase.js:102` |
| tabel `settings` (cloud) | `qris_url`, `bank_info`, `app_links` | `purchase.js:100-101`; `app-link.js:43`; `license.sync.js:701` |
| RPC `device_known` | verifikasi perangkat | `sync.js:291,480`; `license.sync.js:66,677`; `purchase.js:323`; `sync.health.js:91` |
| RPC `device_assign` | reassign serial antar perangkat (Opsi 3) | `license.sync.js:618` |
| Storage `backups` | cadangan cloud | `backup.js:436-470` |
| Storage `bukti` | bukti transfer pembelian | `purchase.js:335` |
| Realtime | channel `license:${unitId}`, `postgres_changes` UPDATE `clients` filter `unit_id=eq.` | `purchase.js:439-441`, dilanggan `app.js:1481` |

**`sync.js`** — `ensureSynced()` (dipanggil `app.js:1407`, `settings.ui.js:21`,
`sync.health.js:8`): baca 12 kunci profil (`:178-184`) → upsert `clients` → verifikasi
`device_known` → tulis state `sync`. `startSyncRetryLoop()` retry tiap **5 menit**
(`RETRY_INTERVAL_MS:379`, dipasang `app.js:1447`). `pullCloudProfileTo()` mapping
snake_case→camelCase (`:416-429`) dan hanya menulis bila berubah (`:436-442`).

**`sync.health.js`** — diagnosa 11 langkah berurutan (`:29-196`), modal `#syncDiagModal`
(`index.html:1092`), tombol salin "Kirim ke Admin" (`:1101`, `copy-sync-diag` → `app.js:943`).

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
   `js/pos.ui.js:530`. Elemen `#posCatTabs` memang dihapus dari layout (lihat komentar
   `pos.ui.js:531`) tapi referensinya tertinggal.
2. **`test-modules.js`** — jatuh **bukan** karena gagal impor, melainkan karena child
   `test-html-refs.js` di atas (gate `test-modules.js:89`).
3. **`test-data-actions.js`** — dua kelas:
   - *MISSING handler*: `add-ojol-row` (`index.html:618`) dan `remove-ojol-row`
     (`js/menu.js:303`) tidak punya `case` di `app.js`; keduanya ditangani **listener
     `window.click` kedua di `js/menu.js:318-336`**, sedangkan `DELEGATED_OK`
     (`test-data-actions.js:66-69`) hanya memuat `add-topping-row` & `remove-topping-row`.
   - *DEAD case*: `navigate-pengaturan` (`app.js:447`), `select-topping` (`:775`),
     `remove-topping` (`:794`), `save-expense` (`:835`); `DEAD_OK` hanya mengizinkan
     `open-income-form` (`test-data-actions.js:59`). Catatan: `retry-pos` **tidak** mati —
     terdeteksi dinamis dari `renderPOSError('retry-pos')` (`pos.js:380,442`). Komentar
     `pengeluaran.js:323` ("masih dipanggil lewat case 'save-expense'") sudah tidak benar;
     tombol kini memakai `save-txn` (`index.html:749`).

**Prosedur yang benar:** sebelum menyalahkan kode sendiri, bandingkan sinyal kegagalan
dengan blob `HEAD` (`git show HEAD:kaki5/<path>`). Kalau string pemicunya sama di HEAD,
itu baseline. **Jangan blokir rilis** karena tiga harness ini, dan **jangan tambah korban
baru**.

> Dikonfirmasi ulang pada **v170 / 1.0.102** (2026-09-05): setelah perubahan modal Buka Kas,
> tiga saklar form menu, dan tema gradasi, ketiga harness melaporkan kegagalan yang sama
> persis — 1 orphan `#posCatTabs`, 2 MISSING `*-ojol-row`, 4 DEAD case. `test-css-drift`
> naik dari 833 → **839 rule** (bertambah 6 = blok `.stat-card.kbg-*` v170) dan tetap
> **hijau**, termasuk pemeriksaan "SW cache sinkron".
> Dikonfirmasi ulang pada **v182 / 1.0.107** (2026-09-07): sinyal identik (2 MISSING
> `*-ojol-row` — handler-nya memang hidup di `menu.js`, bukan `app.js`; 4 DEAD case),
> `test-css-drift` kini **856 rule** dan tetap **hijau**.

Harness yang **hijau**: `test-css-drift.js`, `test-db-migrations.js`,
`test-dynamic-imports.js`, `test-imports.js`, `test-shim.js`.

### Dev server

`node server.cjs` → `PORT = 8086` (`server.cjs:9`), bind `127.0.0.1` (`:56`),
`Cache-Control: no-store` (`:34`) sehingga JS tidak mungkin basi saat dev, `/api/*` → 404
JSON (`:29`), SPA fallback → `index.html` **hanya** untuk path tanpa ekstensi (`:30,46-51`).
Sejak hardening 2026-11-06, file statis berekstensi yang hilang dijawab **404 jujur**
(`:42-44`) — dulu 200 `text/html` membuat module graph mati tanpa error yang jelas.

### Rilis

Lihat `../../AGENTS.md` § Rilis dan `../../DEPLOYMENT.md:111-160`. Ringkas:
`push-beta.ps1` → mirror `kasol-beta` → GitHub BETA; setelah stabil `push-live.ps1` →
mirror `kasol` → GitHub LIVE. Guard `Test-SnapshotDrift` memaksa staged index mirror
identik dengan pohon sumber **sebelum** commit (`push-beta.ps1:64-90`), dan secret scan
(`:37-58`) memblokir pola prefix token. Kedua skrip berhenti di `Read-Host`
(`push-beta.ps1:144`, `push-live.ps1:130`) di lingkungan non-interaktif — push manual
setelah itu adalah jalur normal, bukan kegagalan.

---

## 11. Common Pitfalls & Troubleshooting

| Gejala | Penyebab paling mungkin | Cara memastikan |
|---|---|---|
| Tombol/saklar mati **tanpa error di konsol** | nama di `_*WireMap` tidak di-export modul yang di-import `app.js` (facade tidak me-re-export) — lihat §4 | cek `window.<fn>` di konsol; cek daftar re-export facade |
| `Dexie is not defined` di harness | lupa `<script src="dexie.min.js">` di head harness | bandingkan dengan head `index.html` |
| App mati setelah deploy, `Dexie is not defined` | `dexie.min.js` ter-ignore `*.min.js` global | `git ls-files kaki5/dexie.min.js` |
| Overlay "Versi Baru Tersedia" tidak muncul | salah satu dari 6 slot versi tidak di-bump; atau tab sudah di-reload ke versi baru (`update.js:261` bail bila `cacheBust` sama) | bandingkan `version.js`, `version.json`, `sw.js`, `index.html` |
| Cache lama menyajikan JS basi saat dev | SW aktif | pastikan `js/dev-unregister-sw.js` dimuat (`index.html:26`) |
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
                    │  6 .page · 23 modal/sheet · 110 data-action│
                    └───────────────┬──────────────────────────┘
                                    │ dexie.min.js (global) → app.js?v=217 (ESM)
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
                    sw.js: API network-only · HTML cache-first · aset statis CACHE-FIRST (sejak v187)
```

---

*Terakhir diselaraskan dengan kode: **v217 / 1.0.142-beta.1, 2026-11-08**.*
*Sebelumnya dokumen ini merujuk `js/onboarding.js`, port 8123, trial 7 hari + perpanjangan,
dan `rosok.zip` — semuanya sudah tidak ada di kode.*
