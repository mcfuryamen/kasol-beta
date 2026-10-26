# QA & RELEASE CHECKLIST — Kasir Solo - Rosok

Dokumen SOP HIDUP (bukan arsip). Dipakai setiap kali akan bump/rilis.
Lahir dari insiden: toast tak terlihat berbulan-bulan (1.4.13), drift
`version.js` v72 vs `version.json` v73 di beta (overlay palsu), vendor
`supabase.min.js` hilang dua kali karena `.gitignore` mirror, bug guard
`await isLicensed()`, dan race render ganda riwayat.

---

## A. Sebelum commit (per perubahan)

- [ ] Syntax ESM: `cp js/<x>.js /tmp/<x>.mjs && node --check /tmp/<x>.mjs`
- [ ] Sweep referensi fungsi yang dihapus/diubah: `grep -rn "<namaLama>" js/ index.html`
- [ ] Handler baru di HTML → `window.<nama>` diekspos di modul pemiliknya
- [ ] Guard async di-`await` (pelajaran `isLicensed`); dites DUA ARAH
- [ ] Verifikasi UI mengukur **visibilitas**, bukan hanya DOM:
      `getComputedStyle` + `getBoundingClientRect` (on-viewport) —
      assertion `textContent`/`classList` SAJA tidak membuktikan apa pun
- [ ] QA lokal via `node run-local.js` (port 8084). ⚠️ SW menyajikan cache lama →
      `unregister()` semua registrasi + reload, baru ukur; setelah selesai biarkan
      app mendaftarkan SW kembali

## B. Bump versi = 4 slot SINKRON (satu angka, mis. `1.4.13` / `v74`)

| # | File | Field |
|---|------|-------|
| 1 | `js/version.js` | `CACHE_BUST = 'vNN'` (+ `APP_VERSION` bila ada perubahan fitur) — **paling sering terlupa! (insiden v73 beta)** |
| 2 | `js/version.json` | `"version"`, `"cacheBust"`, `"notes"` (bahasa user, bahan overlay) |
| 3 | `sw.js` | `CACHE_VERSION = 'vNN'` (+ `?v=NN` pada entri `style.css`/`app.js` di `CORE_ASSETS`; file baru WAJIB ditambahkan ke daftar) |
| 4 | `index.html` | `?v=NN` pada `style.css` dan `js/app.js` |

- [ ] `version.json` TIDAK pernah masuk `CORE_ASSETS` (harus network-murni)
- [ ] Entri `CHANGELOG.md` (bahasa fitur untuk pemilik/user, bukan commit note)
- [ ] `js/bantuan.js` → `CHANGELOGS`: salin poin user-facing ke entri BARU di
      PALING ATAS (chip "TERPASANG" pindah otomatis mengikuti `APP_VERSION`)
- [ ] Cek konsistensi cepat:
      `grep -o "v7[0-9]\|v8[0-9]" rosok/js/version.{js,json} rosok/sw.js && grep -o "?v=7[0-9]" rosok/index.html`

## C. Mirror & rilis

- [ ] **BETA (dibolehkan setelah fix disetujui):** semua yang ingin rilis sudah
      ter-commit di `main` work dir → `echo y | powershell -File ../push-beta.ps1`
      (guard secret + drift otomatis; skrip men-squash snapshot jadi 1 commit)
- [ ] **LIVE: HANYA dengan perintah EKSPLISIT pemilik per rilis** (approval "gas"
      atas fix BUKAN izin live) → `../push-live.ps1` (promosi `refs/beta/main`)
- [ ] Konfirmasi push GitHub bila belum menjadi bagian perintah

## D. Verifikasi deployment (domain publik, BUKAN URL per-deployment)

```bash
B=https://rosok-beta.vercel.app   # atau https://rosok.kasirsolo.com utk live
curl -s  $B/js/version.js   | grep -E "^export const"        # vNN + X.Y.Z
curl -s  $B/js/version.json | grep -E "version|cacheBust"    # SAMA dengan version.js
curl -s  $B/sw.js | grep -oE "CACHE_VERSION = '[^']+'"       # vNN
curl -s  $B/index.html | grep -o "?v=[0-9]*" | sort -u       # hanya ?v=NN
curl -sI $B/dexie.min.js        | grep -i content-type       # application/javascript!
curl -sI $B/js/supabase.min.js  | grep -i content-type       # application/javascript!
curl -s  $B/CHANGELOG.md | head -6                           # entri rilis terbaru
```

- [ ] `text/html` di mana pun = file HILANG dari deployment (catch-all rewrite 200!)
      → cek negasi `.gitignore` di WORK TREE (`git check-ignore -v` + `git ls-tree HEAD -- <file>`)
- [ ] `version.js` TERDEPLOY == `version.json` TERDEPLOY → kalau beda, klien dapat
      overlay update palsu/permanen
- [ ] Markup kunci ikut terverifikasi, contoh saat ini:
      `curl -s $B/index.html | grep -o '<div class="toast"[^>]*>'`

## E. Catatan lingkungan QA (berlaku lintas app kasol)

- Preview in-app WAJIB URL localhost (rosok 8084; kaki5 8086; control 8082)
- QA Playwright terisolasi pakai origin `127.0.0.1` (IndexedDB per-origin!) —
  JANGAN pernah menyentuh origin `localhost:8084` milik data asli pemilik
  (insiden restore sintetis 2026-09-08)
- Celah evaluate yang error di tengah meninggalkan async page-side yang menyela
  pengukuran berikutnya → reload dulu sebelum timeline baru
- Screenshots IAB bisa gagal persisten di sesi tertentu — fallback ukur DOM
  (teknik resmi di ekosistem ini)

---

*QA-RELEASE-CHECKLIST.md — Rosok · dibuat 2026-09-14 (rilis v1.4.13/v74)*
