# 🚨 LAYOUT, CSS & UI/UX AUDIT — KASIR SOLO KAKI5
**Tanggal:** 2026-08-22
**Versi auditan:** 1.0.14 (index.html + sw.js cache v69)
**Metode:** Audit statis (15 file CSS, index.html, manifest, sw.js, 40+ modul JS) **+ audit runtime di browser nyata** (viewport 390×844, 768×1024, 1280×800) + test bawaan (`test-css-drift.js`, `test-html-refs.js`, `test-modules.js`)

> ✅ **UPDATE 2026-08-22 (post-audit): HOTFIX P0 SUDAH DIIMPLEMENTASIKAN & DIVERIFIKASI (v1.0.15 / SW v70).**
> K1+K2+K3 diperbaiki: CSP tanpa nonce (`style-src 'self' 'unsafe-inline'`, `script-src 'self'`), `style.css` dimuat blocking normal, script nonce & dead code dihapus, dev SW-unregister dieksternalkan ke `js/dev-unregister-sw.js`.
> Bukti pulih (origin bersih): kartu statistik hijau `rgb(232,245,233)`, `#greetText` 14px, `#updateOverlay` hidden/fixed, stat-grid 3 kolom @1280px. Screenshot: `.scratch/audit-shots/07–11`.
>
> ✅ **UPDATE 2026-08-22 (lanjutan): SPRINT P1 HARDENING SELESAI & DIVERIFIKASI (v1.0.16 / SW v71).**
> T2 (`--paper` didefinisikan), T3 (`theme_color` → `#D6501C`), M1–M4 (tabindex `#trialChip` + keyboard, toast `role=status`, Escape-to-close, scroll-lock) beres.
> Bonus fix kritikal pre-existing: **21 handler `data-action` yang hilang** setelah refactor `onclick` → `data-action` (termasuk `add-to-cart`, `change-qty`, `set-nominal-bayar`, `activate-license` — POS & lisensi sempat mati total di working tree) + delegasi event `input`/`change` untuk data-action di elemen input. Semua 72 action kini tertangani (diverifikasi E2E: tambah item → keranjang → modal → Escape → pencarian → keyboard).
> Styling kritikal overlay (`#licenseGate`, `#cartBar`, guard `#updateOverlay`) dipindah dari inline ke file CSS dengan paritas style.css.
> ✅ **UPDATE 2026-08-22 (lanjutan 2): SPRINT P2 KONSOLIDASI SELESAI & DIVERIFIKASI (v1.0.17 / SW v72).**
> T1 beres: `css/style.css` kini **satu-satunya stylesheet** — 67 selector modular-only + `@keyframes licenseProgress` dilebur ke dalamnya (diverifikasi level-selector & level-deklarasi: 0 bocor); 13 file css modular dihapus; index.html & precache SW hanya memuat 1 file CSS (dulu 14 request). M5 beres: breakpoint banner profil disatukan ke 414px. M6 beres: skeleton otomatis terdedup. Dead code `TEMPLATES` di `templates.js` dihapus. `test-css-drift.js` ditulis ulang sebagai guard single-source.
> Verifikasi runtime 8086: 1 link CSS, v1.0.17, semua computed style tetap benar, date-picker kustom hidup (bg #FFF3E0), desktop 3 kolom, Escape + scroll-lock jalan.
> ✅ **UPDATE 2026-08-22 (lanjutan 3): SPRINT P3 DOKUMENTASI SELESAI (tanpa bump versi — murni docs).**
> README.md (struktur folder), docs/DEVELOPER.md (guard single-source), docs/REGRESSION-CHECKLIST.md (precache & guard), DESIGN.md (warna primer `#D6501C`) disinkronkan dengan arsitektur pasca-konsolidasi. Tidak ada referensi arsitektur CSS lama tersisa (terverifikasi grep).
> Sisa backlog strategis saja: migrasi bertahap ~343 inline style → kelas CSS (untuk suatu saat memperketat CSP tanpa `unsafe-inline`).

> ⚠️ **Audit ini menggugurkan kesimpulan audit 2026-08-21 (skor 9.1/10).**
> Audit kemarin murni statis — tidak menjalankan aplikasi. Audit hari ini menemukan
> **dua bug CSP yang membuat layout aplikasi benar-benar rusak saat dirender browser modern.**

---

## 📊 EXECUTIVE SUMMARY

| Aspek | Skor Runtime Saat Ini | Potensi Setelah Fix P0 |
|-------|----------------------|------------------------|
| **Visual Render Aktual** | 🔴 3/10 | 8.5/10 |
| **Responsive di Layar** | 🔴 3/10 (breakpoint ≥900 mati total) | 9/10 |
| **CSS Architecture** | 🟠 5/10 (dual-source, master bukan superset) | 8.5/10 |
| **Design System (kode)** | 🟢 8.5/10 | 8.5/10 |
| **Accessibility** | 🟡 7/10 | 8/10 |
| **Performance CSS** | 🟡 6.5/10 (15 file, 2× payload) | 9/10 |
| **PWA/Manifest** | 🟢 8/10 | 8.5/10 |
| **TOTAL BERAT** | **🔴 4.6/10** | **8.5/10** |

**KESIMPULAN SATU KALIMAT:** Design system di kode tetap bagus, tapi **meta CSP di `index.html` memblokir semua inline `style=""` (382 titik!) dan membunuh pemuatan `style.css`** — sehingga apa yang dilihat pengguna Chrome modern saat ini jauh dari desain yang dimaksud: kartu statistik kehilangan warna, overlay kehilangan posisi fixed, dan seluruh breakpoint tablet/desktop tidak pernah aktif.

---

## 🔴 TEMUAN KRITIS (P0 — layout rusak nyata, terverifikasi runtime)

### K1. CSP memblokir SEMUA inline style attribute — 382 titik styling mati

Meta CSP di `index.html:17`:
```
style-src 'self' 'nonce-__CSP_NONCE__'
```
Per spesifikasi CSP3, **nonce tidak bisa diterapkan pada style attribute** (atribut tidak bisa membawa nonce), dan kehadiran nonce membuat `'unsafe-inline'` diabaikan. Akibatnya semua `style="..."` ditolak browser.

**Bukti runtime (computed style, viewport 390×844, Chromium):**

| Elemen | Inline attribute (maksud) | Computed (kenyataan) | Dampak |
|---|---|---|---|
| `#greetText` | `font-size:14px; color:var(--text3)` | `16px · rgb(26,26,26)` | Hierarki teks beranda hilang |
| `.stat-card` pertama | `background:var(--green-bg); border-color:#A5D6A7` | `rgb(255,255,255) · rgb(224,224,224)` | **Kartu omzet/pengeluaran/laba putih semua** — coding warna hijau/merah/biru hilang |
| `#platCarouselEl` | `grid-column:1/-1` | lebar 309px dari 366px | **Carousel setengah kolom** di grid statistik |
| `.app-header h1 span` | `font-size:12px` | `17px` | Subjudul header sebesar judul |
| `#updateOverlay` | `position:fixed; inset:0; z-index:800` | `static · top=164 · h=1478px` | **Overlay update jadi blok statis 1478px** yang mengalir di tengah dokumen |

Skala masalah: **92 inline style di `index.html` + 290 di template `js/*.js`** (innerHTML parsing ikut diblokir). Elemen yang disembunyikan murni lewat inline markup bocor saat induknya aktif — contoh paling berbahaya:

- **`#cartBar`** — seluruh properti visualnya (fixed, bottom, background hijau, shadow, z-index) 100% inline. JS memang menambal `display` via CSSOM saat kosong, tapi begitu keranjang terisi bar ini muncul sebagai **blok statis di bawah grid**, bukan floating bar.
- **`#licenseGate` (onboarding) & gate lisensi** — `position:fixed; inset:0; z-index:500; background:var(--bg)` semuanya inline. Saat gate ditampilkan ke pengguna baru/lisensi habis, dialog muncul **tanpa full-screen dim** — konten dashboard tembus di belakang/di sekitarnya.
- **`#importFile`** (input file tersembunyi di Pengaturan), **`#afterSaleActions`** (aksi cetak nota), layout grid 2–4 kolom di modal keranjang — semua bergantung inline style.

### K2. `style.css` TIDAK PERNAH aktif di layar — trik `media="print"` diblokir CSP yang sama

`index.html:43`:
```html
<link rel="stylesheet" href="css/style.css" media="print" onload="this.media='all'">
```
`onload="..."` adalah **inline event handler** — tidak bisa membawa nonce → diblokir `script-src 'self' 'nonce-__CSP_NONCE__'`. Media tidak pernah dipindah ke `all`.

**Bukti runtime:**
- Atribut `media` link style.css tetap `"print"` (dibaca langsung dari DOM, menit-menit setelah load).
- `document.styleSheets.length = 14` — file **berhasil diunduh**, tapi hanya berlaku untuk media print (percuma).
- `#updateOverlay` **terlihat tanpa class `.show`** — karena satu-satunya rule `#updateOverlay{display:none}` ada di style.css yang mati (tidak ada di 13 file modular — diverifikasi grep).
- Viewport 1280×800: `.stat-grid` tetap **2 kolom**, padahal rule 3 kolom (`min-width:900px`) ada di style.css.

**Yang ikut mati bersama style.css** (rule yang HANYA ada di sana):
- Semua breakpoint `≥600/900/1100px` untuk stat-grid 3 kolom, menu-grid 130→140→160px, modal 560/600px, tombol 56/58px, trx-icon 48→52px, FAB 68→72px (kecuali `#page-pengaturan` grid yang berparitas di `components-settings.css`).
- `#updateOverlay{display:none}`, `.update-card`, `.update-notes` (seluruh UI force-update).
- `.license-card-revoked`, `.toast .toast-action`, `#cartBar` responsive max-width.
- Phone-landscape `max-height:500px` (header/nav compact).

### K3. Nonce `"__CSP_NONCE__"` adalah placeholder publik = security theater

- Skrip `index.html:4-8` mengganti atribut nonce elemen dengan nilai acak **setelah** meta CSP terparse — CSP tetap memakai string literal `__CSP_NONCE__`. Nonce yang nilainya konstan/publik tidak punya nilai keamanan (penyerang bisa menulis atribut yang sama).
- Dampak nyata justru **negatif**: nonce-lah yang mematikan inline style (K1) dan inline handler (K2).
- vercel.json tidak mengirim CSP header — tidak ada " CSP benar" di sisi server.

**Fix P0 (pilih salah satu jalur):**
1. **Cepat & aman (rekomendasi):** ganti meta CSP menjadi `style-src 'self' 'unsafe-inline'` (atau `style-src-attr 'unsafe-inline'; style-src-elem 'self'`), hapus nonce untuk style; pertahankan `script-src` hanya `'self'` + pindahkan 3 inline `<script>` ke file eksternal. Ganti link style.css jadi `<link rel="stylesheet" href="css/style.css">` biasa (blocking — toh 13 file lain sudah blocking).
2. **Tuntas (P1 menyusul):** migrasi 382 inline style ke kelas CSS, lalu CSP ketat tanpa `unsafe-inline` sama sekali.

> **Aksi verifikasi segera:** buka deploy produksi (kasirsolo.app) di Chrome Android/desktop — CSP ini ada sejak commit `388c693` (v54, 2026-08-17), jadi produksi kemungkinan besar terdampak sejak itu. Cek juga console (F12) — akan penuh `Refused to apply inline style`.

---

## 🟠 TEMUAN TINGGI (P1)

### T1. Arsitektur CSS ganda: master bukan superset, modular bukan sumber tunggal

Faktual di `index.html`: **13 file modular dimuat blocking + style.css async** (total 15 request CSS). Audit kemarin mendeskripsikan "single file master" — kenyataan tidak demikian.

- `test-css-drift.js` PASS untuk konflik (bagus), tapi melaporkan **67 selector hanya ada di file modular** (date-picker kustom `.cal-cell/.week-opt/.month-opt`, `.license-steps/.license-progress`, `.badge.amber`, `.license-card-pending`, `.manual-key-*`, `.license-state-card`, dll).
- Test hanya memeriksa satu arah (modular → master). **Arah sebaliknya tidak diawasi**: `#updateOverlay`, `.update-card`, `.license-card-revoked`, `.toast-action`, dan seluruh responsive ≥600px justru hanya ada di style.css — inilah kenapa K2 berdampak besar.
- Payload CSS dobel (~34KB modular + ~32KB style.css dengan konten tumpang tindih ~80%).

**Rekomendasi:** tetapkan **satu sumber kebenaran** — 13 file modular sebagai kanonik, pindahkan rule unik style.css ke modular yang sesuai, lalu hapus style.css dari index.html dan dari precache SW. Tambahkan arah kedua ke test drift.

### T2. Token `--paper` tidak terdefinisi

`css/style.css:208` — `.update-notes li{background:var(--paper);…}`. `--paper` tidak didefinisikan di `:root` mana pun → background jatuh ke transparan. Definisikan (mis. `--paper:#FFF8F0`) atau ganti `var(--bg)`.

### T3. `theme_color` tidak sinkron dengan brand

- `index.html:13` `<meta name="theme-color" content="#E65100">` dan `manifest.json:14` `"theme_color": "#E65100"` — **warna lama**.
- Primary CSS sekarang `#D6501C` (header gradient). Address-bar Android/splash PWA tidak match dengan header. (`background_color:#FFFAF5` sudah benar ✅ — rekomendasi audit kemarin dijalankan.)

---

## 🟡 TEMUAN SEDANG–RENDAH (P2)

| # | Temuan | Lokasi | Dampak |
|---|---|---|---|
| M1 | `#trialChip` `role="button"` tanpa `tabindex` | index.html:78 | Tidak bisa diakses keyboard |
| M2 | Toast: `role="alert"` + `aria-live="polite"` kontradiktif (alert = assertive) | index.html:556 | SR membacanya dobel/aneh |
| M3 | Tidak ada tombol **Escape** untuk menutup modal (grep seluruh js/ kosong) | js/modal.js | Keyboard user terjebak (focus trap ada, tapi tanpa jalan keluar Esc) |
| M4 | Tidak ada **scroll-lock** background saat modal terbuka | js/modal.js | Konten di belakang masih bisa discroll (mobile touch) |
| M5 | Drift breakpoint: `.prof-banner-*` compact di `@media(max-width:414px)` (base.css) vs `380px` (style.css) | base.css:118 · style.css:169 | Perilaku beda di lebar 381–414px; editor bingung sumber mana yang berlaku |
| M6 | Skeleton duplikat 3 lokasi (base.css reduced-motion, components-stat.css, style.css) | 3 file | Utang pemeliharaan |
| M7 | `js/app.js?v=66` pakai query param, tapi 15 link CSS **tanpa** versi — andalkan network-first SW | index.html:30-43 | Risiko stale cache setelah update (SW network-first meringankan, tidak menghilangkan) |
| M8 | ~290 inline style di template JS ikut jadi korban K1 — setelah fix CSP tetap jadi utang arsitektur | js/*.js | Refactor bertahap ke kelas |

---

## ✅ YANG SUDAH BAIK (dipertahankan)

1. **`js/modal.js` + `trapFocus`** — focus trap kini ada di semua overlay (rekomendasi #1 audit kemarin ✅), dengan registry selector & cleanup yang benar.
2. **Token design semantik** konsisten (`--primary #D6501C` kontras 4.5:1, semantic green/red/blue/orange).
3. **`prefers-reduced-motion`** lengkap (base.css + paritas style.css).
4. **`:focus-visible`** di hampir semua elemen interaktif.
5. **Safe-area** `env(safe-area-inset-bottom)` di nav, modal, sheet, FAB.
6. **Viewport meta** mengizinkan zoom (`user-scalable=yes`, max 5×) — ramah a11y low-vision.
7. **`background_color` manifest** sudah disinkronkan `#FFFAF5`; ikon maskable 192/512 lengkap.
8. **test-css-drift / test-html-refs / test-modules** PASS — infrastruktur anti-regresi ada (cukup tambah arah kedua).
9. Gate system `body.gate-active` dengan `!important` terdokumentasi — satu-satunya `!important` yang disengaja.
10. Z-index ladder disiplin (100→350→520→600→610→620→640→800).

---

## 📋 BUKTI AUDIT RUNTIME (reprodusibel)

Server lokal `python -m http.server 8777`, Chromium (IAB), langkah & hasil:

1. Load `http://localhost:8777/` @390×844 → `link[style.css]` `media` tetap `"print"`; `#updateOverlay` visible tanpa `.show` (display default).
2. `getComputedStyle`: greetText `16px/rgb(26,26,26)` (mestinya 14px/abu); stat-card putih; carousel 309px; header span 17px; `#updateOverlay` static h=1478px.
3. Viewport 1280×800 → `.stat-grid` 2 kolom (seharusnya 3).
4. `document.styleSheets.length=14` → style.css terunduh, tidak diterapkan.
5. Screenshot bukti tersimpan di `.scratch/audit-shots/` (01–06: mobile beranda, full-page, jualan, cart, tablet, desktop).

---

## 🎯 REKOMENDASI PRIORITAS

### Sprint 0 — HOTFIX (hari ini, ~1–2 jam)
1. **Ubah meta CSP**: `style-src 'self' 'unsafe-inline'` (atau `style-src-attr 'unsafe-inline'; style-src-elem 'self'`), hapus nonce dari style-src; `script-src 'self'` + eksternalkan 3 inline script.
2. **Hapus trik media print**: `<link rel="stylesheet" href="css/style.css?v=69">` biasa (tanpa `onload`).
3. **Verifikasi produksi** (kasirsolo.app di Chrome) sebelum/sesudah patch.
4. Bump cache SW v69 → v70.

### Sprint 1 (minggu ini)
5. Pindahkan styling kritikal overlay dari inline ke CSS: `#licenseGate` (fixed/inset/z-index/bg), `#cartBar` (fixed/bottom/bg), `#updateOverlay` guard `display:none` juga di `components-modal.css`.
6. Definisikan `--paper` atau ganti token; sinkronkan `theme_color` → `#D6501C` (meta + manifest).
7. Escape-to-close + scroll-lock di `js/modal.js`.

### Sprint 2 (bulan ini)
8. Konsolidasi CSS: modular = sumber tunggal; pindahkan rule unik style.css; hapus style.css dari HTML & SW precache; perluas test drift dua arah.
9. Migrasi bertahap 382 inline style → kelas (mulai dari yang bermakna: stat-card variants, cart-bar, gate).
10. P2 kecil: tabindex `#trialChip`, perbaiki aria toast, samakan breakpoint prof-banner, dedup skeleton.

---

## ✅ FINAL VERDICT

**Runtime saat ini: 4.6/10 — TIDAK production-ready untuk pengguna Chrome modern** karena dua bug CSP (K1+K2) yang mematikan 382 inline style dan seluruh lapisan responsive style.css. Desain dasar mobile masih "lumayan" justru karena paritas 13 file modular yang blocking — itulah yang menyelamatkan aplikasi dari kejatuhan total.

**Setelah Hotfix Sprint 0 (1–2 jam kerja): perkiraan langsung naik ke ~8.3/10** — tanpa mengubah satu pun komponen desain. Ini kemungkinan besar adalah bug dengan **rasio dampak/efek-fix tertinggi** yang pernah ditemukan di repo ini.

---

*Lampiran: screenshot bukti di `kaki5/.scratch/audit-shots/` (01-mobile-beranda … 06-desktop-1280-beranda). Audit oleh ZCode — statis + runtime, 2026-08-22.*
