# PLAN REKOMENDASI PERBAIKAN — kaki5 (pasca-audit 2026-09-05)

**Sumber temuan:** `AUDIT-KAKI5-2026-09-05.md` (kode v170 / 1.0.102, HEAD `39fd66d`).
**Target versi:** v171 / 1.0.103 (satu rilis; K1 boleh di-ekstrak jadi rilis terpisah kalau ingin cepat).
**Cakupan:** 1 Kritis + 8 Menengah + 6 Info terpilih. Di luar scope: keputusan pemilik yang sudah final (lihat §6).

---

## 0. Aturan main (mengikat semua fase)

1. **Commit/push hanya atas perintah eksplisit pemilik** (policy 2026-08-26). Kerja di workspace, berhenti sebelum commit.
2. **Offline-first & konvensi AGENTS.md tidak boleh menua**: gagal jaringan tak boleh menghapus/mengubah state lokal; overwrite cloud hanya via `force`; escape semua nilai dinamis; tanpa inline handler.
3. **Keputusan pemilik yang dijaga** (jangan "memperbaiki" ini):
   - `waktu` held = waktu dibuat, sengaja dipertahankan (`pos.sync.js:151-152`, jawaban user #4) → fix M3 lewat `paidAt`, bukan ubah `waktu`.
   - Kuota habis ≠ lock app (hanya banner + blokir transaksi) — `AGENTS.md` konvensi 10.
   - `.btn-wa` tetap hijau solid; 18 ikon Pengaturan tetap pastel.
4. **QA:** harness dari CWD `kaki5`; jangan reload tab app user saat cart terbuka; verifikasi state lewat dump read-only, bukan screenshot.

---

## 1. 🔴 P0 — K1: Gerbang in-flight `simpanPenjualan` (stop-loss uang)

**Masalah:** audit §K1 — dobel tap "Bayar" = 2 transaksi paralel, stok terkurang 2×; jalur held membuat record baru lagi.

**File:** `js/pos.js`, `js/app.js` (dispatcher), opsional `css/style.css`.

**Perubahan:**
1. Flag modul-level di `pos.js`: `let _simpanInFlight = false;`
   - Awal `simpanPenjualan()`: bila `_simpanInFlight` → `return` (toast singkat "Transaksi sedang diproses…"); set `true`, dan `finally { _simpanInFlight = false; }` menyeluruh (termasuk semua jalur early-return).
   - Terapkan guard identik di `bukaKas()` (`js/kas.js:163-193`) — sekaligus menutup Info #4 (dobel-tap 2 shift).
2. UI: saat guard aktif, tombol `[data-action="save-sale-print"]` (`index.html:459`) diberi `disabled` + kelas `.btn-busy` (opacity/pointer-events), dilepas di `finally`. Dispatcher (`app.js:601-605`) tidak perlu diubah — guard di sumber sudah cukup; tambahkan komentar di case bahwa guard ada di `pos.js`.
3. Jangan kosongkan cart sebelum record benar-benar ter-tulis: pindahkan `setCart({})` (`pos.js:673`) ke tepat setelah `simpanPenjualanSync` sukses (bukan di awal jalur held).

**Uji terima:**
- Script headless: panggil `simpanPenjualan('ask')` dua kali berurutan tanpa await → hanya 1 record penjualan baru, 1 decrement stok.
- QA Browser: dobel-tap cepat tombol Bayar pada app lokal (DB uji) → 1 transaksi; nomor TRX berurutan tanpa lompat.
- Harness tetap baseline (tidak menambah MISSING/DEAD baru).

**Estimasi:** 1-2 jam. **Risiko:** rendah — jalur guard tunggal, mudah di-revert.

---

## 2. 🟠 P1 — Integritas uang: kluster held + sync (M2, M3, M4, M7)

### 2a. M2 — Validasi stok saat resume held (oversell)
**File:** `js/pos.js:216-240` (resumeHeldOrder) atau lebih tepat di `simpanPenjualan` cek-ulang.
**Perubahan:** perluas cek-ulang stok yang sudah ada (`pos.js:552-564`): blokir bukan hanya `stok <= 0`, tapi `fresh.stok < c.qty` → toast "Stok X tinggal N — sesuaikan jumlah dulu" + jangan lanjut. Alternatif (UX lebih baik): saat resume, clamp qty ke stok terkini + toast per item.
**Uji:** held dengan qty 5, stok DB tinggal 2 → transaksi diblok/clamped, stok tidak minus. **Estimasi:** 1 jam.

### 2b. M3 — Kas window pakai `paidAt` (jaga keputusan `waktu`)
**File:** `js/kas.js` (`dataShift` window :95-104, tampilan riwayat), tanpa menyentuh `pos.sync.js`.
**Perubahan:** semua agregasi kas yang kini memfilter/mengelompokkan per `waktu` transaksi, ganti kuncinya jadi `(t.paidAt ?? t.waktu)` — record lama tanpa `paidAt` otomatis jatuh ke perilaku lama (backward-compatible). Jangan ubah `waktu` di `payHeldSync` (keputusan pemilik).
**Uji:** kasus uji: shift ditutup kemarin; held kemarin dibayar hari ini → tunai masuk shift hari ini; baris "Hitung ulang" oranye tidak muncul untuk kasus ini. **Estimasi:** 2 jam (uji kas paling berat).

### 2c. M4 — Pending sync: pisahkan intent force vs backfill
**File:** `js/sync.js:316-324` (catch), `:334-348` (retry loop).
**Perubahan:** simpan flag intent di settings.sync: `pendingIntent: 'force' | 'backfill'` — di-set dari argumen `ensureSynced` yang gagal. Retry loop membaca flag: `force:true` hanya bila intent force; push boot/gagal jaringan lain = backfill-only. Toast "akan dicoba ulang otomatis" hanya untuk intent force. Hapus komentar asumsi "pending hampir selalu dari form profil".
**Uji:** matikan jaringan saat push boot → status pending backfill; online lagi → baris cloud TIDAK tertimpa; form profil offline → pending force → online → tertimpa (sesuai intent user). **Estimasi:** 1,5 jam.

### 2d. M7 — Held terhapus tanpa konfirmasi
**File:** `js/pos.js:231-240`.
**Perubahan:** sebelum `deleteHeldSync`, jika ≥1 item menu sudah tidak ada → modal `showConfirm` (bukan native) "1+ menu pesanan ini sudah dihapus. Tetap buka pesanan?" [Buka & hapus item mati] / [Batal]. Item mati ditandai, tidak diam-diam dihapus.
**Uji:** hapus menu yang ada di held → resume → konfirmasi muncul; pilih Batal → held utuh. **Estimasi:** 1 jam.

---

## 3. 🟠 P2 — Escape & injeksi (M1, M6, M5)

### 3a. M1 — `ojolPlatform` di daftar held
**File:** `js/pos.ui.js:906-916`. **Perubahan:** `typeLabel` membungkus platform dengan `escapeHtml(...)` (huruf kecil semua dulu biar label konsisten). **Uji:** nama app ojol `<img onerror>` di form menu → tersimpan sebagai teks di daftar held. **Estimasi:** 15 menit.

### 3b. M6 — `buktiBayar` + nilai admin di purchase
**File:** `js/trxdetail.js:63`; `js/purchase.js:119-141,161-162`.
**Perubahan:** (1) `src` bukti bayar: set atribut via `img.setAttribute('src', s.buktiBayar)` setelah build DOM, dan guard hanya terima `data:`/`blob:`/`https://` prefix sebelum dipakai; (2) nilai admin (bank/rekening/nama/QRIS URL/priceLabel) dibungkus `escapeHtml`; URL QRIS divalidasi `https://` sebelum masuk atribut.
**Uji:** import backup dengan `buktiBayar: '" onerror="alert(1)'` → dirender sebagai teks/atribut aman, tanpa eksekusi. **Estimasi:** 1 jam.

### 3c. M5 — `esc()` region.js no-op
**File:** `js/region.js:20-24`. **Perubahan:** ganti isi `esc()` dengan pemanggilan `escapeHtml` dari `helpers.js` (import), atau tulis entity benar (`&amp; &lt; &gt; &quot; &#39;`). Satu implementasi, bukan dua.
**Uji:** province name mengandung `<` (fixture) → ter-render sebagai teks. **Estimasi:** 15 menit.

---

## 4. 🟢 P3 — Hygiene & kebersihan (M8 + Info terpilih)

| Item | File | Perubahan | Estimasi |
|---|---|---|---|
| M8 `.vercelignore` | `kaki5/.vercelignore` | tambah `_qa-*`, `server.cjs`, `*.log`, `.playwright-mcp/` | 10 mnt |
| Timer carousel | `js/carousel.js:116-121`, `js/templates.js` | daftar-kan stop timer via `registerCleanup` saat initPage beranda | 30 mnt |
| Duplikat escapeHtml | `helpers.js`, `helpers.pure.js` | helpers.js re-export dari helpers.pure.js (satu implementasi) + rapikan import | 30 mnt |
| Fallback close-held-list | `app.js:561-568` | hapus fallback `classList.remove('show')`, selalu via `closeModal()` | 15 mnt |
| Dead code | `pos.js:294-306` (`getDebouncedPosSearch`), `laporan.js:889` (`setCustomDate`) | hapus (git riwayat menyimpan) | 15 mnt |
| `totalModal` fallback | `pos.js:576` | `Number(c.menu.hargaModal) || 0` selaras `_calcCartTotals` | 10 mnt |

**Tidak dikerjakan (dokumentasi saja):** Info lisensi-offline (desain diketahui + mitigasi cloud), CSP `style-src` (butuh 340+ style attr), `img-src https:` (butuh foto bukti remote), link `wa.me` footer (navigasi same-tab disengaja).

---

## 5. Rilis v171 / 1.0.103 (setelah semua fase lolos)

1. **Bump 6 slot + 2 titik pelengkap:** `version.js:7,18`, `version.json:2-3` (+notes), `sw.js` CACHE_NAME `:186` + header komentar, `index.html:1014` `?v=171`, README `?v=`.
2. **Harness penuh** dari CWD `kaki5`: 5 hijau wajib; 3 merah harus **sinyal baseline identik** (bandingkan dulu vs HEAD sebelum menyimpulkan regresi).
3. **Test integrasi lisensi** admin⇄kaki5: 13/13 PASS.
4. **Audit rujukan dokumen:** `node _qa-v168-docrefs.mjs` (CWD kaki5) → 0 di luar rentang; perbarui rujukan `file:line` di AGENTS.md/DEVELOPER.md/CHANGELOG yang bergeser karena edit.
5. **CHANGELOG.md** entri baru: `## 2026-09-XX (v171 / 1.0.103: …)` — dua nomor wajib.
6. **QA Browser** di `localhost:8086` (DB uji): skenario P0 (dobel-tap Bayar), held (resume stok kurang, konfirmasi hapus, bayar lintas hari), region picker, daftar held XSS string, offline push boot.
7. **Rilis beta** via `push-beta.ps1` → verifikasi 5 jalur (ls-remote, FETCH_HEAD, API, raw, konten terhidang di `kq5beta.vercel.app` — bukan `homepage` repo; jangan fetch `/index.html`).
8. **Live** ke `kaki5.kasirsolo.com` hanya setelah konfirmasi pemilik; guard blob lintas-app (rosok) sebelum push live.

---

## 6. Matriks risiko & urutan eksekusi

| Urut | Item | Sentuh uang? | Risiko regresi | Test terkait |
|---|---|---|---|---|
| 1 | P0 K1 (+bukaKas guard) | YA | rendah | harness + Browser dobel-tap |
| 2 | 2a M2 oversell | YA | rendah | Browser held stok |
| 3 | 2d M7 konfirmasi hapus | tidak | rendah | Browser held |
| 4 | 2b M3 paidAt kas | YA | **sedang** (agregasi kas) | Browser kas lintas hari + dump shift |
| 5 | 2c M4 pending intent | YA (cloud) | sedang | simulasi offline/online |
| 6 | P2 escape ×3 | tidak | rendah | fixture XSS import |
| 7 | P3 hygiene | tidak | rendah | harness (jaga baseline) |
| 8 | Rilis v171 | — | — | checklist §5 |

**Total estimasi:** ±1 hari kerja (P0 ≈ 2 jam; P1 ≈ 5,5 jam; P2 ≈ 1,5 jam; P3 ≈ 1,5 jam; rilis+QA ≈ sisanya).

---

## 7. Kriteria selesai (Definition of Done)

- [ ] Dobel-tap Bayar = tepat 1 transaksi (bukti dump DB uji).
- [ ] Held: oversell terblokir/clamped; penghapusan terkonfirmasi; kas lintas hari masuk shift benar.
- [ ] Offline push boot tidak pernah menimpa cloud; form profil offline tetap bisa retry sebagai force.
- [ ] Semua string dinamis temuan (ojolPlatform, buktiBayar, nilai admin, wilayah) lolos fixture injeksi.
- [ ] Harness: 5 hijau + 3 merah baseline-identik; license integration 13/13; docrefs 0 out-of-range.
- [ ] CHANGELOG + rujukan dokumen sinkron; bump 6 slot lengkap.
- [ ] Tanpa commit/push tanpa perintah — siap rilis, menunggu aba-aba.
