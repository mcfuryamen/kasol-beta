# AGENTS.md — app masjid (kasol)

## Brand & tema (JANGAN diganti — keputusan user 2026-11-16)
- **Gradasi oranye adalah tema resmi seluruh ekosistem kasol**:
  `--brand-gradient: linear-gradient(135deg,#FCD34D 0%,#F97316 55%,#DC2626 100%)`, `theme-color: #F97316`.
  Dipakai di adm-masjid: `.app-header`, `.btn-primary`, `.tab.active`, `.fab`, `.pay-chip.active`, `.pf-seg button.on`, garis bawah `.nav-item.active`.
- Saat audit kontras/a11y: **jangan mengubah warna gradasi**, DAN **jangan mengubah warna teks di atas gradasi** — putih itu keputusan brand (user, 2026-11-19: *"teks di atas gradasi, kembalikan warna putih, jangan diubah lagi"*). Putih di gradasi ini terukur 1,69–2,05:1 (di bawah ambang WCAG AA 4,5:1) dan itu **diterima sadar** — jangan diusulkan ganti hitam/gelap lagi (hitam pernah dicoba, terukur lolos AA 4,57–4,98:1, tapi ditolak pemilik). Nilainya lewat variabel `--on-brand` (saat ini `#ffffff`) di `adm-masjid/index.html` → semua pemakai (`h1#brandName`, `.brand-sub`, `.btn-primary`, `.tab.active`, `.fab`, `.pay-chip.active`, `.pf-seg button.on`, outline fokus header) ikut putih otomatis. Alpha chip header `.icon-btn`/`.akun-chip` juga **dikembalikan ke nilai asli `.22`/`.28`** (keputusan yang sama, 2026-11-19) — tampilan asli dipertahankan, jangan dinaikkan lagi demi skor kontras.
- **Logo utama Kasir Solo**: `kasirsolo-logo.png` (600×600, root repo) — di adm-masjid tersalin sebagai `adm-masjid/logo.png` (+ `logo-192.png`). Dipakai di footer settings (`.app-footer .logo img`).
- **Logo kubah masjid** (`favicon.svg` / `icon.svg`): tetap dipakai sebagai ikon brand sekunder (header `brand-mark`, lock-card, favicon/PWA, website publik).
- Header admin: `h1#brandName` = **nama masjid dari pengaturan** (`DB.settings.namaMasjid`, default "Masjid") via `updateBrandHeader()`; `div#brandSub` = nama aplikasi `CFG.name` ("Kasir Solo - Masjid").
- Header admin: **tombol akun aktif** `#akunChip` (kanan header) menampilkan **akun yang sedang login** — sejak v1.5.5 **hanya foto profil (bulat)**; tanpa foto → siluet CSS. Status lisensi/kuota hanya ada di modal "Akun Saya" (`Platform.openAkun()`) + halaman Pengaturan. Nama akun diambil dari `user_metadata.nama` server (`Akun.muatProfil()`) lalu disimpan di sesi lokal (`sesi.nama`).

## Foto profil akun (v1.5.5 — lintas app)
- Sumber kebenaran: kolom `global_identities.avatar_url` (server Supabase). Bucket storage `avatars` (public read), path `${auth_uid}/avatar-<timestamp>.jpg`. RPC: `account_update_avatar(p_url)` (validasi prefix URL bucket sendiri) + `account_my_avatar()` (baca) — keduanya hanya untuk role `authenticated`.
- **App mitra** (`mitra/src/pages/akun.astro`, kartu "Data Diri"): pilih/ganti/hapus foto; kompresi di browser (canvas → JPEG 512px q0.82) lalu unggah via storage API, simpan URL lewat RPC `account_update_avatar`. Helper: `mitra/src/lib/account.ts` → `unggahFotoProfil()`, `hapusFotoProfil()`.
- **adm-masjid** (PWA satu file): `Akun.muatProfil()` memanggil RPC `account_my_avatar` (REST) → disimpan di sesi lokal (`sesi.avatar`) → `renderAkunChip()` memasang `<img id="akunAvImg">`. Avatar tidak boleh berisi teks/emoji (Lighthouse `label-content-name-mismatch`) → fallback pakai siluet CSS.
- Baris akun di **Pengaturan** (`#rowAkunLink`, `data-mitra-akun`) membuka app Mitra. URL tunggal: konstanta `MITRA_AKUN_URL` (admin) — domain custom `mitra.kasirsolo.com` belum aktif, sementara pakai `https://mitrabeta.vercel.app/akun`.

## Gate fitur berlisensi (v1.5.6 — keputusan user 2026-11-19)
- `CFG.proFeatures` di adm-masjid = daftar fitur yang TERKUNCI untuk akun tanpa lisensi. Kunci bisa selevel halaman (`jamaah`) atau granular (`laporan.bulanan` — badge 🔒 muncul bila ada kunci apa pun untuk halaman itu, lihat `P.isProAny`; termasuk juga tab dalam halaman Kas via `kas.<tab>`). **Sampel aktif (v1.5.6): `laporan.bulanan`, `laporan.custom`, `laporan.mingguan.nav`, `kas.pinjaman`, `kas.zakat` terkunci** — halaman Laporan tetap bisa dibuka dan mendarat di mode Mingguan (minggu ini), tab Bulanan/Custom (`setLaporanRange`) + geser periode ‹ › (`lapNav`) diblok; halaman Kas tetap bisa dibuka dan mendarat di tab Semua, tab Pinjaman/Zakat (`setKasTab`) diblok + `openZakatMenu` di-wrap. Ganti/tambah sesuai kebutuhan.
- Gate (`P.requireFeature`/`P.isPro`) dipasang di `go(view)` (semua navigasi), `P.guard({feature})` (tombol tambah via `P.wrapGuard`), dan badge 🔒 via `P.renderGateBadges()` pada tab bawah + sheet "Lainnya" (`data-f`).
- Skema harga (lifetime vs **langganan**) tidak mengubah gate: cukup `P.licenseAktif()` — status dari server (RPC `app_my_license` sudah menolak `license_expired`) + cek lokal `license_expires_at` di cache. Langganan = baris `licenses` dengan `expires_at`; perpanjang = update `expires_at`. Tanpa mengubah HUB.
- `CFG.quota <= 0` = tanpa kuota bulanan (mode gate fitur saja); teks status pakai `P.quotaInfo()`. Offline: cache lisensi terakhir dipakai (grace).
- S&K pasal 2 sudah memuat klausul "beberapa fitur lanjutan dapat dikunci untuk versi gratis".

## Arah arsitektur: full online + tetap support offline (keputusan user 2026-11-19)
- Nanti aplikasi masjid diarahkan ke **full online** (data di server), namun **tetap bisa dipakai saat offline** (cache lokal + sinkron saat online — pola yang sudah ada di sesi/lisensi/HUB: grace offline, jangan pernah mencabut sesi/lisensi karena jaringan putus).
- Gate fitur & gerbang login harus tetap jalan saat offline → selalu baca cache lokal lebih dulu.

## Sesi & token: jeda refresh vs HUB (v1.5.5)
- `Akun.boot()` harus **selesai** sebelum `HUB.boot()` (lihat `init()`). Kalau HUB jalan lebih dulu, `app_my_access` masih memakai access token kedaluwarsa → 401 → `Akun.matikanSesi()` → sesi dicabut + gerbang login muncul, padahal refresh token masih valid.
- `refresh()` wajib menyalin field `avatar` (dan `nama`) ke sesi baru — kalau tidak, cache foto profil hilang tiap token di-refresh.
- PostgREST kadang balas **401 "JWT issued at future"** tepat setelah login (selisih beberapa detik jam server antara node auth & node PostgREST). Gejalanya sesaat, sesi tetap sah → pola retry 1× setelah jeda ±1,2 detik dipakai untuk RPC avatar (adm-masjid & mitra). Jangan dianggap sesi rusak.

## Struktur file app admin (P3-1, 20 Nov 2026)
- `adm-masjid/index.html` **tidak lagi** berisi CSS & JS inline. Sekarang: `index.html` (28 KB, markup saja) + `app.css` (58 KB) + `app.js` (334 KB). Tanpa build step — file tetap bisa dibuka langsung & tetap sinkron saat diedit.
- `app.js` = gabungan blok `<script>` lama (urutan sama, skrip klasik **bukan** module → variabel top-level tetap global, `onclick` inline tetap bisa memanggilnya). Kalau menambah `<script>` baru, taruh di `app.js`, jangan inline di HTML.
- Service worker wajib ikut preload file baru: `ASSETS` di `sw.js` harus memuat `app.css` + `app.js`, dan `CACHE_NAME` naik versinya (v1.5.9). Kalau lupa, app offline akan pakai CSS/JS versi lama.
- Pengecekan sintaks: `node --check masjid/adm-masjid/app.js`.

## Aksesibilitas keyboard (P1, audit 20 Nov 2026)
- **Semua elemen interaktif wajib `<button type="button">`**, bukan `<div onclick>`. Pada 20 Nov 2026, 57 elemen (`.tab`, `.stat-card`, `.quick-btn`, `.list-item`, `.setting-item`, `.pay-chip`, `.pf-row`, `.tut-head`, `.dash-pinj`) diubah dari `<div>` ke `<button>`; tinggal 2 `.backdrop` (lapisan klik-tutup) yang tetap `<div>` + `aria-hidden="true"`.
- Reset gaya tombol pakai **`:where(...)`** — spesifisitasnya NOL. Kalau ditulis polos (`button.stat-card`), spesifisitasnya (0,1,1) **mengalahkan** aturan komponen `.stat-card` (0,1,0) → padding kartu hilang & tinggi kartu menyusut (terukur 94,8px → 64,8px). Jangan diubah tanpa mengukur ulang.
- `.tab` punya `role="tab"` + `aria-selected` (disinkronkan otomatis oleh MutationObserver di `app.js`), wadahnya `role="tablist"`.
- Toast (`#toast`) punya `role="status"` + `aria-live="polite"` → pesan "Data tersimpan"/"Penyimpanan penuh" diumumkan ke pembaca layar.
- `.tab`/`.btn-sm`/`.st-more` sengaja **rendah** (36/34/40px) — sudah lolos standar minimum WCAG 2.2 (24px). Jangan dinaikkan tanpa alasan; yang sudah dinaikkan hanya `.akun-chip` (42 → 44px).
- `.modal-head` yang sticky + `margin-top` negatif: pakai `.modal:has(> .modal-head:first-child){padding-top:0}` supaya kepala modal nempel di tepi atas sheet (bukan meleset 16px ke bawah).

## Header keamanan & meta (P2/P3, 20 Nov 2026)
- CSP + `Referrer-Policy` + `Permissions-Policy` ada di `masjid/vercel.json` (untuk seluruh project) dan `masjid/adm-masjid/vercel.json` (project terpisah). CSP masih memakai `'unsafe-inline'` untuk script **karena masih ada ~250 `onclick` inline** — kalau `onclick` dihapus semua, `script-src` bisa jadi `'self'` saja.
- Host yang boleh diakses `connect-src`: `https://hhywrvedlwljawgxzpkq.supabase.co` saja. Tambah host baru → tambah juga di CSP, kalau tidak app gagal diam-diam saat ambil data.
- `web-masjid` **canonical & og:url dibuat runtime** (JS), bukan statis — website ini multi-tenant (satu isi untuk banyak slug). Canonical statis akan menunjuk semua masjid ke satu URL → salah SEO.
- Preload font **sengaja dinonaktifkan** di `web-masjid`: preload justru memperlambat ambil data masjid sehingga CLS naik 0,001 → 0,429 (diuji 20 Nov 2026). Kalau mau aktifkan lagi, wajib cek CLS dengan throttle.

## Sinkron data ke awan (v1.5.7, 20 Nov 2026)
- Server: tabel `masjid_records(site_slug, coll, rec_id, data, deleted, client_mt, server_at, seq)` + `masjid_website_drafts` (draft website, terpisah dari tabel tayang). Keduanya RLS aktif **tanpa policy** + grant hanya `service_role`; akses klien **hanya** lewat RPC.
- RPC: `masjid_sync_push(p_slug, p_ops)` (maks 400 op/permintaan, upsert per record, menang hanya bila `client_mt` lebih besar), `masjid_sync_pull(p_slug, p_since, p_limit)` (kursor = `seq` server, bukan jam), `masjid_sync_colls()` (daftar koleksi yang boleh disinkron), `masjid_my_draft(p_slug)` (draft website untuk owner). Semua `SECURITY DEFINER` + cek peran owner/manajer/kasir; grant `authenticated` + `service_role` saja.
- Klien: modul `Sync` di `adm-masjid/app.js` (cari `const Sync = (() =>`). Satu hook: `saveDB()` memanggil `window.Sync.setelahSimpan()` → diff isi DB vs "bayangan" → masuk antrean `localStorage: ksmasjid_sync_antrean_v1`. Kursor per situs di `ksmasjid_sync_kursor_v1`. Kemajuan naik-perdana di `ksmasjid_sync_basis_v1`.
- Yang TIDAK disinkron (sengaja): `license` (datang dari server per perangkat), `websiteDraft`/`websiteLive` (jalurnya `masjid_website`), `platform.shift` (sesi shift per perangkat). Daftarnya di `SYNC_COLLS`/`SYNC_TUNGGAL`.
- Aturan anti data-hilang: (1) tarikan **tidak menimpa** record yang masih punya antrean lokal; (2) kursor **tidak dimajukan saat mengirim** (beban echo diterima, di-no-op di `terapkan`); (3) penanda "lebih baru" = jam logis (`mtBaru()`/`catatMt()`), `mt` dari masa depan >60 dtk diabaikan.
- Naik-perdana (`naikkanBasis`): data yang sudah ada di perangkat sebelum fitur ini dipasang dinaikkan **sekali**, dicicil 100 record / ~600 KB per permintaan, dengan **`mt=0`** → record yang sudah ada di awan **tidak** ditimpa (versi awan dianggap lebih benar). Jangan ganti ke `mt` asli tanpa memikirkan data perangkat lama yang basi.
- Uji tanpa kredensial: `node masjid/_audit/test-sync-klien.js` (sandbox Node: tiruan localStorage/DOM/HUB, 44 pemeriksaan — antrean, batching, tarik, anti-pantul, naik-perdana, offline, jalur ditolak).
- Uji server: `supabase/_test-masjid-sync.sql` (12 skenario, dijalankan `apply-migration.js --dry-run` = rollback).

## Perbaikan slug situs + pemicu sinkron (v1.5.8, 20 Nov 2026)
- **Bug (ditemukan uji E2E):** `HUB.boot()` hanya memanggil `muatAkses()`, TIDAK pernah `muatSitus()` → `slugAktif()` jatuh ke slug bawaan `"masjid"` → sinkron & pratinjau website mengarah ke situs yang bukan milik akun (status di UI: "Akun ini tidak berhak"). Dampaknya: di perangkat baru, data lokal tidak pernah naik ke awan sampai pengguna membuka halaman Website.
- Perbaikan: `HUB.boot()` sekarang memanggil `muatSitus()`; slug hasil server disimpan ke `DB.settings.pubSlug` **dan** `localStorage: ks_masjid_slug_v1`; `slugAktif()` memakai urutan `_situsAktif` → `DB.settings.pubSlug` → cache localStorage → `"masjid"`. Modul `Sync` memanggil `siapkanSitus()` sebelum kirim/tarik, dan `HUB.situsDimuat()` dipakai untuk mengecek daftar situs sudah dimuat.
- Pemicu sinkron setelah login: `sinkronSetelahSiap()` (boot HUB → satu putaran `Sync.sekarang()`) dipanggil dari `Gerbang.selesaiLogin()` dan dari `init()` setelah `Akun.boot()`. Sebelumnya putaran pertama hanya jalan 3,5 detik setelah halaman dimuat → sering tanpa sesi ("Masuk akun dulu") dan harus menunggu interval 4 menit.
- Uji E2E browser (Chrome DevTools, 20 Nov 2026): login → slug benar & "Tersimpan di awan"; transaksi Rp12.345 masuk awan; mode offline → transaksi Rp54.321 tersimpan lokal + antrean 1 + "Menunggu sinyal"; koneksi hidup → antrean terkirim otomatis; perangkat baru (DB + kursor dihapus) → 2 transaksi ditarik dari awan (saldo Rp66.666).
- Fixture QA terisolasi: `supabase/_qa-masjid-sync-e2e.mjs setup|cleanup|status` (WA 628990020202, PIN 123456, slug `qa-sync-e2e`). **Koreksi (20 Nov 2026):** RPC `account_prepare_identity` / `account_bind_auth_user` **BISA** dipanggil lewat PostgREST dengan key `service_role` — grant tidak menyembunyikan fungsi dari schema cache. `PGRST202` = **nama argumen meleset dari signature** (body `{}` juga memicu), BUKAN "fungsi hilang" atau "grant ditutup". Fixture membuat `global_identities` langsung via REST service_role lalu menautkan `auth_user_id` — murni demi determinisme & kemudahan pembersihan, bukan karena RPC tidak bisa dipanggil.

## Referensi skema Supabase kasol (cek nama tabel yang benar, 20 Nov 2026)
Salah nama tabel = hasil audit yang salah. Yang benar:

| Kebutuhan | TABEL yang benar (bukan) |
|---|---|
| Membership per aplikasi | **`app_memberships`** — kolom `global_identity_id`, `app_key`, `role`, `status`, `outlet_ref`. **Bukan** `outlet_memberships` (tabel lama, tidak dipakai app; `user_id` di sana = auth uid) |
| Lisensi | `licenses` — kolom `global_identity_id` (bukan `user_id`), `app_type`, `outlet_ref`, `status` |
| Identitas global | `global_identities` — `id`, `phone_e164`, `display_name`, `status`, `auth_user_id` |
| Kode referral | **`license_codes`** — kolom `status` ('aktif' / 'dibatalkan'). **Bukan** `referral_partners` (itu pasangan referral, 8 baris, tidak pernah disentuh P3) |
| Dompet referral | `referral_wallets` |
| Arsip P3 | `p3_arsip_referral(kategori, ref_id, payload, alasan, dibuat_pada)` — `kategori`: `kode_yatim`, `dompet_kosong` |
| Sinkron masjid | `masjid_records(site_slug, coll, rec_id, data, deleted, client_mt, server_at, seq)` |
| Website tayang (publik) | `masjid_website` — satu-satunya tabel yang **wajib** terbuka untuk anon (policy `publik boleh baca website`, `using true`): profil masjid + laporan keuangan + kegiatan |
| Website draft | `masjid_website_drafts(slug, data, updated_at)` — RLS aktif tanpa policy, hanya lewat RPC `masjid_my_draft` |

Cek cepat live (read-only):
```
node supabase/audit-query.js --ref=hhywrvedlwljawgxzpkq --sql="select ... from <tabel> ..."
```
`audit-query.js` menolak kata kerja mutasi. Compound query hanya mengembalikan hasil statement terakhir → pisahkan query.

## Catatan teknis
- Dev server lokal: `node _dev-server.mjs 8095` secara detached (jangan `python -m http.server` — mati setelah 1 jam & lambat). URL: `/web-masjid/`, `/adm-masjid/` (alias `/adm/`), `/web/`.
- **Menu ☰ "Lainnya" wajib berupa `<button>`**, bukan `<div onclick>` (audit a11y 2026-11-19: `<div>` tidak bisa difokus keyboard). `openMoreSheet()` memindahkan fokus ke item pertama, Tab berputar di dalam sheet (`moreSheetFocusables()`), Escape menutup & mengembalikan fokus ke tombol ☰. Isi `<button>` harus konten phrasing → ikon `.ic` pakai `<span>`, bukan `<div>`. Pola sama berlaku untuk menu/aksi sejenis yang dibuat kemudian.
- Aset web-masjid pakai prefix absolut `/assets/...` (root project Vercel = `web-masjid/`).
- Jangan commit/push tanpa perintah eksplisit user.

## Inventaris: arti angka "dimiliki" vs "ada di tempat" (jangan "diperbaiki")
- Data aset menyimpan **jumlah yang dimiliki**: `jumlah` (total) + `kondisiRinci` `{baik, ringan, berat}`. Ini yang diisi/diubah di form.
- Yang **ditampilkan di daftar aset** adalah **sisa yang ada di tempat** = dimiliki − barang yang sedang keluar (`pinjamAktif`, status `dipinjam`). Contoh: 15 karpet, 5 dilaundry → daftar "10 dari 15".
- Pengurangan diambil dari kondisi terbaik dulu (`baik` → `ringan` → `berat`) di `rincianTersedia()`; semua keluar → "semua sedang keluar".
- Jadi selisih angka form vs daftar itu **disengaja**, bukan bug. Stok barang keluar (`tersediaAset`, pagar "jumlah tidak boleh kurang dari yang sedang keluar") juga memakai arti yang sama.

## Pinjaman uang kas: satu transaksi, dua tempat (jangan dobel)
- Data pinjaman di `DB.pinjamKas` (`jumlah`, `bayar[]`, `tglRencana`). Status & sisa selalu **dihitung** (`sisaPinjamKas`), tidak disimpan.
- Uangnya tetap **wajib** tercatat di `DB.kas` sebagai pengeluaran kategori `Pinjam Kas`, dan tiap cicilan sebagai pemasukan `Bayar Pinjaman` — dihubungkan lewat field `refPinjam` (+ `refBayar`) di record kas, bukan id yang disimpan di pinjaman. Jadi saldo, opname, dan laporan ikut benar tanpa pencatatan ganda.
- Kategori `Pinjam Kas`/`Bayar Pinjaman` **tidak** dimasukkan ke pilihan form transaksi biasa (mencegah dobel); `openTransaksiDetail` menyembunyikan tombol hapus untuk record ber-`refPinjam` dan mengarahkan ke tab Pinjaman.
- Hapus pinjaman = hapus semua `DB.kas` dengan `refPinjam` itu. Ubah jumlah dikunci setelah ada pembayaran.

## Zakat: fitrah terpisah dari mal (v1.5.3, keputusan user 2026-11-17)
- **Zakat fitrah TIDAK pernah menyentuh `DB.kas`** — pengumpulan maupun penyaluran fitrah dicatat terpisah, jadi saldo kas, opname, dan laporan keuangan tidak ikut berubah (P2: "uang fitrah keluar total dari kas").
- Pengumpulan fitrah → `DB.fitrah` (`{id,tipe:'kumpul',musim,nama,jiwa,bentuk,nilai,tanggal,keterangan}`), `nilai` = per jiwa (Rp50.000 atau 2,5 kg — SK BAZNAS 14/2026, boleh diedit user).
- Penyaluran fitrah → `DB.salurZakat` dengan `jenisZakat:'fitrah'` (data lama tanpa field ini = mal). `musim` = tahun hijriah (`musimHijri()`, mis. "1447 H") untuk cocok dengan pengumpulan.
- Modul fitrah TIDAK memakai `DB.kas`/`refSalur`; **`sisaZakatUang()` dan `zakatBarangPerSatuan()` wajib mengabaikan record `jenisZakat:'fitrah'`** (kalau tidak, sisa zakat barang jadi negatif).
- Asnaf penerima fitrah **hanya Fakir & Miskin**; jumlah salur tidak boleh melebihi sisa fitrah musim tersebut.
- Zakat mal (bukan fitrah): sub-jenis 7 opsi + panduan nisab/kadar (`PANDUAN_ZAKAT`); "Zakat Fitrah" **dihapus** dari pilihan form kas. Saluran mal uang tetap membuat record kas `Penyaluran Zakat` (anti-dobel).
