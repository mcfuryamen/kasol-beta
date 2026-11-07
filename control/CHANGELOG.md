# Changelog — Admin Marketing KASIRSOLO

Semua perubahan dicatat per tanggal, versi terbaru di atas.


## [1.12.0] - 2026-10-24 (✨ Variasikan materi pakai AI — server-side, tanpa runner)

> Materi 14 hari itu **kadaluarsa**. Sekarang tiap materi bisa divariasikan AI
> dari dalam Control: klik "✨ Variasikan", pilih gaya/level, AI nulis 3–8
> versi baru, lo pilih mana yang dipake, masuk ke bank materi.
>
> Jalur ini **server-side** (panggil provider langsung dari API Control) —
> bukan lewat agent runner lokal, jadi **jalan terus walau runner mati**.

### Fitur
- **Tombol "✨ Variasikan"** di tiap kartu materi (tab 📚 Bank Materi).
  Sheet-nya:
  - **Jenis hasil** — Caption / Komenter / Brief Video (default ikut kategori materi).
  - **Gaya** (untuk caption) — edukasi · promo · interaktif · build-in-public · cerita.
  - **Level** (untuk komentar, aturan kit 07) — A umpan · B soft · C pitch · D DM.
  - **Platform** & **jumlah** (3/5/8).
  - Hasil tampil sebagai kartu checkbox → **💾 Simpan ke bank** · **📋 Salin** · **📅 Jadwalkan**.
- **Kategori baru di bank**: `caption_ai` · `komentar_ai` · `brief_ai` (badge hijau),
  plus filter chips baru "✨ Varian AI / Komentar AI / Brief AI".
  Judul hasil menyimpan asal materinya (mis. "S1 — Demo input 3 barang · Offline & Tenang"),
  jadi jelas varian dari materi mana.
- **Aturan level dari kit 07 ditegakkan di prompt**: level A tidak boleh menyebut
  aplikasi/link sama sekali; level B boleh menyebut app tapi TANPA link; level C
  boleh link; level D format DM hangat. AI juga dilarang mengarang diskon/garansi
  di luar fakta produk.

### Server
- **`api/_ai-core.js` (baru)** — pemanggil provider AI (OpenAI-compatible):
  baca `settings.ai_providers`, pilih provider aktif + model, POST
  `/chat/completions`, parse JSON **dan** SSE (beberapa provider selalu balas
  streaming walau `stream:false`), timeout 45 detik.
- **`api/_ai-variasi-core.js` (baru)** — inti logika variasi: ambil materi sumber
  → susun prompt (fakta produk + aturan gaya + level) → panggil AI → parse & normalisasi.
- **`api/ai-variasi.js` (baru)** — endpoint Vercel (gate admin, `maxDuration 60`).
- **Mirror dev** route `/api/ai-variasi` di `control/server.js` — sumber tunggal
  (`_ai-variasi-core.js`), sama seperti pola `api/_social-fb-core.js`.

### Catatan penting
- **Provider AI aktif = openrouter** (`nvidia/nemotron-3-ultra-550b-a55b:free`),
  baseUrl hosted → **bisa dipanggil dari Vercel** (berbeda dari runner lokal
  yang hanya jalan di PC). Kalau nanti provider-nya diganti ke yang lokal
  (127.0.0.1), fitur ini **hanya jalan di dev**, bukan produksi.
- `control/api/_ai-core.js` **harus self-contained** — deployment Vercel untuk
  Control punya root = folder `control/`, jadi file di luar tidak ikut ter-deploy
  (import ke root `agent/callAI.js` akan 404 di produksi).
- Latensi provider free: **10–30 detik** per permintaan. Sheet menampilkan
  statusnya, jadi user nggak kira nge-hang.

### Bug diperbaiki
- **Filter kategori di tab Bank Materi tidak pernah berfungsi** — array chip
  pakai properti `k:` tapi template membaca `c.key` → `data-mat="undefined"`,
  jadi klik chip selalu menyaring ke "semua" dan tidak ada chip yang aktif.
- **Stat "slot terisi" salah hitung** (sudah tercatat di v1.11.0).


## [1.11.0] - 2026-10-24 (Kalender Konten — opsi posting MANUAL bulanan, tanpa token)

> Jalur **manual** untuk yang belum bisa pegang token Meta App. Semua yang
> dibutuhkan: atur rencana posting per tanggal → salin caption → tayangkan
> sendiri di FB/IG/Threads/TikTok/WA → tandai "sudah tayang".
> **Nol kredensial, nol API Meta.**

### Fitur
- **Layar baru 📅 Kalender** (nav sidebar + menu "Lainnya" di mobile), 2 tab:
  - **📅 Jadwal Bulanan** — grid kalender (Sen–Min). Tiap hari bisa berisi
    beberapa rencana; chip per rencana menampilkan jam + platform. Statistik:
    jumlah rencana, sudah tayang, menunggu, slot terisi, sisa materi.
    - Navigasi bulan (◀ ▶ + "Hari ini"), tombol **＋ Tambah rencana**.
    - **⚡ Isi bulan ini** — tebar materi caption ke slot kosong, dengan pilihan
      1/2/3 posting per hari. Materi dipakai **bergilir** (rotasi acak per bulan)
      supaya varies, bukan posting 3× konten yang sama. Slot yang sudah terisi
      tidak pernah ditimpa.
  - **📚 Bank Materi** — 141 materi, filter per kategori + pencarian.
    Tombol **📋 Salin**, **📅 Jadwalkan** (buka sheet rencana dengan materi
    terisi), **🎬 Lihat brief** (untuk brief video).
- **Sheet Rencana** — tanggal, slot jam (09:00 / 12:30 / 19:00), platform/kanal
  (FB, IG, Threads, TikTok, YouTube Shorts, WA Status, Marketplace, Grup FB),
  pilih materi dari bank (caption ikut terisi), edit caption, opsional link
  posting, tombol **✅ Sudah tayang**, **📋 Salin caption**, **🗑️ Hapus**.
- **Status baru `planned`** di `social_posts` = "rencana tanggal, menunggu owner
  tayangkan sendiri". **Rencana manual tidak pernah keposting otomatis** —
  `post-due` cuma mengambil status `approved`.

### Bank Materi (tabel baru `content_materials`)
- Di-seed dari folder `marketing-kit/`:
  - 42 caption (agent/content.json — 14 hari × 3 slot)
  - 16 promo post (doc 07 section E)
  - 14 brief video siap rekam (doc 02 — Hook/Aksi/VO/CTA/Durasi)
  - 58 variasi komentar + DM (doc 07 section A–D)
  - 11 template balasan (doc 06 + doc 07 section F)
- Total **141 materi**, tag otomatis (edukasi / promo / interaktif / build-in-public /
  level-a..d), plus penanda "dipakai" biar materi yang sering kepakai gampang dicari.

### Tooling
- **`scripts/seed-marketing-kit.mjs` (baru)** — seed bank materi dari marketing-kit.
  Idempoten (`source_key` unik) → `npm run seed:kit` aman dijalankan berulang.
  `--dry-run` untuk pratinjau.
- **`scripts/check-rest-parity.mjs` (baru)** — `npm run check:parity`. Guard baru:
  whitelist tabel `/api/rest` ada di DUA file (`api/rest.js` untuk Vercel,
  `server.js` untuk dev). Lupa update salah satu → dev 200 tapi produksi 403.
  Ini persis kejadian saat modul Kalender pertama dibuat, jadi sekarang dicek
  otomatis (tabel yang dipakai modul vs whitelist produksi).

### Bug diperbaiki
- **Whitelist `/api/rest` di `server.js` (dev) lupa nambah `content_materials`**
  → modul Kalender dapat 403 `forbidden_table` di dev, padahal lolos di produksi.
  Sudah dibenerin + ditambah guard `check:parity`.
- **Stat "slot terisi" salah hitung** — dihitung dari jumlah hari × jumlah slot
  (ngakuin semua slot kepakai walau cuma 1 yang dijadwalin). Sekarang dihitung
  dari pasangan (tanggal, jam) yang benar-benar ada.

### Migrasi
- `supabase/migrations/20261024_content_materials.sql` — tabel `content_materials`
  (+index, RLS, grant), kolom `social_posts.material_id`, status `'planned'`
  masuk CHECK constraint, index `idx_social_posts_scheduled_at`.
  **Sudah diterapkan** di project `hhywrvedlwljawgxzpkq` + seed 141 materi.


## [1.10.0] - 2026-10-23 (Opsi OAuth: Facebook Page + Instagram Business + Threads)

> Jalur koneksi **sekarang tanpa nempel token manual**. Control yang nge-handle
> OAuth-nya: user klik "🔗 Hubungkan", login di dialog Meta, centang Page/IG,
> selesai — token langsung tersimpan server-side. Posting jalan ke 3 platform.
>
> Env baru (server-side, JANGAN dimasukin browser): `FB_APP_ID`, `FB_APP_SECRET`,
> `CONTROL_PUBLIC_URL`. Tanpa itu, jalur manual token tetap 100% jalan.

### Fitur
- **Opsi OAuth di ⚙️ Koneksi** (3 platform, satu panel status):
  - **Facebook Page** — Facebook Login for Business → token Page **tanpa kedaluwarsa**.
  - **Instagram Business** — IG yang ter-link ke Page, ikut didapat di OAuth yang sama.
  - **Threads** — API Threads (host & OAuth terpisah: `graph.threads.net`).
  - Panel menampilkan status per platform, tombol **🔗 Hubungkan** / **✂️ Putuskan**,
    dan **redirect URI** yang harus didaftarkan di app Meta.
- **Publish multi-platform** — `api/_social-fb-core.js` sekarang pakai `row.platform`:
  - `facebook` → `/feed` (teks) atau `/photos` (gambar).
  - `threads` → 2 langkah (bikin container, lalu publish) di `graph.threads.net/v1.0`.
  - `instagram` → container + `media_publish`; **wajib `media_url`** (IG API tidak bisa post teks doang).
- **Editor post** — pilihan Platform sekarang Facebook / Instagram / Threads.
  Platform yang belum terhubung otomatis disabled, ada hint per platform
  (IG butuh gambar, Threads belum bisa jadwal-otomatis), dan tombol
  **🗓️ Jadwalkan di Meta** nonaktif di luar Facebook.

### Keamanan
- Callback OAuth **tidak** digate session (request-nya datang dari redirect Meta).
  Keamanannya dari parameter `state`: acak, disimpan di `settings.oauth_states`,
  **sekali pakai**, TTL 10 menit — dan dibakar di semua jalur, termasuk saat
  user menolak izin.
- Token hasil OAuth **tidak pernah** dikembalikan ke browser. Endpoint `status`
  cuma balas info non-rahasia (nama Page, username IG/Threads, masa berlaku token).
- `FB_APP_SECRET` hanya dipakai di server untuk tukar `code` → token.
  `control/js/env-loader.js` tidak pernah menyentuhnya.

### Tooling
- `api/_social-oauth-core.js` (baru) — sumber tunggal logika OAuth, dipakai
  `api/social-oauth.js` (Vercel) **dan** `control/server.js` (dev).
- `control/server.js` sekarang ikut baca `kasol/.secure.env` (format `export KEY=…`)
  → `FB_APP_ID`/`FB_APP_SECRET` cukup diisi di **satu** tempat, tidak diduplikasi.
- Graph API dinaikkan **v21.0 → v23.0** (Meta retiring versi lama; `activate.mjs`
  di marketing-kit sudah v23.0) — sekarang seragam.
- `control/.env.example` didokumentasikan untuk 3 env baru.

### Catatan
- OAuth **wajib** punya `FB_APP_ID` (client_id) — itu harga masuknya jalur ini.
  Tapi posting manual tetap butuh CUMA `page_id` + `page_token`, jadi Meta App
  tetap bukan syarat untuk pemakaian Control.
- Jadwal otomatis lewat Meta (`scheduled_publish_time`) **hanya** untuk Facebook.
  Instagram & Threads: posting normal aja, jadwalnya di aplikasi masing-masing.
- Instagram butuh **URL gambar yang bisa diakses publik** — konten teks 42 hari
  dari `marketing-kit` tidak bisa langsung dipakai ke IG.


## [1.9.0] - 2026-10-23 (Sosmed: mode jadwal-Meta / Business Suite + panduan token)

> Pivot jalur token FB: Meta App (**FB_APP_ID** / **FB_APP_SECRET**) ternyata **tidak
> dibutuhkan Control Center** — yang dibutuhkan cuma `page_id` + `page_token`.
> Control juga gains mode "tayang sendiri": post diserahkan ke scheduler Meta
> (`published=false` + `scheduled_publish_time`) → PC boleh mati, dan postnya
> kelihatan di kalender Meta Business Suite.

### Fitur
- **Mode jadwal-Meta (baru)** — `api/_social-fb-core.js` action baru:
  - `schedule-remote` — serahkan 1 post ke scheduler Meta (min 15 menit, maks 75 hari).
  - `schedule-remote-batch` — sekaligus banyak post (untuk "isi 14 hari ke Business Suite 1x").
  - `sync-remote` — cek mana yang sudah tayang (post yang sudah live muncul di feed Page).
  - Status row `social_posts` jadi `'terjadwal'` → **tidak boleh** di-`post-due` yang menepuk
    (filter `remote_id=is.null`), jadi tidak ada post dobel.
  - Menjadwalkan ulang post yang sudah terjadwal = PATCH waktu ke post yang sama, bukan bikin baru.
- **UI Sosmed** — tombol `🗓️ Jadwalkan di Meta` (per post), `🗓️ Jadwalkan ke Meta` (batch
  semua post "Dijadwalkan"), `🔄 Sinkronkan`; chip baru **Menunggu Meta**; badge biru.
- **Panduan Koneksi ditulis ulang** jadi 3 jalur yang bisa dilipat:
  🅰️ tanpa Meta App (±5 menit, Explorer → Access Token Debugger → `/me/accounts`),
  🅱️ nol token (Meta Business Suite), 🅲️ Meta App (hanya kalau mau auto-reply komentar).
  Jalur 🅰️ jadi default — **App Review & Business Verification tidak diperlukan**.

### Tooling
- **`scripts/fb-token-check.mjs` (baru)** — validator token read-only:
  valid? kedaluwarsa kapan? izin apa aja? `tasks` Page oke? `node control/scripts/fb-token-check.mjs --dari-db`.
  Token **tidak pernah dicetak utuh** (6 depan + 4 belakang) dan tidak pernah dikirim ke mana pun.

### Bug diperbaiki
- **`social_posts` tidak punya trigger `updated_at`** — kolomnya selalu tertinggal dari
  default `now()`, padahal baris di-PATCH berkali-kali (draft→approved→terjadwal→posted).
  Trigger `trg_social_posts_touch` ditambahkan (fungsi `touch_updated_at()`).
- **Nomor langkah hilang di panduan Koneksi** — reset global `ul,ol{list-style:none}`
  mematikan `<ol>`; kini di-scope balik (`list-style:decimal`) di `.social-guide`.
- **`post-due` bisa menepuk post yang sudah dijadwalkan di Meta** — kini dikecualikan
  lewat `remote_id=is.null`, dan `post` manual menolak dengan `sudah_dijadwalkan_di_meta`.

### Migrasi
- `supabase/migrations/20261023_social_posts_status_terjadwal.sql` — CHECK constraint
  `social_posts_status_check` diperluas dengan `'terjadwal'`, index
  `idx_social_posts_status_scheduled`, trigger `updated_at`. **Sudah diterapkan** di project
  `hhywrvedlwljawgxzpkq`.


## [1.8.1] - 2026-10-20 (QA live browser putaran 2 — HUB + tab Klien)

> Audit lanjutan live browser di halaman Klien Control Center (desktop + mobile).
> Verifikasi ulang: rekomputasi grouping dari data DB mentah dibandingkan langsung
> dengan yang dirender DOM — 16 akun / 23 baris / 4 lisensi, 0 selisih.

### Bug diperbaiki
- **Import modul terpecah (`?v=`)** — `dashboard.js` mengimpor `clients.js?v=20260915a`,
  `app.js` mengimpor `clients.js?v=20261001c` → dua instance modul berbeda → analitik
  Dashboard selalu "Belum ada data klien". Semua `?v=` pada import modul dicabut
  (cache busting ditangani `Cache-Control: no-store` + service worker network-first).
  Guard baru: `scripts/check-module-imports.mjs` + npm script `check:imports`.
- **HUB gagal load harus terlihat** — state `hubLoadError` + banner "Data lisensi & akun
  tidak termuat". Kolom Lisensi jadi "— gagal dimuat" (bukan "Belum ada lisensi" yang
  bisa membuat admin menerbitkan lisensi dobel) dan tombol "Buat Akun Hub" dihide.
- **Nama akun tidak deterministik** — sebelumnya ambil client pertama (ikut urutan
  `last_seen`) sehingga nama meloncat tiap ada perangkat baru. Urutan sekarang:
  pemilik lisensi aktif → nama usaha (urut `unit_id`) → nama pemilik → WA → "Tanpa nama".
- **Kolom Lisensi & Perangkat** — Lisensi: jumlah lisensi aktif + status akun Hub +
  jatah "x/y dev"; Perangkat: jumlah device UNIK (sebelumnya jumlah baris cloud).
- **Lisensi terhitung dobel** — lisensi yang sudah diklaim ke akun A (GID) tapi baris
  `clients`-nya nempel ke akun B → nongol di dua akun. GID sekarang jadi kepemilikan
  mutlak: lisensi dilepas dari grup lain.
- **Lisensi lama menimpa yang baru** — `licByClient`/`licByOutlet` memakai `Map.set`
  dengan daftar terurut `created_at DESC` → lisensi TERLAMA yang menang. Semua lisensi
  kini dikumpulkan per baris/outlet.
- **Kuota dihitung dari lisensi non-aktif** — perangkat terpakai & jatah kini hanya
  lisensi berstatus `active` (sebelumnya lisensi lama ikut menambah kuota).
- **Kartu akun dobel di desktop** — `#accountsCardList` / `#clientsCardList` tidak
  disembunyikan di ≥1025px → 16 kartu muncul DI BAWAH tabel yang sama. Tinggi halaman
  2062px → 1052px.
- **Baris "—" identik di mode Perangkat** — 5 baris rosok tanpa profil tampil "— —".
  Nama baris kini device code, sub-teks `unit_id`.
- **Baris device duplikat identik** — device code sama bisa punya 2 baris cloud.
  Kolom Aplikasi menampilkan `unit_id` (unik per baris) + badge "⚠ N baris".
- **Judul bagian ambigu** — "Perangkat & Outlet (7)" vs kolom Perangkat 6 →
  "Perangkat & Outlet (7 baris · 6 perangkat)".
- **Fokus hilang saat flip page** — buka/tutup halaman detail sekarang memindahkan fokus
  ke judul dan mengembalikannya ke pemicu (termasuk saat daftar me-render ulang).
- **Label badge tidak konsisten** — daftar "Siap diklaim" vs detail "Belum ada akun Hub"
  → keduanya "Belum diklaim".
- **Kode mati** — `nama_warung` (sudah di-drop dari DB) dibersihkan dari seluruh
  `clients.js`; `c.serial` → `c.license_serial` (pencarian by serial sebelumnya tidak
  pernah jalan); debug `console.log` blok Draft Pesan dibuang.

### Yang diverifikasi (tidak berubah)
- Pengelompokan WA-primary: rekomputasi independen dari data mentah = identik dengan UI
  (16 akun, 4 lisensi ter-cover penuh, 0 anomali).
- Jalur degradasi HUB: banner tampil, semua lisensi "— gagal dimuat", tombol klaim hilang,
  banner hilang lagi setelah data termuat.
- Race: toggle mode ×8, pencarian bertumpuk, chip filter bertumpuk → state akhir konsisten.
- Keyboard/a11y: Escape menutup detail (→ kembali ke akun → kembali ke daftar), Enter/Space
  pada baris perangkat, fokus masuk & kembali.
- Proxy: 403 untuk tabel/RPC di luar whitelist (`profiles`, `auth.users`, `pgexec`), whitelist
  `api/rest.js` (Vercel) ≡ `server.js` (dev).
- Regresi lintas modul: 8 screen render bersih, console tanpa error/warning.

## [1.8.0] - 2026-10-20 (HUB — Tab Klien dikelompokkan per akun)

> Tab Klien kini punya dua tampilan: **👤 Per Akun** (default) dan **📱 Perangkat** (baris lama).
> Satu baris di tampilan Akun = satu **pemilik/akun**, bukan satu perangkat — jadi admin
> langsung bisa lihat "WA ini punya 3 app" (dasar untuk bundle/upsell).
> Desain & keputusan: `docs/HUB-DESIGN-DECISIONS.md`.

### Tampilan Per Akun (fitur baru)
- **Pengelompokan akun**: WA dinormalisasi (`normalizePhone`: 08xx → 62xx) jadi
  `082325103336` dan `6282325103336` dianggap orang yang sama. 23 baris perangkat →
  **16 akun**. GID hanya menempel sebagai identitas akun (bukan pemisah grup), jadi
  akun tidak terpecah saat lisensinya diklaim.
- **Kolom tabel**: Akun (nama + WA + jumlah perangkat) · Aplikasi (chip per app) ·
  Lisensi (jumlah aktif + badge "🔑 Akun Hub"/"Siap diklaim") · Perangkat (n/ jatah) ·
  Status (agregat pipeline) · Aksi.
- **Chip filter** ikut berubah: di mode Akun angkanya jumlah akun, di mode Perangkat
  jumlah baris.
- **Halaman detail akun**: info akun (WA, Global ID), daftar lisensi per aplikasi
  (status, paket perangkat, perangkat terdaftar + label, transaksi terpakai), dan
  daftar perangkat/outlet yang bisa dibuka ke detail klien biasa.
- **Aksi admin**:
  - `🔑 Buat Akun Hub` → membuat `global_identities` + klaim lisensi via RPC
    `license_claim_identity` (dengan verifikasi profil: nama usaha / WA harus cocok).
    Idempoten (nomor yang sudah punya akun dipakai ulang) dan memverifikasi ulang
    kalau proxy balas error padahal query-nya sudah jadi.
  - `→ Multi perangkat` / `→ 1 perangkat` → ubah `licenses.plan` + `max_devices`
    (lever upsell per aplikasi).
- **Navigasi**: detail perangkat yang dibuka dari halaman akun → tombol "Kembali"
  kembali ke akun, bukan ke daftar.

### Backend
- `api/rest.js` + `server.js` (dev): whitelist tabel `global_identities`, `licenses`,
  `license_devices`, `app_memberships` + jalur RPC (`/rest/v1/rpc/*`) untuk
  `license_claim_identity` dan `license_activate_device`. **Parity wajib** antara
  `api/rest.js` (Vercel) dan `server.js` (dev lokal) — kalau salah satu lupa,
  dev lolos tapi production 403.
- Data HUB dimuat terpisah dari `clients`; kalau gagal, tab Klien tetap jalan normal.

### Perbaikan hasil QA live browser (2026-10-20)
- **Layout mobile**: `.oc-toolbar` default-nya `flex-wrap:nowrap` → toggle HUB membuat
  kolom search terjepit jadi **48px** (hampir tak terlihat). Toolbar Klien sekarang
  wrap (scoped ke `#clientsList`, modul lain tidak ikut berubah): search + select di
  baris 1, toggle di baris 2 selebar layar. Tombol toggle juga tidak lagi wrap teks
  ("Per / Akun" → 1 baris).
- **Baris "Tanpa nama" identik**: 5 akun tanpa nama & tanpa WA tampil sama persis
  → sub-teksnya kini memakai device code (`tanpa WA · 01NL-DCWV`) supaya bisa dibedakan.
- **Sub-teks mobile terpotong ellipsis** (9/16 kartu, app pertama jadi "Kasir …"):
  sub-teks versi mobile sekarang ringkas jadi `WA · aplikasi` ("Kasir Rosok +1" kalau
  multi-aplikasi). Desktop tetap `WA · N perangkat` (ada kolom Perangkat terpisah).
- Header CHANGELOG yang sempat mojibake (`â€”`) dirapikan jadi em-dash.

## [1.7.0] - 2026-08-29 (Kuota Transaksi + Migrasi Nama Usaha)

### Kuota Transaksi (fitur baru kaki5 v116)
- **Katalog produk**: field `tx_quota` (integer) — kuota transaksi gratis per bulan untuk tier gratis.
  - Badge di kartu: "🎁 Kuota gratis: N transaksi/bulan"
  - Form sheet: input number, step 10, placeholder "mis. 100"
- **Klien/CRM**: tampilan kuota transaksi per device:
  - Badge "Kuota: N/M" dengan warna hijau/merah
  - Tombol adjust: −10, +10, +50 (PATCH `clients.tx_adjust`)
  - Tombol ↺ Reset Pakai (PATCH `tx_used: 0, tx_month: null`)

### Migrasi Nama Usaha
- Kolom `nama_warung` di `clients` dimigrasi ke `nama_usaha`.

## [1.6.2] - (Deploy Preview FIX)

> Menghentikan kegagalan build preview Vercel ketika env `SUPABASE_*` Preview kosong (opini #2 = samakan pola kaki5).

### 🚀 Deploy
- **`buildCommand` dihapus** dari `vercel.json` (kini static deploy, seperti kaki5) → preview tidak lagi menjalankan fail-closed `build-env-loader.mjs` yang `exit 1` saat `SUPABASE_URL` kosong.
- `js/env-loader.js` diubah jadi **STATIS & di-commit** (dihapus dari `.gitignore`), hanya memuat var publik `SUPABASE_URL` + `SUPABASE_ANON_KEY`. Service key & ADMIN_API_KEY tetap server-side `api/*`.
- Dokumentasi `docs/07`, `docs/08`, `CHANGELOG` diperbarui agar tidak lagi menyebut build-env-loader sebagai build step.

## [1.6.1] - (2026-08-17: Perbaikan Audit P1)

> Audit menyeluruh aplikasi admin → perbaikan bug fungsional & pembersihan kode mati.

### 📊 Dashboard
- **Fixed:** kartu "Potensial Revenue" selalu Rp0 — kini dihitung langsung dari data
  klien + harga katalog (`dashboard.js`), sama dengan hitungan halaman Klien.

### 🗂️ Klien / Kanban
- **Fixed:** render dobel saat pindah view Klien (panggilan `switchClientView` ganda
  dari dua jalur) — kini satu jalur + guard same-view.
- Nomor WhatsApp tampil konsisten format `62xxxx` di kartu & detail.
- Kartu kanban dirampingkan: badge sumber (`kb-src`, mis. "APP-KAKI5") dan pil
  status di kepala kartu (`kb-status`) dihapus — info status sudah ada di baris
  konteks & tab per status.
- **Layout baru:** tombol aksi masuk ke dalam kepala kartu (`.kb-head`) via
  kontainer `.kb-head-btn` dengan `margin-left: auto` agar selalu di kanan.
- **Layout revisi:** konteks status masuk ke dalam kepala kartu (`.kb-head`) —
  tombol aksi tetap di luar, baris terpisah di bawah kepala.
- **Perbaikan:** tombol aksi duplikat di dalam akordeon detail (`kb-cta-open`)
  dihapus — hanya tersisa satu tombol per kartu, di kepala.
- **Layout flat:** detail klien tidak lagi pakai sub-akordeon. Grid 3 kolom atas
  (Pemilik · Kontak · Lokasi) langsung terlihat, baris info vertikal ke bawah,
  lalu Generate/Verifikasi/Kelola Lisensi. Sub-akordeon `kb-manage` dan judul
  "📋 Data Klien" dihapus.

### 🧹 Kode mati dibuang
- `js/supabase-client.js` (tidak dipakai modul manapun) dihapus.
- `js/auth.js` dirampingkan: kode login mati + password hardcoded dihapus (login tetap
  dinonaktifkan — upgrade ke Supabase Auth/JWT = backlog).
- Blok `loadingOverlay` tanpa CSS/JS di `index.html` dihapus (teks "Memproses..."
  nyasar), selector `addAppBtn` mati di `catalog.js` dihapus.

### 🔁 Konsistensi
- Format tanggal & label/ikon status kini satu sumber: `utils.js` (`formatDate`) dan
  `PIPELINE_STAGES`/`stageMeta` dari `clients.js` — duplikasi di `dashboard.js` dihapus.

### 📱 PWA
- `sw.js` sekarang **terdaftar** dari `app.js` + strategi **network-first** untuk semua
  aset (sebelumnya cache-first — rawan menampilkan versi/`env-loader.js` lama).
  Cache bump `kasir-admin-v23`.

### 🧮 Pengaturan
- Nomor WhatsApp di Info Usaha dinormalisasi ke `62xxxx` saat disimpan.


## [1.6.1] - (2026-08-17: Perbaikan Audit P1)

### 📊 Dashboard
- **Fixed:** kartu "Potensial Revenue" selalu Rp0 — kini dihitung langsung dari data klien + harga katalog.
- **Layout flat detail klien:** grid 3 kolom atas (Pemilik · Kontak · Lokasi) dengan judul di atas isi (vertikal), baris info ke bawah, sub-akordeon dihapus.

### 💰 Harga Coret
- Kolom baru `price_before_label` di tabel `products` (migrasi `supabase/migration-add-price-before-to-products.sql`, SUDAH diterapkan).
- Form katalog admin: input "Harga Coret" opsional — hanya disimpan bila lebih besar dari harga jual.
- Aplikasi kaki5 menampilkan harga coret (strikethrough) di samping harga lisensi.

## [1.6.0] - (2026-08-13: Harga Pusat di products + Signed URL Bukti)

> Suites audit Kaki5 → sinkronisasi arsitektur harga + perbaikan bukti bayar.

### 💰 Arsitektur Harga Disentralisasi
- **`clients.harga` DI-DROP** — harga tidak lagi disimpan per klien. Nominal di-resolve
  dinamis dari tabel `products` (kolom `price_label`) berdasar `app_type` via
  `STATE.catalog` saat render kartu/detail (`clients.js`). Satu-satunya source of truth
  harga = `products`.
- **`products.kode_produk` ditambahkan** + backfill (kaki5→KK5, rosok→KSR,
  retail→RTL, dll = upper(app_type)) + unique index. Diintegrasikan ke katalog admin
  (load/edit/save/kartu) & flow pembelian kaki5.
- Migrasi: `supabase/migration-drop-clients-harga.sql`, `supabase/migration-add-kode-produk-to-products.sql`.

### 🖼️ Bukti Bayar (Bucket `bukti`)
- **Fixed:** admin tak bisa lihat foto bukti (`Bucket not found` / `Path bukti tidak valid`).
  Kini ada **signed URL** (15 menit) via handler `storageSign` (`api/rest.js` serverless +
  `server.js` local) + helper `supabaseStorageSign()` (`api.js`).
- `clients.js` guard path tak valid → error "Gagal membuat link bukti" ditangani.

### 🔘 Smart Button "Kirim Bukti Bayar" (kaki5)
- Klik langsung buka file picker foto → preview + nama file → tombol berubah jadi submit
  (satu aksi, tanpa dobel-step). Di-dokumentasikan di CHANGELOG kaki5.


## [1.5.2] - (Polish Kartu Klien: Info Lisensi & Verifikasi)

### 🎨 Kartu lebih informatif & komprehensif (design polish)
- **Baris lisensi/verifikasi** (`kb-card-lic`): muncul hanya bila data tersedia —
  chip hijau "✓ Lisensi Aktif" + chip "🔎 Verifikasi <tanggal>" / "✓ Diaktifkan <tanggal>"
  sehingga admin langsung tahu status lisensi tanpa buka detail.
- **Harga deal** dipertegas (positif, readable) di baris deal.
- **Cuplikan serial** diperpanjang 10 → 12 karakter biar lebih mudah dicocokkan.

### 🧹 Bersih-bersih lanjutan
- Hapus CSS dead `.kanban-card.dragging` (drag & drop sudah tidak ada).
- `cursor: grab` → `pointer` (kartu tidak bisa di-drag, diklik untuk buka detail).
- Rapikan komentar yang masih menyebut "kanban board / drag & drop" → view Kelola
  Klien + tab status.
- SW cache → `kasir-admin-v21`.


## [1.5.1] - (Kartu Info-Rich di Tab Per Status)

### ↩️ Balik ke tampilan Tab Per Status (bukan board kolom)
- View Kelola kembali pakai **tab per status**: Semua / Baru / Dihubungi / Tertarik /
  Menunggu Verifikasi / Aktif / Batal.
- Tiap tab nampilin kartu sesuai status + header (label status, jumlah kartu, total Rp).

### 🔍 Kartu tetap info-rich (dari 1.5.0)
- **Progress bar** posisi pipeline di atas kartu.
- **Baris deal**: 🤑 harga (Rp id-ID) • 🔑 cuplikan serial / 🕑 umur lead.
- **Badge sumber**, meta lengkap (👤 pemilik, 💬 WA / ✉️ email, 📍 wilayah).
- **Badge status** di pojok kanan kartu saat tab "Semua" aktif.
- **Menu aksi ⋯** (👁️ Detail, ⬅️ prev, ➡️ next) menggantikan tombol ‹ ›.

### 🧹 Bersih-bersih
- Buang kode board kolom-per-stage + drag & drop (`.kb-board`, `.kb-col*`,
  `.kb-headstats`, `enableKanbanDnd`) yang ternyata bukan yang dimau.
- Buang CSS dead board; CSS tab (`kb-tabs`/`kb-tab*`) dipakai lagi.
- SW cache → `kasir-admin-v20`.


## [1.4.8] - (Kartu Kanban Kontekstual per Status)

### 🎨 Tampilan kartu klien dinamis sesuai konteks status
- **Aksen warna halus per status:** tint latar tipis (bukan border tebal) —
  biru=Baru, oranye=Dihubungi, amber=Tertarik, teal=Verifikasi, hijau=Aktif,
  merah=Batal.
- **Baris konteks status** di tiap kartu:
  - `baru` → "🆕 Lead baru — belum dihubungi"
  - `dihubungi` → "📞 Sudah dihubungi"
  - `tertarik` → "💡 Tertarik — siap ditawarkan"
  - `menunggu_verifikasi` → tombol "🧾 Lihat Bukti" (jika ada bukti) atau
    "⏳ Menunggu verifikasi"
  - `aktif` → status Online/Offline (berdasar `last_seen`) + cuplikan serial
  - `batal` → "❌ Batal — lisensi nonaktif"
- **Tombol utama kontekstual** menggantikan tombol "Buka":
  - Baru→📞 Hubungi, Dihubungi→💡 Tawarkan, Tertarik→⏳ Minta Verifikasi
    (semua maju ke tahap berikutnya)
  - Verifikasi→🔍 Verifikasi, Aktif→⚙️ Kelola, Batal→↩️ Pulihkan (buka detail)
- **Kartu `batal` diredupkan** (opacity .62) sebagai tanda nonaktif.
- Klik kartu masih buka detail; tombol ‹ › tetap ada.
- SW cache `v18`.

---

## [1.4.7] - (Responsive Layout Detail Klien & Kanban)

### 📱 Responsif: HP, tablet, dan desktop
- **Detail klien:** form `.field-grid` kini 2 kolom di tablet/desktop
  (`min-width:768px`), tetap 1 kolom di HP. Field lebar (`.field-span-2`)
  tetap memenuhi baris penuh.
- **HP (≤640px):**
  - Baris tombol (`.btn-block-row`) ditumpuk vertikal, tombol selebar kontainer
    (Generate/Copy/Kirim WA & Kembali/Simpan/Hapus).
  - Header detail (`.cd-head`) jadi kolom, elemen sejajar kiri.
  - Input/select/textarea pakai `font-size:16px` untuk hindari auto-zoom iOS.
  - Toolbar klien: input search & filter pilih memenuhi baris penuh.
- SW cache `v17`.

---

## [1.4.6] - 2026-08-11 (Fix Detail "Salah Tempat" — hidden dihormati)

### 🐞 Detail klien muncul di bawah board, bukan menggantikan
- **Akar masalah:** `.kanban-board { display: flex }` menimpa atribut `hidden`
  sehingga `board.hidden = true` tidak menyembunyikan board. Akibatnya detail
  `#clientDetailBody` tampil **di bawah** board, bukan menggantikan seluruh
  tampilan panel kanban.
- **Fix:** tambah rule global `[hidden] { display:none !important; }` di
  `style.css` agar atribut `hidden` selalu mengalahkan rule `display` manapun.
- Sekarang klik kartu / tombol **Buka** → board + head benar-benar diganti
  oleh form detail di kontainer yang sama; **← Kembali** mengembalikan board.
- SW cache `v16`.

---

## [1.4.5] - 2026-08-11 (Detail Klien Inline di Panel Kanban)

### 🖥️ Detail kartu klien tampil inline (bukan layar penuh)
- Detail klien kini render **di dalam panel `#kanbanView`** itu sendiri, bukan
  pindah ke layar terpisah `screen-klien-detail` (section tersebut dihapus dari
  `index.html`).
- Saat klik **Buka** di kartu kanban: head + board kanban disembunyikan, dan
  form detail muncul menggantikan di kontainer panel yang sama.
- Tombol **← Kembali** (di bawah form) menampilkan ulang board kanban via
  `backFromClient()` → `renderKanban()` (tanpa `showScreen('klien')`).
- `#clientDetailBody` dipindah ke dalam `#kanbanView`; `#kanbanViewHead` diberi
  id untuk togglable.
- **Trigger detail = klik kartu ATAU tombol Buka.** Klik di area kartu kanban
  (di luar tombol aksi) kini membuka detail; tombol `‹ ›`, `🧾 Bukti`, dan
  `Buka` diabaikan supaya tidak trigger ganda.
- Terverifikasi: `detailInsideKanban: true`, board/head togglable, kembali
  restore 11 kartu, 0 error console. SW cache `v15`.

---

## [1.4.4] - 2026-08-11 (Smart Refresh Button + Cleanup KPI/Muat)

### 🔁 Tombol refresh jadi smart button
- Ikon `⟳` di topbar (`#refreshBtn`) kini berfungsi di **semua** halaman dan
  menyesuaikan aksi berdasarkan halaman aktif: Dashboard → `refreshDashboard`,
  Klien → `refreshClients`, Katalog → `refreshCatalog`, Pengaturan → reload.
- Dispatch lewat `window.refreshCurrentScreen()` di `app.js` (memakai
  `getCurrentScreen()`), dengan spinner sementara + toast bersih.
- Modul mengekspos fn via global: `window.refreshDashboard`,
  `window.refreshClients`, `window.refreshCatalog`.

### 🧹 Tombol refresh dalam konten dihapus
- Tombol `⟳ Segarkan` (dashboard) dihapus — cukup pakai smart button topbar.
- Tombol `⟳ Muat` (toolbar klien) dihapus — smart button yang nangani.
- Duplikat `#clientStatCards` di-rapikan + fix `</div>` dobel di page-head klien.

### 🗑️ Dead code
- `renderStats()` + 3 pemanggilnya dihapus dari `clients.js` (target
  `#clientStatCards` sudah tidak ada).
- Binding `refreshClientsBtn` & `refreshBtn` lama dibersihkan dari
  `clients.js` / `dashboard.js`.

> Terverifikasi: klik smart button di Dashboard, Klien, dan Katalog semuanya
> memunculkan `✅ Data diperbarui` dengan 0 error console. SW cache `v13`.

---

## [1.4.3] - 2026-08-11 (Login di-bypass + Halaman Klien: Analitik & Kelola Klien)

### 🔓 Login di-bypass
- Halaman login (`#loginScreen`) tidak lagi ditampilkan — `initAuth()` langsung
  `showApp()`. Logout tidak kembali ke layar login. (Checkpoint menunjuk ke
  BACKLOG modul kredensial di `audit-admin-kasirsolo.md`.)

### 📊 Halaman Klien → 2 mode: Analitik & Kelola Klien
- Tombol tampilan dirombak: ~~List~~ → **Analitik**, ~~Kanban~~ → **Kelola Klien**.
- Kartu "Daftar Klien" (list) dihapus total.
- View **Analitik** = dashboard analitik khusus klien: stat ringkas (Total,
  Aktif/Deal, Aktif 30 hari, Potensial Revenue) + panel bar Pipeline per Status,
  Klien per Aplikasi, dan Sebaran Wilayah. Menghormati filter cari & aplikasi.
- View **Kelola Klien** = kanban pipeline (tab per status, geser kartu ‹ ›).
- KPI cards (`#clientStatCards`) pindah ke bawah deskripsi halaman, di atas
  tombol mode tampilan.


## [1.4.2] - 2026-08-11 (Detail Klien → Halaman Penuh + Redesign Kartu)

### 🖥️ Detail klien jadi halaman penuh (bukan modal)
- `#sheetClient` (modal/sheet) dihapus dari `index.html`.
- Detail klien kini render ke section baru `screen-klien-detail` (halaman penuh)
  dengan **tombol kembali** (`#backFromClient` di atas + `← Kembali` di bawah
  form). Navigasi balik lewat `window.backFromClient()` → `showScreen('klien')`.
- `openClient()` menulis ke `#clientDetailBody` lalu `showScreen('klien-detail')`.
- `closeClientSheet()` menjadi alias dari `backFromClient()` (tetap dipakai
  `saveClient`/`deleteClient`).

### 🎨 Redesign kartu klien
- Kartu **List**: hierarki diperjelas — nama warung besar, badge status di kanan,
  baris kontak (`👤 pemilik`, `💬 WA`, `📍 wilayah`) terpisah, footer memuat
  waktu terakhir terhubung + dropdown status + tombol bukti (bila verifikasi).
- Kartu **Kanban**: ikon waktu `🕒` di footer, chip kontak lebih ringkas.
- Styling baru: `.client-card-head`, `.client-contact`, `.cc`, `.client-foot`,
  `.status-select`, `.cd-head`, `.cd-title` di `style.css`.


## [1.4.1] - 2026-08-11 (Konsolidasi Modul Lisensi → Klien & Katalog)

### 🔀 Modul Lisensi dihapus (digabung)
- Menu sidebar **Lisensi** dihapus; `js/license-ui.js` dilepas (dead code).
- **Verifikasi Serial** dipindah ke sheet Klien (`js/clients.js`): blok
  `🔎 Verifikasi Serial` di bawah `⚡ Generate Lisensi`, fungsi
  `window.verifyClientSerial` via `/api/license` (HMAC server-side).
  `formatExpiry` diambil dari `js/license-core.js` (tetap dipertahankan).
- **Kelola Produk** sudah penuh di modul **Katalog** (`products`), jadi registry
  & form produk lisensi dihilangkan.
- Fitur **Referral** & **Backup/Restore** lisensi di-drop.
- Header `#licenseChip`, `#sheetProduct`, `#sheetLicense`, `#screen-license`
  dihapus dari `index.html`; import/init `initLicense` dihapus dari `app.js`.
- `closeSheet` dipindah dari license-ui ke `js/overlay-a11y.js` (dipakai
  sheetOnboarding & sheetLeadDetail yang masih ada).
- `sw.js`: cache bump `v9`, hapus `/js/license-ui.js` dari static assets.


## [1.4.0] - 2026-08-11 (Pipeline Satu-Tabel `clients` + UI List/Kanban)

### 🔀 Pipeline konsolidasi: `leads` & `pembelian` dihapus
- Tabel **`leads`** dan **`pembelian`** DROPPED dari Supabase (lewat Management API).
  Seluruh pipeline marketing kini digarap di **satu tabel `clients`**
  (baru → dihubungi → tertarik → menunggu_verifikasi → aktif/batal).
  Data lama (2 leads + 1 pembelian) sudah dikonsolidasi & diverifikasi di `clients`.
- Whitelist proxy di `api/rest.js` disempitkan:
  `ALLOWED_REST_TABLES = ['clients', 'products']` (leads/pembelian tidak lagi diizinkan).
- `js/pembelian.js` dihapus (dead code) — app klien (`kaki5/js/purchase.js`)
  juga sudah menulis pipeline ke `clients`, bukan `pembelian`.

### 🗂 UI Klien rombak: List + Kanban
- Layar **Klien** kini punya 2 mode tampilan via toggle: **List** (kartu + filter)
  dan **Kanban** (6 kolom pipeline, drag-drop status).
- `js/clients.js`: `PIPELINE_STAGES`, `renderKanban()`, `switchClientView()`,
  `updateClientStatus()` — konsisten untuk List & Kanban (via `/api/rest`).
- Dashboard KPI & "aktivitas terbaru" mengikuti pipeline `clients`.

## [1.3.6] - 2026-08-10 (Landing Product Status: live/ready/maintenance/development)

- Kolom `status` baru di tabel `products` (default NULL = auto-derive). Logika
  status saling terhubung dipakai konsisten di admin & landing:
  - Link live & vercel keduanya kosong -> otomatis **development** (fallback).
  - Status `live` / auto-derive -> **live** jika store_url ada, **ready** bila
    cuma vercel_url terisi.
  - Status `ready`/`maintenance` -> dipertahankan selama ada link.
- Admin `js/catalog.js`: dropdown Status di sheet produk, chip status di kartu,
  kirim `status` saat create/update (via proxy `/api/rest`).
- Landing `index.html`: badge status (LIVE/READY/MAINTENANCE/DEVELOPMENT),
  tombol "Buka Aplikasi" pakai actionUrl (live -> store_url; ready/maintenance
  -> store_url, fallback vercel), "Konsultasi" saat development.
- Migration SQL: `admin/scripts/migration-product-status.sql`.

## [1.3.5] - Dev Server Vercel CLI

- Setup dev lokal pakai Vercel CLI (`vercel dev`, port 8082) — API routes
  `/api/rest` & `/api/license` sekarang jalan di lokal (sebelumnya 501 karena
  Python http.server cuma static).
- Catatan setup: project rootDirectory = `admin`; `vercel dev` harus jalan
  dari root repo `kasol/`. Env dibaca dari `.env` di root repo.
- `.env.local` lokal ditambah `ADMIN_API_KEY` (dev-only) biar gate fail-closed
  lolos di dev. Jangan commit `.env*` — berisi service role key.

## [1.3.4] - 2026-08-10 (Bug Fix - Service Worker selalu return Response)

### sw.js tidak lempar "Failed to convert value to 'Response'" / "Failed to fetch"
- Branch JS/CSS (fetch fallback) & branch default (network-first) sebelumnya bisa
  menghasilkan nilai undefined saat fetch gagal offline & tidak ada cache, sehingga
  browser melempar error SW tadi. Sekarang selalu fallback ke Response valid
  (503/404) -- tidak pernah 
espondWith(undefined).
- Cache name di-bump ke kasir-admin-v8 supaya browser meng-install SW baru dan
  membersihkan cache lama yang rusak.
## [1.3.3] - 2026-08-10 (Security Fix C3 - Closing remaining stored XSS)

### Stored XSS ditutup di kartu Pembelian (C3)
- **`js/clients.js`** - `pembelianCardHtml()` (duplikat dari `js/pembelian.js`) masih
  menginterpolasi data merchant TANPA escape: `status`, `bukti_url`, `id`, `unit_id`,
  `app_type`, `serial`. Karena data pembelian dibuat oleh merchant/klien (untrusted),
  buka tab Klien = stored XSS aktif. Sekarang semua field user-controlled ke-`escapeHtml()`-kan,
  konsisten dengan implementasi di `js/pembelian.js` yang sudah aman.
- `escapeHtml()` (C2) sudah diverifikasi: 9 payload XSS (`<img onerror>`, `<script>`,
  atribut-breakout `\" autofocus`, dsb) semuanya ter-escape; guard null/undefined tidak
  menjatuhkan nilai 0.
- Verifikasi behavior render card: 6/6 cek PASS, tidak ada raw `<img>`/`<script>` bocor.
## [1.3.2] - 2026-08-10 (Security Fix H1 - Gate endpoint fail-closed)

### Gate /api/rest & /api/license di-hardening (H1)
- **`api/_gate.js` (baru)** - helper gate bersama: **fail-closed** + **constant-time**
  (`timingSafeEqual`). Kalau `ADMIN_API_KEY` TIDAK diset di env, kedua endpoint
  return **503 `server_not_configured`** (sebelumnya kebypass / terbuka total).
- **`api/rest.js`** - pakai `checkAdminGate()`; perbandingan header `x-admin-key`
  sekarang constant-time (anti timing-side-channel), ganti dari `!==` string.
- **`api/license.js`** - penerapan gate yang sama (konsisten dgn rest).
- **`.env.example`** - `ADMIN_API_KEY` kini di-tag WAJIB (fail-closed).
- Catatan: login admin resmi tetap **DITUNDA** (lihat `../CONTEXT.md`). Ini bukan
  pengganti auth, hanya pematokan gate eksisting biar tidak terbuka.

## [1.3.1] - 2026-08-10 (Security Fix C1 â€” Lisensi server-side)

### ðŸ”’ Lisensi dipindah ke server-side (tidak bisa dipalsukan offline)
- **`api/license.js` (baru)** â€” Vercel Serverless yang memegang HMAC salt
  **server-side only** (env `LICENSE_SALT_*` / `LICENSE_SALTS`, fallback konstanta
  di file). Endpoint `generate` & `verify` dilindungi gate `ADMIN_API_KEY`
  (sama seperti `/api/rest`).
- **Hapus salt dari client:** `js/clients.js` (`APP_META`) dan `js/license-ui.js`
  (`FALLBACK_REGISTRY`, `loadProductsFromSupabase`) tidak lagi menyimpan/menampilkan
  salt produk resmi. Tab Lisensi & tombol "Generate di kartu Klien" kini call
  `/api/license` via `licenseApi()` (helper baru di `js/api.js`).
- Sebelumnya salt di-hardcode di bundle client & serial bisa digenerate offline
  oleh siapa pun tanpa bayar â€” sekarang salt & crypto cuma ada di server.
- UI registry menampilkan "ðŸ”’ Salt di server" (tidak menampilkan salt lagi).
- Produk kustom tetap didukung: salt override dikirim per-request (tidak di-bundle).
- **`.env.example`** didokumentasikan dengan var salt server-side.
- `escapeHtml` di `utils.js` diperbaiki (no-op â†’ escape sebenarnya), menutup XSS.

## [1.3.0] - 2026-08-08 (Leadsâ†’Klien + Lisensi HMAC-V2 universal)

### ðŸ“‡ Leads digabung ke Klien
- Screen & menu **"Leads" terpisah dihapus** â†’ leads kini **tab "Leads"** di dalam
  layar **Klien** (`screen-klien`, `.tab-bar` Outlet/Leads).
- `js/clients.js` kini menangani keduanya: `loadClients` (tabel `clients`) +
  `loadLeads` (tabel `leads` â†’ `STATE.leads` sehingga dashboard overview tetap terisi),
  `renderLeadsTable`, status update, delete, `exportLeadsCSV`, `openLeadDetail`.
- Tab wiring `switchKlienTab` di `initClients`. **`js/leads.js` dihapus.**

### ðŸ”‘ Lisensi HMAC-V2 universal (retail kini valid)
- Retail (`retail/index.html`) di-port ke **RTL**
  HMAC-V2 (`KASIRSOLO-RETAIL-HMAC-V2`); backward-compatible dengan
  skema lama.
- Kini **salt admin** (KSR/KK5/RTL) cocok dengan app klien →
  semua serial yang di-generate admin bisa diaktivasi (diverifikasi end-to-end).

### ðŸ§¹ Hygiene
- `manifest.json` `theme_color` disinkronkan ke `#EA5129` (== `--brand` produksi).
- `.vercelignore` mengecualikan `proto/`, `proto2/`, `.pre-proto2-backup/`,
  `prototype-redesign.html`, `*.backup*` dari deploy.
- Naming convention salt diperbarui ke `KASIRSOLO-{APP}-HMAC-V2`.

---

## [1.2.0] - 2026-08-07 (CRM Klien + Sinkronisasi Profil)

### ðŸ“‡ Tab Klien (CRM) â€” baru
- `js/clients.js` + nav/halaman **Klien**: analitik (total outlet, aktif 30 hari,
  per app), daftar klien (cari + filter), detail/edit/delete.
- Data dari Supabase tabel **`clients`** (profil outlet yang dikirim app klien via
  `sync.js`) â€” akses via **service_role**.

### âš¡ Generate lisensi langsung dari kartu klien
- Dari kartu klien bisa **generate serial** (produk + device code otomatis terisi)
  + **Copy** + **Kirim via WhatsApp** ke nomor merchant â€” tanpa pindah menu.
- **Fix bug**: prefix produk kaki5 `K5` â†’ **`KK5`** (selama ini serial kaki5 yang
  digenerate admin DITOLAK app karena regex kaki5 pakai `KK5`). Registry + ikon ikut berubah.

### ðŸ—ºï¸ Analitik wilayah
- Kolom wilayah tersruktur (`provinsi/kabkota/kecamatan`) di `clients` â†’ fondasi
  agregasi analitik per daerah yang akurat.

---

## [1.1.0] - 2026-08-07 (Audit Menyeluruh + Deploy Model Baru)

### ðŸ” Lisensi
- **Salt disamakan ke salt asli app klien** â€” `PRODUCT_REGISTRY` memakai `KASIRSOLO-ROSOK-HMAC-V2` / `KASIRSOLO-KAKI5-HMAC-V2` (dulu `-SALT-2024`, salah). Dampak: serial yang di-generate admin kini **valid & bisa diaktifkan** di app rosok/kaki5 (diverifikasi end-to-end dengan meniru logika `validateLicenseKeyV2`).
- Field "Unit ID" ðŸ’¬ diganti **"Device Code (dari app klien)"** + hint â€” serial terikat ke device code, bukan unitId toko.

### âš™ï¸ Tombol / handler yang sebelumnya mati â†’ aktif
- `exportLeadsCSV()` (Export CSV Leads)
- `openLeadDetail(id)` (klik aktivitas terbaru di dashboard)
- `openLicenseSheet()` (chip LICENSE di header)
- `finishAdminOnboarding()` (tombol onboarding)
- `exportLicenseBackup()` / `importLicenseBackup()` (backup & restore lisensi)

### ðŸ› Bug
- Status lead tersimpan sebagai **label emoji** (`ðŸ†• Baru`) bukan kunci (`baru`) â†’ `<option value="key">`. Dashboard/filter/statistik kini benar.
- KPI **"Aplikasi Aktif" selalu 0** â†’ filter `c.visible !== false` (sebelumnya `c.active`).

### ðŸ’¾ Storage
- `storage.js` kini punya **fallback ke `window.localStorage`** â€” data persist di browser produksi biasa (dulu hanya jalan di environment yang inject `window.storage`).

### â˜ï¸ Supabase
- **Wiring dipulihkan:** `js/env-loader.js` + `js/supabase-client.js` + tag script di `index.html` (file sempat tidak ada di produksi).
- **Build step DIHAPUS:** `buildCommand` dihapus dari `vercel.json` (kaki5 pattern) â€” `js/env-loader.js` kini **STATIS & di-commit** hanya berisi var publik (`SUPABASE_URL`, `SUPABASE_ANON_KEY`). Service key + ADMIN_API_KEY hanya server-side `api/*`. Preview tidak lagi gagal build saat env Preview kosong.

### ðŸ§¹ Pembersihan
- Buang unused import (catalog, license-ui, navigation, settings), dedupe `escapeHtml` di dashboard (import dari utils).
- Manifest shortcut `/#overview` â†’ `/#dashboard`; SW cache `v1` â†’ `v2`; `.vercelignore` kecualikan `migrate-catalog-to-supabase.html` & `run-migration.html`.

### ðŸš€ Deploy
- **GitHub Actions tidak dipakai lagi** (semua `.github/workflows/*` dihapus). Deploy via **Vercel git integration (auto-detect)** â€” project `kasir-admin`, Root Directory `admin/`, **tanpa build command** (static deploy).

---

## [1.0.0] - 2026-08-06 (Modular ESM Refactor)

- Refactor ke modular ESM (`js/app-state.js`, `js/*.js`, entry `js/app.js`), hapus inline single-file.
- Katalog, Settings, Leads, License, Dashboard sebagai module terpisah dengan storage abstraction.
- CSS class contract & empty-state; backup/import admin.
