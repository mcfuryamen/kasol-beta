# Anti-Regression Checklist — kaki5

Guardrail manual + otomatis supaya kelas bug lama tidak kembali.
Dibuat 2026-08-11 (bagian dari rencana perbaikan P1–P7); **diselaraskan ulang dengan kode
v217 / 1.0.142-beta.1 pada 2026-11-08.**

Acuan: [`../AGENTS.md`](../AGENTS.md) · [`DEVELOPER.md`](DEVELOPER.md) ·
[`../../CONTEXT.md`](../../CONTEXT.md) · [`../../DEPLOYMENT.md`](../../DEPLOYMENT.md)

---

## 1. Kelas bug yang dijaga

Aplikasi ini punya **lima** kelas regresi berulang; empat di antaranya **senyap** — tidak
melempar error, tidak muncul di konsol:

1. **Null-guard DOM menelan elemen hilang.** `render*()` memanggil
   `getElementById`, tidak menemukan apa pun, guard null-nya diam-diam menghentikan
   render → fitur hilang tanpa jejak.
2. **`data-action` tanpa `case`** (atau sebaliknya). Tombol terlihat tapi tidak melakukan
   apa pun.
3. **Silent-skip facade + wire-map.** `app.js` menyalin fungsi ke `window` dengan guard
   `if (m[modKey] !== undefined)`. Nama yang tidak diekspor modul target **dilewati tanpa
   error** → `window.fn` `undefined` → fitur mati total. Ini penyebab bug saklar kas v166
   (lihat `DEVELOPER.md` §4) dan **kelas bug paling aktif** di kaki5.
4. **Kontrol disembunyikan tapi nilainya tetap tersimpan** (komentar browser 2026-09-05,
   diperbaiki v170). Saklar "Pakai Stok" / "Harga Ojol" / "Topping" dulu cuma
   `display:none`, sehingga angka lama tidak terlihat **tapi tetap ikut tersimpan**.
   Aturan: kalau saklar mati, bersihkan tampilannya **dan** nolkan di jalur tulis.
5. **Gerbang yang masih punya jalan keluar dari UI** (diperbaiki v170). Modal "🔓 Buka Kas"
   mengaku mengunci dashboard padahal tombol "Batal", Escape, klik backdrop, dan pindah tab
   semuanya menutupnya. Aturan: satu daftar `HARD_GATE_OVERLAYS`, tanpa aksi tutup dari UI,
   dan tolak submit kosong (kosong ≠ 0).
   > **Revisi v181:** gerbang kas **sengaja** tidak lagi jadi hard gate. `bukaKasModal`
   > keluar dari `HARD_GATE_OVERLAYS` dan hanya mengunci halaman Jualan lewat watcher
   > `armKasGateWatcher()` (`js/kas.js:175-191`). Yang wajib tetap tanpa jalan keluar dari UI
   > tinggal `lockOverlay` (revoke admin) dan `updateOverlay` (force update).

Contoh historis kelas 1: `#licenseInfoCard` (kartu lisensi di Pengaturan berhenti
dirender).

---

## 2. Aturan: setiap `getElementById` harus resolve

Id yang dipakai `document.getElementById('...')` **wajib** ada di salah satu dari:

1. **statis** di `index.html` (`id="..."`), atau
2. **disuntik sebelum pemakaian pertama** (`id="..."` di template string, atau
   `el.id = '...'` di modul yang jalan lebih awal).

Kalau menghapus elemen dari `index.html`: hapus **semua** `getElementById` yang
mereferensikannya, atau null-guard aksesnya secara sadar.

### Id kritis — masih hidup, perlakukan ekstra hati-hati

| Id | Pemilik | Fitur |
|----|---------|-------|
| `#licenseInfoCard` | `license.ui.js` | kartu status lisensi di Pengaturan |
| `#licUnit` | `license.ui.js` | identitas unit lisensi |
| `#installBanner` | `pwa.js` (disuntik) | banner instal PWA |
| `#platCarouselRoot`, `#platTrack` | `carousel.js` (disuntik) | banner/promo platform |
| `#buktiInput`, `#buktiPreview`, `#submitPurchaseBtn` | `purchase.js` (disuntik) | pembelian lisensi + bukti transfer |
| `#kasCard` | `kas.js` / `index.html:92` | kartu kas di Beranda (**punya `style="display:none"` anti-FOUC**) |
| `#fiturKasToggle` | `settings.ui.js` | saklar fitur Buka/Tutup Kas (v166) |
| `#bukaKasModal` (`index.html:760`), `#tutupKasModal` (`:774`), `#tutupBukuModal` (`:813`), `#kasShiftDetailModal` (`:1023`) | `kas.js` | modal kas, tutup buku, dan detail riwayat shift (v169). **Sejak v181 `#bukaKasModal` BUKAN hard gate lagi** — `.modal-center`, tanpa tombol "Batal", Escape/backdrop/navigasi boleh menutup, tapi watcher `armKasGateWatcher()` membukanya lagi selama masih di Jualan tanpa shift |
| `#heldFab`, `#heldListModal` | `pos.ui.js` | pesanan ditahan |
| `#cartModal`, `#menuSelectorModal`, `#returModal` | `pos.ui.js` / `laporan.js` | keranjang, selector menu, retur konsinyasi |
| `#quotaBanner` | `app.js:299-317` (`showQuotaBanner`) | banner kuota habis (tidak mengunci app) |
| `#lockOverlay` | `license.ui.js:183` (`enforceRevoked`) | full-lock **hanya** untuk revoke admin |
| `HARD_GATE_OVERLAYS` | `js/modal.js:48` | satu daftar gate yang dipakai Escape, `closeAllModals()`, klik backdrop/navbar (`app.js:1153-1171`), dan `navigation.js:70`: **hanya** `lockOverlay` + `updateOverlay` (`bukaKasModal` keluar Sejak v181). Menambah jalur tutup dengan `except:` sendiri = regresi v170 |
| `#bantuanTabTc` → `#bantuanPanelTc` + `#tcAcceptRow` (`index.html:380`) | `app.js:280-292` (`_ksr_acceptTC`) | S&K = **TAB** di Bantuan, bukan modal lagi (`#tcModal` dihapus 2026-09-14) |
| `#updateOverlay` | `update.js` | modal "Versi Baru Tersedia" |
| `#syncDiagModal` (+ `#syncDiagTitle`, `#syncDiagContent`) | `sync.health.js` | diagnosa sync 12 langkah (0–11) |
| `#reportPeriodTabs`, `#reportDateNav`, `#reportContent` | `laporan.js` | periode laporan (termasuk tab **Custom**) |
| `#appVersionLabel` (`index.html:320`), `#profileBanner` (`:392`) | `app.js:1552` / `beranda.js` | label versi & banner profil |

> **Id yang sudah MATI — jangan ditulis ulang di kode atau dokumen mana pun:**
> `#syncStatusText`, `#licenseGate`, `#gateLicenseBlock`, `#gateSerial`, `#gateLicMsg`,
> `#customStartInput`, `#customEndInput`. Tidak ada satu pun yang muncul di `index.html`
> maupun di `js/`. Periode Custom kini memakai tab `data-action="report-period-custom"`
> (`index.html:185`) dengan input tanggal yang disuntik ke `#reportDateNav`.
>
> **Yatim yang masih tertinggal di kode:** `getElementById('posCatTabs')` di
> `js/pos.ui.js:530` — elemennya memang dihapus dari layout (lihat komentar `pos.ui.js:531`).
> Ini satu-satunya penyebab `test-html-refs.js` merah (lihat §5).

---

## 3. Aturan: bump versi harus jalan berenam

Sumber kebenaran versi adalah `js/version.js`, tapi **enam slot** harus naik bersamaan.
Satu saja tertinggal → overlay update tidak muncul (`update.js:261` bail bila
`remote.cacheBust !== CACHE_BUST`) dan cache SW tidak invalid.

| # | Slot | Nilai kini (v217) |
|---|---|---|
| 1 | `js/version.js` → `APP_VERSION` (`:7`) | `1.0.142-beta.1` |
| 2 | `js/version.js` → `CACHE_BUST` (`:18`) | `v217` |
| 3 | `js/version.json` → `"version"` (`:2`) | `1.0.142-beta.1` |
| 4 | `js/version.json` → `"cacheBust"` (`:3`) | `v217` |
| 5 | `sw.js` → `CACHE_NAME` (`:237`) **dan** komentar "Cache version vNNN" (`:5`) + blok catatan rilis di bawahnya | `kasir-solo-kaki5-v217` |
| 6 | `index.html` → `js/app.js?v=` (`:1161`) | `?v=217` |

`version.json.notes[]` juga diisi — itu isi overlay "Yang Baru" untuk user.

> **Insiden tercatat:** `CHANGELOG.md:746` — `sw.js`/`index.html` naik ke v100 sementara
> `version.js`/`version.json` tertinggal di v99. `push-beta.ps1` sekarang mencetak
> `[WARN]` bila `kaki5/` berubah tanpa `version.json` di-bump (`push-beta.ps1:126-136`).

### Checklist bump cache SW

- [ ] Sufiks `CACHE_NAME` baru, **strictly greater** dari sebelumnya.
- [ ] Aset baru/berubah benar-benar masuk daftar precache `assetsToCache`
      (mis. `css/style.css` — temuan mayor di masa lalu; dijaga `test-css-drift.js`).
- [ ] Query `?v=` pada `<script>`/`<link>` di `index.html` ikut naik.
- [ ] Penghapusan cache lama masih bekerja
      (`caches.keys().filter(k => k !== CACHE_NAME)` di activate handler, `sw.js:333`).
- [ ] Bila menyentuh PNG ikon (`assets/icon-*.png`): **verifikasi CRC per-chunk** —
      pelajaran v182: `icon-192`/`icon-512` punya IHDR CRC salah (header ditulis ulang
      tanpa hitung CRC) → browser menolak decode → splash PWA fallback ikon kecil = buram,
      dan file tetap terlihat "PNG valid" dari magic bytes. Cek cepat: loop
      `zlib.crc32(chunk)` vs CRC tersimpan (PIL pun menolak file semacam ini).

---

## 4. Aturan: `data-action` wajib berpasangan

Setiap atribut `data-action="x"` (**110** buah di `index.html`) harus punya
`case 'x'` di `handleDataAction()` (`js/app.js:391`) — **dan sebaliknya**.

Kecuali yang memang ditangani listener lokal; daftar pengecualian hidup di
`DELEGATED_OK` (`test-data-actions.js:66`) dan `DEAD_OK` (`:59`). Menambah pengecualian
harus disertai alasan di komentar.

Dispatcher dipanggil dari **empat** listener delegasi: `click` (`app.js:1153`),
`keydown` Enter/Space (`:1184`), `input` (`:1206`), `change` (`:1207`).
`input`/`change` ada karena `data-action` pada `<input>`/`<select>`/saklar **tidak pernah**
memicu `click`. Inline handler dilarang CSP (`index.html:16`).

---

## 5. Harness otomatis — cara pakai & **status baseline**

Jalankan dengan **CWD `kaki5`** (`test-html-refs.js` memakai `process.cwd()`).

### ✅ Hijau per 2026-11-08 (v217) — wajib tetap hijau

```bash
node test-css-drift.js        # 943 rule, 1 link, 1 file, parse OK, precache SW sinkron
node test-imports.js          # 49/49 modul js/*.js dimuat di browser-stub
node test-dynamic-imports.js  # 24/24 target import('./x') literal ada
node test-db-migrations.js    # skema v1..v8 berurutan, tidak ada tabel/index hilang
node test-shim.js             # browser-stub itu sendiri
node test-modules.js          # ⚠️ MERAH karena child html-refs (lihat di bawah)
node test-html-refs.js        # ⚠️ MERAH (lihat di bawah)
node test-data-actions.js     # ⚠️ MERAH (lihat di bawah)
```

### ❌ MERAH SEBAGAI BASELINE — bukan regresi baru

**Status diukur langsung (bukan disalin dari dokumen lama) pada 2026-11-08, v217:**

| Harness | Pemicu spesifik (terukur) |
|---|---|
| `test-html-refs.js` | **1** ref yatim: `getElementById('posCatTabs')` di `js/pos.ui.js:530` (49 modul, 267 ref, 266 id statis + 36 dinamis) |
| `test-modules.js` | jatuh **karena** child `test-html-refs.js` di atas (child dijalankan `test-modules.js:67`, gate exit `:89`), bukan karena gagal impor |
| `test-data-actions.js` | (a) `add-ojol-row` (`index.html:618`) & `remove-ojol-row` (`js/menu.js:303,327`) ditangani listener `window.click` lokal di `js/menu.js:318` tapi tidak terdaftar di `DELEGATED_OK`; (b) **3** "DEAD case": `navigate-pengaturan` (`app.js:447`), `remove-topping` (`:794`), `save-expense` (`:835`) — `select-topping` sudah **tidak** mati |

> Catatan: `add-topping-row` & `remove-topping-row` **sudah** terdaftar sebagai delegated
> (`menu.js:282-290`), jadi jangan salah menambahkannya ke daftar masalah.

**Prosedur wajib sebelum menyalahkan kode sendiri:**

1. Catat pesan kegagalan harness.
2. Bandingkan pemicunya dengan blob `HEAD`:
   `git show HEAD:kaki5/<path>` — kalau string yang sama juga ada di `HEAD`, itu baseline.
3. Boleh lanjut rilis. **Jangan** memblokir rilis karena tiga harness ini, dan **jangan**
   menambah yatim/case mati baru.
4. Kalau memperbaiki salah satunya, perbarui tabel ini.

> `retry-pos` **tidak** termasuk case mati — terdeteksi dinamis dari
> `renderPOSError('retry-pos')` (`pos.js:380,442`).

### File test yang TIDAK ADA (jangan dijalankan)

`test_validate.js` dan `test_pos.js` disebut di dokumen lama tetapi **sudah tidak ada** di
repo — siapa pun yang menjalankan "full suite" versi lama akan kena `MODULE_NOT_FOUND`.
Validasi backup kini dijaga lewat `backup.js` + `test-imports.js`, dan perhitungan POS
lewat `pos.logic.js` / `kas.logic.js`.

---

## 6. Sebelum commit & rilis

- [ ] `git add -u kaki5` — **bukan** `git add -A`. Artefak `_qa-*`, `rosok/*`,
      `.github/github-app.yml` tidak boleh ikut.
- [ ] Enam slot versi naik sinkron (§3) + `version.json.notes` terisi.
- [ ] Tidak ada inline `onclick`/`onchange`/`oninput` yang baru (CSP).
- [ ] Semua nilai dinamis lewat `escapeHtml` / `buildSafeHtml`.
- [ ] Kalau menambah fungsi yang dipanggil dari HTML: sudah masuk `_*WireMap` **dan**
      sudah di-re-export oleh modul yang di-import `app.js` (§1 kelas 3).
- [ ] Kalau menyentuh `DB.kasShift` / data user: gerbang `fiturKasAktif()` tidak dilewati
      dan tidak ada baris shift user yang terhapus.
- [ ] Kalau menambah/mengubah **gerbang yang membaca `settings`**: nilainya dibaca SEGAR
      dari DB saat gerbang dievaluasi, bukan dari cache modul. Cache = bohlam lintas-tab
      (bug v167: kios bisa jualan tanpa buka kas).
- [ ] Kalau menambah **saklar/checkbox di Pengaturan**: state-nya disinkronkan dari DB di
      AWAL `loadSettings()`, sebelum `await` jaringan apa pun, dan `index.html` TIDAK
      boleh mengaku posisi "aktif" lewat atribut `checked`/teks default yang salah.
- [ ] Kalau ada `await` panggilan cloud di jalur render: pastikan ada timeout atau
      sudah didahului render lokal, supaya jaringan lambat tidak membekukan tampilan.
- [ ] Kalau **saklar menyembunyikan blok input**: nilainya ikut dibersihkan di tampilan
      (`el.value=''` / render grid kosong) **dan** dinolkan di jalur tulis `save*()`.
      `display:none` saja = angka lama tetap tersimpan tanpa terlihat (kelas 4, v170).
- [ ] Kalau menambah **modal gerbang**: daftarkan id-nya ke `HARD_GATE_OVERLAYS`
      (`js/modal.js:48`), hapus aksi tutup dari UI (tidak ada `data-action="close-..."`),
      dan tolak submit saat input wajib masih kosong. Semua jalur tutup harus menyapu
      daftar yang sama (kelas 5, v170). **Kecuali** gerbang yang memang per-halaman
      (seperti `bukaKasModal` sejak v181) — kalau begitu, watcher yang menegakkan ulang
      wajib ada dan diuji.
- [ ] Kalau mengubah **tema/warna permukaan**: cek kontras teks di atasnya, dan pastikan
      kelas warna yang dipakai ganda (mis. `.kbg-*` untuk kartu statistik **dan** tile ikon
      pengaturan) tidak ikut berubah — pakai selector gabungan
      (`.stat-card.kbg-*`, `css/style.css:982-994`). `.btn-wa` tetap hijau gelap solid
      (permintaan pemilik 2026-09-04).
- [ ] Migrasi DB aditif — tidak ada tabel/kolom yang di-drop.
- [ ] Rilis **hanya atas perintah eksplisit pemilik**.

### Bukti rilis = 5 jalur independen (bukan output git)

1. `git ls-remote origin refs/heads/main`
2. `git fetch` + `git rev-parse FETCH_HEAD`
3. API: `curl.exe -s --noproxy '*' https://api.github.com/repos/<owner>/<repo>/branches/main`
   (`gh api` rusak di mesin ini)
4. **Isi file** di `raw.githubusercontent.com/.../kaki5/js/version.js` — SHA benar tapi isi
   salah tetap lolos di tiga jalur pertama.
5. **Konten yang benar-benar terhidang** di domain-nya: `kq5beta.vercel.app` untuk BETA dan
   `kaki5.kasirsolo.com` untuk LIVE. Cek `/js/version.json`, `/sw.js` (`CACHE_NAME`), dan
   `/` (untuk `app.js?v=`). Jangan fetch `/index.html` — ia **308** ke `/`.
   > **Jangan pakai field `homepage` repo GitHub** sebagai acuan URL. Untuk `kasol-beta`
   > field itu menunjuk `kaki5beta.vercel.app` yang **404 semua path**; project Vercel-nya
   > bernama `kaki5beta` tapi domainnya `kq5beta.vercel.app`. Cara murah dan benar:
   > `vercel project ls`.

---

## 7. Kalau kena regresi

1. Jalankan lint terkait — `test-html-refs.js` menyebut id + `file:line`;
   `test-data-actions.js` menyebut aksi yang tidak berpasangan.
2. Kembalikan elemen ke `index.html` **atau** suntik sebelum pemakaian pertama.
3. Untuk kelas 3: cek `window.<namaFungsi>` di konsol, lalu cek daftar re-export facade.
4. Pastikan fungsi pemilik benar-benar menemukannya (verifikasi di app, bukan dari
   screenshot saja).
5. **Bump enam slot versi** (§3) supaya perbaikan benar-benar sampai ke user.
6. Perbarui `CHANGELOG.md` dengan judul `## <tanggal> (vNNN / 1.0.NN: judul)`.

---

*Sinkron dengan kode v217 / 1.0.142-beta.1 (2026-11-08). Dokumen lama menyebut `APP_VERSION
'1.0.18'`, `CACHE_BUST 'v85'`, "42/42 module imports" (kini **49/49**), dan
`test_validate.js`/`test_pos.js` — semuanya sudah tidak berlaku.*
