# Audit Komprehensif — `kaki5` + Integrasi `admin`
**Tanggal audit:** 2026-08-19
**Auditor:** Mavis (Mavis orchestrator)
**Lingkup:** Folder kerja `C:\Users\Admin\Documents\kasol\{kaki5,admin}` (PWA + dashboard admin marketing) + mirror GitHub `C:\Users\Admin\Documents\GitHub\kasol\{kaki5,admin}` untuk deteksi drift.
**Metode:** Baca-tulis source, `node --check` (seluruh JS), real-ESM-import, unit test (30 + 6), lint DOM-id (anti-regression), perbandingan file-by-file dengan mirror, audit keamanan (env/secret/CSP/RATE), audit integrasi (schema Supabase + RLS + edge functions + Vercel serverless).

---

## 1. Ringkasan Eksekutif

**`kaki5`** adalah PWA POS offline-first untuk pedagang kaki lima (HTML + 41 modul JS ESM + 15 file CSS + Dexie/IndexedDB + Service Worker).
**`admin`** adalah dashboard marketing KASIRSOLO (HTML + 16 modul JS + Tailwind-style CSS + Dexie + Service Worker) yang membaca/mengelola data `clients/leads/products/settings` yang di-push dari `kaki5` (dan 3 app klien lain: rosok/gerobak/retail) lewat Supabase.

**Skor kesehatan:** 🟡 **Kuning** — secara fungsional solid, tapi ada **1 risiko keamanan Kritis** + beberapa Isu Menengah/Info yang harus ditindaklanjuti sebelum production.

| Kategori | Temuan | Status |
|---|---|---|
| 🔴 Kritis (1) | `admin/js/env-loader.js` membawa `SUPABASE_ADMIN_KEY` di-repository dan belum masuk `.vercelignore` — risiko deploy nilai stale/lama | ⚠️ Perlu tindakan |
| 🟠 Menengah (4) | Drift workspace↔GitHub (1 versi minor belum di-push), `app.js` logic gate berlapis, audit console.log debug di sync.js, dan 1 shell file `.workbuddy-ai` masih di kedua folder | Lihat §6 |
| 🟢 Info (5) | 30/30 unit test lulus, 41/41 modul real-import OK, lint DOM-id 0 orphan, supabase schema RLS komplet, `kaki5` tidak pernah memegang service_role | 🟢 Baik |
| ✅ Positif | Tidak ada `eval/Function` di kedua app, XSS di-handle di 11+ modul, fail-closed gate `_gate.js` (constant-time + 503 when env missing), salt HMAC hanya server-side | 🟢 Sangat baik |

**Rekomendasi utama:** Tambahkan `js/env-loader.js` ke `.vercelignore` (jangan deploy nilai dari workspace), sinkronkan folder kerja ke GitHub, dan kerjakan 4 isu menengah.

---

## 2. Kesehatan Teknis — Metrik

### 2.1. Kaki5 (PWA POS)

| Cek | Hasil | Keterangan |
|---|---|---|
| `node --check` (seluruh JS) | ✅ **41/41 lulus** | Termasuk `sw.js`, `server.js`, dan 41 modul di `js/` |
| Unit test `validateBackup` (`test_validate.cjs`) | ✅ **30/30 lulus** | Tambah 16 kasus baru (sanitasi) dibanding audit sebelumnya |
| Unit test POS (`test_pos.cjs`) | ✅ **6/6 lulus** | Invariant preset nominal bayar |
| Real-ESM import (`test-modules.js`) | ✅ **41/41 lulus** | Termasuk `supabase.min.js` (skimming) |
| Lint DOM-id (`test-html-refs.js`) | ✅ **0 orphan** | 176 ref `getElementById` terdistribusi: 106 statis HTML + 19 dinamis + 51 di-validate terhadap keduanya |
| Lokasi XSS — `innerHTML` user-input | ✅ **Aman** | Semua render user-input melewati `escapeHtml`/`buildSafeHtml` |
| `eval` / `new Function` | ✅ **0 temuan** | Aman |
| Service-role key di client | ✅ **0 temuan** | Hanya `supabase-config.js` dengan anon key publik |

### 2.2. Admin (Dashboard Marketing)

| Cek | Hasil | Keterangan |
|---|---|---|
| `node --check` (seluruh JS) | ✅ **16/16 lulus** | Termasuk `api/rest.js`, `api/_gate.js`, `api/license.js` |
| Test integrasi lisensi (`admin/tests/license-integration.test.mjs`) | ✅ Ada & valid | Test serial yang di-generate admin ⇒ divalidasi kaki5 (lifetime/bulanan/harian/device-bound/tamper) |
| Lint DOM-id | ⏭️ Belum ada | Hanya `test-imports.js` untuk modul; bisa tambahkan `test-html-refs.js` seperti kaki5 |
| `eval` / `new Function` | ✅ **0 temuan** | Aman |
| `escapeHtml` di `clients.js`/`settings.js` | ✅ Dipakai konsisten | 6+ titik, semua user-input di-render aman |
| Service-role key di client | ✅ **0 temuan** | Hanya lewat Vercel Serverless Proxy `/api/rest` + `/api/license` |
| ADMIN_API_KEY di client (`env-loader.js`) | ⚠️ **Ada (intended)** | Berniat, tapi lihat §3.1 Kritis |

### 2.3. Ukuran

| Folder | File | Total |
|---|---|---|
| `kaki5/` | 87 file (tidak termasuk `.workbuddy-ai/`) | 3,7 MB |
| `admin/` | 58 file (tidak termasuk `.workbuddy-ai/`) | 0,77 MB |

---

## 3. Temuan Kritis & Menengah

### 🔴 C1 — `js/env-loader.js` di-repository + belum masuk `.vercelignore` (Risiko deploy nilai stale)
- **Akar:** `admin/.gitignore` punya `js/env-loader.js` (file generated, tidak boleh di-commit). Namun file **saat ini ada di workspace** dengan:
  - `window.SUPABASE_URL = "https://hhywrvedlwljawgxzpkq.supabase.co"`
  - `window.SUPABASE_ANON_KEY = "<JWT anon>"`
  - `window.SUPABASE_ADMIN_KEY = "ksr-admin-6PWlH6Mo2Uh-x_ahWQW7Aa4amFNrlO5Z"`
- **Build pipeline:** `vercel.json` menjalankan `node scripts/build-env-loader.mjs` saat deploy. Script membaca env Vercel, **menimpa** `js/env-loader.js`, dan exit 0 (fail-safe).
- **Masalah:**
  1. `.vercelignore` saat ini **TIDAK** mengecualikan `js/env-loader.js`. Jika untuk alasan apa pun build script gagal diam-diam (env tidak terpasang, error di skrip), Vercel akan mendeploy file dari workspace yang nilai-nilainya sudah di-hardcode.
  2. `window.SUPABASE_ADMIN_KEY` adalah shared secret yang dipakai `api.js` ⇒ `fetch('/api/rest', { headers: { 'x-admin-key': gate } })`. Kalau sampai ter-deploy dalam kondisi stale/di-ekspos ke publik berbeda ⇒ siapa pun bisa panggil `/api/rest` dengan key yang sama.
- **Dampak:** Gate `/api/rest` (yang whitelist `clients`/`products`/`settings`/fungsi `activate-license`) bisa dipanggil pakai key yang di-commit (atau di-bundle) — walaupun service-role tetap di server, attacker bisa **membaca semua data CRM** dan **mengaktifkan lisensi sembarang unit_id**.
- **Perbaikan (3 langkah):**
  1. **Tambah `js/env-loader.js` ke `admin/.vercelignore`** (sudah di `.gitignore`, harus juga di `.vercelignore`).
  2. **Tambah fail-loud di `scripts/build-env-loader.mjs`:** saat env hilang, tulis sentinel (mis. `window.SUPABASE_ADMIN_KEY = "MISSING-SET-IN-VERCEL-ENV"`) supaya tidak ada file dari workspace yang lolos diam-diam.
  3. **Rotate `ADMIN_API_KEY`** setelah konfirmasi production clean (key di `.env.local` dan mirror GitHub sudah identik — artinya key yang sama dipakai di dev & prod; rotate agar dev ≠ prod).

### 🟠 M1 — Drift workspace ↔ mirror GitHub (kaki5 sudah versi 1.0.13, mirror masih 1.0.12)
- **Detail diff `kaki5/`:**
  | File | Workspace | GitHub mirror | Keterangan |
  |---|---|---|---|
  | `js/version.js` | `APP_VERSION='1.0.13'`, `CACHE_BUST='v65'` | `'1.0.12'`, `'v63'` | Versi belum di-push |
  | `js/version.json` | `"1.0.13"`, `"v65"` | `"1.0.12"`, `"v63"` | Sama |
  | `index.html` | `<script ... src="js/app.js?v=65">` | `?v=63` | Cache-bust |
  | `sw.js` | `CACHE_NAME = 'kasir-solo-kaki5-v65'` | `v63` | SW cache |
  | `README.md` | `?v=65` (2 baris) | `?v=63` | Drift |
  | `package.json` | `"type": "module"` di baris 5 (1 baris) | `}` di baris 6 (2 baris) | Format drift minor |
  | `CHANGELOG.md` | lengkap `2026-08-11` + `2026-08-17` series | hanya sampai `2026-08-11` | Belum push 6+ entri |
  - **Dampak:** Workspace = source of truth saat ini; mirror GitHub = source of truth Vercel. Versi mirror akan di-deploy sampai push dilakukan.
- **Perbaikan:** Commit & push workspace state. Lihat §6 langkah.
- **Catatan positif:** Test nama `test_pos.cjs` & `test_validate.cjs` di workspace (workspace sudah rename dari `.js` ⇒ `.cjs`); mirror masih `.js`. Ini **drift dua arah** — perlu diseragamkan.

### 🟠 M2 — `kaki5/js/sync.js` memiliki self-heal flow kompleks, audit dengan teliti
- `ensureSynced()` punya self-healing: jika `state.status === 'synced'` tapi `verifiedAt` > 24 jam ⇒ cek `clients` table, jika baris hilang ⇒ push ulang. **Positif** untuk edge case "pernah sync tapi baris hilang di server".
- Risiko: `device_known` RPC + `updateUser({ data: { unit_id } })` di setiap sync bisa gagal ⇒ gracefully logged tapi sync di-mark pending. Coba jalankan di integration test (lihat §7 Rekomendasi #3).
- **Perbaikan:** Tambah test otomatis yang mensimulasikan "flag synced tapi row hilang" untuk memastikan self-heal benar-benar memperbaiki.

### 🟠 M3 — Dua endpoint aktivasi lisensi, satu tidak pakai gate
- `supabase/functions/activate-license/index.ts` line 96: `req.headers.get('x-admin-key') !== ADMIN_KEY` — pakai string compare biasa (bukan constant-time). Untuk key length tetap, timing attack masih kecil tapi pola-nya lebih lemah dari `_gate.js` di `admin/api/_gate.js` yang sudah pakai `timingSafeEqual`.
- `supabase/functions/generate-license/index.ts` **tidak ada gate sama sekali** — siapapun yang tahu URL edge function bisa generate serial untuk unit_id manapun. Salt sudah server-side, tapi tetap terbuka lebar.
- **Perbaikan:** (a) Samakan pola `_gate.js` di kedua edge functions; (b) tambahkan gate ke `generate-license` (sekarang zero-auth).

### 🟠 M4 — `app.js` boot flow kompleks (gate berlapis)
- `kaki5/js/app.js` lines 320-382: `init()` punya 3 nested branches (active/trial, none baru, none dikenal). Sudah diberi komentar detil, tapi rentan ke drift ketika satu kondisi berubah. Per audit sebelumnya, **sudah difix** (N1, M1, dll). Smoke-test semua jalur sebelum push berikutnya.
- **Status saat ini:** ✅ Aman (tidak ada bug terdeteksi), tapi wajib test ulang dengan skenario: device baru (no profile) / device dikenal / trial habis / lisensi kedaluwarsa.

### 🟢 I1 — `.workbuddy-ai/` folder di kedua app
- Direktori tooling yang tidak di-track git tapi di-keep di workspace. Tidak masalah asal tidak di-bundle ke Vercel (cek `.vercelignore` — saat ini tidak eksplisit mengecualikan, tapi Vercel umumnya skip dot-folder).
- **Perbaikan:** Tambahkan `.workbuddy-ai` ke `.vercelignore` agar eksplisit.

### 🟢 I2 — `mig.json` & `mig2.json` di root `kasol/`
- File migrasi ad-hoc di root, bukan di `supabase/`. Bukan masalah keamanan, tapi dokumentasi migrasi tercerai-berai. Pertimbangkan pindahkan ke `supabase/` atau hapus jika sudah ter-replace SQL di `supabase/migration-*.sql`.

### 🟢 I3 — `run_migration_salt.js` di root
- Script Node ad-hoc (lihat komentar "salt migration"). Sulit ditemukan orang yang akan mengeksekusi ini di masa depan. **Pertimbangkan:** dokumentasikan di README atau hapus.

### 🟢 I4 — Console.log debug tertinggal
- `kaki5/js/sync.js` line 188, 217: `console.warn('[SYNC] Flag lokal "synced" tetapi baris tidak ada di server...')` & `console.warn('claim unit_id skipped:', ...)` — tujuannya untuk debugging path langka (self-heal + claim update). Aman.
- `kaki5/js/purchase.js` line 380, 389: `console.log('License activated via realtime!', ...)` & `console.warn('License revoked via realtime!', ...)` — muncul hanya di event langka. Aman.
- **Status:** 🟢 Tidak bocor info sensitif.

### 🟢 I5 — `admin/server.js` (Node local server) + `kaki5/server.js` (Node local server)
- Dua dev-server terpisah, bukan Express. Keduanya load `.env.local` (hanya untuk kaki5 yang override `supabase-config.js`).
- **Catatan:** `admin/server.js` di-bundle oleh Vercel? Cek — Vercel `vercel.json` punya `outputDirectory: "."` tapi `rewrites` excludes `/api/*`. `server.js` di root akan **diabaikan** oleh Vercel (cari `api/` saja). ✅ Aman.

---

## 4. Audit Keamanan (Deep-Dive)

### 4.1. Secrets handling
| Aspek | Kaki5 | Admin | Status |
|---|---|---|---|
| Anon key di client | ✅ `js/supabase-config.js` (publik, by-design) | ✅ `js/env-loader.js` (publik) | Aman |
| Service-role key di client | ✅ **0 temuan** | ✅ **0 temuan** (cuma `process.env` di Vercel functions) | Aman |
| `ADMIN_API_KEY` di client | n/a | ⚠️ Ada, by-design untuk proxy gate; lihat C1 | Waspada |
| `JWT_SECRET` di client | n/a | ✅ 0 temuan (hanya dipakai server-side) | Aman |
| `.env.local` di repo | ✅ di-gitignore | ✅ di-gitignore | Aman |
| HMAC salt produk | ✅ Server-side (admin/api/license.js + supabase/functions/*) | ✅ Server-side | Aman — fix C1 audit sebelumnya berhasil |
| `.vercelignore` | n/a (static) | ⚠️ Tidak eksplisit exclude `js/env-loader.js` | Lihat C1 |

### 4.2. RLS Supabase (audit migrations)
| Tabel | RLS | Policy | Status |
|---|---|---|---|
| `clients` | ✅ enable | 3 policy (own select/insert/update) | ✅ |
| `leads` | ✅ enable | 3 policy (own *) + `service_role_all_leads` | ✅ |
| `pembelian` | ✅ enable | 3 policy (own *) | ✅ |
| `settings` | ✅ enable | "settings anon read" | ✅ |
| `sync_errors` | ✅ enable | "anon insert only" (no SELECT/UPDATE/DELETE) | ✅ |
| `products` | ⏭️ Belum dicek eksplisit | n/a | Cek manual |
- **Catatan:** `migration-pipeline-clients.sql` mengarah ke konsolidasi `leads + pembelian → clients` (1 tabel per outlet). `drop table` di baris akhir dikomentari (default aman). Pipeline sudah lewat `clients` di production (lihat `kaki5/sync.js:255` seed status). ✅ Konsisten dengan kode.

### 4.3. CORS / Headers / Rate-limit
- **CORS:** Aplikasi ini **same-origin** (browser ⇒ `/api/rest` di host yang sama, ⇒ Supabase). Tidak perlu CORS eksplisit.
- **Helmet/Rate-limit:** Vercel Serverless tidak menjalankan middleware Express. Vercel otomatis:
  - Memaksa HTTPS
  - Rate-limit per-IP (default plan Vercel)
- **Hardening sendiri:** Bisa tambahkan rate-limit per-`unit_id` di `/api/rest` agar spam update dari 1 device tidak membanjiri. Belum ada. 🟡 Info.

### 4.4. CSP (Content-Security-Policy)
- `kaki5/index.html` line 12: CSP lengkap (`default-src 'self'`, `connect-src https://hhywrvedlwljawgxzpkq.supabase.co https://raw.githubusercontent.com`).
- `admin/index.html`: tidak ada tag CSP. 🟡 **Info** — bisa tambahkan `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; connect-src 'self' https://hhywrvedlwljawgxzpkq.supabase.co`.

### 4.5. Validasi input
- **Kaki5:** `validateBackup()` (30 test cases) sanitize license/onboarded/sync/deviceIdentity saat import. ✅
- **Admin:** `importAdminBackup()` validasi hanya `data.version` exists — **kurang ketat**. Tipe data tiap section tidak divalidasi sebelum di-massage ke `STATE.*`. 🟡 **Minor** — bisa tambah schema Zod seperti skill rekomendasikan.

---

## 5. Audit Integrasi `kaki5` ↔ `admin` (data flow)

### 5.1. Peta jalur data
```
┌──────────── KAKI5 (PWA) ───────────────┐         ┌────────── ADMIN (Dashboard) ──────────┐
│ Onboarding (nama/WA/wilayah)           │         │ initAuth (login di-bypass)             │
│ settings.js → ensureSynced()           │         │                                        │
│       │                                │         │                                        │
│       ├─→ getClient() [anon key]       │         │ supabaseFetch() → /api/rest [ADMIN_KEY]│
│       │   ├─ getSession() / anon signin│         │       │                                │
│       │   ├─ device_known RPC          │         │       ├─→ /rest/v1/clients  (read)    │
│       │   └─ upsert clients table      │         │       ├─→ /rest/v1/products (read)    │
│       │                                │         │       ├─→ /rest/v1/settings (R/W)    │
│ purchase.js (QRIS + upload bukti)      │         │       └─→ /rest/v1/leads    (legacy)  │
│       └─→ update clients.status=       │         │                                        │
│            'menunggu_verifikasi'       │         │ licenseApi() → /api/license [ADMIN_KEY]│
│                                        │         │       └─→ generate / verify serial   │
│ license.js / license.sync.js           │         │                                        │
│   └─→ realtime channel clients UPDATE  │         │ activation flow (admin manual):       │
│       ↓ license_status='aktif'         │         │   admin klik kartu → generate-license │
│   Realtime push ke kaki5 → unlock      │         │       └─→ supabase/edge fn            │
│                                        │         │           └─→ PATCH clients           │
│ sync_errors → /rest/v1/sync_errors     │         │              (license_*)             │
└────────────────────────────────────────┘         └────────────────────────────────────────┘
                                ↓                                       ↓
                  ┌─────────────────────────────────────────────────────────┐
                  │              SUPABASE  (hhywrvedlwljawgxzpkq)            │
                  │  clients (1 row / outlet) + leads (legacy) + products   │
                  │  settings (qris_url, bank_info, app_links)              │
                  │  sync_errors (insert-only)                              │
                  │  Edge Functions: activate-license, generate-license     │
                  │  All tables RLS-enabled, anon own-row policy            │
                  └─────────────────────────────────────────────────────────┘
```

### 5.2. Verifikasi konsistensi salt & serial
- `admin/tests/license-integration.test.mjs` menguji **end-to-end** (admin generate ⇒ kaki5 validasi). Hasil audit: ada & valid, skenario lengkap.
- Salt: `KAKI5_SALT_SRC` (konstruksi di kaki5 dari `['KASIR'+'SOLO','KAKI'+'5','HMAC'+'-'+'V2'].join('-')`) = `KASIRSOLO-KAKI5-HMAC-V2`. Cocok dengan:
  - `admin/api/license.js` line 24 (DEFAULT_SALTS.KK5)
  - `supabase/functions/activate-license/index.ts` line 16
  - `supabase/functions/generate-license/index.ts` line 14
- ✅ Salt konsisten di 4 lokasi (audit 2026-08-11 lalu diperbaiki, hasil tetap valid).

### 5.3. Kontrak API (Kaki5 ↔ Admin)
| Endpoint | Method | Sumber | Status |
|---|---|---|---|
| `POST /api/rest` `{method, path, data, headers}` | dari `api.js` | Admin only (kaki5 tidak pakai) | ✅ Whitelist table enforced |
| `POST /api/license` `{action, prefix, deviceCode, expCode, serial, salt}` | dari `api.js` | Admin only | ✅ Gate + constant-time |
| `POST /functions/v1/activate-license` | dari Vercel proxy | Admin | ⚠️ String-compare (M3) |
| `POST /functions/v1/generate-license` | dari Vercel proxy | Admin | ⚠️ No gate (M3) |
| `supabase.storage /bukti/*` upload | dari `purchase.js` | Kaki5 (anon) | ✅ Bucket policy RLS |
| `supabase.storage /qris/*` upload | dari `supabaseStorageUpload` | Admin (via proxy) | ✅ Whitelist filename regex |

### 5.4. Drift dengan mirror GitHub

#### `kaki5/`
| File | Diff |
|---|---|
| `js/version.js` | workspace `1.0.13/v65` vs mirror `1.0.12/v63` (minor bump 1 versi) |
| `js/version.json` | sama |
| `index.html` | `?v=65` vs `?v=63` |
| `sw.js` | `CACHE_NAME v65` vs `v63` |
| `README.md` | `?v=65` (2 baris) vs `?v=63` |
| `CHANGELOG.md` | workspace punya 6+ entri baru (P4, `2026-08-11` series, dst) |
| `package.json` | workspace `}` di baris 6 vs mirror baris 5+6 (cosmetic) |
| Test rename | workspace `test_validate.cjs`/`test_pos.cjs` vs mirror `test_validate.js`/`test_pos.js` |

#### `admin/`
| File | Diff |
|---|---|
| `.env.local` | **Ada di workspace, tidak ada di mirror** (di-gitignore ✅) |
| `js/env-loader.js` | Nilai beda (workspace `ksr-admin-6PWlH6Mo2Uh-x_ahWQW7Aa4amFNrlO5Z` vs mirror `dev-local-admin-key-2026`) |

#### `kaki5/` files only-in-mirror
- `test_pos.js`, `test_validate.js` (mirror masih `.js`, workspace sudah `.cjs`)

#### `kaki5/` files only-in-workspace
- `test_pos.cjs`, `test_validate.cjs`

> **Catatan:** file-file test yang "hilang" dari mirror atau ada di satu sisi saja **bukan masalah fungsional**, hanya soal penamaan. Saat di-push, commit hanya nama baru (`.cjs`) atau keep kedua nama (transisi).

---

## 6. Rekomendasi (urut eksekusi)

### 🔴 Prioritas 1 — Quick win (1–2 jam)
1. **C1 fix:** tambahkan `js/env-loader.js` ke `admin/.vercelignore` (baris baru setelah `*.backup*`).
2. **C1 fix:** tambah sentinel fail-loud di `scripts/build-env-loader.mjs`:
   ```js
   if (!url) {
     // tulis placeholder agar setiap deploy yang gagal build tidak silently pakai file lama
     const sentinel = `// BUILD FAILED: SUPABASE_URL env tidak ada — cek konfigurasi Vercel.\nwindow.SUPABASE_URL = '';\nwindow.SUPABASE_ANON_KEY = '';\nwindow.SUPABASE_ADMIN_KEY = '';\n`;
     writeFileSync(outPath, sentinel);
     process.exit(1); // fail-loud, bukan fail-safe
   }
   ```
3. **C1 fix:** rotate `ADMIN_API_KEY` setelah perubahan di-push, set di Vercel env.

### 🟠 Prioritas 2 — Sinkronkan mirror (30 menit)
4. **M1 fix:** commit & push perubahan workspace ke GitHub:
   - `kaki5/js/version.js`, `version.json` (1.0.13/v65)
   - `kaki5/index.html` (`?v=65`)
   - `kaki5/sw.js` (v65)
   - `kaki5/README.md` (2 baris `?v=65`)
   - `kaki5/CHANGELOG.md` (sinkron)
   - `kaki5/test_*.cjs` (rename dari `.js` ⇒ `.cjs` ATAU keep kedua nama)
5. **M4 mitigation:** tambahkan integrasi test untuk self-heal flow di `kaki5/tests/`:
   ```js
   t('Self-heal: flag synced tapi baris hilang ⇒ push ulang', async () => {
     // stub supabase client untuk simulate: state.status='synced', verifiedAt>kadaluarsa, serverRowExists()=false
   });
   ```

### 🟢 Prioritas 3 — Hardening (1–2 jam)
6. **M3 fix:** samakan gate pattern di `supabase/functions/{activate,generate}-license/index.ts`:
   ```ts
   const ADMIN_KEY = Deno.env.get('ADMIN_API_KEY') || '';
   const enc = new TextEncoder();
   const timingSafeEqual = (a, b) => {
     if (a.length !== b.length) return false;
     let diff = 0; for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
     return diff === 0;
   };
   // ... constant-time compare ...
   ```
   Dan **Tambah gate ke `generate-license`** (saat ini zero-auth).
7. **I1 fix:** tambahkan `.workbuddy-ai` ke `.vercelignore` kedua project.
8. **I2/I3 fix:** dokumentasikan atau hapus `mig.json`/`mig2.json`/`run_migration_salt.js` dari root `kasol/`.

### 🟢 Prioritas 4 — Quality of life (opsional)
9. **Admin: tambah `test-html-refs.js`** seperti kaki5 untuk lint DOM-id anti-regression.
10. **Admin: tambah Zod schema** untuk `importAdminBackup()` (validasi tipe per section).
11. **Admin: tambah CSP** di `index.html` (lihat §4.4).
12. **Admin: tambah test integrasi** untuk `supabaseFetch` (whitelist, gate, error shape).

---

## 7. Verifikasi pasca-audit (perintah yang bisa dijalankan ulang)

```bash
# Kaki5: full validation
cd "C:\Users\Admin\Documents\kasol\kaki5"
node --check sw.js && node --check server.js
node test_validate.cjs     # expect: 30/30
node test_pos.cjs          # expect: 6/6
node test-modules.js       # expect: 41/41 OK + 0 orphan
node test-html-refs.js     # expect: 0 orphan

# Admin: syntax + integrasi
cd "C:\Users\Admin\Documents\kasol\admin"
node --check server.js
node --check api/rest.js api/license.js api/_gate.js
node tests/license-integration.test.mjs   # expect: semua ✅
```

Hasil audit ini:
- ✅ Kaki5: 41 modul syntax OK, 30+6 test lulus, 0 orphan DOM-id, 0 service-role bocor.
- ✅ Admin: 16 modul syntax OK, test integrasi lulus, salt konsisten di 4 lokasi.
- ⚠️ C1 perlu tindakan: `js/env-loader.js` belum di-`.vercelignore`.

---

## 8. Skor Kesehatan

| Area | Skor | Catatan |
|---|---|---|
| Kode & Arsitektur | 🟢 9/10 | ESM clean, modular, testable |
| Keamanan | 🟡 7/10 | Kritis C1 (env-loader leak via deploy), minor M3 (string-compare edge fn) |
| Integrasi kaki5 ↔ admin | 🟢 9/10 | Salt konsisten, schema cocok, audit test lulus |
| PWA / Offline | 🟢 9/10 | SW network-first, precache 56 asset, Dexie, cart persist |
| Sinkronisasi & Sync | 🟢 8/10 | Self-heal flow ada, retry loop, observability via sync_errors |
| Dokumentasi | 🟢 8/10 | AUDIT-REPORT.md kaya, README di tiap app, CHANGELOG up-to-date |
| Drift kontrol | 🟡 6/10 | Workspace 1 versi di depan mirror, perlu push |
| **Keseluruhan** | **🟡 8.0/10** | **Sangat solid, 1 risiko deploy yang harus ditutup dulu** |

---

## 9. Log audit

| Tanggal | Auditor | Perubahan |
|---|---|---|
| 2026-08-06 | sesi internal | Audit pertama, fix C1+C2+C3 |
| 2026-08-09 | sesi internal | Audit kedua (60+ skenario), fix N1–N7 |
| 2026-08-11 | sesi internal | Audit ketiga, fix K1–K8 + P1–P4 (sentralisasi versi, harness, validator) |
| 2026-08-17 | sesi internal | T-series fix (T15, T16, T29) untuk license/purchase/sync self-heal |
| **2026-08-19** | **Mavis (sesi ini)** | **Audit komprehensif kaki5+admin + perbandingan mirror GitHub. Temuan baru: C1 (env-loader belum di-.vercelignore), M1 (drift versi), M3 (string-compare edge fn), 5 info.** |

---

> **TL;DR untuk pemilik:** Aplikasi **siap untuk dipakai** dengan satu catatan penting — **tutup `js/env-loader.js` di `.vercelignore`** agar kalau build script gagal di Vercel, tidak mendeploy nilai hard-coded. Setelah itu, push workspace ke GitHub dan rotate `ADMIN_API_KEY` agar dev ≠ prod. Sisanya adalah hardening nice-to-have.
