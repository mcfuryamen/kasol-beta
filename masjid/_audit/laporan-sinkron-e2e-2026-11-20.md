# Laporan Uji Sinkron Cloud + Offline — Kasir Solo Masjid (browser sungguhan)

**Tanggal:** 20 November 2026
**Target:** `http://localhost:8095/adm/` (dev server `masjid/_dev-server.mjs`, port 8095)
**Metode:** Chrome DevTools MCP — klik nyata di UI + emulate offline, bukan hanya pemanggilan fungsi internal
**Akun uji:** fixture terisolasi `supabase/_qa-masjid-sync-e2e.mjs` → WA 628990020202, PIN 123456, slug `qa-sync-e2e`
**Server:** Supabase project `hhywrvedlwljawgxzpkq` (tabel `masjid_records` + RPC `masjid_sync_push`/`masjid_sync_pull`)

## Hasil: LULUS SEMUA (11/11 skenario) — 1 bug produksi ditemukan & diperbaiki

| # | Skenario | Hasil | Bukti |
|---|---|---|---|
| A | Gerbang login (perangkat bersih) | ✅ | Overlay "Masuk Akun Kasol" tampil, aplikasi di-inert, 2 tab Masuk/Daftar |
| B | Login akun QA | ✅ | Toast "Selamat datang 🎉", dashboard render, lisensi aktif (tanpa batas kuota) |
| C | Slug situs benar | ✅ | `HUB.slugAktif()` = `qa-sync-e2e` (bukan bawaan `masjid`), `situsDimuat()` = true, cache `ks_masjid_slug_v1` terisi |
| D | Sinkron otomatis setelah login | ✅ | Status "Tersimpan di awan", kursor `seq` maju 24 → 28, basis naik-perdana selesai untuk slug yang benar |
| E | Reload dengan sesi tersimpan | ✅ | Tanpa login ulang: slug benar, status "Tersimpan di awan", gerbang tidak muncul |
| F | Push transaksi baru | ✅ | Transaksi Rp12.345 "E2E-SYNC-2026-11-20" muncul di `masjid_records` (coll `kas`, `client_mt` jam asli) |
| G | Mode offline | ✅ | `navigator.onLine` = false, transaksi Rp54.321 "E2E-OFFLINE-2026-11-20" tersimpan lokal, antrean 1 op, status "Menunggu sinyal" |
| H | Koneksi hidup kembali | ✅ | Event `online` memicu putaran otomatis → antrean 0, status "Tersimpan di awan", record masuk awan |
| I | Perangkat baru (data lokal dihapus) | ✅ | Setelah `ksmasjid_db_v1` + kursor + basis dihapus: reload → 2 transaksi ditarik dari awan, saldo tampil Rp66.666 |
| J | Batas akses server | ✅ | RPC sinkron menolak peran bukan owner/manajer/kasir (`forbidden`), tabel `masjid_records` tetap RLS tanpa policy (hanya `service_role`) |
| K | Harness klien | ✅ | `node masjid/_audit/test-sync-klien.js` → 44 LULUS, 0 GAGAL (setelah perbaikan) |

## Bug produksi yang ditemukan & diperbaiki

**Gejala:** setelah login (atau reload dengan sesi tersimpan), kartu "☁️ Data di Awan" menampilkan **"Akun ini tidak berhak"** dan tidak ada data yang naik ke awan — padahal akun tersebut pemilik situsnya.

**Akar masalah (2 titik):**
1. `HUB.boot()` hanya memanggil `muatAkses()`, **tidak pernah** `muatSitus()` → `slugAktif()` jatuh ke slug bawaan `"masjid"`. Semua push/pull diarahkan ke situs milik orang lain/bukan milik akun → server menolak `forbidden`.
2. `Sync.mulai()` hanya menjadwalkan putaran pertama 3,5 detik setelah halaman dimuat. Karena login biasanya dilakukan belakangan, putaran pertama berjalan tanpa sesi ("Masuk akun dulu"), dan putaran berikutnya baru 4 menit kemudian (interval) atau saat tab dibuka lagi.

**Perbaikan (v1.5.8, `masjid/adm-masjid/app.js`):**
- `HUB.boot()` → tambah `await muatSitus()`; slug hasil server disimpan ke `DB.settings.pubSlug` dan `localStorage: ks_masjid_slug_v1`.
- `slugAktif()` memakai urutan: situs aktif dari server → `DB.settings.pubSlug` → cache localStorage → `"masjid"`.
- Modul `Sync` memanggil `siapkanSitus()` sebelum kirim & tarik; `HUB.situsDimuat()` menandai daftar situs sudah dimuat.
- `sinkronSetelahSiap()` (boot HUB → `Sync.sekarang()`) dipanggil dari `Gerbang.selesaiLogin()` dan dari `init()` setelah `Akun.boot()`.
- `sw.js` `CACHE_NAME` → `kasirsolo-masjid-v1.5.9` (aset app.js berubah), `CFG.version` → `1.5.8`.

**Catatan keamanan:** tidak ada kebocoran data antar-penyewa — cek peran tetap di server (`masjid_site_role`), jadi slug yang salah hanya menghasilkan penolakan, bukan pencurian data.

## Investigasi "regresi account-register" — hasil: TIDAK ADA REGRESI

Ditemukan dugaan bahwa Edge Function `account-register` rusak: RPC `account_prepare_identity` & `account_bind_auth_user` (grant `service_role`-only) "tidak terlihat" PostgREST → `PGRST202` → pendaftaran akun mati.

**Hasil: billingan awal itu SALAH. Pendaftaran di produksi BERJALAN NORMAL.**

### Bukti

1. **Skema cache**: OpenAPI `GET /rest/v1/` (Accept `application/openapi+json`) memuat **78 RPC**, termasuk `account_prepare_identity`, `account_bind_auth_user`, `account_attach_existing_licenses`, `account_ensure_referral_for_gid` — semuanya **grant `service_role`-only**. Grant tidak menyembunyikan fungsi dari schema cache.
2. **Mekanisme PGRST202 (terbukti)**: PGRST202 muncul bila **nama argumen meleset** dari signature — termasuk body `{}`.
   - `account_prepare_identity` body `{}` → 404 PGRST202.
   - `account_prepare_identity` body `{"p_wa":"1","p_nama":"x"}` → **HTTP 200** (balas `invalid_wa`).
   - `app_feature_gate` (grant anon!) body `{"app":"kaki5"}` → 404 PGRST202; body `{"p_app":"kaki5"}` → 200.
   → PGRST202 **bukan** diskriminator grant.
3. **Edge Function ter-deploy (uji langsung ke produksi)**, memakai WA yang sudah terdaftar penuh agar tidak ada data ditulis:
   - `OPTIONS` Origin diizinkan → 204 + `Access-Control-Allow-Origin` sesuai.
   - `OPTIONS` Origin asing → 204 tanpa ACAO.
   - `POST` Origin diizinkan → **409 `already_registered`** ⇒ RPC service_role jalan normal.
   - `POST` Origin asing → **403 `origin_not_allowed`** ⇒ guard Origin server-side sudah ter-deploy.
   - `POST` tanpa Origin (server-to-server, jalur Control) → 409 ⇒ jalur Control tetap boleh.
4. **Sapuan menyeluruh kode produksi** (4 app + Control + Edge Function, 139 file): **27/27 pemanggilan RPC cocok dengan signature live, 0 PGRST202**.

### Kesimpulan

Tidak ada perubahan grant maupun Edge Function yang perlu dilakukan. Edge Function yang ter-deploy sudah memuat guard Origin fail-closed dan jalur RPC-nya sehat. Hipotesis awal yang salah ("grant `service_role` ⇒ fungsi hilang dari schema cache") sudah dikoreksi di memori dan di catatan fixture QA.

**Catatan:** `has_function_privilege('authenticator', …)` bukan diskriminator visibilitas PostgREST (FALSE untuk hampir semua fungsi).

### Temuan tambahan: origin produksi masjid belum terdaftar di `account-register`

`adm-masjid` punya gerbang "Daftar" yang memanggil Edge Function `account-register`. Edge Function itu **fail-closed** (403 `origin_not_allowed` untuk origin tak terdaftar). Matriks origin live (diuji langsung ke Edge Function ter-deploy, WA yang sudah terdaftar ⇒ tanpa write):

| Origin | Hasil |
|---|---|
| `https://mitrabeta.vercel.app` | 409 diterima |
| `https://kq5beta.vercel.app` | 409 diterima |
| `https://rosok-beta.vercel.app` | 409 diterima |
| `https://mitra.kasirsolo.com` | 409 diterima |
| `https://kaki5.kasirsolo.com` | 409 diterima |
| `https://kasolmasjid.vercel.app` | **403 ditolak** |
| `https://adm-masjid-beta.vercel.app` | **403 ditolak** |
| `https://masjid.kasirsolo.com` | **403 ditolak** |
| `https://evil.example` | 403 ditolak (benar) |

**Dampak:** begitu `adm-masjid` di-deploy ke Vercel, tombol "Daftar" dari browser production akan **gagal 403** — daftar akun masjid belum bisa dipakai user production. Ini bukan regresi (app masjid belum pernah live), tapi ** prasyarat sebelum deploy.

**Status domain (diverifikasi 2026-11-20):**
- `masjid.kasirsolo.com` → **DNS tidak ada** ("DNS name does not exist").
- `kasolmasjid.vercel.app` & `adm-masjid-beta.vercel.app` → DNS resolve ke Vercel, tapi **HTTP 404** di `/` maupun `/adm/` ⇒ project Vercel belum ter-deploy (atau project tidak pernah dibuat).
- Konfirmasiethods: `xyzprojectabc-mcfury.vercel.app` juga 404 ⇒ ini memang indikasi project belum ada, bukan routing.

**Tindakan yang dibutuhkan sebelum deploy:** tambah origin produksi masjid ke `BASELINE_ORIGINS` di `supabase/functions/account-register/index.ts` (lalu deploy Edge Function itu). Alternatif: set env `ACCOUNT_CORS_ORIGIN` di Edge Function. Keduanya butuh keputusan owner karena menyangkut domain produksi yang belum ditetapkan.

## Verifikasi lain (regresi)

- `node --check masjid/adm-masjid/app.js` → OK
- `node masjid/_audit/test-sync-klien.js` → 44 LULUS / 0 GAGAL
- `node masjid/_audit/test-anon-http.js` → 33 LULUS / 0 GAGAL (anon tetap ditolak di 17 tabel + 7 RPC)
- `supabase/_test-masjid-sync.sql` (12 skenario, dry-run/rollback) → OK

## Jejak data uji

- Semua data uji memakai slug `qa-sync-e2e` + akun WA 628990020202 (fixture QA). Tidak ada data masjid live yang disentuh.
- Pembersihan: `node supabase/_qa-masjid-sync-e2e.mjs cleanup` (menghapus record, situs, token, lisensi, membership, outlet, identitas, dan auth user QA).
- App **belum di-deploy** ke Vercel — masih di workspace produksi `C:\Users\Admin\Documents\kasol`.

---

# Cek ulang independen (20 Nov 2026, sore)

Verifikasi ulang seluruh hasil kerja dari nol: file lokal, suite uji, dan state live di database.

## Suite lokal — semua hijau

| Uji | Hasil |
|---|---|
| `node --check app.js` | SYNTAX-OK |
| `node --check sw.js` | SYNTAX-OK |
| `test-sync-klien.js` | 44 LULUS / 0 GAGAL |
| `test-anon-http.js` | 33 LULUS / 0 GAGAL |
| `CFG.version` | `1.5.8` (app.js L38) |
| `sw.js CACHE_NAME` | `kasirsolo-masjid-v1.5.9` |
| Penanda fix v1.5.8 | `muatSitus` 8×, `slugAktif` 14×, `_situsAktif` 15×, `ks_masjid_slug_v1` 1×, `sinkronSetelahSiap` 4×, `siapkanSitus` 3× — semuanya ada |

## Live — P0/P1/P2/P3 terverifikasi ulang

- **P0** — grant `anon`/`authenticated`/`public` untuk `masjid_draft`, `partner_register`, `partner_my_balance` = **0 baris** (tidak ada).
- **RLS** — **0 tabel** di schema `public` tanpa `relrowsecurity`.
- **P1** — tabel `masjid_records`, `masjid_website_drafts`, `p3_arsip_referral` ada; RPC `masjid_my_draft`, `masjid_sync_push`, `masjid_sync_pull`, `masjid_sync_colls` ada.
- **P2** — 16 tabel diuji langsung lewat HTTP pakai anon key: **7 DITOLAK (401)**, **8 mengembalikan 200 tapi 0 baris** (RLS deny-all), **1 terbuka** = `masjid_website` (memang disengaja untuk situs publik).
- **P3** — `license_codes`: 11 `aktif` + **9 `dibatalkan`**; arsip `p3_arsip_referral`: **9 `kode_yatim` + 2 `dompet_kosong`**; `referral_wallets` tersisa 8.

## Koreksi terhadap laporan versi sebelumnya

Tiga klaim di laporan lama ternyata menyebut nama tabel yang salah. Data-nya sendiri benar, tapi tabelnya keliru:

1. **Kode referral P3 ada di `license_codes`, bukan `referral_partners`.** `referral_partners` (8 baris) semuanya `aktif` — tidak pernah disentuh P3. Tabel target ada di `migration-p3-repository-referral.sql:167` (`update public.license_codes lc`).
2. **Membership ada di `app_memberships`, bukan `outlet_memberships`.** Target backfill P3 = `app_memberships` (`migration-p3-backfill-membership.sql:106`). `outlet_memberships` adalah tabel lama yang tidak dipakai app.
3. **`masjid_records` berisi 15 baris, bukan 0.** Barsanya **data asli site demo `masjid`** (kas Rp700.000, 3 jamaah, pinjam Rp150.000, settings), dibuat saat smoke test 20 Nov 08:39 UTC — bukan sisa fixture. Fixture `qa-sync-e2e` benar-benar bersih (situs `qa-sync-e2e` tidak ada; hanya `masjid` yang terdaftar).

## Konfirmasi item keputusan owner (facts live, terbaru)

**P3(a) — varian nomor WA** (`global_identities`):

| WA | Nama | Status | Punya auth |
|---|---|---|---|
| 6282325103335 | amin | active | ya |
| 62823251033361 | mian | pending | tidak |
| 62823251033366 | amin maghfuri | active | ya |
| 628232510333666 | iman | pending | tidak |

**P3(b) — katalog**: `products` 10 baris; `visible=true` → kaki5, laundry, minimarket, retail, rosok; `visible=false` → bengkel, klinik, konveksi, **masjid**, tpa. MASJID belum diubah.

**P3(c) — owner tanpa lisensi** (`app_memberships`, `role='owner'`, lisensi=0):

| Membership | WA | Nama | Identitas | Membership |
|---|---|---|---|---|
| `dd0a97cd-ba33-423e-aae8-b3845a17678a` | 628232510333666 | iman | pending | kaki5 / active |
| `ec381f00-3656-4d4f-9a9a-5fda8aa3e2ed` | 628990010001 | QA Owner Gerbang | active | kaki5 / active |

Keduanya **belum** dihapus/suspend.

## Temuan tambahan dari cek ulang

- **Akses tabel sync hanya lewat RPC.** `masjid_records` & `masjid_website_drafts` punya RLS aktif **tan satu pun policy** → akses langsung anon ditolak 401; data hanya bisa dibaca lewat RPC `SECURITY DEFINER` yang memvalidasi kepemilikan. `masjid_sync_push` / `masjid_sync_pull` / `masjid_my_draft` / `masjid_my_sites` → `prosecdef=true`, grant ke `authenticated` + `service_role`. `masjid_sync_colls` → `prosecdef=false`, hanya `postgres`/`service_role` (sesuai).
- **`masjid_website` memang terbuka untuk publik** (policy `publik boleh baca website`, roles anon+authenticated, `using true`). Isinya: profil masjid (nama, WA, alamat, takmir), laporan keuangan (masuk/keluar + rincian), dan kegiatan. Ini persis data yang ditampilkan situs publik, jadi **tidak diubah** — tapi perlu diketahui owner bahwa angka keuangan masjid ikut publik.
- **Sisa grant "mati"**: 8 tabel (`outlet_memberships`, `outlets`, `orders`, `order_items`, `profiles`, `petty_cash`, `pos_products`, `loyalty_transactions`) masih punya grant `SELECT` untuk anon, tetapi policy-nya berbasis `auth.uid()`/`auth.role()` sehingga anon selalu 0 baris. P2 tidak mencabut grant di sini sesuai desainnya (tabel punya policy, jadi deemed "aktif"). Secara praktis aman; hanya rapuh kalau RLS suatu saat dimatikan.

## Prasyarat deploy — KOREKSI PENTING (21 Nov 2026)

**Klaim versi laporan ini sebelumnya ("app masjid belum pernah live / project belum ada") adalah SALAH.** Setelah dicek langsung ke API Vercel (token ada di `.env.local` root):

**Beta masjid SUDAH выпущен 20 Nov 2026 dan masih hidup.**

| Item | Nilai |
|---|---|
| Project Vercel | `masjid-beta` (`prj_i1KsXAEGk4uTqUTDIUGgcR5uHqln`) |
| Root directory | `masjid` |
| Link git | repo `kasol-beta` (mirror), branch `main` |
| Deployment | `dpl_8g8RZ79QtLrMWtbXrvPZTyDxx4U8` — READY / PROMOTED, target production |
| SHA yang dideploy | `279e92c` (= commit beta 20 Nov; isi app.js 334.680 B, sw.js v1.5.7) |
| Alias aktif | `masjid-beta-mcfury.vercel.app`, `masjid-beta-git-main-mcfury.vercel.app`, `masjid-beta-weld.vercel.app` |
| URL deployment | `masjid-beta-96l7ptjvn-mcfury.vercel.app` |
| Proteksi | project **terproteksi login Vercel** → tanpa login Vercel Pengunjung melihat halaman login, bukan app |

Tim Vercel punya 14 project: 8 beta (semua link ke mirror `kasol-beta`: control-beta, **masjid-beta**, kaki5beta, rosok-beta, mitrabeta, comp-beta, tpabeta, laundrybeta) + 6 produksi (link ke repo `kasol`: retail, shop, kaki5, rosok, control, tpa). **Belum ada project produksi untuk masjid** → masjid memang beta-only, sesuai target.

**Kenapa sempat salah menyimpulkan "belum ada"?** Nama project ≠ domain publik, dan endpoint yang dipakai (DNS + HTTP anonim) tidak memperlihatkan project yang terproteksi login. Karena itu `masjid-beta-mcfury.vercel.app` membalas **200 dengan halaman login Vercel**, bukan 404 — itu bukti deployment-nya ada, bukan bukti project tidak ada. Pelajaran: cek API Vercel (`/v9/projects`, `/v13/deployments`), bukan cuma probing URL publik.

### Yang MASIH perlu dikerjakan untuk beta versi terbaru

1. **Isi beta masih v1.5.7.** Fix slug + pemicu sinkron (**v1.5.8**), hardening P0–P3, dan sinkron cloud **belum ada di beta** — kodenya masih uncommitted di repo produksi.
2. **Origin beta belum masuk whitelist `account-register`.** Yang terdaftar sekarang: mitra, mitrabeta, localhost:13132, kaki5, kq5beta, localhost:8086, 127.0.0.1:8086. **Tidak ada `masjid-beta`** → tombol "Daftar" di admin masjid akan **403** saat dibuka dari origin beta.
3. **`products.visible` untuk MASJID masih `false`** → katalog tidak menampilkan produk Masjid (keputusan marketing owner).
4. Butuh **commit repo produksi + push ke mirror `kasol-beta`** agar Vercel auto-deploy versi terbaru — belum diizinkan (kebijakan: commit/push hanya atas perintah eksplisit owner).

Peronteks: `kasolmasjid.vercel.app` dan `adm-masjid-beta.vercel.app` memang **404 DEPLOYMENT_NOT_FOUND** karena project dengan nama itu memang tidak pernah dibuat — jangan dipakai sebagai acuan.
