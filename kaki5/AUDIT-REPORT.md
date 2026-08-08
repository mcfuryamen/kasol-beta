# Audit Aplikasi — Kasir Solo · Kaki Lima Edition (`kaki5`)

**Tanggal audit:** 2026-08-06
**Lingkup:** Seluruh folder `kaki5/` (HTML, CSS, 21 modul JS ESM, Service Worker, manifest, config deploy, docs).
**Metode:** Baca-tulis seluruh kode sumber, `node --check` pada semua JS, jalankan unit test, cross-referensi DOM id ↔ `getElementById`, dan verifikasi konsistensi gitignore/deploy.

---

## 1. Ringkasan Eksekutif

`kaki5` adalah **PWA SPA frontend-only** (kasir offline untuk PKL) dengan arsitektur ESM yang rapi: state terpusat (`app-state.js`), DB lokal IndexedDB via Dexie, rendering vanilla, dan bridge `window.*` untuk handler HTML. Secara keseluruhan **kodenya sehat dan terstruktur baik**.

Namun ditemukan **3 bug kritis** yang menghantam fungsi inti/produksi, semuanya **sudah diperbaiki** dalam audit ini:

| # | Severity | Masalah | Dampak | Status |
|---|----------|---------|--------|--------|
| C1 | 🔴 Kritis | `*.min.js` di root `.gitignore` meng-ignore `dexie.min.js` (tanpa pengecualian) | App **mati di produksi** (Dexie = `undefined`) | ✅ Fixed |
| C2 | 🔴 Kritis | `showPage('laporan')` memanggil `loadExpenses()` yang men-referensi DOM `#expenseList/#expenseTotal/#expDateNav` yang **sudah dihapus** | Halaman Laporan **throw error** tiap dibuka + pasca-simpan pengeluaran | ✅ Fixed |
| C3 | 🟠 Mayor | `sw.js` precache tidak menyertakan `carousel.js`, `bantuan.js`, `expensedetail.js` | PWA offline-first tidak cache 3 modul → risiko gagal saat offline pertama | ✅ Fixed |
| M1 | 🟠 Mayor | Container `#licenseInfoCard` & `#licUnit` hilang | Kartu info lisensi di Pengaturan **tidak pernah tampil** | ✅ Fixed (2026-08-06) — lalu REGRESS, fixed lagi 2026-08-09 |

**Skor kesehatan:** 🟢 **Baik** setelah perbaikan (sebelumnya 🟡 karena 3 kritis).

---

## 2. Kesehatan Teknis (metrik)

| Cek | Hasil |
|-----|-------|
| `node --check` (21 modul + `test_validate.js` + `sw.js`) | ✅ 23/23 lulus |
| Unit test `validateBackup` | ✅ 14/14 lulus |
| Modul JS | 21 file (~161 KB) |
| Penggunaan `escapeHtml` di render dinamis | ✅ 11 file — semua input user di-escape |
| Cross-ref DOM id ↔ JS | ✅ 7 id "missing" terindentifikasi & diselesaikan |
| Arsitektur | ✅ ESM modular, state via setter, tidak ada global polusi |

---

## 3. Temuan Detail

### C1 — 🔴 `.gitignore` mematikan `dexie.min.js` di produksi
- **Akar:** Root `kasol/.gitignore` punya aturan `*.min.js` **tanpa pengecualian**. `kaki5/dexie.min.js` (80 KB) adalah satu-satunya `.min.js` di app dan ikut ter-ignore.
- **Ironis:** README & IDEA.md **sudah mengingatkan** pitfall ini ("tambahkan `!kaki5/dexie.min.js`"), tapi exception-nya **tidak pernah ditulis**.
- **Dampak:** Saat deploy via GitHub Actions → Vercel, `dexie.min.js` tidak masuk repo → `Dexie` global `undefined` → `new Dexie(...)` di `db.js` throw → **seluruh aplikasi tidak bisa boot**.
- **Perbaikan:** Tambah `!kaki5/dexie.min.js` di root `.gitignore` (sesuai rekomendasi dokumentasi sendiri).

### C2 — 🔴 Crash di halaman Laporan
- **Akar:** Saat refactor "gabung pengeluaran ke Laporan", elemen `#expenseList`, `#expenseTotal`, `#expDateNav` **dihapus dari `index.html`**, tapi fungsi `loadExpenses()` (beserta `renderExpDateNav`, `navExpenseDate`) di `pengeluaran.js` **tetap dipanggil**:
  - `navigation.js:23` → `loadReport(); loadExpenses();`
  - `pengeluaran.js` `saveExpense()` → `await loadExpenses();`
- **Dampak:** Buka tab Laporan → `loadExpenses()` tembak `box.innerHTML` di elemen `null` → **unhandled rejection**. Laporan tetap render (karena `loadReport` jalan duluan), tapi console error + fitur expense terintegrasi tidak tampil. Simpan pengeluaran via FAB → crash juga.
- **Perbaikan:**
  - Hapus fungsi mati `loadExpenses`, `renderExpDateNav`, `navExpenseDate`, `confirmDeleteExpense` dari `pengeluaran.js`.
  - `saveExpense()` kini memanggil `loadReport()` (laporan sudah me-render breakdown pengeluaran).
  - `navigation.js` & `app.js` disesuaikan (import + window-wiring dihapus).

### C3 — 🟠 Service Worker precache tidak lengkap
- `sw.js` `ASSETS_TO_CACHE` hanya 18 modul; **kurang** `carousel.js`, `bantuan.js`, `expensedetail.js`.
- Karena `app.js` meng-`import` ketiganya, saat load online pertama browser tetap cache via fetch-handler → biasanya aman. Tapi bertentangan dengan klaim "v4 precache" dan berisiko gagal jika user buka **offline murni sebelum pernah online**.
- **Perbaikan:** Tambah ke-3 modul ke `ASSETS_TO_CACHE`.

### M1 — 🟠 Container `#licenseInfoCard` & `#licUnit` hilang
- `license.js` (`renderLicenseInfoCard`) dan `settings.js` (`loadSettings`) men-target `#licenseInfoCard` / `#licUnit`, tapi **dua elemen itu tidak ada di `index.html`** (fungsi diam-diam `return`/`guard`).
- **Dampak:** Kartu info lisensi & ID perangkat di Pengaturan **tidak pernah tampil** (fitur terdocumentasi tapi mati).
- **Perbaikan:** Tambah `<div id="licenseInfoCard">` dan `<div id="licUnit">` di kartu versi halaman Pengaturan.

### Minor (tidak blocking)
- **Redundansi wiring** `window`: `window._ksr_closeSheet` didefinisikan di `app.js` *dan* `license.js`; `window.showExpenseDetail`/`initBantuan`/`toggleTutorial` di-self-wire di modul padahal sebagian sudah di-wire di `app.js`. Tidak berbahaya, tapi inkonsisten.
- **Dead code:** `getPengaturan`/`setPengaturan` di `db.js` (legacy tabel `pengaturan`) tidak dipakai di mana pun; `setExpDate` di `app-state.js` tidak dipakai lagi. ✅ *Dihapus (2026-08-07).*
- **Fragile selector:** `pos.js` `openCartModal`/`closeCartModal` pakai `document.querySelector('.modal-overlay')` (ambil overlay *pertama* = cartModal). Aman sekarang, tapi rapuh kalau urutan markup berubah. ✅ *Diganti `getElementById('cartModal')` (2026-08-07).*
- **Drift dokumentasi:** README/IDEA menyebut "24 modul"/"17 modul" (aktual **21**); README bilang "4 tabel" padahal `db.js` v3 punya 5 tabel logis (termasuk `platformMessages`). `sw.js` komentar bilang `v4` tapi daftar precache tidak update.
- **⚠️ Keamanan (caution):** `.env.local` berisi **Supabase `service_role` key** (admin penuh). File memang di-gitignore (tidak ter-commit) dan **tidak dibaca** oleh kode frontend, jadi tidak bocor aktif. Tapi menyimpan `service_role` di file yang dekat dengan client adalah praktik buruk — seharusnya **hanya** ada di server/backend (Supabase Edge Functions), bukan di workspace PWA.

---

## 4. Hal yang Sudah Baik (positif)

- ✅ **Arsitektur ESM bersih:** impor eksplisit, state mutation lewat setter (`app-state.js`), tidak ada polusi global.
- ✅ **XSS di-handle benar:** `escapeHtml` + `buildSafeHtml` dipakai di 11 modul; semua render user-input (nama menu, keterangan, nama warung) di-escape. Tidak ditemukan raw-`innerHTML` dengan data user yang tidak di-escape.
- ✅ **Validasi backup ketat:** `validateBackup()` murni & teruji (14 kasus) — import JSON tidak bisa merusak skema.
- ✅ **Offline/PWA proper:** SW + manifest + installable + cache-first.
- ✅ **Cart persisten** ke `localStorage` (survive tutup-buka app), dengan try/catch saat storage penuh.
- ✅ **Navigasi periode laporan benar** (bulan pakai aritmatika bulan, lintas tahun aman).
- ✅ **Unit test ada & lulus**, syntax semua file valid.

---

## 5. Rekomendasi (prioritas)

1. **Penting:** Pastikan `.gitignore` exception benar-benar masuk ke repo git (PR/deploy) — tanpa ini C1 kembali muncul di produksi.
2. **Penting:** Pindahkan `SUPABASE_SERVICE_ROLE_KEY` keluar dari `.env.local` workspace; gunakan hanya di server. Anon key cukup untuk client.
3. **Menengah:** Hapus dead code (`getPengaturan`/`setPengaturan`, `setExpDate`) & seragamkan pola window-wiring (semua di `app.js`, bukan self-wire di modul).
4. **Menengah:** Samakan dokumentasi dengan realita (jumlah modul 21, 5 tabel, daftar SW).
5. **Kecil:** Ganti `querySelector('.modal-overlay')` di `pos.js` dengan `getElementById('cartModal')` agar tidak rapuh.
6. **Kecil:** Tambahkan test ringan untuk flow POS (addToCart → simpanPenjualan) bila ingin coverage naik.

---

## 6. Log Perubahan (diterapkan dalam audit ini)

| File | Perubahan |
|------|-----------|
| `../.gitignore` (root `kasol`) | Tambah `!kaki5/dexie.min.js` (fix C1) |
| `js/navigation.js` | Hapus import & pemanggilan `loadExpenses()` di `showPage('laporan')` (fix C2) |
| `js/pengeluaran.js` | Hapus fungsi mati (`loadExpenses`, `renderExpDateNav`, `navExpenseDate`, `confirmDeleteExpense`); `saveExpense()` → `loadReport()`; rapikan import (fix C2) |
| `js/app.js` | Sesuaikan import dari `pengeluaran.js` & hapus window-wiring untuk fungsi yang dihapus (fix C2) |
| `sw.js` | Tambah `carousel.js`, `bantuan.js`, `expensedetail.js` ke `ASSETS_TO_CACHE` (fix C3) |
| `index.html` | Tambah `<div id="licenseInfoCard">` & `<div id="licUnit">` di halaman Pengaturan (fix M1) |

**Verifikasi pasca-perbaikan:** `node --check` 23/23 ✅ · unit test 14/14 ✅ · tidak ada referensi fungsi mati tersisa ✅.

> Catatan: `git check-ignore` tidak dapat diverifikasi karena folder ini belum menjadi git repository di environment ini; pengecualian dibuat persis sesuai pola yang direkomendasikan README sendiri (`!kaki5/dexie.min.js`), yang secara semantik git akan meng-un-ignore file tersebut.

---

## 7. Tindak Lanjut — Cleanup Rekomendasi (2026-08-07)

Berdasarkan rekomendasi §5, dikerjakan pembersihan berikut:

| # | Rekomendasi | Status |
|---|---|---|
| R3 | Hapus dead code `getPengaturan`/`setPengaturan` (`db.js`) & `setExpDate` (`app-state.js`) | ✅ Done |
| R3 | Seragamkan window-wiring (semua di `app.js`, bukan self-wire di modul) | ⏭️ Ditunda — tidak blocking, berisiko jika salah sentuh; `expDate` tetap dipertahankan karena masih dipakai `pengeluaran.js` |
| R4 | Samakan dokumentasi (21 modul, 5 tabel aktif + 1 legacy, daftar SW) | ✅ Done |
| R5 | Ganti `querySelector('.modal-overlay')` → `getElementById('cartModal')` di `pos.js` | ✅ Done |
| R6 | Test ringan flow POS (`generatePresetNominal`) | ✅ Done (`test_pos.js`) |

**Catatan implementasi:**
- `expDate` (bukan `setExpDate`) **dipertahankan** — masih dibaca di `pengeluaran.js:30` untuk `tanggal` pengeluaran, jadi hanya setter tak-terpakai yang dihapus.
- `querySelector('.modal-overlay')` memang kebetulan menarget `cartModal` (elemen `.modal-overlay` pertama di DOM), tapi diganti `getElementById('cartModal')` agar tidak rapuh terhadap urutan markup.

**Verifikasi:** `node --check` (db.js, app-state.js, pos.js) ✅ · `node test_pos.js` lulus ✅.

---

## 8. Audit Kedua — 2026-08-09 (Komprehensif Multi-Skenario)

**Tanggal:** 2026-08-09
**Metode:** 60+ skenario uji langsung di browser (IndexedDB seeded, DOM probe, multi-flow exercise).
**Pelingkup:** Seluruh `kaki5/` (HTML, CSS, 24 modul JS, Service Worker, manifest, config deploy).
**Status:** 7 bug ditemukan, **semua sudah diperbaiki dalam audit ini**.

| # | Severity | Modul | Masalah | Dampak | Status |
|---|----------|-------|---------|--------|--------|
| N1 | 🟠 Mayor | `index.html` + `license.js:312` | `<div id="licenseInfoCard">` **tidak ada** di HTML padahal `renderLicenseInfoCard()` reference (REGRESS dari M1) | Kartu info lisensi (status trial/hari tersisa/perpanjangan) tidak pernah tampil di Pengaturan | ✅ Fixed |
| N2 | 🟠 Mayor | `index.html` + `settings.js:44` | `<div id="syncStatusText">` **tidak ada** di HTML padahal `loadSettings()` reference | Status sinkronisasi profil ke Supabase tidak pernah tampil | ✅ Fixed |
| N3 | 🟠 Mayor | `menu.js:51` | Race condition di `openMenuForm(id)` async — rapid click (Tambah lalu Edit) bikin `editId` & `title` mismatch karena `await DB.menu.get()` belum selesai saat sync setter call kedua overwrite | Modal kedap-kedip "Tambah Menu" / "Edit Menu" saat rapid click | ✅ Fixed (serialize via `_menuFormInFlight` + re-check setelah await) |
| N4 | 🟡 Minor | `sync.js:89` | `ensureSynced()` selalu `signInAnonymously()` baru, tidak cache `getSession()` | Tiap sync bikin user anon baru → RLS `auth.uid() = user_id` reject upsert (sync state stuck "pending") | ✅ Fixed (`getSession()` dulu, signIn hanya kalau session kosong) |
| N5 | 🟡 Minor | `expensedetail.js:62`, `license.js:235,405-408` | Duplicate `window.*` assignments untuk `showExpenseDetail`, `_ksr_openLicenseSheet`, `_ksr_openExtendFlow`, `_ksr_activateLicense`, `_ksr_closeSheet` (sudah di-wire di app.js) | Tidak berbahaya (last-write-wins) tapi inkonsisten dgn konvensi "wire di app.js only" | ✅ Fixed (hapus dari modul, biarkan hanya di app.js) |
| N6 | 🟢 Info | `sw.js` | Cache version `v24` perlu di-bump ke `v25` karena ada perubahan modul (sync.js, menu.js, license.js, expensedetail.js) | Browser bisa pakai cache lama kalau tidak bump | ✅ Fixed (v24 → v25) |
| N7 | 🟢 Info | `index.html:209` | Versi "1.0" hard-coded, tidak baca dari constants/SW | Setiap release harus update manual di banyak tempat | ⏭️ Ditunda — bukan blocker |

### Hal yang masih lulus (uji ulang audit kedua)

| Cek | Hasil |
|-----|-------|
| `node --check` 24 modul JS + `sw.js` | ✅ 25/25 lulus |
| Module loading (window globals + ESM imports) | ✅ semua wire benar |
| Dexie IndexedDB (CRUD menu/penjualan/pengeluaran/settings/platformMessages) | ✅ semua tabel ok |
| NaN-safe aggregation (Laporan/Beranda guard `\|\| 0`) | ✅ robust thd data corrupt |
| `setReportPeriod` reset `reportDate` ke hari ini | ✅ cegah date bleed-through |
| Modal overlay click-to-close handler | ✅ jalan |
| Carousel auto-advance (4s) + manual dot click | ✅ jalan |
| Tutorial accordion auto-close | ✅ jalan |
| Region picker (4-level) dari emsifa GitHub raw | ✅ 34 provinsi dimuat |
| Phone validation (lokal/intl/format salah/chars salah) | ✅ 9/9 skenario lulus |
| Backup validator (`validateBackup`) | ✅ 9/9 skenario lulus |
| License validator (format regex + HMAC + device match) | ✅ 4/4 skenario lulus |
| `simpanPenjualan` validation (cart kosong / bayar kurang) | ✅ guard jalan |
| `formatRp` edge cases (NaN/null/Infinity/string) | ✅ tidak throw |
| Service Worker v25 precache semua 24 modul | ✅ cache-first OK |
| Smoke test nav 5 halaman + license card + sync text + tutorial | ✅ 7/7 pass |

### Verifikasi pasca-perbaikan

```
✔ index.html : tambah <div id="licenseInfoCard"> + <div id="syncStatusText">
✔ menu.js    : serialize openMenuForm via _menuFormInFlight (lock + re-check)
✔ sync.js    : getSession() dulu, signInAnonymously() hanya kalau session null
✔ expensedetail.js : hapus self-wire window.showExpenseDetail
✔ license.js : hapus self-wire window._ksr_closeSheet + _ksr_* globals
✔ sw.js      : CACHE_NAME v24 → v25
```

**Smoke test pasca-fix (runtime):**
```
nav-beranda    ✓
nav-jualan     ✓ (2 menu items)
nav-laporan    ✓
nav-pengaturan ✓ (licenseCard render length>50, syncText render length>10)
nav-menu       ✓
openMenuEdit   ✓ (title "✏️ Edit Menu", nama "Bakso" — race resolved)
nav-bantuan    ✓ (11 tutorial panels)
JS errors      0
Sync session   stable (user_id 8941a753 before+after ensureSynced)
```

**Skor kesehatan:** 🟢 **Baik** — semua bug mayor & minor teratasi, tinggal N7 (info-only versi sentralisasi).
