# AUDIT REPO — Kasir Solo - Rosok

**Tanggal audit:** 2026-11-08
**Snapshot kode:** `1.4.24` / `v85` (branch `main`, working tree rosok bersih)
**Commit terakhir yang menyentuh `rosok/`:** `ea9bea2` (2026-11-08)
**Metode:** pembacaan kode statis seluruh `js/*.js`, `index.html`, `sw.js`,
`manifest.json`, `vercel.json`, `run-local.js`, `.env.local` (nama key saja),
`.gitignore`/`.vercelignore`, serta perbandingan paritas dengan `kaki5/`.
Perbandingan versi & precache diverifikasi satu per satu ke disk.
**Status:** DOKUMEN SNAPSHOT (arsip) — menggambarkan kondisi saat tanggal di atas,
bukan status hidup. Untuk SOP rilis harian pakai `docs/QA-RELEASE-CHECKLIST.md`.
**Perubahan kode:** tidak ada. Temuan murni saran, belum dieksekusi.

---

## Ringkasan

| Severity | Jumlah | Inti |
|---|---:|---|
| **P0** | 1 | Dev server `run-local.js` menyajikan `.env.local` (berisi `SUPABASE_SERVICE_ROLE_KEY`) + CORS `*` + bind semua interface |
| **P1** | 6 | Route typo `/laporan` crash; token precache SW `?v=83`; blok update warisan di `app.js`; XSS atribut (akar: `escapeHtml` tanpa escape kutip); `CHANGELOG.md` tertinggal; `assets/logo.svg` tak diprecache |
| **P2** | 11 | Signature cadangan opsional; tanpa CSP; deep link multi-segmen; render ganda; async tanpa catch; precache all-or-nothing; router tanpa `pushState`; `/api/supabase-config` hantu; tanpa `Cache-Control`; artefak QA ikut deploy; dokumen drift |
| **P3** | 12 | Leak listener/timer, dead code, aset & vendor berserakan, manifest non-standar, secret lisensi di klien |

Catatan positif (terverifikasi): seluruh 41 entri `CORE_ASSETS` ada di disk;
tidak ada modul JS yatim; semua pemanggil `getSupabaseClient()` memeriksa `null`;
`skipWaiting`/`SKIP_WAITING`/`controllerchange` di `js/update.js` + `sw.js`
internal konsisten; anon key di `js/supabase-config.js:11` wajar (publishable).

---

## P0 — Dev server membocorkan kunci `service_role`

**File:** `run-local.js:33`, `run-local.js:47`, `run-local.js:51`, `run-local.js:62`,
`.env.local:4`

```js
res.setHeader('Access-Control-Allow-Origin', '*');                        // :33
let filePath = path.join(ROOT, pathname === '/' ? 'index.html' : pathname); // :47
fs.readFile(filePath, (err, data) => { ... });                             // :51
server.listen(PORT, () => { ... });                                        // :62 — tanpa host
```

**Bukti (dijalankan):** resolusi path `/.env.local` →
`C:\Users\Admin\Documents\kasol\rosok\.env.local` (berkas ada, 587 B, memuat
`SUPABASE_SERVICE_ROLE_KEY`). Tidak ada filter file tersembunyi, sehingga
`/.env.local` dan `/.git/config` dapat diambil apa adanya.

**Dampak:** kunci `service_role` menembus RLS — seluruh database Supabase dapat
dibaca/diubah/dihapus. CORS `*` + bind semua interface membuat berkas ini bisa
diambil perangkat lain di LAN yang sama, dan oleh situs web apa pun yang sedang
dibuka di browser developer (halaman jahat cukup `fetch('http://127.0.0.1:8084/.env.local')`).

**Catatan:** `.env.local` **tidak pernah** ter-commit (`git log --all -- .env.local`
kosong) dan sudah ada di `.gitignore:1` serta `.vercelignore:21`. Jadi ini murni
permukaan server dev, bukan kebocoran repo.

**Saran:** bind `server.listen(PORT, '127.0.0.1')`; hapus header CORS `*`; tolak
path yang memuat segmen berawalan `.` dan batasi ke whitelist folder/ekstensi;
jangan simpan kunci `service_role` di direktori aplikasi klien (pindahkan ke luar
`rosok/` atau ke secret store terpisah).

---

## P1-1 — Deep link `/laporan`, `/pengaturan`, `/riwayat` mematikan setengah aplikasi

**File:** `js/router.js:12`, `js/nav.js:28`, `js/app.js:323,326`

```js
'/riwayat': '/riwayat', '/laporan': '/laporan', '/pengaturan': '/pengaturan',  // router.js:12
document.getElementById('screen-'+name).classList.add('active');              // nav.js:28 — tanpa null guard
```

**Analisis:** dua lapis kesalahan bertumpuk.
1. `router.js:12` memetakan ke string **berslash**, padahal id elemen adalah
   `screen-laporan`. Komentar di baris 11 (`Riwayat tergabung ke halaman laporan`)
   menunjukkan niat sebenarnya: `'/riwayat': 'laporan'`.
2. `nav.js:28` tidak memakai null guard (sementara baris lain di file yang sama,
   `wizardBar`/`stokBar`/`kasBar`, sudah di-guard dengan `if(...)`).

**Akibat berantai (terverifikasi runtime 2026-11-09, Playwright + Chrome):**
`showScreen('/laporan')` → `null.classList` → `TypeError`. Karena `showScreen`
men-deactivate **semua** `.screen` **sebelum** baris yang melempar, hasilnya
**layar kosong** — bukan kembali ke dashboard (koreksi atas dugaan awal di draf
laporan ini). Lalu, karena `markReady()` (`app.js:323`) dipanggil **di luar**
blok try/catch `initApp`, exception menjalar keluar; `startUpdateWatcher()`
(baris 326) tidak pernah dieksekusi dan sisa handler `load` (termasuk
`hideBootSplash()`) ikut terlewat — splash hanya terselamatkan timer darurat
3,5 dtk (`app.js:454`).

**Suguhan ke pemakai:** refresh/bookmark/back di `/laporan`, `/pengaturan`, atau
`/riwayat` ⇒ **layar kosong** + deteksi update mati selama sesi itu.

**Saran:** ubah pemetaan menjadi `'riwayat': 'laporan'`, `'/riwayat': 'laporan'`,
`'/laporan': 'laporan'`, `'/pengaturan': 'pengaturan'`, dan tambahkan guard pada
`showScreen`. Pindahkan `markReady()`/`startUpdateWatcher()` ke jalur yang tetap
jalan walau routing gagal.

---

## P1-2 — Slot versi ke-5 (token precache SW) ketinggalan di `v83`

**File:** `sw.js:8,10` vs `index.html:25,842`, `js/version.js:18`, `js/version.json:3`

```js
const CACHE_VERSION = 'v85';                 // sw.js:5
"./", "./index.html", "./style.css?v=83",    // sw.js:8  ← DRIFT
"./js/app.js?v=83",                          // sw.js:10 ← DRIFT
```

`index.html` meminta `style.css?v=85` dan `js/app.js?v=85`; `version.js`/`version.json`
sama-sama `v85`. `caches.match()` pada `sw.js:91` memakai `ignoreSearch: false`
(default), sehingga key `?v=83` **tidak akan pernah** cocok dengan permintaan `?v=85`.

**Dampak:** dua entri precache menjadi beban mati; saat offline permintaan
`js/app.js?v=85` gagal di cache lalu jatuh ke fallback `caches.match("./index.html")`
⇒ modul JS menerima `text/html` ⇒ aplikasi tidak bisa boot offline sampai ada satu
kunjungan online yang meng-cache URL `?v=85`.

**Akar:** konvensi resmi di `js/version.js:10-15` menyebut **4 slot** (CACHE_BUST,
`version.json`, `CACHE_VERSION`, `?v=` di `index.html`). Token `?v=` di dalam
`CORE_ASSETS` tidak termasuk daftar itu sehingga rutin terlupa saat bump.

**Saran:** hapus query dari `CORE_ASSETS` (`"./js/app.js"`, `"./style.css"`) atau
generate seluruh token dari satu konstanta; perbarui komentar konvensi agar
menyebut slot ke-5.

---

## P1-3 — Mekanisme update warisan di `app.js` bertabrakan dengan alur OKE

**File:** `js/app.js:168-184` (bandingkan `kaki5/js/app.js:1543`)

```js
reg.addEventListener("updatefound", function () {                 // :171
  const nw = reg.installing;
  nw.addEventListener("statechange", function () {
    if (nw.state === "activated") {                               // :176
      showConfirm({ icon:'🔄', text:'Update tersedia. Reload sekarang?', okLabel:'Reload Sekarang' })
        .then(ok => { if(ok) window.location.reload(); });
    }
  });
});
navigator.serviceWorker.addEventListener("controllerchange", () => window.location.reload()); // :183
```

Kontrak resmi alur update dinyatakan di `js/update.js:12-16` dan `:26-31`:
SW **tidak** `skipWaiting` otomatis, overlay hanya boleh ditutup dengan OKE, dan
reload hanya sah setelah `SKIP_WAITING` → `controllerchange`, dijaga `RELOAD_FLAG`
(`sessionStorage`). Blok di `app.js` melewati seluruh kontrak itu:

1. **`app.js:183` reload tanpa syarat.** Karena `sw.js:43` memanggil
   `clients.claim()`, event `controllerchange` juga menyala pada **instalasi SW
   pertama** ⇒ halaman reload sendiri di kunjungan pertama. Blok ini juga tidak
   memakai `RELOAD_FLAG`.
2. **`app.js:171-179` menambah jalur reload kedua**, sehingga saat OKE di overlay
   ditekan bisa muncul confirm "Update tersedia" bersamaan dan reload dua kali.
3. **Paritas:** di kaki5 handler `controllerchange` yang setara **bukan** reload,
   melainkan `checkForUpdate()` (`kaki5/js/app.js:1543`). Jadi ini paritas yang
   belum diport ke rosok.

**Saran:** hapus blok `updatefound`/`controllerchange` di `app.js`; biarkan
`js/update.js` menjadi pemilik tunggal alur update. Bila `controllerchange` tetap
diperlukan, ganti isinya menjadi panggilan `checkForUpdate()` seperti kaki5.

---

## P1-4 — XSS konteks atribut (akar: `escapeHtml` tidak meng-escape tanda kutip)

**File:** `js/utils.js:51-56`

```js
export function escapeHtml(text){
  if(!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;      // meng-escape & < > saja — KUTIP LOLOS
}
```

Kaki5 sudah memakai peta penuh (`kaki5/js/helpers.pure.js:6-16`):
`String(s).replace(/[&<>"']/g, ...)` → meng-escape `"` dan `'`. Rosok belum —
padahal migrasi itu tercatat pernah disiapkan. Akibatnya **setiap** pemakaian
`escapeHtml()` di dalam `attr="..."` tetap bisa dipecah.

Titik yang terverifikasi lolos:

| Lokasi | Bukti | Jalur masuk |
|---|---|---|
| `js/riwayat.js:139-146` | `proofSrc` hanya dicek **prefiks** (`/^data:image\//` \|\| `/^https:\/\//`), lalu masuk ke `src="${proofSrc}"` **dan** `onclick="window.open('${proofSrc}')"` | Berkas cadangan JSON yang diedit / dikirim via WhatsApp. `validateBackup` (`js/backup.js:152-160`) **tidak memvalidasi `buktiBayar` sama sekali** ⇒ payload `https://x" onerror="alert(1)` lolos whitelist prefiks dan memecah atribut `src` |
| `js/kategori.js:19` | `<div class="row-icon green-soft">${k.emoji||'♻️'}</div>` — mentah | `emoji` juga tidak divalidasi (`backup.js:148-153`) ⇒ eksekusi otomatis saat layar Stok dibuka. Di `js/pos.js:43` sudah di-escape, jadi hanya halaman Stok yang terkena |
| `js/bantuan.js:478,488` | `const judul = escapeHtml(item.judul…)` → `<iframe … title="${judul}">` | `judul` berasal dari `products.tutorials` (Supabase, diedit via Control) ⇒ kutip tidak ter-escape, `title` bisa dipecah + `onload` disisipkan |
| `js/carousel.js:29-30` | `style="background:${m.gradient…}"` dan `${m.emoji…}` mentah | Saat ini `platformMessages` hanya di-seed lokal (`js/app-state.js:117-128`), jadi belum jalur serangan jarak jauh — tapi rapuh |

Karena origin sama, XSS di sini bisa membaca IndexedDB (data usaha) dan
`localStorage` (termasuk token sesi Supabase — lihat P2-1).

**Saran:** ganti `escapeHtml` rosok dengan peta penuh seperti kaki5, tambahkan
`escapeAttr()` untuk interpolasi atribut, validasi ketat `buktiBayar`
(`^data:image\/(png|jpe?g|webp|gif);base64,[A-Za-z0-9+/=]+$` atau `^https://` **utuh**),
whitelist `emoji`, dan render bukti transfer lewat DOM (`img.src`, `addEventListener`)
alih-alih string `innerHTML`.

---

## P1-5 — `CHANGELOG.md` tertinggal satu rilis dan 5+ commit

**File:** `CHANGELOG.md:3` (entri teratas `1.4.23`, 2026-09-17) vs `js/version.js:17`
(`1.4.24`) dan `js/bantuan.js:269` (changelog in-app sudah `1.4.24`).

`git log -S "1.4.24" -- rosok/CHANGELOG.md` kosong walaupun commit bump `f12228c`
mengklaim changelog diperbarui. Commit yang menyentuh `rosok/` setelah 2026-09-17
dan tidak terdokumentasi: `5573678` (hapus referensi gerobak), `ae48aca`
(logo + dashboard), `953d800` (ikon PWA), `e9556fd` (branding & splash),
`ea9bea2` (CRM/growup, akun mitra, migrasi Supabase — `js/app.js`,
`js/license.sync.js`, `js/purchase.js`).

**Saran:** tambahkan entri `1.4.24` (dan rilis yang menyusul) dengan tanggal serta
nomor `sw vN`, sesuai format entri di atasnya.

---

## P1-6 — `assets/logo.svg` dipakai tiga tempat, tapi tidak diprecache

**File:** dipakai di `index.html:34,39,810` dan `js/app.js:165`;
`sw.js:20-21` hanya memuat `./assets/logo.png`.

**Dampak:** saat offline, logo boot/header/overlay tidak ditemukan di cache lalu
jatuh ke fallback HTML (`sw.js:91`) ⇒ gambar rusak (bukan ikon).

**Saran:** tambahkan `"./assets/logo.svg"` ke `CORE_ASSETS`.

---

## P2 — Daftar temuan

### P2-1. Signature cadangan bersifat opsional
`js/backup.js:199-205` — `if (data._signature && data._signatureVersion === 1) { … }
else { console.warn('[BACKUP] File tanpa signature — restore diperbolehkan …') }`.
Menghapus dua field dari JSON cukup untuk melewati verifikasi HMAC. Bersama P1-4
ini menghilangkan hambatan integritas untuk berkas cadangan yang beredar bebas.
*Saran:* wajibkan signature untuk impor berkas lokal, atau sanitasi ketat semua
field teks sebelum `applyBackupData` (saat ini `buktiBayar`, `emoji`, `kontakNama`,
`catatan`, `keterangan`, `catatanTutup` tidak divalidasi).

### P2-2. Tidak ada CSP sama sekali
`index.html` tidak memuat `<meta http-equiv="Content-Security-Policy">` dan
`vercel.json:9-18` hanya mengirim `X-Content-Type-Options`, `X-Frame-Options`,
`X-XSS-Protection` (yang terakhir sudah usang dan bukan pengganti CSP). Ada
**83 atribut `onclick`** + 6 `onchange` + satu `<script>` inline
(`index.html:338-353`), sehingga CSP ketat belum mungkin tanpa refactor ke
dispatcher `data-action` (pola yang sudah dipakai kaki5). *Saran:* migrasi dulu ke
`addEventListener`, lalu pasang CSP + `Referrer-Policy`, `Permissions-Policy`, HSTS.
Catatan: `run-local.js` juga tidak mengirim header keamanan apa pun (clickjacking lokal).

### P2-3. Deep link multi-segmen rusak (referensi path relatif)
`index.html:25,842` memakai `href="style.css?v=85"` / `src="js/app.js?v=85"`, dan
`js/update.js:34` `VERSION_URL = './js/version.json'`. Pada URL `/transaksi/beli`,
base menjadi `/transaksi/` ⇒ permintaan mengarah ke `/transaksi/js/app.js`.
Rewrite `vercel.json:6-8` membalas `index.html` dengan status **200** `text/html`,
sehingga gagal MIME dan `js/update.js:246-248` menelan error diam-diam.
*Saran:* pakai path absolut (`/js/app.js`, `/js/version.json`, `/sw.js`) dan
batasi rewrite hanya untuk route aplikasi.

### P2-4. Dashboard dirender dua kali saat boot
`js/app.js:318` (`await refreshAll()`) lalu `js/app.js:323` `markReady()` →
`router.js:47` → `handleInitialRoute()` → `showScreen('dashboard')` →
`js/nav.js:39` `refreshAll()` lagi. `refreshAll` membaca `db.kas`/`db.transaksi`
(`js/dashboard.js:51,59`) dan me-render ulang carousel. *Saran:* buang `refreshAll()`
dari `initApp` atau lewati render route pertama.

### P2-5. Banyak pemanggilan async tanpa `await`/`.catch`
`js/nav.js:32,36,37,39`, `js/app.js:322,461`. `renderStok`, `renderLaporan`,
`renderRiwayat`, `refreshAll`, `checkLicenseGate`, `maybeOfferCloudRestore`
semuanya `async` tapi dipanggil telanjang; `try { maybeOfferCloudRestore(); }`
hanya menangkap throw sinkron. Kegagalan IndexedDB/jaringan menjadi
`unhandledrejection` dan UI berhenti setengah render tanpa pesan.
*Saran:* `void fn().catch(...)` atau `await` di dalam try.

### P2-6. Precache all-or-nothing
`sw.js:31-34` — `c.addAll(reqs)` menolak seluruh batch bila satu aset gagal;
fallback pun `c.addAll(...)` lagi. SW baru tidak pernah mencapai status `waiting`,
`js/update.js` menunggu 20 detik lalu membatalkan ⇒ update macet sampai aset
diperbaiki. *Saran:* `Promise.allSettled` per aset (`cache.add` individual).

### P2-7. Router tidak `pushState` saat pindah layar
`js/router.js:32-37` — `navigateTo` hanya dipakai sebagai `window._ksr_navigateTo`
dan tidak pernah dipanggil (`grep` bersih); `showScreen` tidak memanggil
`history.pushState`. Akibat: tombol Back browser tidak kembali antar layar, dan
shortcut PWA (`manifest.json:33-42` memakai `./#/transaksi`, `./#/laporan`) tidak
pernah resolve karena `router.js:28-30` membuang hash. *Saran:* panggil
`navigateTo` dari handler navigasi, atau dukung hash routing dan samakan URL shortcut.

### P2-8. `/api/supabase-config` di-fetch padahal tidak ada
`js/supabase-config.js:27-40` mem-fetch endpoint itu, tetapi folder `api/` tidak
ada di `rosok/`; rewrite catch-all membalas `index.html` 200 ⇒ `res.json()` reject
dan ter-catat sebagai warning tiap load produksi. *Saran:* tambahkan fungsinya atau
hapus cabang fetch; periksa `content-type` sebelum `json()`.

### P2-9. Tidak ada `Cache-Control` di kedua jalur
`run-local.js:57` hanya menetapkan `Content-Type`; `vercel.json` hanya header
keamanan. `index.html`, `sw.js`, dan `js/version.json` idealnya `no-cache`
(sinyal rilis), sedangkan aset berversi boleh `immutable`. Tanpa ini, deteksi rilis
bergantung heuristik cache host.

### P2-10. Artefak QA ter-track dan ikut ter-deploy
`outputDirectory: "."` (`vercel.json:4`) + `.vercelignore` hanya mengecualikan
`*.log`. File yang ter-track dan berpotensi diakses publik:
`screenshot-1-onboarding.png` … `screenshot-6-pos.png` (±878 KB total, berisi data
contoh usaha), `SMOKE_TEST_CHECKLIST.html`, `_license_test.html`,
`browser-smoke-test.js`, `smoke-test.js`, `test-persistence.js`, `test-pos-grid.js`,
`verify-persistence.js`, `run-local.js`. Selain itu 7 PNG di root
(`favicon-16/32`, `icon-192/512`, `logo.png`, `logo-rosok.png`, `splash-1028.png`)
adalah **duplikat persis** dari `assets/` (blob hash sama) sebesar ±2,85 MB dan
tidak dirujuk HTML/manifest/SW. *Saran:* pindahkan skrip tes ke `tools/`, tambahkan
artefak tersebut ke `.vercelignore`, hapus duplikat root (`logo-rosok.png` 2,2 MB
tidak dirujuk siapa pun).

### P2-11. Drift dokumen
| Dokumen | Baris | Isi sekarang | Seharusnya |
|---|---|---|---|
| `README.md` | 10, 171 | `1.4.22` / `v83` | `1.4.24` / `v85` |
| `README.md` | 85 | Bantuan "2 tab sticky: Tutorial dan Changelog" | 3 tab `Tutorial \| Video \| S & K` + Changelog berupa modal `#modalChangelog` |
| `AGENTS.md` | 21, 174 | `1.4.22` / `v83`; Bantuan 2 tab | idem |
| `DESIGN.md` | 6, 261 | `1.4.22` / `sw v83`; Bantuan 2 tab | idem |
| `docs/QA-RELEASE-CHECKLIST.md` | 38 | pola grep `v7[0-9]\|v8[0-9]` dan `?v=7[0-9]` | tidak bisa mencocokkan `v85` ⇒ checklist mengembalikan hasil kosong |
| `docs/AUDIT_FIXES.md` | 79-81, 141, 202 | mengacu `js/onboard.js:9-24` untuk `loadSettingsIntoState()` | fungsi kini di `js/app-state.js:77` |
| `docs/SMOKE_TEST_FINAL_REPORT.md` | 4, 13-15 | "PARTIAL PASS", "Production Readiness: NOT YET" | temuan Agustus 2026 sudah lama diperbaiki — perlu banner arsip agar tidak disalahpahami |

---

## P3 — Kebersihan & sisa kecil

1. **Secret penandatangan lisensi ada di bundle klien** — `js/license.js:18,20`
   (`PRODUCT_SALT`, `LICENSE_SECRET_V1`) dan `js/license.sync.js:71`
   (`FALLBACK_PRODUCT_SALT`). Bukan kebocoran data, tapi HMAC lisensi/kuota offline
   bisa dipalsukan siapa pun yang membaca bundle. Verifikasi lisensi idealnya
   server-side (Supabase sudah jadi sumber kebenaran).
2. **Leak listener/timer** — `js/carousel.js:18` keluar lebih awal sebelum
   `platStopAuto()`; listener `controllerchange` di `js/update.js:153-158` tidak
   dibersihkan saat timeout menang; `setInterval(checkLicenseGate, 60000)`
   (`js/app.js:461`) tidak pernah dibersihkan.
3. **Closure state basi** — `js/region.js:193-243`: listener dipasang sekali
   (guard `dataset.regionWired`) tetapi menangkap objek `state` dari pemanggilan
   pertama, sedangkan `openAlamatSheet` membuat objek baru setiap kali.
4. **Dead code** — `SCREEN_TO_ROUTE` (`js/nav.js:16-20`) tidak dipakai; import
   `fmtRupiah, fmtKg, fmtDate, todayStr, showLoading, hideLoading, escapeHtml`
   dan `getRoute` di `js/app.js:7,17` hanya muncul di baris import; event
   `router:ready` (`js/router.js:44`) tidak pernah di-`dispatchEvent`.
5. **`sw.js:54`** memakai `new URL(...).origin.includes(self.location.origin)`;
   sebaiknya `===` + cek `e.request.mode === 'same-origin'`.
6. **`sw.js:60-63`** cabang `version.json` tanpa `.catch` ⇒ offline menghasilkan
   network error, bukan respons terkontrol.
7. **Vendor & aset** — `dexie.min.js` dan `js/supabase.min.js` ada di root/`js/`;
   lebih rapi di `assets/vendor/`. `_license_test.html` rusak (import
   `./app-state.js`, seharusnya `./js/app-state.js`) dan tidak dirujuk siapa pun.
8. **`manifest.json:9-11,47-48`** memuat anggota non-standar (`splash_pages`,
   `apple_touch_icon`, `msapplication_tilecolor`) yang diabaikan browser; ikon
   `"purpose": "any maskable"` memakai satu gambar tanpa safe-area maskable terpisah.
9. **`package-lock.json` di-ignore** padahal `package.json` punya dependency
   (`puppeteer-core`) ⇒ build/dev tidak reproducible (kebijakan monorepo, layak ditinjau).
10. **Rosok tidak unregister SW di localhost** — kaki5 punya
    `kaki5/js/dev-unregister-sw.js` sedangkan `js/app.js:168` selalu mendaftarkan SW;
    saat dev lokal, cache lama bisa menyajikan kode basi.
11. **`run-local.js:54`** merefleksikan `req.url` pada respons 404 (Content-Type
    `text/plain`, jadi tidak dieksekusi — tetap sebaiknya tidak merefleksikan input).
12. **Penyimpanan lokal** — token sesi Supabase (`persistSession: true`,
    `js/license.sync.js:34`) tersimpan plaintext di `localStorage`; status
    lisensi/kuota plaintext di IndexedDB `settings` dengan signature bersalt
    hardcoded (lihat P3-1). Tidak ada PIN/password di aplikasi. Mitigasi utama =
    perbaiki P1-4 + P2-2.

---

## Urutan perbaikan yang disarankan

| Prioritas | Paket kerja |
|---|---|
| 1 | **P0** `run-local.js` hardening (bind 127.0.0.1, buang CORS `*`, tolak dotfile, whitelist folder) + pindahkan `service_role` keluar direktori klien |
| 2 | **P1-1** typo route + guard `showScreen`; **P1-2** precache `?v=`; **P1-3** hapus blok update warisan `app.js` |
| 3 | **P1-4** `escapeHtml` full-map + `escapeAttr` + validasi `buktiBayar`/`emoji` di `validateBackup`; **P2-1** signature cadangan wajib |
| 4 | **P1-6** precache `logo.svg`; **P2-3** path absolut; **P2-6** precache per-aset; **P2-9** header cache |
| 5 | **P1-5** changelog + **P2-11** drift dokumen; **P2-10** bersihkan artefak deploy |
| 6 | Sisa P2/P3 (CSP, render ganda, async catch, dead code) |

Setiap perbaikan wajib lewat `docs/QA-RELEASE-CHECKLIST.md` (syntax ESM, sweep
referensi, verifikasi UI dengan pengukuran visibilitas) dan — untuk rosok —
diingat bahwa `sw.js` menyajikan cache lama saat QA lokal.

---

## Status perbaikan (diperbarui 2026-11-09)

| Temuan | Status | Commit |
|---|---|---|
| **P0** — `run-local.js` membocorkan `.env.local` (`service_role`) | ✅ **DIPERBAIKI** — loopback-only (opt-in LAN berperingatan), CORS `*` dihapus, segmen tersembunyi + `node_modules`/`package*.json` ditolak, kontainmen `path.resolve` di dalam ROOT, `decodeURIComponent` sebelum cek, 404 generik, `405` untuk non-GET, header `nosniff`/`X-Frame-Options`/`Referrer-Policy` | `f9edf25` |
| **P1-1** — route typo + boot berhenti | ✅ **DIPERBAIKI** — peta route memakai nama layar, `showScreen` mundur ke dashboard (tidak melempar), `safeShow` di router, guard terpisah `markReady()`/`startUpdateWatcher()`, handler `load` tidak lagi melewati `hideBootSplash()`, dead code `SCREEN_TO_ROUTE` dibuang | `23635e3` |

**Bukti verifikasi P0 (curl):** `/`, `index.html`, `js/app.js?v=85`, `style.css?v=85`,
`sw.js`, `js/version.json`, `assets/logo.svg`, `assets/region/provinces.json` → 200
dengan MIME benar; `/.env.local`, `/.env`, `/.git/config`, `/.gitignore`,
`/.vercel/project.json`, `/node_modules/.package-lock.json` → 404; enam varian
traversal (`%2e%2e%2f`, `..%2f`, `%2e%2e%5c`, `/../kaki5/...`) → 404; tidak ada
`Access-Control-Allow-Origin`; `POST` → 405; `netstat` menunjukkan bind
`127.0.0.1:8084` saja (bukan `0.0.0.0`).

**Bukti verifikasi P1-1 (Playwright, Chrome, service worker diblokir, deep link
direproduksi seperti rewrite Vercel):** baseline SEBELUM fix **7/13** — ketiga
deep link menghasilkan `aktif=[]` (layar kosong) + `Cannot read properties of null
(reading 'classList')`; SESUDAH fix **13/13 PASS** — `/laporan` & `/riwayat`
membuka `screen-laporan`, `/pengaturan` membuka `screen-pengaturan`, 0 pageerror,
navigasi internal 5 layar tetap benar. Skrip QA sengaja **tidak** di-commit
(dijalankan dari temp) agar diff repo hanya berisi perbaikan.

**Belum dirilis.** Kedua commit ada di `main`; versi tetap `1.4.24/v85` (belum
di-bump) dan **belum masuk beta/live** — menunggu perintah rilis pemilik.

**Sisa antrean dari laporan ini:** P1-2 (precache `?v=83`), P1-3 (blok update
warisan `app.js:183`), P1-4 (XSS atribut / `escapeHtml` full-map), P1-5
(CHANGELOG), P1-6 (`logo.svg` precache), lalu 11 P2 dan 12 P3.
