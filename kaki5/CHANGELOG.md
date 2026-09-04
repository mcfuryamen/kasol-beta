# Changelog — Kasir Solo Kaki Lima (kaki5)

Semua perubahan dicatat per tanggal, versi terbaru di atas.
Format judul entri: `## <YYYY-MM-DD> (vNNN / 1.0.NN: judul)` — dua nomor wajib ada,
supaya bisa di-diff terhadap `js/version.json` saat audit rilis.

> **Catatan kelengkapan (2026-09-04).** Tidak semua rilis punya entri di sini.
> Yang **tidak tercatat**: v103, v142, v143, v145, v146, v149, v150, dan v152–v159
> (disebut di komentar `sw.js:7-147` tetapi tidak punya heading). Rilis-rilis itu tetap
> bisa ditelusuri lewat riwayat git — misalnya `743c74e` ("kaki5 v152-v159 / 1.0.84-1.0.91")
> dan `feb4ed3` ("kaki5 v147-v150 / 1.0.79-1.0.82"). Entri `v120–v132` sengaja digabung
> jadi satu. Entri tanpa nomor versi dikelompokkan di bagian
> "catatan tanpa nomor rilis" dekat dasar file.

## 2026-09-04 (v168 / 1.0.100: modul Bantuan ditulis ulang mengikuti kode nyata)

`js/bantuan.js` (+426/−115, jadi 656 baris) — satu-satunya perubahan yang terlihat
user di rilis ini; **tidak ada perubahan logika aplikasi**.

- **11 → 17 tutorial.** Topik baru: Buka & Tutup Kas (saklar, modal awal, selisih
  fisik−sistem, dompet digital, "💸 Catat Kas"), Tahan Pesanan, Stok/Topping/Harga
  Ojol, Metode Pembayaran & Foto Bukti, Catat Pengeluaran **& Pemasukan**, Tutup
  Buku Tahunan, Menu Titipan (Konsinyasi) & Retur.
- **Klaim basi dibuang**, bukan disunting: layar onboarding + "🚀 Mulai Masa
  Percobaan" (gate dihapus `app.js:245`), "✓ Setuju & Lanjut" (nyata "✓ Saya
  Setuju" / "✕ Nanti Saja"), chip "TRIAL" (nyata `GRATIS`/`LISENSI` dengan
  `n trx` / `Habis` / `✓ Aktif` / `✕ Dicabut`, `license.ui.js:359-378`), seluruh
  blok "Tambah 1 Hari Gratis (Berbagi)" (fitur dicabut), "🧾 Kirim Bukti
  Pembayaran" (nyata "📎 Lampirkan Bukti Pembayaran" → "🚀 Kirim Sekarang").
- **Label UI dikoreksi ke teks asli:** tab Menu (bukan "Makanan"), kategori
  `Makanan/Minuman/Snack/Lainnya/Titipan` (tanpa "Jajanan"), tipe pesanan
  Dine-in/Take-away/Ojol (tanpa "Biasa"), tombol "Bayar" (bukan "✅ Simpan"),
  8 jenis pengeluaran (bukan 5), "💸 Biaya Usaha" + "📝 Riwayat Transaksi" di
  Laporan, kartu "📱 Perangkat" (bukan bagian "Printer Bluetooth"), "Pasang
  Aplikasi" (bukan "Instal"). Typo "Bluettooth" & "Routin-routin" diperbaiki.
- **Verifikasi:** audit otomatis 471 label yang dikutip tutorial vs
  `index.html`+`js/*.js` → 464 lolos; 7 sisanya jalur navigasi komposit, dicek
  manual satu per satu, semuanya ada. Harness render: 17 kartu, akordeon
  berfungsi, tag `<b>` seimbang 423/423. `test-imports` 45/45,
  `test-dynamic-imports` 23/23, `test-css-drift`/`test-db-migrations`/`test-shim`
  hijau; `test-html-refs`/`test-data-actions` tetap merah baseline lama.
- **Bump 6 slot** ke 1.0.100/v168 (version.js ×2, version.json ×2 + notes,
  sw.js CACHE_NAME + blok riwayat, index.html `?v=`). Tanpa bump `update.js` bail
  dan cache SW user tidak pernah menerima teks baru.
- **Ikut naik ke beta:** `1239e08` (port identitas lintas-browser kaki5 — memang
  ditulis untuk "menumpang rilis v167+ berikutnya").

## 2026-09-04 (v167 / 1.0.99: identitas perangkat lintas-browser — port hasil audit rosok)

Perbaikan "1 perangkat, banyak browser" yang dirosok dikerjakan lebih dulu
(lihat rosok/CHANGELOG 1.4.1–1.4.2). Enam file: `license.logic.js`,
`license.js` (shim), `license.sync.js`, `sync.js`, `backup.js`, `app.js`.

- **Fingerprint V4 — sinyal `platform` dibuang.** V3 masih memakainya, padahal
  ia justru MEMECAH identitas antar engine di hardware yang sama (Chrome/
  Samsung/WebView = 'Linux armv8l' vs Firefox = 'Android') sementara
  sumbangan entropinya nol. Kini Chrome ↔ Firefox satu HP menghasilkan
  deviceCode sama. `getDeviceFingerprint()` jadi pembungkus
  `fingerprintFromSignals(includePlatform)`.
- **Masa tenggang V3 di `validateSerial`:** serial terbitan era V3 (digits
  deviceCode V3) tetap sah — V3 deterministik, dihitung ulang via
  `getLegacyV3DeviceCode()` yang baru diekspor. Tidak ada pengguna yang
  terkunci oleh pergantian ini.
- **`reanchorUnitId()` (baru, license.sync.js)** dipanggil boot FASE 1 sebelum
  sync/pull/push/realtime: instalasi era V3 mengonvergensikan `unit_id`
  simpanan ke kanonik `K5-<kodeV4>` — PATCH baris sendiri; duplicate key →
  adopsi HANYA bila baris kanonik kosong profilnya atau cocok dgn lokal
  (kalau bukan = pengguna asing sesama model HP → unit lama dipertahankan).
  Dilewati untuk perangkat terikat serial aktif (aturan lama: pindah unit
  hanya via `device_assign`). Idempoten; jejak di `settings.unitReanchor`.
- **Guard tabrakan identitas (`cloudProfileMatchesLocal`):** dua pengguna tipe
  HP identik menghasilkan fingerprint identik → unit_id sama → RLS hybrid
  membuat mereka saling bisa baca baris. Kini TIGA jalur dilindungi: adopsi
  lisensi blok (A) `syncLicenseStatus`, `persistCloudLicense` (realtime/
  polling), dan `pullCloudProfileTo` (pull profil tidak lagi menimpa lokal
  dengan profil asing). Lokal kosong (browser baru) tetap boleh mengadopsi.
- **Signature backup V3→V4:** `verifyBackupSignature` mencoba ulang dengan
  deviceCode V3 — file cadangan lama tidak jadi yatim.
- **`maybeOfferCloudRestore()` (baru, backup.js)** — deferred 5 dtk dari init:
  browser baru + lisensi aktif + `DB.penjualan` kosong + ada cadangan cloud →
  showConfirm penawaran pemulihan (maks 1×/hari, `settings.restoreOfferAt`).
  Data transaksi tetap per-browser (hukum IndexedDB); ini jembatan resminya.

## 2026-09-04 (v167 / 1.0.99: gerbang "buka kas dulu" tidak bisa lagi lolos diam-diam)

> **Status: di-commit ke mirror beta (`kasol-beta` lokal); BELUM di-push ke GitHub.**
> Versi sudah dinaikkan ke `1.0.99` / `v167` pada enam slot sinkron.

**Gejala yang dilaporkan pemilik:** status kas tertutup dan Pengaturan menampilkan
"Buka / Tutup Kas" aktif, tapi kios tetap bisa langsung jualan tanpa diminta modal awal.

**Fakta hasil diagnosa (bukan tebakan):** `settings.fiturKas` di IndexedDB pemilik
bernilai `"0"` dan `kasShift` hanya berisi satu baris `status:'tutup'`. Gerbang POS di
`pos.js:529` bekerja **benar** — ia memang dilewati karena saklar membaca `'0'`. Yang
bohong adalah **tampilan Pengaturan**, bukan gerbangnya. Tiga celah ditutup:

- **`kas.js fiturKasAktif()` sekarang membaca DB tiap dipanggil** (`:48`), tidak lagi
  "baca sekali lalu cache seumur hidup". Cache apa pun pasti bisa menyimpang karena
  IndexedDB dipakai bersama seluruh tab/jendela pada satu origin: tab yang cache-nya
  masih `true` akan meloloskan transaksi walau tab lain sudah menyimpan `'0'`.
  `_fiturKas` tetap dipakai sebagai fallback bila pembacaan gagal, dan bila belum pernah
  baca sama sekali hasilnya **AKTIF** (gagal baca tidak pernah membuka gerbang).
- **Saklar disinkronkan dari DB di AWAL `loadSettings()`** lewat
  `syncFeatureSwitches()` (`settings.ui.js:35`, dipanggil `:52`), sebelum panggilan cloud
  mana pun. Sebelumnya blok ini berada di baris 66-78, yaitu **setelah**
  `pullCloudProfileIfOnline()` yang tidak punya timeout. Karena `index.html:240-241`
  men-hardcode `checked` **dan** teks "transaksi diblok kalau kas belum dibuka", setiap
  kali `loadSettings()` menggantung atau melempar sebelum baris 66, halaman Pengaturan
  mengaku fitur AKTIF padahal DB sudah `'0'` — persis gejala di atas.
- **`saveFiturKas()` membandingkan dengan nilai tersimpan, bukan cache modul**
  (`settings.ui.js:143`, early-return di `:154`). Guard `if (mau === terpasang) return`
  yang lama membandingkan kehendak user dengan cache, sehingga sekali cache menyimpang,
  klik saklar **membatalkan penulisannya sendiri secara diam-diam**: saklar terlihat ON,
  DB tetap `'0'`. Sekarang pembacaan yang gagal menghasilkan `null` dan early-return
  dilewati — menulis ulang sesuai tampilan lebih aman daripada mengabaikan kehendak
  pemilik.
- **Dokumen ikut diselaraskan**: `docs/DEVELOPER.md` §7 (tabel baris `kas.js` bergeser
  +7, daftar gerbang jadi 7 titik, tabel kunci `settings`) dan `AGENTS.md` aturan #10
  kini memuat larangan eksplisit untuk mengembalikan cache "baca sekali".
- **Verifikasi:** harness `test-imports` / `test-dynamic-imports` / `test-css-drift` /
  `test-db-migrations` / `test-shim` hijau; `test-html-refs` / `test-data-actions` /
  `test-modules` tetap pada kegagalan baseline lama (tidak ada kegagalan baru).
  Diuji lewat harness baca-saja `_qa-kasgate.html`: sebelum perbaikan gerbang
  melaporkan "JUALAN DILULUSKAN", sesudah `fiturKas='1'` + `getOpenShift()=null`
  melaporkan **"JUALAN HARUSNYA DIBLOKIR"**. Tidak ada satu baris data user yang ditulis
  selama diagnosa.

## 2026-09-04 (v166 / 1.0.98: saklar "Buka / Tutup Kas" di Pengaturan)
- **Blok "💳 Metode Pembayaran" berganti judul jadi "⚙️ Aktifkan Fitur"** dan sekarang menaungi saklar fitur, bukan hanya cara bayar. Tiga saklar lama (Tunai/QRIS/Transfer) tidak berubah perilaku.
- **Saklar baru "💰 Buka / Tutup Kas"** (`#fiturKasToggle`, setting `fiturKas` = `'1'`/`'0'` di tabel `settings`). Default **aktif** — pengguna lama tidak mengalami perubahan apa pun setelah update.
- **Saat dimatikan** (satu sumber kebenaran: `kas.js fiturKasAktif()`, di-cache dan disegarkan oleh `setFiturKasAktif()`): kartu kas di Beranda dikosongkan + `display:none` (`renderKasCard`), **gerbang POS di `pos.js simpanPenjualan` dilolos** sehingga transaksi boleh disimpan tanpa shift 'buka', dan blok "🕐 Riwayat Buka/Tutup Kas" tidak dirender (`kasReportBlocksHtml()` mengembalikan `''`).
- **Kartu "📕 Tutup Buku Tahunan" tetap tampil.** Saklar ini mengatur alur LACI (buka/tutup kas), bukan pembukuan tahunan — rekap laba dan kunci tahun tetap bisa dibuka walau fitur kas mati.
- **Tidak ada data yang dihapus.** Shift lama tetap ada di `kasShift`; menyalakan saklar mengembalikan kartu, riwayat, dan gerbang POS persis seperti semula.
- **Perisai salah pencet:** kalau saklar dimatikan padahal masih ada shift berstatus `buka`, `showConfirm` muncul lebih dulu ("Kas masih tercatat TERBUKA … shift yang berjalan TIDAK ditutup"). Saklar dikembalikan ke posisi ON sebelum konfirmasi, jadi membatalkan dialog tidak meninggalkan state bohong. Membuka modal Buka/Tutup Kas lewat jalur lain juga ditolak dengan toast bila fitur mati.
- **Penyimpanan mengikuti pola saklar pembayaran:** `data-action="save-fitur-kas"` hanya diproses pada event `change` (label meneruskan `click` sintetis — kalau ikut diproses, nilai lama tersimpan dan toast saling menimpa), nilai ditulis via `setSetting` lalu `refreshKasViews()` langsung menyegarkan Beranda/Laporan tanpa reload.

## 2026-09-03 (v165 / 1.0.97: catatan bisa diedit + kolom Tanggal, plus 7 komentar browser)
- **Kolom Tanggal di form Catat** (`#expTanggal` / `#incTanggal`, `type=date`, `max` = hari ini). Catatan boleh diisi mundur — ini permintaan lama yang belum ada jalurnya sejak v164. Tanggal di masa depan ditolak, dan kalau tahunnya **sudah ditutup buku** muncul konfirmasi dulu (data tidak dikunci, pemilik cuma diperingatkan).
- **Nomor & waktu ikut tanggal**: `nomor` BLJ/MSK dihitung ulang dari tanggal yang dipilih (`nextNomor`), dan `waktu` dipindah ke jam 12:00 tanggal itu. Ini bukan kosmetik — `dataShift()` menyaring catatan dengan `waktu` antara jam buka shift dan sekarang, jadi catatan "kemarin" yang dibiarkan ber-`waktu=sekarang` akan **menggeser laci shift hari ini**. Kalau tanggalnya tidak pindah hari, `nomor` dan `waktu` lama dipertahankan supaya urutan harian & keanggotaan shift tidak berubah.
- **Jalur EDIT catatan** (`ubahCatatan(id)` → form yang sama, mode edit): tombol **"✏️ Ubah Catatan"** di modal rincian (`expensedetail.js`), judul form berubah "✏️ Ubah Pengeluaran/Pemasukan", tombol simpan jadi "💾 Simpan Perubahan", state edit di `#editExpenseId`. Form lama `saveExpense`/`saveIncome` jadi **alias** ke `simpanCatatan` — tetap satu jalur tulis, tidak ada validasi kedua.
- **Perisai mode edit**: `switchTxnTab` melepas state edit saat pindah tab, dan `tulisCatatan` menolak menyimpan baris `pengeluaran` lewat tab Pemasukan (dan sebaliknya) — tanpa ini, satu klik tab bisa menimpa jenis catatan. `nomor` lama tidak pernah dipakai sebagai kunci pencarian (id yang dicari), jadi tidak bisa menimpa baris lain.
- **Komentar browser #1/#2/#4/#5 (font kebesaran)**: semua isian modal Catat diturunkan ke 16px (`#expenseModal .form-input`), select 13px/40px/13px/16px. Dulu `.form-input` 17px (18px di layar lebar) sementara label 14px — font select 18px membuat opsi "🥬 Bahan Baku / Bumbu" terlihat jauh lebih besar daripada isian lain.
- **Komentar #3 & #6**: label metode disingkat jadi **"Ambil dari?"** dan **"Masuk ke?"** (hint di bawahnya tetap menjelaskan tunai/QRIS/transfer).
- **Komentar #7**: kartu **"📕 Tutup Buku Tahunan" pindah ke urutan paling bawah Laporan**. Isinya dipecah ke `kasTutupBukuBlockHtml()` (riwayat shift tetap di `kasReportBlocksHtml()`), jadi posisi kartu diatur di `laporan.js` tanpa memindah logika apa pun.
- **Perbaikan ikut terbawa**: `hapusExpense` selalu memanggil `kas.refreshKasViews()` (dulu hanya saat kas dibuka, sehingga kartu kas bisa tertinggal angka setelah catatan dihapus); `pilihOpsi()` membuatkan opsi bila kategori lama/custom tidak ada di daftar statis — tanpa itu select tampil kosong dan simpan berikutnya menimpa kategori user dengan default; impor `expDate`/`loadReport` yang tidak terpakai dibuang.
- **QA**: unit test `kas.logic.js` 59 assertion tetap lolos; checker statis v165 memverifikasi kolom Tanggal, `max` hari ini, `waktuUntukTanggal`, penolakan masa depan, konfirmasi tahun tertutup, `nomor` dihitung ulang hanya saat pindah hari, tombol Ubah + `case 'edit-expense'`, dan posisi kartu Tutup Buku.

## 2026-09-03 (v164 / 1.0.96: satu jalur pencatatan uang — fitur "catat kas" dobel dihapus)
- **Modal "Catat Kas Manual" dihapus** (`#kasManualModal`, `setKasTab`, `openKasManualModal`, `closeKasManualModal`, `saveKasManual`, 4 `case` di `app.js`). Tombol **💸 Catat Kas** di Beranda sekarang hanya membuka form **Pengeluaran/Pemasukan Laporan** (`kas.js catatKasDariBeranda` → `pengeluaran.js bukaCatatanKas`) — satu modal, satu tabel, satu sumber kebenaran.
- **`metodeBayar` di tiap catatan** (select `#expMetode` / `#incMetode`: tunai laci / QRIS / transfer). Hanya catatan **tunai** yang menggeser kas sistem (`hitungKasSistem`), jadi bayar supplier pakai transfer tidak lagi memunculkan selisih palsu waktu tutup kas. Baris lama tanpa field ini otomatis dianggap tunai — makna data lama tidak berubah.
- **Kategori non-usaha dikecualikan dari Laba**: baru 🏧 **Setor Bank / Ambil Uang** (pengeluaran) dan yang sudah ada 🏦 **Modal Tambahan** (pemasukan) ditandai `isNonLaba()`. Keduanya tetap masuk laci, tapi tidak memotong/menambah Laba.
- **`hitungLaba()` jadi satu-satunya rumus Laba** — dipakai Beranda, Laporan, dan tutup buku tahunan. Dulu tiga halaman menjumlah sendiri-sendiri (itu sumber bug pemasukan v160); sekarang mereka tidak bisa beda angka lagi.
- **Blok "📱 Dompet digital" di layar Tutup Kas** (permintaan pemilik): rincian per metode — QRIS dan Transfer — lengkap dengan jumlah transaksi masuk/keluar dan total di rekening. Ganti hint lama yang cuma menyebut satu angka, dan label baris dibuat jujur: "Modal awal di laci", "Pengeluaran tunai", "Pemasukan tunai".
- **Laporan**: kartu statistik berganti label "💸 Biaya Usaha" / "💵 Pemasukan Usaha" (angka yang masuk Laba) + kartu "🏧 Non-Usaha (laci)" muncul hanya bila ada; persentase rincian memakai total semua kategori supaya tidak ada baris yang hilang tanpa jejak; tiap baris daftar & modal detail menampilkan metode dan penanda "tidak masuk Laba".
- **IndexedDB `version(8)`**: baris tabel `kas` lama **dipindahkan** ke `pengeluaran` saat upgrade ('masuk' → Pemasukan/Modal Tambahan, 'keluar' → Pengeluaran/Setor Bank / Prive, tunai), lalu tabel `kas` dikosongkan dan dibiarkan sebagai arsip — TIDAK di-drop, karena menghapus object store di tengah transaksi upgrade berisiko kalau penyalinan belum selesai. Index `jenis` + `metodeBayar` ditambahkan (laporan/kas kini menyaring keduanya).
- **Backup payload `version: 4`**: kunci `kas` tidak dicadangkan lagi. File cadangan lama (v3) yang masih punya kunci `kas` **tetap bisa di-restore** — isinya dipindah ke `pengeluaran` dengan aturan yang sama seperti migrasi DB.
- **Perbaikan ikut terbawa**: `pisahkanCatatan()` tidak lagi meloloskan baris `null` sebagai "pengeluaran"; `refreshKasViews()` di-export supaya form Laporan dan penghapusan catatan selalu menyegarkan kartu kas Beranda.
- **QA**: 59 assertion unit test `kas.logic.js` (Node, tanpa DOM/DB) lolos — termasuk kasus "setor bank menggeser laci tapi tidak memotong Laba" dan "pengeluaran transfer tidak mengurangi laci".

## 2026-09-03 (v163 / 1.0.95: revisi modal "Versi Baru Tersedia" — lihat gambar)
- **Logo dihapus** dari header (`<img class="update-logo">` + rule `.update-logo` dibuang); judul jadi elemen pertama header.
- **Kalimat penenang pindah**: "Data jualanmu aman, tidak ada yang hilang." sekarang menutup paragraf intro `.update-sub` di header, dan **hint di bawah tombol OKE dihapus** (rule `.update-hint` ikut dibuang). Footer tinggal tombol OKE.
- **Badan konten dijamin bisa menggulir**: `.update-body` dapat `min-height:0` (syarat flex scroll-child) supaya daftar catatan yang panjang menyusut di dalam area sendiri, bukan mendorong kartu/melempar footer ke luar layar; padding bawah header/footer dinaikkan sedikit (`10px`) biar catatan terakhir tidak nempel ke garis footer.

## 2026-09-03 (v162 / 1.0.94: modal "Versi Baru Tersedia" jadi header + footer sticky)
- **Tiga zona di `.update-card`** (komentar browser #1–#7): `.update-head` (logo, judul, badge versi, intro, label "Yang baru di versi ini:") nempel di atas; `.update-body` = daftar catatan, satu-satunya bagian yang menggulir; `.update-foot` (tombol OKE + hint muat ulang) nempel di bawah. Kartu jadi flex column `max-height:88vh` + `overflow:hidden`.
- **Menggantikan trik v160**: `#updateOkBtn position:sticky` + `box-shadow` putih yang "menyamarkan" catatan yang lewat di belakangnya — sekarang header/footer benar-benar tidak bisa tertutupi, dan style atribut inline pada logo pindah ke kelas `.update-logo`.
- **Bug fix `app.js`**: `case 'open-sync-diag'` tercatat dua kali di switch `handleDataAction` (sejak v151). Yang kedua tidak pernah jalan karena switch berhenti di match pertama; salinan kedua dihapus.

## 2026-09-03 (v161 / 1.0.93: adopsi fitur Kas dari Kasir Solo Rosok)
- **Buka/tutup kas (shift laci)**: tabel Dexie baru `kasShift` (v7) + kartu status kas di Beranda (`#kasCard`). Buka kas mencatat modal awal; transaksi POS **ditolak selama kas belum dibuka** (gerbang di `pos.js simpanPenjualan`, sama pola gerbang kuota).
- **Tutup kas**: rincian lengkap (modal awal, penjualan tunai, pengeluaran, pemasukan, ambil/tambah kas) → **kas sistem** dibandingkan uang fisik → selisih + catatan tersimpan di shift. Beda dengan rosok: kas sistem dihitung ulang dari data yang ada dan **hanya penjualan tunai** yang masuk laci — QRIS/Transfer dilaporkan terpisah sebagai uang rekening.
- **Catat Kas manual** (`➕ Tambah Kas` / `➖ Ambil Kas`, tabel `kas`): mutasi uang laci yang bukan penjualan/pengeluaran (setor bank, nambah kembalian) sehingga tidak mengocok laba.
- **Laporan**: kartu "🕐 Riwayat Buka/Tutup Kas" (10 shift terakhir, modal/sistem/fisik/selisih + catatan) dan "📕 Tutup Buku Tahunan".
- **Tutup buku tahunan** (tabel `tutupBuku`): snapshot rekap satu tahun kalender — omzet, modal barang, pengeluaran, pemasukan, laba, jumlah transaksi, perkiraan arus kas. Laba memakai rumus yang sama dengan Beranda & Laporan (rosok memakai jual − beli sehingga beda angka). Tahun yang sudah ditutup tidak dikunci, tapi menghapus data di tahun itu memunculkan peringatan.
- **Backup/restore/reset**: tiga tabel kas ikut tercakup (payload v3) + validasi field & cek id ganda. Di rosok tabel ini lupa dicadangkan sehingga riwayat shift hilang saat restore.
- **Perbaikan service worker**: `./js/onboarding.js` (file tidak ada — membuat `cache.addAll()` gagal total) dihapus dari precache; `./js/modal.js`, `./js/nomor.js`, `./js/app-link.js` yang selama ini tidak ikut diprecache ditambahkan.

## 2026-08-30 (v120–v132 / 1.0.51–1.0.63: topping grid, polish keranjang, konsinyasi & retur barang)
- **Topping grid (v120)**: textarea "Nama|Harga" diganti grid 2 kolom (Nama | Harga) + tombol "＋ Tambah Topping" (`#menuToppingGrid`, `renderToppingRows`/`collectToppingGrid`); toggle topping mati otomatis saat menu tanpa topping (v121); tombol hapus kotak rounded oranye seukuran field; placeholder harga rata kiri.
- **Polish keranjang (v121–v122)**: helper "Kosongkan jika…" dihapus; tombol Batal keranjang jadi ✕ kotak 48×48 rounded (`.btn-icon` radius 10px, `#cartModal .btn-row [data-action="close-cart"]` width 48 fix); header keranjang menampilkan catatan order (`orderNoteInput`) pengganti "berlaku untuk semua item".
- **Modal input in-app (v122–v123)**: `showInputDialog()` menggantikan `window.prompt` (tidak didukung embedded browser) untuk Tambah Suplayer/Kategori; fix callback di-null-kan sebelum dipanggil (pola bug lama `confirm.js`) yang membuat data tak tersimpan.
- **Konsinyasi akordeon (v124–v126)**: kartu per suplayer jadi akordeon ala Riwayat Transaksi (`.trx-day-header` + chevron); angka header berkode status — "Lunas" hijau / sisa utang oranye; suplayer berutang pertama terbuka otomatis; tombol ↩️ Retur (secondary) + 💰 Setor sejajar diperkecil proporsional (38px).
- **Retur barang per suplayer (v127–v132)**: tombol Retur kini buka modal retur sungguhan (bukan form pengeluaran) — konsep per suplayer: satu kontainer daftar semua barang titipan (dipisah garis), info Diterima (rekonstruksi `stok+terjual`) · Terjual (lifetime) · Est. sisa, dan satu-satunya input "Sisa riil" di kanan; selisih riil vs estimasi wajib catatan alasan (`catatanSelisih`); simpan → stok disesuaikan, barang balik masuk counter `retur`, laporan refresh. Form menu kembali satu field stok seperti semula.

## 2026-08-29 (v119 / 1.0.50: UI polish kuota — progress bar hijau, tombol singkat, horizontal)
- **Progress bar hijau**: progress `linear-gradient(90deg,var(--green),#388e3c)` menggantikan oranye untuk quota bar (`license.ui.js` + inline `animation:none` di kartu kuota agar tidak bertabrakan dengan keyframe lama).
- **Label tombol pendek**: "💳 Beli Lisensi" (singkat, tanpa keterangan) + "💬 Tanya Admin" disederhanakan — keduanya kini sejajar horisontal di bawah kartu lisensi (`license-actions-row`, flex row `justify-content:center`).
- **Pindahkan tombol admin**: tombol "💬 Tanya Admin" dikeluarkan dari dalam kartu kuota ke baris terpisah horizontal sejajar tombol beli.

## 2026-08-29 (v118 / 1.0.49: fix produk query 400 — kolom asli `kode_produk` & `salt`)
- **Produk 400 fix**: `fetchProductSalt()` (`license.sync.js`) sebelumnya query `.eq('prefix', PRODUCT_PREFIX)` → selalu 400 (kolom `prefix` tidak ada di tabel `products`). Kini benar pakai `.eq('kode_produk', PRODUCT_PREFIX)` + select `salt` (bukan `salt_hmac`/`salt_version`). Bug ini sudah berjalan berbulan-bulan — selalu jatuh ke local fallback (salt identik jadi tidak ada yang pecah, tapi cloud sync tidak berjalan).
- **`fetchTxQuotaConfig()`**: juga diperbaiki ke `.eq('kode_produk', PRODUCT_PREFIX)` (konsisten).

## 2026-08-29 (v117 / 1.0.48: 📜 Dokumen card fix — pindah ke dalam `#page-bantuan`)
- **📜 Dokumen card salah tempat**: kartu "Syarat & Ketentuan" di Bantuan muncul di **semua halaman** (di luar `#page-bantuan` div, sebelum closing `</div>`). Diperbaiki dengan memindahkan closing `</div>` sehingga card berada di dalam `#page-bantuan`.

## 2026-08-29 (v116 / 1.0.47: kuota transaksi per bulan menggantikan trial waktu)
- **Konsep baru tier gratis (keputusan pemilik)**: tanpa batas waktu 7 hari — gratis = **kuota transaksi selesai per bulan kalender** (default 100, diatur admin via `products.tx_quota` di kartu produk admin; di-cache lokal agar offline). Kuota segar otomatis tiap awal bulan.
- **Penghitung anti-reset**: tiap penjualan selesai (`pos.sync.simpanPenjualanSync`) menaikkan `txUsed` (IndexedDB + localStorage). Reconcile cloud di `syncLicenseStatus`: adopsi `clients.tx_used` bila lebih besar (hapus data/ganti browser tidak menurunkan), push lokal bila lebih besar (pemakaian offline), `tx_adjust` (bonus/kurang dari admin) selalu ikut cloud, reset admin (`tx_month=null` + `tx_updated_at` baru) dihormati via `txLastPushAt` LWW.
- **Tanpa full-screen gate**: kuota habis → **banner bisa-ditutup** di bawah header (`#quotaBanner`, menampilkan ID Perangkat) + blok transaksi di `pos.js` (toast + sheet pembelian). Aplikasi tetap bisa dibuka & dieksplor. Revoke admin tetap full-lock (`lockOverlay`).
- **Gate onboarding dihapus**: tidak ada lagi input WhatsApp + layar persetujuan saat boot. Syarat & Ketentuan kini modal sekali-jalan **non-blocking** (bisa ditutup, dibuka ulang dari Bantuan → 📜 Dokumen) + tanggal setuju dicatat (`tcAcceptedAt`).
- **Cadangan Cloud khusus lisensi aktif**: tombol cloud backup/restore di Pengaturan dicek `isLicensed()` (`guardLicensedThen`); cadangan file (ekspor JSON) tetap gratis. Hint 🔒 di Pengaturan.
- **UI lisensi baru**: chip header `GRATIS · N trx` (warna oranye saat ≤10), kartu status kuota dengan progress bar & bonus admin, langkah pipeline "Trial"→"Gratis". Fitur "Tambah 1 Hari (share)" dihapus (tidak relevan tanpa batas waktu).
- **Admin**: kartu produk katalog punya field "Kuota Transaksi Gratis /bulan"; kartu klien menampilkan `pakai/kuota` + tombol kuota −10/+10/+50 dan ↺ Reset Pakai (`clients.tx_adjust`).
- **DB**: `products.tx_quota int` (seed 100 utk kaki5), `clients.tx_month/tx_used/tx_adjust/tx_updated_at`.

## 2026-08-29 (v102 / 1.0.33: cloud = sumber kebenaran lisensi & profil)
- **Cabang `belum` di `syncLicenseStatus()` (`license.sync.js`)**: cloud yang tidak mencatat lisensi terjual untuk unit (`license_status = 'belum'` / kosong) kini menurunkan lokal `active` → **trial berjangkar `clients.first_seen`** (T12). Menutup gap yang membuat chip `#trialChip` membeku di "✓ Aktif" padahal cloud `belum` (insiden chip zombie v101). Status `batal`/`nonaktif`/`revoked` tetap revoke; `belum` kembali ke masa coba, bukan hukuman.
- **Arah push profil dibatasi (`sync.js: ensureSynced`)** — aturan pemilik: *Supabase = satu-satunya sumber kebenaran lisensi & profil; lokal tidak boleh menimpa, kecuali tulisan eksplisit dari form profil*:
  * Push **otomatis** (boot fase 1c / latar, tanpa `force`) kini **backfill-only**: baris `clients` sudah ada → tidak disentuh sama sekali (dulu `update({...payload})` menimpa semua field profil dengan nilai lokal).
  * Penimpaan baris cloud hanya lewat jalur **user-intent** (`force`: 4 handler form profil di `settings.ui.js` + `syncNow()`).
  * Retry loop (T29) kini `force: true` — janji "akan otomatis dicoba saat online" untuk edit form saat offline tetap terpenuhi.
- **`boot()`: hapus duplikasi blok `verifyBootLicenseAssignment`** (artefak merge; verifikasi lisensi jalan 2x per boot).
- **Pipeline rilis dirapikan**: `push-beta.ps1` & `push-live.ps1` tidak lagi memakai branch `preview` sama sekali (permintaan pemilik) — mirror cukup `git fetch` dari sumber, snapshot dibangun di orphan `_release` → rename `main` → push GitHub. Guard drift kini membandingkan **staged index** vs pohon sumber (versi lama membandingkan branch yang saat pengecekan masih unborn = no-op). File `.ps1` wajib UTF-8 dengan BOM agar PowerShell 5.1 tidak salah baca em-dash.

## 2026-08-29 (v101 / 1.0.32: re-align versi & pulihkan overlay update)
- **Konvensi rilis pecah di v87-era commit 473231a**: `sw.js` dinaikkan ke v100 + `index.html ?v=100` tanpa menyentuh `version.js`/`version.json` (tetap v99). Akibat kumulatif: overlay update tidak pernah muncul (`remote.cacheBust === CACHE_BUST`), cache SW tidak pernah invalid (user PWA berisiko stuck HTML lama), catatan rilis tidak pernah sampai user.
- **Re-align SEMUA ke v101**: `version.js` CACHE_BUST + `version.json` cacheBust + `sw.js` CACHE_NAME + `index.html ?v=`. Komentar `KONVENSI RILIS` ditambahkan di `version.js`: satu bump = 4 tempat sekaligus.
- **Infra deploy hari yang sama** (di luar app):
  * `api/supabase-config.js`: `FALLBACK_ANON_KEY` di-hardcode `'******'` (placeholder) menimpa fallback valid klien → `createClient(url, '******')` gagal → sinkronisasi mati diam-diam. Fix: fallback server = JWT anon yang sama dengan klien.
  * 13 aset `kaki5/` (dexie, supabase.min, ikon, modul sync/onboarding/app-link) yang tidak sampai ke snapshot `kasol-beta` dipulihkan; snapshot main kini 599 file (dari 404).
  * `push-beta.ps1` + `push-live.ps1`: tambah **`Test-TreeDrift`** (guard blocking: snapshot squash harus identik dengan work HEAD) dan **version-bump reminder** (WARN jika `kaki5/` berubah tanpa bump `version.json`).
  * `.gitignore` (work + beta): whitelist `!kaki5/assets/icon-old-backup-*.png` & `!kaki5/assets/icon-old.png` agar tidak kena pola `*.backup*`.

## 2026-08-26 (v87 / 1.0.19: kartu KPI + form menu 2 kolom + restruk nota)
- **KPI Beranda & Laporan**: utility baru `.kbg-orange-b` (pola sama dgn `kbg-green-b/-red-b/-blue-b`) diterapkan ke 5 kartu jumlah transaksi / porsi / rata-rata (beranda) + 2 kartu Transaksi / Porsi (laporan) — konsisten "warna kartu = warna nilai" (oranye pastel + border `#FFCC80`).
- **Form menu (Edit/Tambah)**: field "Harga Modal / Bahan (Rp)" dan "Harga Jual (Rp)" dibungkus `<div class="kgrid-2col-gap8">` (utilitas CSS eksisting) menjadi 2 kolom sejajar; "Harga Ojol" tetap full width. Urutan field dibalik: Modal di kiri, Jual di kanan.
- **Restruk nota (Bluetooth thermal & window.print fallback)**:
  * Tipe pesanan SELALU tercetak (kiri) dengan label "Dine-in" / "Take-away" / "Ojol"; catatan pesanan di kanan via `padLine(32)`.
  * Topping per-item dicetak sebagai baris "+ nama harga" di bawah item, ikut dijumlahkan ke total.
  * Alamat usaha dari setting `alamat` tampil di header nota (menggantikan teks "Kasir Solo - Kaki Lima" yang lama).
  * Footer dirapikan: "Terima kasih! Semoga berkah" jadi satu baris, "Kasir Solo - Kaki Lima" pindah ke paling bawah sebagai sub-line.
  * `testPrint`: header "=== TES CETAK ===" pakai parameter `warungName` langsung (tidak `.replace` string lagi); footer test jadi "Printer berfungsi!".

## 2026-08-25 (iterasi UI halaman Jualan + sinkronisasi chip lisensi)
- **Kontrol sticky di atas grid menu**: tombol tipe order (🍽️ Dine-in / 🥡 Take-away / 🛵 Ojol) + pencarian + accordion kategori tetap terlihat saat menu di-scroll. Tipe order aktif = tombol primary; harga Ojol otomatis dipakai di grid & keranjang saat 🛵 dipilih.
- **Catatan pesanan end-to-end**: kotak catatan di bawah tombol tipe order (placeholder dinamis per tipe), draft persist di `localStorage['kasirsolo:order-note']`, tersimpan sebagai `orderNote` di record penjualan, tercetak di nota Bluetooth & nota browser, tampil di detail transaksi & laporan; reset otomatis setelah simpan.
- **Footer cart baru**: `🖨️ Simpan & Cetak` (simpan dulu → cetak nota; kegagalan printer tidak membatalkan transaksi), Batal & Simpan sama lebar, Simpan oranye tanpa emoji.
- **Qty bisa diinput manual**: angka qty antara tombol −/＋ di keranjang dan di menu selector kini `<input type="number">`. Saat mengetik, total/harga baris/preset bayar/kembalian ter-update real-time **tanpa rebuild daftar** (fokus ketikan aman — `setCartQty()` + `refreshCartModalTotals()`); sinkron penuh saat blur/Enter. Batas 1–999 (cart) & 1–99 (selector); stepper −/＋ membaca nilai ketikan dulu (tidak menimpa).
- **Menu selector**: daftar topping jadi **grid 2 kolom** (urutan kiri→kanan lalu ke bawah).
- **Kartu menu**: badge emoji **horizontal satu baris** — 🧂 (punya topping) & 🛵 (ada harga Ojol) berdampingan di bawah harga; badge qty pindah ke dalam kartu (pill kanan-atas).
- **Sinkronisasi chip lisensi (`#trialChip`)**: chip kini cermin persis `getLicenseStatus()` (sumber sama dengan gate boot & cek 60 detik). `daysLeft()` jadi async dan memakai jam efektif anti-rollback `getEffectiveNow()` — dulu `Date.now()` mentah membuat chip bisa bertentangan dengan gate saat jam perangkat dimundurkan. Status `revoked` kini tampil "✕ Dicabut", `expired` "Habis", `none` "—". Semua pemanggil `daysLeft` (kartu status, lock overlay, grant extension) ikut di-`await`.
- **Fix audit**: duplikat id `posCatAccordion`, duplikat `data-action` di `#bayarInput`, duplikat `class` di tombol trial; CSP `connect-src` + `wss://…supabase.co` (realtime); `ensureUnitId()` kembali me-return nilai.

## 2026-08-25 (PWA v3: perbaikan manifest agar prompt install muncul)
- Tambah `background_color` ke manifest dinamis (`pwa.js`) — Chrome mensyaratkannya untuk install prompt.
- `purpose` dari string `"any maskable"` → array `["any","maskable"]` (format valid).
- Hapus referensi screenshot yang tidak ada; bump SW cache v67 → v68 (lanjut ke v85 pada rilis berikutnya).

## 2026-08-25 (fix PWA install flow — native prompt sekarang dipanggil benar)
- **Bug**: `checkPWAInstalled()` menilai `navigator.serviceWorker.controller` == PWA terpasang, padahal SW aktif di setiap kunjungan. Akibatnya `isPWAInstalled = true` sebelum prompt muncul, `beforeinstallprompt` ditolak, dan `deferredPrompt` tidak pernah disimpan.
- **Bug**: `installPWA()` nyaris selalu return karena `isPWAInstalled || checkPWAInstalled()` jadi `true` dari sinyal false-positive — native dialog "Install app" tidak pernah dipanggil, tapi UI tetap ganti ke "Sudah Terpasang" + toast "berhasil" (halu).
- **Fix 1**: Hapus sinyal `navigator.serviceWorker.controller` dari `checkPWAInstalled()` — manifest + localStorage + display-mode yang jadi acuan akhir.
- **Fix 2**: `beforeinstallprompt` listener simpan `deferredPrompt` **sebelum** cek apapun — banner yang disembunyikan kalau terdeteksi terpasang, prompt tetap tersimpan walau tak ditampilkan.
- **Fix 3**: `installPWA()` tidak ada guard pre-prompt lagi — langsung `deferredPrompt.prompt()` kalau tersedia, tanpa timeout polling 5 detik yang bikin muncul "toast tutorial" yang hilang sebelum terbaca.
- **Fallback**: Kalau prompt belum ready saat klik, tampilkan `showManualInstallGuide()` (overlay full-screen langkah instalasi), bukan toast yang hilang.

## 2026-08-17 (v64: harga coret di layar pembelian)
- Layar Beli Lisensi menampilkan **harga coret** (harga sebelum diskon, strikethrough) bila `price_before_label` diisi di Admin Console — harga efektif tetap `price_label`.

## 2026-08-17 (v63: halaman "Lisensi Dicabut" bergaya gate)
- **Layar lisensi dicabut kini halaman penuh putih** dengan struktur persis halaman gate lisensi (permintaan pemilik 2026-08-17): logo + Kasir Solo/Kaki Lima Edition, judul merah "Lisensi Dinonaktifkan", tombol 💳 Beli Lisensi (QRIS) + 💬 Tanya Admin, tautan "Sudah punya kode baru? Aktivasi manual" (input serial → `activateLicense`), footer kontak WhatsApp. Mengganti kartu kecil di overlay gelap.
- Implementasi: `#lockRevokedPage` baru di dalam `#lockOverlay` + kelas `.revoked-page` (latar putih penuh); mode di-sinkronkan di `checkLicenseGate` (`setLockMode`) sehingga kondisi lain (trial habis) tetap memakai kartu default.
- E2e lengkap terverifikasi: cloud diset `batal` → halaman baru tampil → aktivasi via edge function `activate-license` (auth x-admin-key, serial KK5-00ZZ-O9VD-99-NHDRBL) → reload → auto-unlock "LISENSI ✓ Aktif".
- Versi: `1.0.12` / `v63` sinkron 5 titik.

## 2026-08-17 (v62: tombol perpanjangan langsung ke WhatsApp)
- **"🎁 Tambah 1 Hari Gratis" kini langsung membuka WhatsApp** (`wa.me` dengan teks promo + link aplikasi terisi; mobile → aplikasi WhatsApp, desktop → WhatsApp Web). Dulu: contact picker OS / share sheet — membingungkan ("kok ke kontak?"). Alur setelahnya tetap: konfirmasi "sudah dibagikan?" → +1 hari (maks 20x).
- Versi: `1.0.11` / `v62` sinkron 5 titik. E2e: klik tombol → tab wa.me dengan teks terisi.

## 2026-08-17 (v61: panel kalender lebih kontras)
- **Panel pemilih tanggal (#customPicker)** — kalender harian/custom, opsi minggu, opsi bulan — kini berlatar krem-oranye brand (`--orange-bg`), border oranye lembut, dan bayangan mengambang, sehingga jelas terbedakan dari kartu-kartu laporan di bawahnya. Sel tanggal, opsi minggu & bulan tetap putih agar terbaca. Style pindah dari inline (laporan.js) ke kelas CSS (`.date-nav .custom-picker`). (Permintaan pemilik 2026-08-17.)
- Versi: `1.0.10` / `v61` sinkron 5 titik.

## 2026-08-17 (v60: fix akordeon rincian pengeluaran)
- **Bug (laporan user):** akordeon kategori pengeluaran tidak membuka di filter Mingguan/Bulanan/Custom — daftar transaksi di dalam panel hanya dirender untuk periode Harian (panel terbuka tapi kosong). Kini semua periode menampilkan daftarnya; untuk periode lintas hari tiap baris menampilkan tanggal + jam (contoh: "17 Agu 2026 · 04:30").
- Versi: `1.0.9` / `v60` sinkron 5 titik. E2e: klik kategori di Mingguan → panel terbuka berisi item.

## 2026-08-17 (v59: kotak kembalian selalu tampil)
- **Kotak 💰 Kembalian kini SELALU tampil** di layar pembayaran (sebelumnya tersembunyi sampai uang diterima diisi). Modal dibuka → "Rp 0" (uang pas); uang belum cukup → tetap "Rp 0"; cukup/lebih → angka kembalian. (Permintaan pemilik 2026-08-17.)
- E2e: buka modal → box tampil Rp 0; preset 20.000 utk total 15.000 → Rp 5.000.
- Versi: `1.0.8` / `v59` sinkron 5 titik.

## 2026-08-17 (v58: Fase 4-5 — UI & kebersihan, penutup audit 2026-08-17)
- **T17/M7**: `bottom-nav` z-index 700 → **350** sesuai kontrak ekosistem (modal/gate/toast kini di atas nav; sebelumnya nav menutupi semuanya). Kontrak z-index CONTEXT.md diperbarui lengkap termasuk `#updateOverlay 800`.
- **T18/M8**: tab kategori POS pakai `data-cat` + delegasi (mengganti interpolasi string mentah ke onclick — rapuh terhadap kategori dari cadangan buatan).
- **T19/M9**: `boot()` tidak menggantung selamanya saat settings module gagal termuat — race timeout 8 detik + toast + tetap lanjut (setupPWA, subscribe).
- **T22/L2**: `checkExpired` clamp tanggal bulanan (31 Jan + 1 bln = 28/29 Feb, bukan 3 Mar).
- **T23/L3**: `./js/version.json` masuk precache SW (cek versi kini jalan offline); komentar strategi SW dikoreksi (network-first).
- **T25/L5**: teks "Hapus Semua Data" jujur menyebut status lisensi dipertahankan.
- **T26/L6**: `Math.max(...arr)` di laporan → reduce (aman dataset ekstrem).
- **T27/L8**: dead exports dihapus (`getLicenseSyncState`, `isWithinLicenseGracePeriod`, `activateLicenseCloud`, `NETWORK_GRACE_DAYS`).
- **T28/L9**: manifest dibersihkan dari key non-standar; **T21**: file `*.bak` dihapus.
- **T24/L4**: dokumen disinkronkan — README (?v=58), DEVELOPER.md (versi SW generik), CONTEXT.md (onboarding = Nomor WhatsApp, kontrak z-index + updateOverlay, aturan bump 5 titik + notes).
- Versi: `1.0.7` / `v58` sinkron 5 titik. Validasi: 41/41 modul, validate 30/30, pos 6/6.
- **STATUS PLAN: Fase 0-5 selesai.** Sisa backlog opsional: T20 self-host data wilayah, D4 validasi lisensi server-side (roadmap cloud).

## 2026-08-17 (v57: Fase 3 — robustness lisensi)
- **T12/M1 — Trial berjangkar cloud**: `startTrial(anchorStartedAt)` menerima `clients.first_seen`; `continueKnownDevice` meneruskannya sehingga hapus data lokal / install ulang **tidak me-reset jatah trial** (first_seen > 7 hari → langsung gate beli lisensi, bukan trial baru).
- **T13/M3 — Anti-rollback jam**: `clockAnchor` (waktu tertinggi yang pernah app lihat, diperbarui saat cek lisensi & sync sukses). Jam perangkat dimundurkan > 2 hari → "sekarang" efektif = anchor → trial/lisensi yang habis tidak hidup lagi. `checkExpired`/`getLicenseStatus`/`isLicensed` pakai `getEffectiveNow()`.
- **T14/M4 — Fingerprint V3**: zona waktu & devicePixelRatio dikeluarkan dari komposit (ganti zona waktu/zoom display tidak lagi mengubah deviceCode → tidak ada lagi "kode bukan untuk perangkat ini" karena bepergian). Aman diterapkan sekarang karena belum ada serial berbayar terbit. Pendukung: `readLicenseRow` kini keyed by **unit_id** (kekal) bukan device_code; `unit_id` tersimpan dipertahankan sehingga baris cloud & identitas perangkat tetap tersambung, kolom device_code menyegarkan via sync.
- **T15/M5 — Wire callback UI lisensi**: `window._ksr_updateTrialChip/_ksr_checkLicenseGate/_ksr_renderLicenseInfoCard` kini di-wire di app.js — refresh chip/kartu pasca-aktivasi realtime/polling tidak lagi menunggu interval 60 detik.
- **T16/M6 — Polling ber-cancel token**: memulai poll baru membatalkan rantai lama (tidak lagi tumpuk timer paralel saat submit berulang).
- Versi: `1.0.6` / `v57` sinkron 5 titik. Validasi: 41/41 modul, validate 30/30.

## 2026-08-17 (v56: Fase 1 — integritas data cadangan)
- **T6/H4 — Restore transaksional**: clear+insert dibungkus `DB.transaction('rw', …)` — gagal di tabel mana pun = rollback total, data lama tetap utuh (dulu: clear duluan tanpa transaksi, file rusak di tengah = data lenyap).
- **T6 — Validasi dua lapis**: selain bentuk array, kini field per tabel divalidasi (nama/harga menu, tanggal-transaksi format, total, items, jumlah pengeluaran, key settings) + id wajib positive-integer + id tidak boleh ganda dalam satu tabel. File rusak ditolak DI DEPAN dengan pesan spesifik, bukan meledak di tengah restore.
- **T7/H5 — Lisensi keluar dari file cadangan**: `sanitizeSettingsRows()` membuang `license`, `onboarded`, `sync`, `installId`, `unitId`, `deviceIdentity` dari ekspor DAN impor — file cadangan lama yang masih memuat license otomatis netral saat dipulihkan; kloning lisensi antar perangkat via file cadangan tertutup. Keputusan D2: buang total.
- **Fix overlay force-update palsu**: `pwa.js` memanggil `notifyUpdateAvailable(string)` saat event SW `updatefound` (kontrak lama) → overlay muncul walau versi sama. Pemanggil dihapus (sumber kebenaran versi = version.json), dan `notifyUpdateAvailable` dikeraskan: abaikan pemanggil tanpa objek remote valid / versi sama. (Bug ketemu live saat uji v56.)
- Validasi: `test_validate.js` diperluas 14 → 30 kasus (field rusak, id ganda, filtering) — 30/30.
- Versi: `1.0.5` / `v56` sinkron 5 titik.

## 2026-08-17 (v55: Force Update Overlay)
- **Notifikasi versi baru jadi overlay full-screen** (`#updateOverlay`, z-index 800 — menutup seluruh dashboard termasuk navbar; tidak bisa ditutup kecuali tombol). Toast lama jadi fallback.
- **Catatan perubahan per rilis**: `version.json` kini punya field `notes` (array) — dirender sebagai daftar "Yang baru di versi ini" (di-escape, fallback default bila kosong).
- **Tombol "OKE"** = pemicu `performForceUpdate()` (SW update → reload). Reload menjalankan boot() → profil tersinkron ke server — jadi setiap rilis baru otomatis jadi momen backfill profil user lama.
- Versi: `1.0.4` / `v55` sinkron 5 titik.

## 2026-08-17 (v54: Fase 0 + Sync Robust — hasil audit 2026-08-17)
- **T8/H3 Fix false-revoke** (`license.sync.js`): baris clients yang tak terlihat RLS (user_id NULL / milik session lain) tidak lagi otomatis dianggap "terhapus" → dibuat session ber-metadata `unit_id` lalu **dibaca ulang**; revoke hanya jika benar-benar hilang. Revoke lama bertanda `not-found` yang barisnya ternyata ada **otomatis dipulihkan**. (Bug ini kejadian nyata: fresh install di perangkat dikenal cloud langsung terkunci "Lisensi Dicabut".)
- **T29 Sync robust** (`sync.js`, `sync.health.js` baru): flag `synced` diverifikasi ke server max 1×/24 jam — baris hilang otomatis di-push ulang (self-heal); retry loop 5 menit saat pending + trigger `online`; toast alasan spesifik per tahap; tabel `sync_errors` (RLS insert-only, migration `supabase/migration-sync-errors.sql`); panel **🩺 Diagnosa Sinkronisasi** (10 langkah + Salin Hasil) di Pengaturan → Data & Cadangan.
- **T1**: navigasi laporan tanpa inline onclick — delegasi klik via `data-*` (`data-date/start-date/month-date/catid`, `.trx-detail-item/.expense-detail-item`).
- **T2**: pulihkan `.license-lock-card` (hapus `display:none !important` yang bikin layar kunci kosong).
- **T3**: CSP `connect-src` + `https://raw.githubusercontent.com` (region picker emsifa tidak lagi diblokir).
- **T4**: script unregister SW di-guard hostname (localhost/127.0.0.1) — produksi tidak lagi membongkar SW tiap load (offline-first hidup kembali).
- **Perbaikan fondasi**: re-export `helpers.pure.js` dari `helpers.js` (tanpa ini 19 modul gagal load), bersihkan orphan ref `customStartInput/customEndInput`, `boot()` tahan banting (try/catch per langkah, sync tetap jalan), stub MutationObserver di test-shim.
- Versi: `APP_VERSION 1.0.3` · `CACHE_BUST v54` · `CACHE_NAME v54` · `?v=54` · `version.json` — sinkron.
- Validasi: `test-modules.js` 41/41 + DOM id 0 orphan, `test-imports.js` 41/41, `test_validate` 14/14, `test_pos` 6/6; end-to-end browser: onboarding → trial → isi profil → baris `clients` ter-update → Diagnosa 10/10 ✅.

## 2026-08-13 (P8: Smart Button Bukti Bayar + Harga dari products)
- **🔘 "Kirim Bukti Bayar" jadi smart button** — klik langsung buka file picker foto
  perangkat (hidden input), tampil preview + nama file, lalu tombol berubah jadi submit.
  Satu aksi, tanpa dobel-step (sebelumnya harus pilih file dulu baru kirim).
- **Harga & kode produk dari `products`** — pembelian tidak lagi mengirim/menyimpan
  kolom `harga`; harga diambil dari `products.price_label` & `kode_produk` (filter
  `app_type=eq.kaki5&visible=eq.true`), dikirim ke `clients` (kolom `harga` sudah di-drop).
- **Upload bukti** ke bucket `bukti` (privat) → `bukti_url` simpannya path objek.
  Admin lihat via signed URL (15 menit).

## 2026-08-11 (P7: Seragamkan window-wiring — semua handler di app.js)
- Hapus **self-wire** di modul: `purchase.js` (5 handler), `settings.sync.js` &
  `settings.js` (`_ksr_syncNow`, duplikat), `bantuan.js` (`initBantuan`,
  `toggleTutorial`). Kini **function handler hanya di-wire di `app.js`** (konvensi R3).
- `app.js`: wire purchase handlers + `_ksr_syncNow` secara eksplisit; tambah
  `toggleTutorial` ke `_bantuanWireMap` (dipakai onclick global tanpa prefix).
- Shared-state `window.*` (config/client cache) tetap di modul — di luar scope R3.
- Tanpa bump versi/cache-version (logika internal wiring saja).
- Validasi: `test-modules.js` 38/38 + lint DOM 0 orphan, `test-imports.js` 38/38,
  `test_validate` 14/14 — semua exit 0.

## 2026-08-11 (P6: Perkuat lisensi — harden core logic + obfuscate salt)
- **Enforce MAX_EXTENSIONS di core logic** (`grantExtensionLogic`): function kini
  return `{ granted:false, reason:'max' }` saat jatah habis, bukan sekadar increment
  (sebelumnya cap cuma di UI layer — bisa di-bypass via console). UI `grantExtension`
  menangani `granted:false` dengan toast error.
- **Sanitize counter**: `grantExtensionLogic` & `trialEndDate` kini menolak nilai
  `extensionsUsed` negatif/NaN yang bisa dipakai memanipulasi masa trial (trial abadi).
- **Obfuscate salt**: `PRODUCT_SALT` tidak lagi konstanta plain yang greppable —
  di-derive runtime via `buildProductSalt()`. Â± defense-in-depth (security-through-
  obscurity), bukan pengganti validasi server. Trade-off offline PWA didokumentasikan.
- **Tidak ada bump versi/**cache-version (logika internal saja, tanpa public-facing
  constant index.html/sw).
- Validasi: `test-modules.js` (38/38 + lint DOM 0 orphan) & `test-imports.js` (38/38), exit 0.

## 2026-08-11 (P5: Self-Host supabase-js agar offline-cache-able)

- **Self-host supabase-js (P5/K6)**: download `@supabase/supabase-js@2.112.2` (UMD, `var supabase` → `window.supabase`) ke `js/supabase.min.js` (211KB). `index.html` tidak lagi load dari `https://cdn.jsdelivr.net/...` — kini file lokal, jadi bisa **di-precache** oleh SW.
- **Akar masalah (K6)**: fetch handler SW cuma `response.type === 'basic'` — supabase dari CDN cross-origin (type `cors`/`opaque`) **tidak pernah masuk cache**, jadi sync tak tersedia offline. Dengan self-host, file jadi same-origin `basic` → bisa `cache.addAll`.
- **SW precache**: tambah `./js/supabase.min.js` ke `ASSETS_TO_CACHE`; bump `CACHE_NAME = 'kasir-solo-kaki5-v41'`.
- **Versi di-sync (P4 rule)**: cache-bust `?v=47 → ?v=48` di `index.html` & `README.md`.
- **Tes**: `test-modules.js` & `test-imports.js` **38/38** (supabase.min.js ikut ke-scan, valid), lint DOM id 0 orphan, `test_validate` 14/14, `test_pos` 6/6 — semua exit 0.
- **Docs**: `AUDIT-REPORT.md` §12, `DEVELOPER.md` §2/supabase, `REGRESSION-CHECKLIST.md` cache-version table.

## 2026-08-11 (P4: Anti-Regression Checklist DOM id + Version Bump)

- **Lint DOM id otomatis (P4)**: file baru `test-html-refs.js` — scan semua `getElementById('...')` di 37 modul & verifikasi tiap id resolve ke `index.html` atau dibuat dinamis. Exit 1 kalau ada ref orphan (mencegah regresi senyap ala `#licenseInfoCard`/`#syncStatusText` yang pernah hilang tanpa error karena null-guard).
- **Gate diperkuat**: `test-modules.js` kini menjalankan lint DOM id di akhir run & exit 1 kalau ada orphan — satu perintah = syntax + real-import + anti-regresi id.
- **Dokumen baru** `docs/REGRESSION-CHECKLIST.md`: daftar id kritis (licenseInfoCard, syncStatusText, licUnit, installBanner, licenseGate) + trap order-of-operations untuk id yang di-inject dinamis + aturan bump cache version (APP_VERSION/CACHE_BUST di `js/version.js`, `CACHE_NAME` di `sw.js`, `?v=` di `index.html` & `README.md` wajib naik bareng).
- **Docs**: `DEVELOPER.md` §6 & §10 + unit-test lint; `AUDIT-REPORT.md` mencatat §11 (P4).
- Hasil lint bersih: **159 ref getElementById, 0 orphan**; `test-modules.js` & `test-imports.js` 37/37 exit 0.

## 2026-08-11 (P1–P3: Sentralisasi Versi + Test Harness Reliable)

- **Sentralisasi versi (P1/N7/K8)**: file baru `js/version.js` jadi satu sumber `APP_VERSION` (`1.0.0`). `app.js` me-wire `window.APP_VERSION` + mengisi label `#appVersionLabel`; `index.html` tidak lagi hard-code "Versi 1.0"; cache-bust `?v=46 → ?v=47` disinkronkan di `README.md`.
- **Test harness reliable (P2/K4)**: file baru `test-shim.js` (stub global Dexie/window/document/dll). `test-imports.js` di-rewrite agar memuat **semua** modul `js/` (36/36), bukan daftar hard-coded yang gagal karena kurang stub.
- **Validator CI-grade (P3/K5)**: file baru `test-modules.js` menjalankan `node --check` + real ESM import per modul dan exit 1 bila gagal — menghentikan false-pass `node --check` (trap yang pernah bikin `app.js` rusak lolos ke produksi).
- **Docs**: `DEVELOPER.md` §6 & §10 memakai `test-modules.js` & `test-imports.js` sebagai validasi utama; `AUDIT-REPORT.md` mencatat §9 (temuan K1–K8) & §10 (perbaikan P1–P3).
- **Cache-bust index.html `?v=47`** (bump setelah perubahan app.js/README).

## 2026-08-11 (Audit jalur data → Supabase + leads dari profil)

- **Fix `sync.js` getClient() → isPlaceholderKey()**: filter `'******'` & placeholder umum (sebelumnya cuma blokir `'PASTE...'` & `'...'`). Konfigurasi anon key di `supabase-config.js` sudah terisi asli sejak audit sebelumnya — view tool sempat ngeredact jadi `'******'`.
- **Jalur profil → `leads`**: `sync.js` `ensureSynced()` sekarang upsert ke tabel `leads` (ON CONFLICT unit_id) setelah upsert `clients`. Gagal leads tidak memutus sync clients (graceful catch). **Prasyarat:** jalankan `migration-leads-unitid.sql` di Supabase SQL editor.
- **`purchase.js` client mandiri**: `getSupabaseClient()` sendiri (tidak bergantung `sync.js` getClient()). Guard `isPlaceholderKey()` + createClient sendiri. Semua fungsi purchase pakai `sb = getSupabaseClient()` bukan `window._ksrSupabaseClient` langsung.
- **Migrasi:** `supabase/migration-leads-unitid.sql` — tambah `unit_id` + `user_id` + unique index + RLS anon own-rows di `leads` + backfill dari `clients`.

## 2026-08-10 (Fix Sync Profil + Region Picker 4-Level + Logo Baru)

- **Fix `sync.js` skip-on-already-synced**: `ensureSynced()` dulunya return early bila `state.status === 'synced'` (tanpa force). Kini semua save function di `settings.js` memanggil `ensureSynced({ force: true })` agar perubahan profil (alamat, pemilik, WA, nama warung) selalu di-push ke Supabase.
- **Fix `region.js` village prefill chain**: `loadDesa()` kini dipanggil otomatis saat modal alamat dibuka dengan data tersimpan (pre-fill desa sesuai kecamatan yang terpilih). Sebelumnya desa selalu kosong karena `loadDesa()` hanya dipanggil saat user manual pilih kecamatan.
- **Endpoint desa diperbaiki**: API desa menggunakan ID kecamatan 7 digit (bukan ID desa 8 digit). URL: `static/api/villages/{kecamatanId}.json`.
- **Logo aplikasi diperbarui**: `assets/icon.png` diganti logo baru (orange gradient, 1254x1254 PNG). PWA icons (`icon-192.png`, `icon-512.png`) diregenerasi dari logo baru. Logo lama (`icon-old.png`) dipertahankan di kartu versi halaman Pengaturan.
- **Hapus console.log debug** dari `sync.js`, `settings.js`, `region.js` pasca-verifikasi.
- **SW cache v30 → v31** (perubahan sync.js, region.js, settings.js, assets/icon*).

## 2026-08-07 (PWA Install Detection + API Wilayah Desa + Custom Period Laporan)

- **PWA Install Detection** (`js/pwa.js`):
  - Deteksi otomatis kalau PWA sudah terinstal (standalone, iOS standalone, localStorage flag)
  - Tidak tampilkan banner "Pasang di HP" jika sudah terinstal
  - Persist flag ke localStorage `kasirsolo:pwa-installed`
  - Listen `display-mode` change untuk deteksi instalasi sesudah reload
  - Notifikasi update SW versi baru tersedia
  - Export `isPWAInstalled`, `checkPWAInstalled` untuk manual check
- **API Wilayah Indonesia sampai Desa** (`js/region.js`):
  - Support 4-level dropdown: Provinsi → Kota/Kab → Kecamatan → Desa/Kelurahan
  - Endpoint: raw GitHub `master/static/api/villages/{kecId}.json`
  - Update `settings.js` + `index.html` (modal alamat) tambah dropdown Desa
- **Custom Period di Laporan** (`js/laporan.js`, `js/app-state.js`, `js/app.js`, `index.html`):
  - Tab baru "Custom" di halaman Laporan
  - Date picker mulai → selesai (input type=date)
  - Validasi mulai ≤ selesai
  - Grafik label "Custom"
- **Fix NaN Laporan** (`js/laporan.js`): Guard `|| 0` di akumulator (totalModal, totalHarga, qty, hargaJual, daySum)
- **Fix Tanggal Bocor** (`js/app-state.js`): `setReportPeriod()` reset tanggal ke hari ini
- **Sync ke mirror & commit** semua perubahan kaki5 + admin docs

## 2026-08-07 (Fix Tanggal "Bocor" saat Ganti Tab Periode Laporan)

Hasil audit logika tampilan laporan (diuji 6 skenario di browser):
- **Skenario A** Normal Mingguan: Omzet/Modal/Pengeluaran/Untung/Porsi/Margin ✓ akurat.
- **Skenario B** Transaksi **tanpa field `totalModal`** (data lama/import): ❌ dibuget —
  `modal += undefined` → NaN merambat ke **Modal=0, Untung=0, Margin=NaN%**. **DIPERBAIKI**
  dengan guard `|| 0` di akumulator (`totalHarga`, `totalModal`, `qty`, `hargaJual`, `daySum`).
- **Skenario D** Bulanan: chart M1–M5 + agregasi menu laris ✓.
- **Skenario E** Periode kosong: tampil Rp 0 tanpa crash/NaN ✓.
- **Skenario F** Harian: label "Hari Ini" + akordeon pengeluaran dengan item list ✓.
- Catatan desain: item list pengeluaran hanya tampil di mode Harian (mingguan/bulanan cuma total kategori).
- SW cache `v21` → `v22`.

## 2026-08-07 (Riwayat Transaksi di-Group per Hari & Tanggal)

Di halaman Laporan, daftar transaksi kini **dipisahkan/di-group per hari & tanggal**:
- Header per hari: `📅 {Hari}, {Tanggal}` + subtotal hari itu & jumlah transaksi.
- Transaksi di dalamnya diurutkan terbaru dulu (pakai jam `formatTime`).
- Kini tampil di **semua periode** (Harian / Mingguan / Bulanan) — sebelumnya cuma di Harian
  dan flat tanpa grup.
- Terverifikasi di browser: 3 transaksi lintas 3 tanggal → 3 grup (Rabu 5 Agu, Kamis 6 Agu, Jumat 7 Agu 2026) @ mingguan.
- SW cache `v20` → `v21`.

## 2026-08-07 (Fix Sync Profil — "sinkronisasi belum dikonfigurasi")

Akar masalah: `js/supabase-config.js` anon key masih **placeholder `'PASTE_ANON_KEY_DISINI'`**,
sehingga `sync.js` `getClient()` balik `null` → setiap simpan profil memunculkan notif
"sinkronisasi belum dikonfigurasi (isip anon key)".
- Embed **anon key asli** (publik, aman di browser) ke `supabase-config.js` (ganti placeholder).
- Rapikan komentar header (buang instruksi "tempel anon key" yang usang).
- Terverifikasi di browser: `anonPlaceholder:false`, `anonLen:208`, `supabaseLib:true`
  → sinkronisasi profil ke Supabase kini aktif.
- SW cache `v19` → `v20`.

## 2026-08-07 (Fix API Wilayah KO — notif "gagal memuat wilayah")

Akar masalah: endpoint lama `https://www.emsifa.com/api-wilayah-indonesia/api/...`
mengembalikan **404** (bukan karena internet), sehingga dropdown provinsi gagal →
notif "Gagal memuat wilayah (cek internet)".
- Ganti `js/region.js` ke raw GitHub `master/static/api` yang valid:
  - `provinces.json` (34 provinsi)
  - `regencies/{provId}.json` (kota/kab)
  - `districts/{kabId}.json` (kecamatan)
- Terverifikasi end-to-end (34 provinsi, kabupaten prov-11 = 23, kecamatan kab-1101 = 10).
- SW cache `v18` → `v19`.

## 2026-08-07 (Tutorial Disesuaikan dengan Kode Asli)

Semua isi tutorial **ditulis ulang berdasar kode aplikasi yang sebenarnya**
(dibaca dari `js/menu.js`, `pos.js`, `laporan.js`, `pengeluaran.js`, `printer.js`,
`backup.js`, `settings.js`, `sync.js`, `license.js`, `onboarding.js`), bukan perkiraan
visual. Isi sekarang 11 topik yang akurat dengan label & langkah nyata:
- 🚀 Memulai Pakai (onboarding 2-langkah + pengingat profil)
- 🍽️ Atur Menu (kategori dropdown Makanan/Minuman/Snack/Lainnya, harga jual/ modal, ✏️ ⏸️ 🗑️)
- 🛒 Catat Penjualan (keranjang, bilah hijau bayar, preset nominal, kembalian otomatis)
- 💸 Catat Pengeluaran (jenis: Bahan Baku/Gas & BBM/Sewa Tempat/Peralatan/Lainnya)
- 📊 Lihat Laporan (periode Harian/Mingguan/Bulanan, ringkasan, margin, menu laris)
- 🖨️ Cetak Struk (printer Bluetooth + fallback print browser)
- 💾 Simpan & Pulihkan Data (cadangan .json, pulihkan, hapus semua)
- 👤 Profil & Data Usaha (region picker provinsi/kab/kec)
- 📲 Pasang & Offline (PWA)
- 🎟️ Lisensi, Masa Coba & Aktivasi
- ❓ FAQ
- Perbaiki akurasi: onboarding = Nama Usaha → "Mulai Masa Percobaan" → "Setuju & Lanjut";
  kategori = dropdown tetap (bukan ketik bebas); tombol bayar = bilah hijau keranjang.
- SW cache `v17` → `v18`.

## 2026-08-07 (Halaman Tutorial/Bantuan Ditingkatkan)

- **Akordeon auto-tutup**: saat satu tutorial dibuka, tutorial lain otomatis tertutup
  (hanya satu panel terbuka — `toggleTutorial` sekarang menutup semua panel lain).
- **Materi lebih komprehensif**: tutorial bertambah dari 8 → 12 dengan 4 topik baru:
  📲 Pasang Aplikasi di Layar Utama & Mode Offline, 🎟️ Memahami Lisensi & Masa Coba,
  🏷️ Mengelompokkan Menu dengan Kategori, ❓ Pertanyaan yang Sering Diajukan (FAQ).
- SW cache `v16` → `v17`.

## 2026-08-07 (Halaman Pengaturan Dirapikan)

- **Hapus kartu "☁️ Sinkronisasi Profil"** (visual saja; fungsi tetap). Sinkronisasi
  tetap berjalan **otomatis di background** tiap profil diupdate (nama, pemilik,
  WhatsApp, alamat via `ensureSynced()`).
- **Kartu versi dikembalikan seperti semula**: hapus kartu "Masa Coba Gratis",
  field kode lisensi, tombol Beli Lisensi & tombol Aktifkan dari halaman pengaturan.
  Semua itu tetap diakses lewat tombol **"🎫 Kelola Lisensi"** (sheet status +
  perpanjangan + aktivasi).
- SW cache `v15` → `v16`.

## 2026-08-07 (Narasi Profil → Fokus Keuntungan User)

Narasi kartu profil dirombak jadi **benefit-driven & non-teknis** (buang kata "sinkron/statistik/akurat"):
- Judul: "Lengkapi Profil Tokomu".
- Sub: pengalaman makin nyaman, bantuan lebih cepat, info promo &amp; tips yang pas.
- Poin: 👤 nama & WhatsApp → bantuan lebih cepat; 📍 alamat toko → tips sesuai daerah.
- SW cache `v14` → `v15`.

## 2026-08-07 (Banner Profil → Kartu Besar di Tengah, Immersif)

Notifikasi "Lengkapi Profil" menjadi **kartu besar di tengah layar** (modal-like, immersif):
- `position:fixed` tengah (flex, `inset:0`, `z-index:520`) + **backdrop peredup blur** di belakang.
- Kartu lebar `max-width:420px`, radius 28px, gradient oranye, animasi pop.
- Konten: emoji besar, judul "Lengkapi Profil Toko Kamu", narasi + 2 poin manfaat
  (kontak/WhatsApp, alamat/wilayah), CTA "Isi Profil Sekarang" (ke Pengaturan),
  dismiss "Nanti Saja" + ✕ + klik backdrop. (poin "sinkronisasi" dihapus per permintaan)
- `checkProfileNotification` kini toggle class `.show`. CSS `.prof-banner-*`.
- SW cache `v12` → `v13`.

## 2026-08-07 (Onboarding 2-STEP: nama usaha → Syarat & Ketentuan)

Transisi gate onboarding lebih mulus buat user gaptek: **2 langkah, tanpa checkbox**.
- **STEP 1** (`gateOnboarding`): isi Nama Usaha → tombol "🚀 Mulai Masa Percobaan".
  Klik → validasi nama, simpan `namaWarung`, buka modal S&K. **Trial BELUM mulai.**
- **STEP 2** (modal `tcModal`): Syarat & Ketentuan + label "Terakhir diperbarui v1.1".
  - **🔙 Batal** → tutup modal, balik ke STEP 1 (nama tetap keisi).
  - **✓ Setuju & Lanjut** → `startTrial()` + masuk aplikasi.
- Checkbox S&K **DIHAPUS** (beserta handler `_ksr_tcClick`/`_ksr_lastTcClick`) — menghilangkan
  semua cacat logika checkbox sebelumnya. Handler baru: `_ksr_proceedToTC`, `_ksr_cancelTC`.
- **Terverifikasi end-to-end**: validasi nama kosong → error; Batal → balik step 1;
  Setuju → trial mulai + gate hilang.
- SW cache `v10` → `v11`.

## 2026-08-07 (Audit & Fix Bulletproof Checkbox S&K)

**Akar kacau**: handler `onclick` di `<input type="checkbox">` tidak andal dipicu klik
(terutama dengan label membungkus / event forwarding), dan klik kadang kena span
"Syarat & Ketentuan" → perilaku tidak deterministik ("perlu 2 klik" / "buka modal saat uncheck").
- **Fix**: pindahkan handler ke **row `<div onclick="window._ksr_tcClick(event)">`** yang pasti
  menerima klik; checkbox `pointer-events:none` (klik selalu kena row); span "Syarat &
  Ketentuan" `onclick="event.stopPropagation(); window._ksr_openTC()"` (buka modal saja,
  tidak ikut state checkbox).
- **Terverifikasi end-to-end (real event)**: unchecked→1 klik buka modal (box tetap unchecked,
  tombol disabled); accept→centang+enable; checked→1 klik uncheck+disable, tanpa modal.
- SW cache `v8` → `v9`.

## 2026-08-07 (Fix Double-Fire Checkbox S&K)

**Akar**: `<label for="tcCheckbox">` yang membungkus checkbox-nya sendiri memicu **double-fire klik** di Chrome → butuh 2 klik untuk buka modal; tetap buka modal saat mau uncheck.
- **Fix**: hapus `for` dari label (checkbox bisa klik langsung / via label tanpa double-fire).
- **Handler `_ksr_tcClick` dirombak jadi deterministik**: `preventDefault()` + `stopPropagation()` selalu, **manual toggle**, + **guard timestamp 250ms** (kolaps double-event). unchecked→1 klik buka modal; checked→1 klik uncheck + tombol disabled (tanpa modal).
- SW cache `v7` → `v8`.

## 2026-08-07 (Revisi Logika Klik Checkbox S&K)

Klik checkbox kini **kondisional** via `_ksr_tcClick(event)`:
- **Belum centang** → klik membuka modal Syarat & Ketentuan (box tetap unchecked, tombol disabled).
- **Sudah centang** → klik **langsung uncheck** (tanpa modal) + tombol "Mulai Masa Percobaan" kembali disabled.
- SW cache `v6` → `v7`.

## 2026-08-07 (Revisi Tombol Trial & Narasi)

- **Tombol "Mulai Masa Percobaan"**: saat `disabled` → abu-abu (`#d9d9d9`) + teks `#9c9c9c` +
  `pointer-events:none` (tidak bisa di-hover); saat checkbox S&K aktif → kembali hijau normal.
- **Narasi**: hapus kata "gratis" di meta `description` & narasi onboarding
  ("Aplikasi kasir buat pedagang kaki lima…").
- SW cache `v5` → `v6`.

## 2026-08-07 (Fix Modal S&K Tertutup Gate Onboarding)

### 🎭 Akar masalah: z-index (bukan checkbox)
Klik checkbox **sudah membuka modal S&K**, tapi modal (`.modal-overlay` z-index 200)
ter-render **DI BELAKANG gate onboarding `#licenseGate` (z-index 500)** yang menutup layar —
jadi modal tidak terlihat sama sekali.
- **Fix**: naikkan layering semua overlay di atas gate — `.modal-overlay` 200→**600**,
  `.confirm-overlay` 300→**610**, `.toast` 400→**620** (di `css/style.css`).
- **Terverifikasi**: setelah klik checkbox, modal display `flex` dengan z-index 600 > gate 500.

## 2026-08-07 (Fix Checkbox Syarat & Ketentuan)

### ☑️ Klik checkbox kini membuka modal Syarat & Ketentuan
- **Bug**: checkbox `tcCheckbox` ter-hardcode `disabled` → klik tidak merespon (perbaikan tahap 1).
- **Tahap 2**: klik checkbox kini **langsung membuka modal S&K** (`onclick="event.preventDefault();
  window._ksr_openTC()"`), TIDAK langsung nyentang. Baru setelah user klik "✓ Saya Setuju & Lanjut"
  → checkbox tercentang + tombol **"Mulai Masa Percobaan"** aktif.
- Tombol trial tetap **disabled** selama checkbox belum tercentang.
- **Terverifikasi** di browser (server 8086): klik checkbox → modal terbuka (box belum centang,
  tombol disabled) → setuju → box centang + tombol enable.

## 2026-08-07 (Smart Gate: Onboarding ↔ Trial Habis)

### 🚦 Gate cerdas (3 mode di satu overlay)
- **User baru** (`none`): onboarding (Nama Usaha + Syarat & Ketentuan → Mulai Masa Percobaan).
- **Trial jalan / lisensi aktif**: gate **di-skip**, langsung masuk aplikasi.
- **Trial habis / lisensi kedaluwarsa**: gate **berubah fungsi jadi input lisensi** —
  teks "Masa Coba Gratis Habis" + input kode + tombol **💬 Beli**, **🔓 Aktifkan**,
  dan **Perpanjang masa coba (+1 hari)** sebagai teks di bawah + counter `x/20`.
  Berhasil (aktifkan / perpanjang) → gate ditutup + app lanjut.

### 🛡️ Perbaikan double-overlay
- `checkLicenseGate()` kini **skip** `lockOverlay` saat gate full-screen tampil →
  tidak ada lagi dua layar numpuk saat trial habis + buka ulang app.
- Aktivasi/perpanjang dari gate kini **memanggil `boot()`** → user expired bisa masuk
  dengan bersih (sebelumnya tidak).

## 2026-08-07 (Onboarding Single-Step + Syarat & Ketentuan)

### 🔤 Onboarding
- Digabung jadi **satu langkah** di layar gate: input **Nama Usaha** + persetujuan
  **Syarat & Ketentuan** → tombol **"Mulai Masa Percobaan"** → langsung mulai trial.
- **Hapus** step-2 onboarding (overlay terpisah) dan **hapus field & tombol aksi**
  lisensi dari layar onboarding (aktivasi lisensi tetap ada di menu Lisensi / sheet).
- Tombol "Mulai Masa Percobaan" **aktif hanya setelah** user membaca & menyetujui
  S&K (checkbox dipicu lewat modal S&K).

### 📜 Modal Syarat & Ketentuan
- **Baru** `tcModal` — konten S&K (layanan, data profil/sinkronisasi, lisensi,
  penggunaan wajar, perubahan). Tombol **"Saya Setuju & Lanjut"** mengaktifkan checkbox + tombol trial.

### ⚙️
- Nama usaha yang sudah tersimpan otomatis terisi ulang saat gate tampil (mis. user yang masa cobanya habis).

## 2026-08-07 (Onboarding Ringkas + Notifikasi Lengkapi Profil)

### 🔤 Onboarding
- Kini **hanya isi Nama Usaha**; profil lengkap (pemilik, WhatsApp, alamat/wilayah) diisi belakangan di Pengaturan.

### 🔔 Notifikasi lengkapi profil
- **Banner** di halaman beranda muncul bila profil belum lengkap (pemilik / WA / alamat kosong), dengan tombol **"Isi Profil"** → menu Pengaturan.
- Banner otomatis hilang setelah profil lengkap.

### ⚙️ Alur Profil (arsitektur baru)
- Setiap perubahan profil (nama usaha, pemilik, WhatsApp, alamat + wilayah) otomatis **menyinkronkan ulang ke Supabase** (`sync.js`).

## 2026-08-07 (Sinkronisasi Profil Klien → CRM Admin)

### ☁️ Sinkronisasi CRM
- **Baru**: `js/sync.js` — push profil identitas outlet ke Supabase tabel `clients`
  (nama usaha, pemilik, WhatsApp, **wilayah**, device code) via **Anonymous Auth**
  (supabase-js v2; anon auth **diaktifkan** di project).
- **Offline-first**: app tetap jalan tanpa internet; sync dicoba saat online
  (flag lokal `sync` = `none`/`pending`/`synced`).
- **Backfill otomatis** untuk user lama (data cuma lokal) di boot berikutnya.
- `js/supabase-config.js` — config URL + anon key (anon = public, aman); sudah terisi.

### 🗺️ Wilayah Indonesia
- **Baru**: `js/region.js` — region picker Provinsi → Kota/Kab → Kecamatan dari API
  **emsifa** (dengan cache). Masuk di onboarding & form Alamat.
- Setting baru: `provinsiId/provinsi`, `kabkotaId/kabkota`, `kecamatanId/kecamatan`.

### ⚙️ UI
- Kartu **☁️ Sinkronisasi Profil** + tombol **Sinkron Sekarang** di halaman Pengaturan.

## 2026-08 (catatan tanpa nomor rilis — arsip sebelum v87)

### ✨ UI / Navigasi
- **Pengeluaran** dipindahkan ke modul **Laporan** (rincian pengeluaran tampil di ringkasan laporan).
- Menu **Pengaturan** dipindah ke **bottom navigation** agar lebih mudah diakses.

### 📲 PWA / Installability
- **Manifest statis** (`manifest.json`) — browser menolak manifest dari `blob:` URL untuk installability; dijaga sebagai file statis + ikon 192/512 + `<link rel="manifest">` + SW precache.
- Cache Service Worker dibump (cache name `kasir-solo-kaki5-v*`) saat SW diubah.
- `dexie.min.js` diberi pengecualian di root `.gitignore` (`!kaki5/dexie.min.js`) — kalau tidak, file tidak ter-deploy dan app mati (`Dexie is not defined`).

### 🚀 Deploy
- **Deploy utama tidak lagi mengandalkan GitHub Actions** — memakai **Vercel git integration (auto-detect)** — project `kasir-kaki5`, Root Directory `kaki5/`. (Koreksi 2026-09-04: bukan berarti semua workflow dihapus — `.github/workflows/deploy-preview.yml` masih ada dan dipakai untuk preview.)

---

## 2026-08-05 (Onboarding Awal)
- Setup PWA penuh: manifest statis, ikon, service worker, offline-first (Dexie/IndexedDB).
- Sistem lisensi offline (HMAC-SHA256) + onboarding (nama warung, pemilik, WhatsApp, unitId `K5-XXXX`).
- Carousel/banner platform di halaman beranda.
