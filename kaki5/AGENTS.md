# AGENTS — Kasir Solo Kaki Lima (kaki5)

Konteks spesifik aplikasi **kaki5** (POS pedagang kaki lima).
Selalu baca [`../CONTEXT.md`](../CONTEXT.md) untuk standar ekosistem — file itu atasan,
dokumen ini bawahan. Untuk detail teknis mendalam: [`docs/DEVELOPER.md`](docs/DEVELOPER.md).

> **Peran khusus:** `CONTEXT.md:71` menetapkan **kaki5 = REFERENSI ARSITEKTUR aplikasi
> klien** (pola kode, sync profil, offline-first). App klien lain meniru kaki5.
> Kesalahan yang dibiarkan di sini akan menular ke aplikasi lain.

---

## 📋 Info Aplikasi

| Item | Value | Bukti |
|------|-------|-------|
| **Folder** | `kaki5/` | — |
| **Port dev server (RESMI, jangan diubah)** | **8086** (bind `127.0.0.1` saja) | `../CONTEXT.md:51`, `server.cjs:9,46` |
| **`APP_VERSION`** | `1.0.99` | `js/version.js:7` |
| **`CACHE_BUST` / SW** | `v167` | `js/version.js:18`, `sw.js:147` |
| **Prefix produk** | `KK5` | `js/license.sync.js:14` |
| **Salt (fallback lokal)** | `KASIRSOLO-KAKI5-HMAC-V2` — salt asli dari cloud `products.salt` | `js/license.logic.js:157`, `js/license.sync.js:102` |
| **`APP_TYPE`** (cloud) | `kaki5` | `js/sync.js:31` |
| **Database Dexie** | `KasirSoloKakiLima`, **skema v8**, 9 object store | `js/db.js:6,137` |
| **`manifest.json`** | name `Kasir Solo - Kaki Lima`, short_name `KasirKaki5` | `manifest.json` |
| **Vercel project** | `kasir-kaki5` (base path `kaki5/`) | `../DEPLOYMENT.md:88` |
| **Domain LIVE** | `kaki5.kasirsolo.com` | `../DEPLOYMENT.md:168` |
| **Repo BETA / LIVE** | `mcfuryamen/kasol-beta` → `<app>.vercel.app` · `mcfuryamen/kasol` → custom domain | `../DEPLOYMENT.md:178-179` |

---

## 🗂️ Struktur File

```
kaki5/
├── index.html              # 1002 baris: 6 halaman .page + 17 modal/sheet + CSP meta (:16)
├── css/style.css           # SATU-SATUNYA stylesheet (dijaga test-css-drift.js)
├── js/                     # 45 file .js — lihat peta modul di docs/DEVELOPER.md §3
│   ├── app.js              # entry: wire window + dispatcher data-action + boot()
│   ├── app-state.js        # satu-satunya holder state (binding read-only + setter)
│   ├── db.js               # Dexie v1..v8 + getSetting/setSetting
│   ├── *.logic.js          # lapisan murni: tanpa DOM/DB (uji unit tanpa browser)
│   ├── *.ui.js             # lapisan DOM: tanpa akses DB
│   ├── *.sync.js           # lapisan cloud
│   ├── settings.js         # FACADE (re-export) — bukan implementasi
│   ├── license.js          # FACADE (re-export)
│   ├── pos.js              # FACADE + orkestrasi
│   └── supabase.min.js     # vendor (harus di-track git)
├── api/supabase-config.js  # serverless: suntik URL/anon-key
├── assets/                 # 8 ukuran ikon + region/provinces.json
├── docs/                   # DEVELOPER.md · REGRESSION-CHECKLIST.md
├── sw.js                   # Service Worker, 3 strategi (lihat § Konvensi 7)
├── server.cjs              # dev server 8086 — DI-GITIGNORE, tidak ikut rilis
├── test-*.js               # harness QA — DI-GITIGNORE (.gitignore:112)
├── DESIGN.md · CHANGELOG.md · README.md · AGENTS.md
└── vercel.json · manifest.json · package.json · .vercelignore
```

---

## ⚠️ Konvensi WAJIB (pelanggaran = bug nyata, bukan gaya)

1. **DILARANG inline handler.** CSP `script-src 'self'` (`index.html:16`) menolak
   `<script>` inline, dan `index.html` sekarang **0** atribut `onclick`/`onchange`.
   Semua interaksi lewat atribut `data-action="nama-aksi"` + `case 'nama-aksi'` di
   `handleDataAction()` (`js/app.js:330`). Dispatcher dipanggil 4 listener delegasi:
   `click` (`:953`), `keydown` Enter/Space (`:982`), `input` (`:1004`), `change` (`:1005`).
   `input`/`change` wajib karena `data-action` di `<input>`/`<select>` tak pernah
   memicu `click`.

2. **JEBAKAN FACADE + WIRE-MAP (akar bug v166).** `app.js` mengisi `window[key]` dari
   modul yang **ia import sendiri**, dengan guard:
   ```js
   if (modKey !== '__wired' && m[modKey] !== undefined) window[key] = m[modKey];
   ```
   (`app.js:72,81,91,101,111,121,132,142`). Kalau nama tidak di-export modul target,
   guard **lolos DIAM-DIAM tanpa error** → `window.fn` `undefined` → fitur mati total
   tanpa jejak di konsol. Karena itu: **setiap nama di `_*WireMap` wajib ada di daftar
   re-export file facade yang di-import `app.js`** (`settings.js`, `pos.js`, `license.js`).
   `settings.js` = facade, `settings.ui.js` = implementasi. Harness QA yang mengimpor
   `settings.ui.js` langsung **tidak akan** menangkap lubang ini.

3. **`escapeHtml` / `buildSafeHtml` untuk SEMUA nilai dinamis** yang masuk HTML.
   Nilai dari user (nama menu, catatan, nama usaha) tidak pernah boleh ditempel mentah.

4. **Rilis = bump 6 slot sinkron** (lihat `docs/REGRESSION-CHECKLIST.md` §3):
   `APP_VERSION`, `CACHE_BUST`, `version.json.version`, `version.json.cacheBust`,
   `sw.js CACHE_NAME`, `index.html ?v=`. Salah satu tertinggal → overlay update tidak
   muncul (`js/update.js:79` bail bila `remote.cacheBust === CACHE_BUST`) dan cache SW
   tidak invalid. Insiden tercatat: `CHANGELOG.md:95`.

5. **`app-state.js` read-only.** Mutasi state hanya lewat setter yang diekspor modul itu;
   jangan menulis properti binding state langsung dari modul fitur.

6. **Migrasi DB bersifat aditif — DILARANG drop tabel/kolom.** `db.version(N)` hanya boleh
   menambah store/index. Tabel `kas` lama sengaja **tidak** di-drop walau isinya sudah
   dimigrasi ke `pengeluaran` oleh `db.version(8).upgrade()` (`js/db.js:124-127,147-174`).
   Tabel `pengaturan` juga legacy dan tidak dibaca kode lagi, tapi tetap dipertahankan.

7. **SW punya 3 strategi, bukan satu.** `/supabase.co` → network-only (`sw.js:242`);
   HTML → **cache-first** supaya bisa navigasi offline (`sw.js:253`); aset statis →
   network-first dengan fallback cache (`sw.js:273`). Jangan tulis "network-first" saja
   di dokumen — itu salah dan sudah sempat menyesatkan.

8. **Cloud = sumber kebenaran untuk lisensi & profil** (`../CONTEXT.md:87-101`), tapi
   **offline-first**: gagal jaringan tidak boleh mengubah/menghapus state lokal.
   `ensureSynced()` push otomatis bersifat **backfill-only**; menimpa cloud hanya lewat
   `force` (form profil / tombol sinkron / retry pending).

9. **Keputusan pemilik soal gerbang lisensi (2026-08-29):** kuota transaksi habis
   **TIDAK** mengunci aplikasi — hanya banner `#quotaBanner` + blokir transaksi
   (`js/app.js:260-276`, `js/pos.js:552-557`). Yang boleh full-lock **hanya** revoke
   admin, lewat `lockOverlay` (`js/license.ui.js:178`). Jangan "memperbaiki" ini.

10. **Fitur kas bisa dimatikan user.** Gerbang `fiturKasAktif()` ada di `js/kas.js:136,
    158, 218, 273, 329, 374` dan `js/pos.js:529`. Saat mati, kios boleh jualan tanpa
    buka kas. **Jangan pernah menghapus baris `kasShift` user** saat mematikan fitur;
    shift yang masih terbuka harus bisa ditutup setelah fitur nyala lagi.
    Dua aturan yang menjaga gerbang ini tetap jujur (bug 2026-09-04: kios bisa jualan
    tanpa buka kas padahal Pengaturan menampilkan "aktif"):
    (a) `fiturKasAktif()` **wajib membaca DB tiap dipanggil** — jangan kembalikan cache
    "baca sekali", karena IndexedDB dipakai bersama antar tab/jendela dan cache yang
    menyimpang membuat gerbang POS terbuka diam-diam;
    (b) saklar **wajib disinkronkan dari DB di awal `loadSettings()`**, sebelum panggilan
    cloud mana pun, karena `index.html` men-hardcode `checked` + teks "transaksi diblok
    kalau kas belum dibuka" pada saklar itu — `pullCloudProfileIfOnline()` tidak punya
    timeout, jadi kalau menggantung tampilan tetap mengaku fitur AKTIF.

---

## 🧪 QA

Jalankan dari CWD `kaki5` (`test-html-refs.js` memakai `process.cwd()`):

| Harness | Status baseline |
|---|---|
| `test-css-drift.js`, `test-db-migrations.js`, `test-dynamic-imports.js`, `test-imports.js`, `test-shim.js` | ✅ hijau |
| `test-data-actions.js`, `test-html-refs.js`, `test-modules.js` | ❌ **merah sejak rilis 1.0.97** — bukan regresi baru |

Penyebab merah & daftar `DELEGATED_OK`/`DEAD_OK` dijelaskan di
`docs/REGRESSION-CHECKLIST.md` §5. **Jangan memblokir rilis karena tiga harness itu**,
tapi jangan juga menambah korban baru: bandingkan dulu dengan blob `HEAD` sebelum
menyimpulkan regresi.

---

## 🚀 Rilis

Alur 2-mirror (`../DEPLOYMENT.md:127-181`): folder kerja → `push-beta.ps1` → mirror
`kasol-beta` → GitHub BETA → `<app>.vercel.app`. Stabil → `push-live.ps1` → mirror
`kasol` → `kaki5.kasirsolo.com`.

Catatan operasional yang terbukti di mesin ini:

- Kedua skrip **selalu berhenti di `Read-Host`** (non-interaktif) *setelah* snapshot
  ter-commit dan branch di-rename `main`. Push manual berikutnya itu jalur normal:
  `git -C <mirror> -c http.postBuffer=524288000 -c http.lowSpeedLimit=1000 -c http.lowSpeedTime=60 push origin main --force-with-lease=main:<SHA_REMOTE_LAMA>`
  (SHA lama diambil dari `git ls-remote` **sebelum** push — lease polos tidak andal
  karena skrip menghapus branch `main` lokal).
- **Bukti rilis = 4 jalur independen**, bukan output git: `ls-remote`, `fetch` +
  `FETCH_HEAD`, API `curl.exe`, dan **isi file di `raw.githubusercontent.com`**.
  `gh api` rusak di mesin ini — pakai `curl.exe -s --noproxy '*'`.
- **`git add -A` DILARANG.** Stage file tracked saja: `git add -u kaki5`. Artefak
  `_qa-*` dan `rosok/*` jangan sampai ikut.
- **Commit/push hanya atas perintah eksplisit pemilik.**

---

## 🔒 Data user

Aplikasi ini dipakai untuk mencatat uang asli. Aturan kerja QA yang terbukti:

- Jangan reload/navigate tab aplikasi user saat keranjang terbuka (cart hanya di memori
  + `localStorage['kaki5-cart']`).
- Aksi `check`/`uncheck` pada saklar di app asli **menulis ke IndexedDB user** — siapkan
  rencana pemulihan sebelum mencoba.
- Verifikasi state lewat **dump read-only**, bukan screenshot.
- Harness QA berdiri sendiri wajib meniru head `index.html`: `<script src="dexie.min.js">`
  (db.js memakai global `Dexie`) dan `js/dev-unregister-sw.js`.

---

## 📚 Dokumen Terkait

| Dokumen | Isi |
|---|---|
| `README.md` | fitur & cara pakai, skema DB, arsitektur 3-layer |
| `docs/DEVELOPER.md` | peta 45 modul, boot sequence, lisensi, kas, cloud, QA |
| `docs/REGRESSION-CHECKLIST.md` | kelas bug berulang, aturan bump versi, baseline harness |
| `DESIGN.md` | model lisensi/kuota & kontrak cloud-nya |
| `CHANGELOG.md` | riwayat rilis per `vNNN / 1.0.NN` |
| `../CONTEXT.md` | standar ekosistem (port registry, lisensi hybrid, arah cloud) |
| `../DEPLOYMENT.md` | alur rilis 2-mirror, guard drift, domain |
