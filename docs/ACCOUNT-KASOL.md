# Akun Kasol — Akun Universal (WA + PIN)

> **Status:** Fase A1 (daftar/login) **live** sejak 2026-11-03; **Fase A2 (dashboard lengkap) live** 2026-11-03.
> Fase A3 (kode referal otomatis + kode aktivasi perangkat) — migrasi & klien
> tersedia (`...-fase-a3.sql`, `...-update-profile-v3.sql`); **verifikasi apply ke DB**
> sebelum dianggap live.
> Login mandiri dari dalam app klien (kaki5/rosok/laundry) = **belum** — app klien
> baru melakukan **binding perangkat** lewat kode aktivasi HUB.
> **Fase A4 (login app klien + multi-role)**: migrasi **ter-apply** ke
> `hhywr...` + klien tersedia (kaki5: kartu Akun & Peran, login WA + PIN,
> kelola pegawai, role owner/manajer/kasir). QA `supabase/_qa-a4-app-role.mjs`
> **13 PASS / 0 FAIL**. rosok/laundry menyusul.
> Migrasi: `supabase/migration-account-kasol-fase-a1.sql` + `...-fase-a2.sql`
> + `...-fase-a3.sql` + `...-update-profile-v3.sql` + `...-app-role-fase-a4.sql`
> · **Fase B1 (lisensi aplikasi = milik AKUN, bukan perangkat)** — migrasi
> `...-app-license-fase-b1.sql` **ter-apply & teruji** (QA 30 PASS / 0 FAIL +
> smoke test browser). **Kuota perangkat = SATU angka global di Katalog Aplikasi**
> (`products.max_devices`, migrasi `...-device-quota-global.sql`) — semua akun
> merujuk ke sana, perubahan langsung berlaku. Lihat §4c.
> · Edge Function: `supabase/functions/account-register/`
> · Klien: `mitra/src/lib/account.ts`, halaman `mitra/src/pages/akun.astro`.
>
> **Istilah:** dokumen ini memakai **"Akun Kasol"**, bukan "HUB". Kata "HUB" dipakai
> dokumen lama dengan dua arti berbeda (`docs/HUB-DESIGN-DECISIONS.md` = akun universal;
> `docs/ADR-VOUCHER-REFERRAL.md` = modul mitra) sehingga rawan salah tafsir.

---

## 1. Tujuan

Satu akun untuk seluruh ekosistem Kasol — mirip akun Google:

- dipakai untuk **aktivasi kemitraan**,
- dipakai untuk **beli/aktivasi lisensi app apa pun** (kaki5, rosok, laundry, minimarket),
- bisa **didaftarkan dari mitra maupun dari app** (app menyusul di Fase A2).

Keputusan produk (pemilik, 2026-11-03):
| # | Keputusan |
|---|---|
| 1 | Login = **nomor WhatsApp + PIN 6 digit** (pola TPA), bukan OTP per login |
| 2 | Fase pertama **mitra saja**; app klien menyusul |
| 3 | Daftar = **akun biasa**; jadi mitra = **opt-in** di dashboard |

## 2. Model data (memakai fondasi Phase 0 yang sudah ada)

```
global_identities   WHO   — id TEXT (uuid string), phone_e164 UNIQUE, status, auth_user_id
app_memberships     APA   — role per app (belum dipakai di fase A1)
licenses            MAYA  — lisensi per app × outlet, terikat global_identity_id
license_devices     —     — perangkat per lisensi (serial device-bound)
clients             —     — registri app klien (satu baris per unit × app)
referral_partners   —     — kemitraan (opt-in), punya global_identity_id
```

Aturan yang **tidak boleh dilanggar** (sama dengan `docs/HUB-DESIGN-DECISIONS.md` §11):
1. Lisensi tetap **per aplikasi** — status akun tidak pernah menjadikan lisensi valid.
2. Role tetap **per aplikasi**.
3. Kuota transaksi di level **lisensi**, bukan baris `clients`.
4. Tulis lisensi/membership/tautan akun hanya lewat `service_role` / RPC `SECURITY DEFINER`.
5. App klien tetap **standalone & offline-first** — akun adalah lapisan expedite, bukan gerbang.

## 3. Kredensial & sesi

| Bagian | Implementasi |
|---|---|
| Email Auth | `<digit WA>@accounts.kasirsolo.local` (08xx / 8xx / +62xx → `62xx`) |
| Password | PIN 6+ digit, di-hash **Supabase Auth** (tidak pernah disimpan app) |
| Pembuatan akun | Edge Function `account-register` (service_role hanya di server) |
| Sesi | Supabase Auth di browser mitra (`localStorage`, key `ksr_account_session`, auto-refresh) |

### Aturan keamanan yang WAJIB dijaga

1. **Jangan pernah** memakai `user_metadata` untuk otorisasi. Field itu bisa diubah
   pemilik sesi lewat `updateUser` → kalau dipakai sebagai `gid`, siapa pun bisa mengaku
   sebagai akun lain dan membaca lisensinya lewat RLS.
   `current_global_identity_id()` sekarang: `app_metadata.gid` → lookup
   `global_identities.auth_user_id = auth.uid()`. Jalur `user_metadata` **dihapus**.
2. `app_metadata.gid` hanya boleh di-set `service_role` (Edge Function).
3. Service key tidak boleh masuk bundle (lihat `mitra/astro.config.mjs:26-29`).
4. Login selalu membalas pesan generik: **"Nomor WhatsApp atau PIN tidak valid."**

## 4. Kontrak RPC

| RPC | Akses | Fungsi |
|---|---|---|
| `account_prepare_identity(p_wa, p_nama)` | service_role | Buat/lookup akun by WA. Balas `already_registered` bila nomor sudah tertaut sesi lain |
| `account_bind_auth_user(p_gid, p_auth_user_id)` | service_role | Tautkan sesi Auth ke akun (idempoten, tolak 1 sesi → 2 akun) |
| `account_attach_existing_licenses(p_gid)` | service_role | Tarik `clients` + `licenses` lama yang WA-nya sama ke akun ini |
| `account_my_profile()` | authenticated | Profil + status mitra (kode, kota, tier) + ringkasan `clients` tertaut (`client.unit_id/app_type/nama_usaha/kabkota/provinsi` untuk prefill Data Diri) |
| `account_become_partner(p_kota, p_provinsi, p_catatan)` | authenticated | Opt-in mitra dari sesi → `referral_partners` + `license_codes` referral universal |
| `account_update_profile(p_nama, p_kota, p_provinsi, p_alamat_detail, p_kecamatan, p_desa)` | authenticated | Edit identitas dari sesi: nama → `global_identities.display_name` + `referral_partners.nama`; wilayah+alamat → `referral_partners` + **semua baris `clients` tertaut** (sinkron Control). Parsial & opsional (`migration-account-kasol-update-profile-v3.sql`) |
| `hub_my_licenses()` | authenticated | **Sudah ada** — daftar lisensi lintas app milik akun |
| `account_my_summary()` | authenticated | Ringkasan: lisensi aktif, perangkat, referral, saldo poin/rupiah, status mitra |
| `account_my_referrals(p_limit)` | authenticated | Riwayat referral mitra (mirror `partner_referrals`, sumber = sesi) |
| `account_my_payouts()` | authenticated | Riwayat pencairan (mirror `partner_payouts`) |
| `account_request_payout(p_points, p_amount, p_bank_info)` | authenticated | Ajukan pencairan — validasi identik `payout_request` (min Rp50rb, 1 poin = Rp1.000, 1 request/siklus) |
| `account_create_activation_code(p_license_id)` | authenticated | Kode aktivasi perangkat baru (10 menit, hanya pemilik lisensi) |
| `app_my_access(p_app_key)` | authenticated | Role milik SESI untuk satu aplikasi + daftar app akun. Auto-provision `owner` bila sesi memegang lisensi app itu tapi belum ada membership (**Fase A4**) |
| `app_list_members(p_app_key)` | authenticated (owner-only) | Daftar pegawai app tsb (scope outlet sama) |
| `app_add_member(p_app_key, p_wa, p_role, p_nama)` | authenticated (owner-only) | Tambah/ubah pegawai by WA (boleh membuat identitas `pending` bila belum punya akun) |
| `app_set_member_role(p_member_id, p_role)` | authenticated (owner-only) | Ubah role pegawai (cegah menurunkan owner terakhir) |
| `app_remove_member(p_member_id)` | authenticated (owner-only) | Hapus pegawai (cegah menghapus owner terakhir) |
| `app_my_license(p_app_key, p_device_code, p_device_label)` | authenticated | **Fase B1** — status + daftar/validasi perangkat pada **lisensi milik akun** (`licenses.global_identity_id`), kuota dari `products.max_devices` (satu angka global per aplikasi di Katalog). Bentuk respons mirip baris `clients` (`license_status/serial/expires_at`). Pegawai memakai lisensi owner pada scope outlet sama; kandidat >1 → `license_ambiguous` (fail-safe) |
| `current_global_identity_id()` | anon/authenticated | Resolver gid untuk RLS |

### Edge Function `account-register`

```
POST /functions/v1/account-register
{ "wa": "0812xxxxxxx", "pin": "123456", "nama": "Nama Usaha" }

201 { ok:true, gid, wa, nama, licenses_attached, clients_linked }
400 { ok:false, code:"invalid_wa"|"invalid_pin"|"invalid_nama" }
409 { ok:false, code:"already_registered" }   → arahkan ke tab Masuk
429 { ok:false, code:"rate_limited" }
500 { ok:false, code:"server_error" }
```

Env: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `ACCOUNT_CORS_ORIGIN` (fail-closed:
origin di luar daftar tidak mendapat header CORS).

Deploy: `node supabase/deploy-account-functions.js [--secrets]` (butuh
`SUPABASE_ACCESS_TOKEN`; ref diturunkan dari `SUPABASE_URL`).

## 4b. Login app klien + multi-role (Fase A4)

kaki5 bisa **login memakai Akun Kasol yang sama** (WA + PIN) dan menerima
**role per-aplikasi** dari `app_memberships`.

| Role | Cakupan di kaki5 |
|---|---|
| `owner` | Akses penuh (profil, fitur, data & cadangan, kelola pegawai) |
| `manajer` | Operasional + laporan; **tanpa** kelola pegawai & Data & Cadangan |
| `kasir` | Jualan & kas; kartu Pengaturan sensitif & nav Laporan disembunyikan |

Prinsip yang dijaga:
- **Role = per aplikasi** (bukan global); membership app lain tidak berlaku.
- **Modal login = LAYER PERTAMA saat boot** (2026-11-04) — bila belum ada sesi,
  gerbang login muncul sebelum UI, bukan lagi opsional-diam-diam. Offline-first
  tetap utuh lewat pintu keluar **mode Pemilik perangkat**: sejak 2026-11-07
  pintunya berupa **tautan khusus dari dashboard Akun Kasol (situs mitra)** —
  `…/#akses-perangkat?k=<kunci acak>` → `applyAksesPerangkatLink()` di awal
  `init()` → bypass gerbang + hash dibersihkan; tombol "Lanjut tanpa akun" di
  gerbang dihapus. Tanpa login, peran efektif tetap = `owner`.
- Identitas dari **sesi** (`current_global_identity_id()`), bukan parameter bebas.
- Hak tulis hanya lewat RPC `SECURITY DEFINER`; klien tidak dapat INSERT/UPDATE.

Komponen klien kaki5:
- `kaki5/js/account.js` — sesi Supabase Auth (`storageKey: ksr_kaki5_session`) +
  RPC `app_*` + peran/izin (`peran()`, `boleh(tier)`).
- `kaki5/js/account.ui.js` — kartu "Akun & Peran" di Pengaturan, modal login,
  modal kelola pegawai, penegakan tampilan via `data-role`.
- `kaki5/js/app.js` — `init()` meng-`await initAkun()` supaya gerbang login tampil
  deterministik sebagai layer pertama; gerbang peran di dispatcher `data-action`
  (defense-in-depth), termasuk aksi `akun-lanjut-perangkat`.
- **Gerbang login** — `showAkunLock()` / `hideAkunLock()` (account.ui.js) menambah
  `akunModal` ke `HARD_GATE_OVERLAYS` selama aktif → Escape, klik backdrop, dan
  klik navbar TIDAK bisa menutupnya; tombol "Batal" disembunyikan. Bypass diingat
  di `localStorage['akunKasolGateBypassV1']` dan dihapus saat login/keluar.
- **Presentasi = LOCK OVERLAY PENUH** (permintaan pemilik 2026-11-04): `#akunModal`
  memakai kelas tetap `akun-lock-overlay` — latar brand **opak** (`var(--grad)`),
  terpusat, `z-index: 645` (di atas bottom-nav 350 / modal 600 / sheet 640, di
  bawah toast 650 & updateOverlay 800) sehingga **menutup seluruh elemen di
  belakangnya** (terverifikasi: probe `elementFromPoint` di sudut & area navbar
  semuanya masuk overlay). Bukan bottom-sheet — berlaku baik sebagai gerbang boot
  maupun saat dibuka dari Pengaturan (di sana "Batal" tampil untuk menutup).
- **Smoke test browser (2026-11-04, dev `127.0.0.1:8086`) — 11/11 lolos**:
  gerbang tampil sebagai layer pertama (z 620 > nav 350, fokus di kolom PIN);
  tahan Escape/backdrop/klik navbar; kredensial salah → pesan generik & gerbang
  tetap; "Lanjut tanpa akun" → terbuka + bypass diingat; reload saat sudah login
  → langsung masuk tanpa gerbang; logout → gerbang kembali; login `owner` → semua
  terlihat; login `kasir` → kartu sensitif & nav Laporan tersembunyi, aksi owner
  ditolak dispatcher ("🔒 Fitur ini khusus pemilik."). Sesi login persist di
  `localStorage['ksr_kaki5_session']`.
- **Fix temuan smoke test**: `applyRoleUI()` dulu menyapu `[data-role]` SEBELUM
  `renderAkunCard()`, sehingga tombol owner-only hasil render ulang (mis. "Kelola
  Pegawai") tetap tampil ke kasir. Kini kartu dirender lebih dulu lalu disapu, dan
  `renderAkunCard()` menyapu isinya sendiri lewat helper `filterRoleEls()`.
- Migrasi: `supabase/migration-account-kasol-app-role-fase-a4.sql`.

> **Catatan keamanan:** karena app offline & lisensi device-bound, multi-role di
> app klien adalah lapisan **kerapian & guardrail**, bukan batas keamanan keras
> (data lokal tetap terbaca oleh siapa pun yang memegang perangkat). Pemilik
> mengikat pegawai lewat PIN masing-masing; penegakan otoritatif ada di server
> (RPC owner-only).

## 4c. Lisensi aplikasi = milik AKUN (Fase B1, 2026-11-05)

Keputusan pemilik: *"karena sudah ada fitur login, ubah lisensi aplikasi
menggunakan akun. bukan perangkat lagi. tapi, sistem control bisa menentukan
nilai maksimal jumlah perangkat per akun."*

**Sebelum** kaki5 membaca `clients` lewat `unit_id` + serial HMAC device-bound —
perangkat = pemilik lisensi. **Sesudah**, saat ada sesi Akun Kasol:

```
boot / login  →  app_my_license('kaki5', deviceCode, 'Kaki5')   [authenticated]
                    │
                    ├─ licenses.global_identity_id = gid sesi (atau owner
                    │   pegawai pada scope outlet yang sama)
                    ├─ cek status / expires_at
                    ├─ license_devices: already-active | activated | reactivated
                    │   · kuota = products.max_devices  ← SATU ANGKA DI KATALOG
                    │   · penuh → device_limit (TOLAK, tidak auto-eject)
                    └─ simpan lisensi lokal: source:'account', serial, expCode
```

- **RPC:** `app_my_license` (`SECURITY DEFINER`, grant hanya `authenticated` +
  `service_role`; identitas dari sesi, bukan parameter). Kode balasan:
  `not_signed_in`, `identity_missing`, `identity_suspended`, `no_access`,
  `no_license`, `license_revoked`, `license_expired`, `device_limit`,
  `license_ambiguous`, `device_conflict`.
- **Kuota (keputusan pemilik 2026-11-05):** **`products.max_devices` = SATU
  angka global per aplikasi, ditanam di Katalog Aplikasi.** Semua akun merujuk
  ke angka itu; ubah sekali di **Control > Katalog > "Maksimal Perangkat per
  Akun"** → langsung berlaku untuk semua akun tanpa apply per akun.
  Migrasi `supabase/migration-hub-device-quota-global.sql`: helper
  `product_device_quota(uuid)` + trigger `products_propagate_device_quota`
  (propagasi) & `licenses_sync_device_quota` (pagar: lisensi tak bisa menyimpan
  angka berbeda). `licenses.max_devices` **deprecated**, jadi mirror otomatis.
  Backfill memakai `MAX` nilai lama per produk supaya tak ada akun yang turun
  kapasitas (live: kaki5=1, rosok=3). Ketiga RPC
  (`app_my_license`, `hub_redeem_activation_code`, `license_activate_device`)
  membaca helper; fallback 2 bila produk belum disetel. Tidak ada lagi
  input/tombol kuota di kartu Klien — di sana cuma badge read-only **"Dari
  Katalog · berlaku semua akun"** + tombol ✕ / ↺ untuk melepas slot perangkat
  (`control/js/clients.js` → `setLicenseDeviceStatus`).
  **Konfirmasi wajib**: mengubah angka kuota di editor Katalog memunculkan dialog
  yang menyebut nilai lama→baru, jumlah lisensi terdampak, dan konsekuensi
  menaikkan/menurunkan. Batal → input dipulihkan & tidak ada yang tersimpan;
  edit field lain tidak memicu dialog. (`control/js/catalog.js` → `saveCatalogApp`).
- **`plan` dirapikan** (`migration-hub-plan-deprecated.sql`): kolom
  `licenses.plan` **tidak di-drop** karena 4 migrasi historis idempotent &
  RPC lama masih menyebutnya, tapi sekarang jadi **mirror yang dijaga trigger**
  (`multi` bila kuota > 1, `single` bila 1) — tulis manual apa pun ditimpa.
  `hub_my_licenses()` berhenti mengembalikan key `plan` dan membaca
  `max_devices` langsung dari `products`. Semua kode aplikasi (mitra
  `account.ts`/`api.ts`/`akun.astro`, Control, `audit-schema.js`,
  `apply-migration.js`, QA) tidak lagi membaca/menulis `plan`.
- **Anti cross-tenant:** pegawai tanpa lisensi sendiri hanya boleh memakai
  lisensi owner di scope `outlet_ref` yang sama, dan itu pun bila kandidatnya
  **tepat satu**. Lebih dari satu → `license_ambiguous` (jangan menebak).
  Perapian scope outlet = improve lanjutan.
- **Klien kaki5:** `js/license.sync.js` → `syncAkunLicense()` /
  `lepasLisensiAkun()`; `js/app.js` → `runLicenseSync()` memilih jalur akun lebih
  dulu, pagar `syncLicenseStatus()` mencegah jalur legacy mencabut lisensi akun,
  `verifyBootLicenseAssignment()` dilewati untuk `source:'account'`.
  `js/account.ui.js` → ambil lisensi **segera saat login**, lepas saat logout,
  kartu menampilkan `Lisensi akun aktif · N/M perangkat`.
- **Fallback sengaja dipertahankan:** tanpa sesi akun (mode Pemilik perangkat /
  perangkat pra-akun) jalur lama `clients`/`unit_id` masih dipakai supaya
  instalasi lama tidak mati mendadak. Konsekuensi: pada perangkat yang **memang
  punya baris `clients` berlisensi**, logout akan kembali ke lisensi device-bound
  itu (bukan tier gratis). Ini improve lanjutan bila kebijakan diperketat.
- **Transfer otomatis BELUM diaktifkan:** kuota penuh → tolak, bukan eject
  perangkat lama. ADR §6.2 mewajibkan step-up PIN + throttle transfer dulu.

**Verifikasi:** migrasi `--dry-run` → `--apply` OK ke `hhywr...`;
`supabase/_qa-app-license-fase-b1.mjs` **30 PASS / 0 FAIL** (self-cleanup
terverifikasi: 0 sisa perangkat/lisensi/identitas/auth user/produk uji).
Uji khusus kuota global memakai **produk uji `QAB1` terisolasi** supaya angka
kaki5/rosok live tidak berubah: ubah `products.max_devices` 1→3 ⇒ **dua lisensi
akun berbeda** ikut berubah (trigger), tulis manual `licenses.max_devices=99`
ditolak trigger (tetap 3), RPC membaca 3. smoke test browser
dev `:8086` — boot dengan sesi → `source:'account'`, login dari gerbang → lisensi
akun langsung aktif (`KAKI5-HUB-…`, 2/2 perangkat), logout → sesi hapus + gerbang
kembali, konsol bersih (hanya 403 `products.salt` yang terdokumentasi).
Fixture: `supabase/_qa-b1-browser-fixture.mjs setup|cleanup`.
**Uji browser Control** (`:8082`, 0 error konsol), memakai produk uji `QACTL`
agar kuota kaki5 live tidak tersentuh:
- `#catalog` — baris produk menampilkan badge `📱 N perangkat/akun`; editor punya
  field **"Maksimal Perangkat per Akun — berlaku untuk SEMUA akun"** (nilai 2).
  Diubah ke 4 + Simpan ⇒ `products.max_devices=4`, **lisensi uji ikut 4**, badge
  baris jadi 4, dan **produk KK5 live tetap 1**.
- `#crm?tab=klien` — kartu akun kini **tanpa** input/Simpan/tombol paket
  (0 elemen), hanya badge read-only `📱 Maks 4 perangkat · Dari Katalog`;
  `app_my_license` balas `activated (3/4)`; tombol ✕ / ↺ perangkat tetap bekerja
  (`status='revoked'` + `superseded_at`, lalu `active` lagi).
- **Konfirmasi kuota global**: ubah `2→7` + Batal ⇒ dialog memuat angka
  lama/baru, "1 lisensi terdaftar" & konsekuensi; input kembali ke 2, produk
  tetap 2, editor tetap terbuka, toast pembatalan. Ubah `2→6` + Lanjut ⇒
  produk & lisensi 6, `plan=multi`, toast "Kuota global diset 6 — berlaku
  untuk semua akun", KK5 live tetap 1. Ubah **nama saja** ⇒ **0 dialog**
  (toast generik); isi `0` ⇒ validasi tanpa dialog.
- **RPC `hub_my_licenses()`** balas `max_devices=6` dari `products` dan
  **tidak ada key `plan`**; build mitra `astro build` sukses (3 halaman).
- Uji lama (sebelum perubahan kebijakan) juga lolos: ✕/↺, integrasi
  `device_limit (2/2)` → `activated (3/3)`, validasi input invalid.

> ⚠️ **Belum dirilis:** bump versi/BETA (`version.js`, `version.json`, `sw.js`,
> `index.html`) belum dilakukan. SW `v213` masih mem-precache file lama ⇒ deploy
> tanpa bump membuat pengguna existing tidak mendapat fitur ini. Belum commit/push.

## 5. Alur

### 5.0 Pintu masuk (keputusan pemilik 2026-11-03)
- **Satu pintu pendaftaran: `/akun`.** `/daftar` lama → **redirect** ke `/akun`; CTA daftar di
  landing/hero/footer diarahkan ke `/akun`; form pendaftaran inline di landing diganti tombol.
- `/akun` memakai layout **`bare`** — header, footer, dan tabbar situs **disembunyikan**
  (halaman funnel); ada topbar minimal (brand + "Program Mitra").
- Tabbar mobile: `Beranda · Program · Portal · Daftar` — "Daftar" menuju `/akun` (tanpa tab
  "Akun" terpisah agar tidak dobel).
- Pendaftaran mitra langsung (form lama) **tidak lagi dipakai**; mitra = opt-in di dashboard.

### 5.1 Daftar
1. `/akun` → tab **Daftar** (nama, WA, PIN, ulangi PIN) → `account-register`.
2. Server: `account_prepare_identity` → `auth.admin.createUser` (app_metadata.gid) →
   `account_bind_auth_user` → `account_attach_existing_licenses`.
3. Klien langsung `signInWithPassword` → dashboard.
4. **Efek samping penting:** kalau nomor itu sudah pernah dipakai di app (ada baris
   `clients`), lisensi lamanya **langsung muncul** di dashboard.

### 5.2 Masuk
`signInWithPassword` → `account_my_profile()` + `hub_my_licenses()`.

### 5.3 Jadi mitra (opt-in)
Tombol **Aktifkan Kemitraan** → `account_become_partner` → baris `referral_partners`
(`registered_via='akun'`) + kode referal universal `MKS-…`. **Tidak** mengembalikan token
portal: portal lama tetap diakses lewat link token dari admin (`partner_issue_token`).

## 6. Dashboard (Fase A2)

`/akun` setelah login menampilkan:

| Kartu | Isi |
|---|---|
| Identitas | Nama, nomor WA, status verifikasi, ID akun, tombol Keluar |
| Ringkasan | 4 angka: lisensi aktif · perangkat · referral · poin siap cair |
| Aplikasi Saya | Per aplikasi: status, paket, kuota `tx_used/tx_quota`, daftar perangkat aktif (label + terakhir terlihat), tombol **+ Tambah perangkat** (kode aktivasi 10 menit) dan **Buka aplikasi** (`settings.app_links`) |
| Kemitraan | Belum mitra: form opt-in (kota/provinsi). Sudah mitra: kode referal + saldo (siap/pending/rupiah) + 5 referral terakhir + form pencairan + riwayat pencairan |
| Keamanan | Ganti PIN + **keluar dari semua perangkat** (`signOut({scope:'global'})`) |
| Bantuan | Chat admin WhatsApp |

Hero pemasaran & panel manfaat **disembunyikan** saat sudah login (halaman jadi dashboard, bukan landing).

## 7. Yang BELUM ada (jangan diasumsikan sudah jalan)

| Gap | Rencana |
|---|---|
| Verifikasi kepemilikan WA (tanpa OTP) | Fase A3: OTP WA untuk verifikasi awal & lupa PIN |
| Lupa PIN mandiri | Sementara lewat admin (tombol chat); Fase A3 OTP |
| Login akun di app klien (bukan sekadar binding) | Fase A3 lanjutan (`app_memberships`) |
| Binding perangkat dari app klien | ✅ **kaki5**: sheet pembelian → `hub_redeem_activation_code` (maks 2 device). rosok/laundry menyusul |
| Beli lisensi atas nama akun dari dalam app | Fase A4 (bersamaan dengan input kode diskon) |
| Layar "Aplikasi Saya" di app klien | Fase A4 |
| `app_memberships` masih 0 baris | Fase A3 lanjutan (dibuat saat login app) |
| Portal mitra token (`/portal?t=`) | **Dihentikan 2026-11-04** — `/portal` & `/daftar` redirect ke `/akun`; `portal.astro` + `FormDaftar.astro` dihapus |

## 8. Verifikasi

```bash
# 1) Migrasi (dry-run lalu apply) — A1 fondasi, A2 dashboard
node supabase/apply-migration.js --ref=hhywrvedlwljawgxzpkq \
  --file=supabase/migration-account-kasol-fase-a1.sql --dry-run
node supabase/apply-migration.js --ref=hhywrvedlwljawgxzpkq \
  --file=supabase/migration-account-kasol-fase-a1.sql --apply
node supabase/apply-migration.js --ref=hhywrvedlwljawgxzpkq \
  --file=supabase/migration-account-kasol-fase-a2.sql --dry-run
node supabase/apply-migration.js --ref=hhywrvedlwljawgxzpkq \
  --file=supabase/migration-account-kasol-fase-a2.sql --apply
node supabase/apply-migration.js --ref=hhywrvedlwljawgxzpkq \
  --file=supabase/migration-account-kasol-fase-a3.sql --apply
node supabase/apply-migration.js --ref=hhywrvedlwljawgxzpkq \
  --file=supabase/migration-account-kasol-update-profile-v3.sql --apply

# 2) Edge Function
node supabase/deploy-account-functions.js --secrets

# 3) Uji endpoint
curl -s -X POST "$SUPABASE_URL/functions/v1/account-register" \
  -H "Content-Type: application/json" -H "apikey: $ANON_KEY" \
  -d '{"wa":"08123456789","pin":"123456","nama":"Uji Akun"}'

# 4) Browser (mitra dev)
npm --prefix mitra run dev   # http://localhost:13132/akun
```

## 9. Riwayat

| Tanggal | Perubahan |
|---|---|
| 2026-11-03 | Fase A1: migrasi resolver + 5 RPC akun, Edge Function `account-register`, halaman `/akun` di mitra, dokumen ini. Akun live: **11** (dari mitra & bridge klien), **0** tertaut sesi, **4** lisensi sudah berakun |
| 2026-11-04 | Bersih-bersih modul lama: `FormDaftar.astro` + `registerPartner()` dihapus (registrasi 100% lewat `/akun`); `/portal` dimigrasikan ke `/akun`, `portal.astro` dihapus. Kartu "Ajak Teman" di kaki5 (`referral.js`) + limiter `applyDiscount` dihapus karena tidak dipakai. Binding perangkat kaki5 lewat kode aktivasi HUB 🔗. |
| 2026-11-04 | **Fase A4**: login app klien + multi-role. Migrasi `migration-account-kasol-app-role-fase-a4.sql` (5 RPC `app_*`, role owner/manajer/kasir). kaki5: `js/account.js` + `js/account.ui.js` (kartu Akun & Peran, modal login WA+PIN, kelola pegawai), gerbang peran di `app.js`. |