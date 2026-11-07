# ADR — Hub Kasol: Akun Utama & Lisensi Berbasi Akun

> **Status:** Fase 0 selesai & ter-apply ke project `hhywrvedlwljawgxzpkq` (2026-10-20).
> Fase 1–3 = rencana, belum dieksekusi.
> **Pemilik keputusan:** McFury. Tanggal keputusan: 2026-10-20.
> Dokumen ini adalah **referensi proyek** — dibaca bersama `../CONTEXT.md` dan `../CLOUD-ROADMAP.md`.

---

## 1. Masalah yang diselesaikan

Hari ini **tidak ada entitas "akun"** di ekosistem Kasol. Atom terkecil di seluruh sistem adalah
`unit_id` = 1 baris `clients` = 1 outlet × 1 perangkat × 1 aplikasi.

Konsekuensinya:

- Satu orang yang punya 3 aplikasi = **3 baris terpisah**, tidak ada yang menghubungkan mereka.
- Admin di Control Center **tidak bisa melihat** "WA ini punya 3 app" → upsell/bundle mustahil.
- "Pindah perangkat" = kerja manual admin (`reassignClientUnit` di `control/js/clients.js:359`).
- Tidak ada login lintas aplikasi sama sekali.

## 2. Keputusan

> **Satu akun utama (Gmail-like) untuk login ke banyak aplikasi, TAPI lisensi tetap terpisah
> per aplikasi. Lisensi dimiliki oleh identitas profil akun; klien bebas pindah perangkat;
> jatahnya satu perangkat per aplikasi, kecuali memilih paket multi-perangkat.**

Model ini memakai **tiga sumbu yang sengaja dipisah**:

| Sumbu | Pertanyaan | Entitas | Sumber kebenaran |
|---|---|---|---|
| **WHO** | Siapa kamu? | `global_identities` | Supabase Auth + session JWT claim `gid` |
| **APA** | Kamu boleh akses apa? | `app_memberships` | membership per-aplikasi, role per-aplikasi |
| **MAYA** | Apakah hak itu aktif komersial? | `licenses` + `license_devices` | `clients`/`licenses` + HMAC salt per produk |

**Pemisahan ini bukan sekadar estetika.** Kalau lisensi ikut jadi properti akun, tiga hal rusak:

1. **Lisensi kedaluwarsa ≠ kehilangan data.** Data transaksi tinggal di Dexie perangkat, bukan di
   cloud (`CONTEXT.md` → Lapisan C). Lisensi yang bergantung pada status akun = provider
   memblacklist data bisnis user sendiri.
2. **Offline-first jadi musnah.** Gate lisensi wajib bisa diverifikasi HMAC lokal tanpa internet
   (`CONTEXT.md` → "Operasional = offline total"). Login ke Hub di tengah gate = user rural
   kehilangan aplikasi.
3. **Blast radius beda.** Revoke lisensi 1 app (mis. refund) tidak boleh mencabut seluruh akun.

## 3. Analogi yang dipakai (dan batasnya)

| Google | Kasol | Catatan |
|---|---|---|
| Google Account | `global_identities` | Satu kredensial, banyak layanan |
| Google Workspace | `owner_units` *(nanti)* | Satu akun, banyak unit/outlet |
| Drive / Photos / Gmail | kaki5 / rosok / minimarket | Masing-masing punya langganan sendiri |
| Google One (Drive 2TB) | paket `multi-perangkat` | Upgrade per layanan |

**Yang sering keliru dan wajib dijaga:** di Google, satu akun **tidak otomatis** memberi akses ke
semua layanan. Tiap layanan mengevaluasi entitlement-nya sendiri. Persis yang dikehendaki di sini.

**Role TIDAK global.** `tpa/IDENTITY-CONTRACT.md:64` sudah menetapkan: *"Role adalah role
aplikasi, bukan role global."* Membership `owner` di KasirSolo tidak memberi akses ke TPA.
Hub memegang identitas + entitlement; tiap aplikasi memegang role & izin sendiri.

---

## 4. Yang TIDAK berubah (dan ini penting)

**Seluruh mesin lisensi per-aplikasi tetap utuh.** Tidak ada versioning format serial, tidak ada
salt baru, tidak ada breaking change pada klien yang sudah jalan.

`control/js/license-core.js:109-125`:

```js
export async function generateSerial(prefix, salt, deviceCodeRaw, expCode) {
  const deviceCode = normalizeDeviceCode(deviceCodeRaw);
  const sig = await hmacSignature(salt, d1 + d2 + expCode);  // payload = deviceCode + expiry
  return `${prefix}-${d1}-${d2}-${expCode}-${sig}`;
}
```

Serial = `f(produk, device, expiry)`. **Tidak ada `licenseId` / `accountId` di dalam kripto** →
link "serial → lisensi" bisa murni di database. Server tinggal **mint serial baru** untuk perangkat
baru (salt-nya di server) lalu arahkan lisensi ke serial itu.

- `control/js/license-core.js` — **TIDAK BERUBAH**
- `kasol/js/license.logic.js:276` (`validateSerial`) — **TIDAK BERUBAH**
- `kaki5/js/license.sync.js` — berubah ringan (lihat §7)
- Format serial, `device_assign`, `device_known`, trial, gate, quota — **TIDAK BERUBAH**

### Pemisahan inti

| | **Lisensi** (entitas komersial) | **Serial** (artefak aktivasi) |
|---|---|---|
| Identitas | `licenses.id` (UUID) | Sekuens unik per perangkat |
| Kepemilikan | **Akun** (`global_identity_id`) | Server |
| Jumlah per lisensi | 1 | **N** (N = `max_devices`) |
| Dipindah? | ❌ tetap di akun | ✅ re-mint saat perangkat pindah |
| Validasi offline | — | ✅ HMAC, tetap |

Serial berhenti jadi "bukti kepemilikan" dan berubah jadi **"tiket masuk perangkat ini"**.
Tiket hilang → cetak ulang, bukan kehilangan lisensi.

---

## 5. Model data (Phase 0 — sudah di-apply)

```
global_identities                    ← AKUN (WHO)
  id text (uuid-string) · phone_e164 unique · display_name
  phone_verified_at · status(pending|active|suspended)
  auth_user_id uuid → auth.users (kalau dibuat via Supabase Auth)

licenses                             ← LISENSI (MAYA)
  id uuid · global_identity_id (NULL = belum diklaim)
  product_id → products · app_type
  outlet_ref (= unit_id legacy, V1)
  plan(single|multi) · max_devices · status · expires_at
  current_serial (ringkasan, bukan sumber kebenaran)
  tx_month / tx_used / tx_adjust / tx_updated_at   ← KUOTA DI LEVEL LISENSI
  transfer_count · last_transfer_at

license_devices                      ← PERANGKAT
  license_id · device_code · device_label · serial
  status(active|superseded|revoked) · activated_at · last_seen
  UNIQUE(license_id, device_code)   ← BUKAN UNIQUE(serial)

app_memberships                      ← HAK AKSES (APA)
  global_identity_id · app_key · role · outlet_ref · status · expires_at
  UNIQUE(global_identity_id, app_key, coalesce(outlet_ref,''))

clients.global_identity_id           ← link baris instalasi → akun
profiles.global_identity_id          ← link profile Supabase → akun
```

### Kenapa `global_identities.id` bertipe TEXT

Tabel `identity_recovery_challenges` dan `identity_security_events` yang sudah ada memakai
`global_identity_id` bertipe **TEXT**. Membuat tabel dengan id TEXT (nilai uuid-string) membuat
kedua tabel itu bisa di-FK-kan ke sini tanpa migrasi tipe di kemudian hari.

### Format sesi Hub

Session Hub = JWT yang ditandatangani server (pakai `SUPABASE_JWT_SECRET`), dengan claim:

```
sub            = uuid        (agar auth.uid() tetap berfungsi)
gid            = global identity id
app_key        = aplikasi yang diakses (kaki5|rosok|...)
role           = role per-aplikasi
membership_id  = uuid
session_version= integer
exp            = timestamp
```

RLS membaca claim `gid` — **sama persis dengan pola "hybrid" yang sudah dipakai `clients`**
(`auth.jwt() ->> 'unit_id'`). Fungsi helper: `current_global_identity_id()`, `current_app_key()`.

**Jangan pakai shared cookie parent-domain** (`.kasirsolo.com`) untuk sesi: domain beta
(`*.vercel.app`) berbeda parent, dan cookie `SameSite=None` rapuh. Pakai pola one-time code
exchange (mirip OAuth2 authorization code) — sudah sesuai kontrak `appSession`.

---

## 6. Tiga jebakan & penanganannya

### 6.1 Kuota dobel-spend — SUDAH PERNAH TERJADI

Counter kuota (`tx_month`, `tx_used`, `tx_adjust`) ada di baris `clients`. Kalau 2 perangkat =
2 baris → user dapat kuota 2×. Ini **bukan teori**: `kaki5/js/license.sync.js:187-194` sudah
mendokumentasikan kasus "kuota dobel-spend" saat satu perangkat fisik pecah jadi 2 baris cloud.

**Penanganan:** counter dipindah ke level **lisensi** (`licenses.tx_*`). Satu lisensi = satu kuota,
berapa pun jumlah perangkatnya. Backfill menyalin angka lama; setelah itu cloud yang jadi sumber
kebenaran.

### 6.2 Anti-sharing melemah

Lisensi device-bound = anti-pirasi alami. Longgarkan ke akun → risiko share WA+PIN lalu
ping-pong eject.

**Penanganan (wajib, belum diimplementasi Fase 1):**
- Throttle transfer: maks N transfer / 30 hari per lisensi (disarankan 5).
- `device_label` diisi (mis. "HP Budi", "Laptop") → pemilik bisa melihat siapa yang aktif.
- Step-up: transfer meminta PIN diulang.
- Paket `multi` = N perangkat sekaligus → tidak perlu eject, jadi '{'share'{}}' tidak perlu.

### 6.3 Serial tidak unik per lisensi

Karena `sig = f(device, expiry)`, device yang sama yang aktivasi ulang menghasilkan serial
**IDENTIK**.

**Penanganan:** `license_devices` **tidak** punya `UNIQUE(serial)`; yang dijamin unik hanya
`(license_id, device_code)`. Aktivasi ulang device yang sama = **upsert**, bukan insert.
Reaktivasi diuji dan menghasilkan `reason='already-active'` tanpa duplikasi baris.

> Konsekuensi lanjutan: kalau nanti 1 perangkat menjalankan 2 outlet di app yang sama, serial
> akan **tabrakan**. Fix-nya: masukkan diskriminator lisensi ke payload HMAC + versioning format
> (preseden sudah ada: salt V1→V2, legacy device V3/V4). **Belum perlu sekarang.**

---

## 7. Alur pindah perangkat

```
Perangkat lama                       Perangkat baru
      │  "Masuk dengan Akun Kasol"       │  "Masuk dengan Akun Kasol"
      │   → app_session (role, unit)      │   → app_session
      │                                   │
      │  aktivasi kaki5                   │  aktivasi kaki5
      │   → jatah penuh (1/1)             │   → jatah penuh (1/1)
      │   → TOLAK: "dipakai di            │   → TRANSFER:
      │     perangkat lain"               │     • device lama → 'superseded'
      │                                   │     • device baru  → 'active'
      │                                   │     • mint serial BARU
      │  sync online → baca status        │  simpan serial baru lokal
      │   → 'superseded'                  │   → validateSerial() tetap lolos ✅
      │   → markLicenseRevoked(           │
      │      'transferred')                │
      │   → "Lisensi dipindahkan ke        │
      │      perangkat lain"              │
```

**Perangkat lama yang offline tetap jalan** (grace) — konsisten dengan aturan
`CONTEXT.md:108-110` ("error network TIDAK boleh mencabut state lokal"). Begitu online, baru
diketahui dan dicabut dengan alasan `transferred`.

RPC yang mengimplementasikan ini: `license_activate_device(license_id, device_code, label, serial, exp)`.
Hanya boleh dipanggil server (service_role) — server yang memegang salt sehingga bisa mint serial.

---

## 8. Status Fase 0 (selesai, 2026-10-20)

**File migrasi** (di `supabase/`):
- `migration-hub-identity-licenses.sql` — 4 tabel, RLS, 5 fungsi, backfill
- `migration-hub-identity-licenses-hardening.sql` — cabut grant, trigger penjaga `global_identities`

**Tooling baru** (di `supabase/`):
- `audit-schema.js` — audit skema read-only (`--ref=<ref>`, `--only=<query,...>`)
- `apply-migration.js` — apply/verify dengan mode `--dry-run` (rollback)

```bash
# audit
node supabase/audit-schema.js --ref=hhywrvedlwljawgxzpkq
# dry-run (tidak ada jejak)
node supabase/apply-migration.js --ref=hhywrvedlwljawgxzpkq --file=supabase/<file>.sql --dry-run
# apply
node supabase/apply-migration.js --ref=hhywrvedlwljawgxzpkq --file=supabase/<file>.sql --apply
# verifikasi
node supabase/apply-migration.js --ref=hhywrvedlwljawgxzpkq --verify
```

### Hasil verifikasi (live, 2026-10-20)

| Uji | Hasil |
|---|---|
| 4 tabel baru + RLS aktif | ✅ |
| 5 fungsi (2 helper, 2 RPC tulis, 1 baca) | ✅ |
| 5 policy RLS | ✅ |
| Backfill: 4 lisensi (3 kaki5 + 1 rosok), 4 perangkat | ✅ |
| Kuota terbawa: `tx_used` 16 & 4 | ✅ |
| Transfer perangkat: `reason='transferred'`, device lama jadi `superseded` | ✅ |
| Reaktivasi device sama: `reason='already-active'`, tanpa duplikasi | ✅ |
| Klaim profil salah → `profile-mismatch` | ✅ |
| Klaim profil benar → `claimed` + membership role `owner` + clients ter-taut | ✅ |
| Klaim oleh akun lain → `already-claimed` | ✅ |
| `clients.global_identity_id` tak bisa diubah klien | ✅ (grant per-kolom + trigger) |
| `global_identities.phone_e164` tak bisa diubah user sendiri | ✅ (celah ditemukan & ditutup) |
| `global_identities.display_name` tetap bisa diubah user sendiri | ✅ |
| Tidak ada residu data uji | ✅ |

### Hasil verifikasi Fase 2 — Tab Klien per Akun (live, 2026-10-20)

| Uji | Hasil |
|---|---|
| Pengelompokan: 23 baris → 16 akun | ✅ |
| Akun multi-aplikasi (WA `6282325103336` → Rosok + Kaki5, 6 perangkat) | ✅ |
| Normalisasi WA `082325103336` ≡ `6282325103336` | ✅ |
| Toggle Per Akun ⇄ Perangkat (23 baris; chip ikut berubah) | ✅ |
| Halaman detail akun (lisensi, perangkat, label, transaksi) | ✅ |
| `Buat Akun Hub` → insert identity + RPC klaim → `claimed` | ✅ (uji, lalu dibersihkan) |
| Akun **tidak terpecah** setelah lisensinya diklaim | ✅ (bug ketahuan saat QA → diperbaiki) |
| Paket perangkat single ↔ multi (tulis DB) | ✅ (uji, lalu dikembalikan) |
| Idempotensi buat akun (nomor sudah punya akun → dipakai ulang) | ✅ |
| Verifikasi ulang saat proxy balas error padahal query jadi | ✅ |
| Konsistensi whitelist `api/rest.js` ⇄ `server.js` | ✅ (403 di dev ketahuan → diperbaiki) |
| Residu data uji di produksi | ✅ 0 (identitas/membership/tautan dibersihkan) |

### Hasil QA live browser — halaman Klien (2026-10-20, dev server `:8092`)

| Area | Hasil |
|---|---|
| Render: 16 baris tabel + 16 kartu (desktop & mobile) | ✅ |
| Chip filter **akun**: angka chip == jumlah baris (Semua 16 / Baru 14 / Aktif 4 / dst) | ✅ 7/7 |
| Chip filter **perangkat**: angka chip == jumlah baris (Semua 23 / Baru 19 / Aktif 4) | ✅ 7/7 |
| Filter aplikasi: kaki5 9 · rosok 6 · laundry 2 (akun) / 12 · 9 · 2 (perangkat) | ✅ |
| Pencarian (nama/WA) + empty state "Tidak ada akun yang cocok" | ✅ |
| Navigasi akun → perangkat → "← Kembali" → kembali ke **akun** → daftar | ✅ |
| Navigasi perangkat (mode Perangkat) → "← Kembali" → daftar | ✅ |
| Aksi tulis paket perangkat single ↔ multi + revert | ✅ (DB kembali `single/1` semua) |
| Edge case akun tanpa WA → tombol "Buat Akun Hub" **tidak muncul** | ✅ |
| Responsif 390px: tanpa overflow horizontal, touch target ≥34px | ✅ |
| Detail akun di mobile: lisensi stack vertikal, tombol full-width 314×44 | ✅ |
| a11y: `role=group` + `aria-label` + `aria-pressed` di toggle & chip, kartu `role=button` + `tabindex` + `aria-label` | ✅ |
| Konsol browser | ✅ bersih (0 error / 0 warning) |
| **BUG 1** — search terjepit 48px di mobile (`.oc-toolbar` nowrap) | ✅ diperbaiki (toolbar wrap, scoped `#clientsList`) |
| **BUG 2** — 5 baris "Tanpa nama" identik | ✅ diperbaiki (sub-teks pakai device code) |
| **BUG 3** — 9/16 sub-teks mobile ter-truncate ellipsis | ✅ diperbaiki (sub mobile ringkas `WA · aplikasi`) |
| **BUG 4** — teks toggle wrap 2 baris di mobile | ✅ diperbaiki (nowrap + baris penuh) |
| DB produksi setelah QA | ✅ 0 identitas, 0 membership, 4 lisensi, 4 perangkat, semua `single/1`, `tx_used` 20 (16+4) |

> **Catatan operasional:** `api/rest.js` (dipakai Vercel) dan `control/server.js`
> (dev lokal) punya implementasi proxy sendiri. Saat menambah tabel/RPC yang diizinkan,
> **keduanya wajib diubah** — kalau salah satu lupa, dev lokal lolos tapi production 403
> (atau sebaliknya). Sudah ketahuan saat QA: dev balas `403 forbidden_table`.

---

## 9. Temuan audit yang MASIH perlu keputusan pemilik

1. **3 pasang device duplikat di live** — `unit_id` berbeda, `device_code` sama:
   `K5-01DQ-T9BU`/`K5-00GC-QFOT`, `K5-01SR-KDI9`/`K5-01XE-8SZH`, `KSR-00E8-M2QO`/`KSR-01V4-4G5K`.
   Semuanya kini punya lisensi masing-masing → **2 lisensi untuk 1 perangkat**. Perlu decide:
   merge (hapus satu) atau biarkan. **Tidak digabung otomatis** (berisiko).
2. **WA yang sama di banyak baris** — `082325103336` (4 baris rosok), `6282325103336` (3 baris kaki5),
   `62823251033366` (2 baris — kemungkinan salah ketik). Ini bahan bakar fitur "klaim otomatis":
   begitu user login ke Hub dengan WA yang cocok, lisensi yang unclaimed bisa ditautkan.
3. **650 baris `auth.users`, 0 punya phone, 1 sintetis** — majority adalah sesi anonim dari app.
   Perlu kebijakan retensi/cleanup (bertambah terus tiap install).
4. **Tidak ada OTP untuk pemulihan akun Hub.** `tpa/IDENTITY-CONTRACT.md:113` menyatakan OTP di luar
   kontrak aktif; recovery sekarang = approval admin manual. **Begitu 1 akun memegang 3 aplikasi,
   kehilangan PIN = kehilangan akses ke semuanya.** Ini gap paling menyakitkan — perlakukan sebagai
   prioritas Fase 1, dan izinkan OTP WhatsApp **khusus untuk Hub** walau kontrak TPA belum.
5. **Tabel `identity_*` kosong** (0 baris) — scaffold saja, belum dipakai. Schema-nya sudah
   kompatibel dengan `global_identities` (keduanya TEXT).

---

## 10. Peta jalan

### Fase 1 — Akun & binding (belum mulai)

- [ ] **Endpoint** daftar/login akun Hub (WA + PIN 6 digit pada email sintetis
      `<e164>@accounts.kasirsolo.local`, pola yang sudah dipakai TPA).
- [ ] **Recovery via OTP WhatsApp** khusus Hub (lihat temuan #4).
- [ ] **Server session issuer** — JWT ber-claim `gid`/`app_key`/`role` (satu kode, dipakai semua app).
- [ ] **Alur klaim** di app klien: "Gabung ke akun utama" → QR/deep-link `claim_token` satu kali →
      server jalankan `license_claim_identity()` (sudah ada, tinggal dipanggil).
- [ ] **Endpoint aktivasi perangkat**: cek entitlement → mint serial → `license_activate_device()`.
- [ ] **Perilaku app saat `superseded`**: tampilkan "Lisensi dipindahkan ke perangkat lain"
      (bukan error generik) + tombol "Cek Data Online".
- [ ] **Throttle transfer** (N per 30 hari) + `device_label` terisi.
- [ ] **Kuota**: baca/tulis ke `licenses.tx_*` (bukan `clients.tx_*`).

### Fase 2 — Kontrol Center & upsell (SEBAGIAN SELESAI — 2026-10-20)

- [x] **Tab Klien dikelompokkan per akun** — dua tampilan: `👤 Per Akun` (default) & `📱 Perangkat`.
      23 baris perangkat → 16 akun (WA dinormalisasi: `082325103336` ≡ `6282325103336`).
      GID hanya menempel sebagai identitas akun, **bukan** pemisah grup — kalau GID jadi
      pemisah, akun terpecah begitu lisensinya diklaim (bug yang ketahuan saat QA).
- [x] **Halaman detail akun** — info akun, lisensi per aplikasi (status, paket, perangkat
      + label, transaksi terpakai), daftar perangkat/outlet.
- [x] **Paket multi-perangkat** — ubah `licenses.plan` + `max_devices` (1 ↔ 3) dari Control.
- [x] **Buat Akun Hub** — admin buat `global_identities` + klaim lisensi via RPC
      `license_claim_identity` (verifikasi profil). Idempoten + verifikasi ulang saat
      proxy balas error.
- [ ] Panel **Perangkat** per lisensi (terakhir terlihat) — belum.
- [ ] **Bundle**: satu pembelian → entitlement ke beberapa app — belum.
- [ ] Pengelompokan WA di sisi **server** (normalisasi 08xx/62xx seragam) — sekarang hanya di UI;
      penting begitu app klien mulai menulis `global_identity_id` sendiri.

### Fase 3 — Hub app (belum mulai)

- [ ] Layar "Aplikasi Saya" (pakai `hub_my_licenses()` — sudah ada, read-only).
- [ ] Layar profil akun, ganti PIN, kelola perangkat.
- [ ] Launcher/deep-link ke tiap app (pakai `settings.app_links` yang sudah ada).
- [ ] **Belum** termasuk sinkronisasi transaksi (Lapisan B) — effort & biaya privasi tinggi.

### North-star metric

**% klien dengan ≥2 aplikasi terikat ke 1 akun.** Sekaligus mengukur berhasil/tidaknya strategi
upsell. Saat ini: **0%** (belum ada akun sama sekali).

---

## 11. Aturan main yang wajib dijaga agent

1. **Lisensi tetap per aplikasi.** Jangan pernah menyatukan validitas lisensi ke status akun.
2. **Role per aplikasi.** Jangan baca role global di app klien.
3. **Kuota di level lisensi**, bukan level baris `clients`.
4. **Serial tidak boleh unik global** di tabel perangkat.
5. **Hak tulis di DB = server saja.** Tulis lisensi/membership/tautan akun hanya lewat
   service_role / RPC DEFINER. Jangan beri grant INSERT/UPDATE ke role klien.
6. **App klien TIDAK wajib bergantung pada Hub.** Gate & lisensi per app tetap jalan standalone
   (offline-first). Hub adalah lapisan expedite, bukan gerbang.
7. **Pindah perangkat = transfer, bukan ganti lisensi.** Serial di-mint ulang, lisensi tetap.
8. **Jangan revoke dari ketidakpastian.** Error jaringan tidak boleh mencabut lisensi lokal.
