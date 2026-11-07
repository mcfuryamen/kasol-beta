# Plan Implementasi Login TPA + Identity Hub Universal

> **Keputusan arsitektur:** credential bersifat universal untuk seluruh ekosistem Kasir Solo. TPA hanya consumer pertama; tabel credential tidak boleh dibuat khusus TPA.

Dokumen ini membahas implementasi login untuk aplikasi **TPA Al-Hikmah** di folder `tpa/`, dengan kontrak identitas yang sengaja dibuat universal agar nantinya dapat dipakai oleh Hub dan seluruh aplikasi KasirSolo.

TPA adalah consumer pertama. Credential tidak boleh menjadi milik TPA, minimarket, atau satu aplikasi tertentu.

## Tujuan

Membangun model login berbasis:

- satu identitas global per pemilik akun;
- nomor WhatsApp canonical sebagai identifier login utama;
- password/PIN disimpan dan diverifikasi di credential service universal;
- membership, role, tenant, outlet, lokasi, dan relasi domain dikelola per aplikasi;
- TPA hanya menerima identity + app membership yang berwenang;
- akses data tetap terisolasi berdasarkan tenant/location;
- mode offline tetap tersedia secara terbatas dan aman tanpa menjadi sumber kebenaran global.

## Keputusan desain

| Role aplikasi TPA | Credential universal | Akses TPA |
|---|---|---|
| Admin | Identity global + password | Pengaturan, data master, pembayaran, backup, laporan |
| Ustadz | Identity global + PIN 6 digit | Kelas yang ditugaskan, absensi, hafalan, Iqro |
| Wali | Identity global + PIN 6 digit | Santri yang terhubung ke akun wali |

Role di atas bukan atribut global user. Role tersebut adalah **membership/entitlement khusus aplikasi TPA**. User yang sama dapat menjadi `admin` di TPA, `owner` di KasirSolo, dan `staff` di aplikasi lain tanpa membuat credential baru.

Aturan penting:

1. Tidak ada pemilihan role sebelum login.
2. Pesan gagal login selalu generik: `Nomor WhatsApp atau credential tidak valid.`
3. Nomor dinormalisasi ke format E.164, misalnya `+628123456789`.
4. PIN/password tidak pernah disimpan plaintext.
5. Semua tindakan sensitif harus divalidasi ulang di service layer.
6. `role`, `locationId`, `guardianId`, dan `teacherId` dari client tidak dipercaya sebagai sumber kebenaran.

---

## Status ringkas

| Fase | Status | Output utama |
|---|---|---|
| 0. Baseline dan kontrak | ✅ Selesai | Baseline, schema target, acceptance criteria |
| 1. Model akun TPA | ✅ Selesai (jalur Supabase Auth) | Login WhatsApp + PIN aktif via Supabase Auth; email sintetis `@accounts.kasirsolo.local` |
| 2. Normalisasi credential | ✅ Selesai | Normalisasi E.164 + validasi PIN di `services/auth.js` |
| 3. Login/password/PIN | ✅ Selesai | Login aktif tanpa role picker; error generik; hardened (getIdentityAdapter saat-call) |
| 4. Lockout dan session | 🔶 Sebagian | Throttle/backoff lokal `tpa_login_backoff` di `auth.js`; lockout server-side menunggu identity hub |
| 5. Authorization portal | ✅ Fondasi selesai | Isolasi wali/guru/lokasi sudah diperketat |
| 6. Recovery dan pengelolaan akun | 🔶 Sebagian | Migrasi `20261021` applied (policy dirapikan, RPC legacy di-drop); Edge Functions Track C siap di kode tapi **belum di-deploy** ke staging |
| 7. Offline terbatas | ⬜ Belum mulai | Aktivasi online + unlock offline terbatas |
| 8. QA dan beta gate | ⬜ Belum mulai | Test matrix dan smoke test browser |
| 9. Rilis production TPA | ⬜ Belum mulai | Tag/release setelah beta stabil |

Status hanya diubah setelah output fase benar-benar ada dan test terkait lulus.

> **Keputusan 2026-10-12:** login aktif memakai **Supabase Auth** (bukan identity
> hub). Identity hub & kontrak universal tetap sumber arah jangka panjang dan
> tetap wire-ready; fase 4/6 di atas mengikuti kondisi nyata per tanggal itu.
> Data keuangan SPP juga sudah naik ke Supabase (migrasi `20261020`) dengan
> soft-delete + tombstone, tanpa DELETE.

---

# Tahapan eksekusi

## Fase 0 — Baseline dan kontrak data

**Status:** ✅ Fondasi selesai

Yang sudah tersedia:

- session canonical memuat ulang user dari IndexedDB;
- `guardianId`/`teacherId` dipakai untuk relasi portal;
- data portal dibatasi dengan `locationId`;
- seed demo tidak berjalan otomatis di production;
- schema Dexie sudah dinaikkan ke versi 7;
- backup tervalidasi dan restore atomik;
- service worker dan smoke test dasar sudah diverifikasi.

**Kriteria selesai:** baseline tidak regresi saat fase berikutnya dikerjakan.

## Fase 1 — Model akun universal dan membership aplikasi

**Consumer awal:** `tpa/db/dexie.js`, `tpa/db/init.js`, `tpa/db/seed.js`, service admin.

**Target jangka panjang:** Supabase Auth/Identity Hub sebagai sumber kebenaran global. TPA tidak boleh memiliki tabel credential global sendiri.

Model konseptual:

```text
global_identities
  id                    // UUID global, stabil lintas aplikasi
  phoneE164             // unique global setelah verified
  displayName
  phoneVerifiedAt
  status
  createdAt
  updatedAt

identity_credentials
  id
  identityId
  type                  // password | pin | passkey | recovery
  hash
  salt
  algorithm
  failedAttempts
  lockedUntil
  version
  createdAt
  updatedAt

app_memberships
  id
  identityId
  appKey                // tpa | kasirsolo | rosok | control | ...
  tenantId
  role                  // role khusus aplikasi
  status
  metadata
  createdAt
  updatedAt

app_subject_links
  membershipId
  subjectType           // guardian | teacher | staff | owner
  subjectId
  locationId

sessions
  id
  identityId
  appKey
  membershipId
  sessionVersion
  issuedAt
  expiresAt
  revokedAt
  deviceId

security_events
  id
  identityId
  appKey
  eventType
  success
  metadataRedacted
  createdAt
```

Projection lokal TPA hanya menyimpan data yang diperlukan untuk operasional:

```text
identityProjection
  globalIdentityId
  phoneE164
  displayName
  phoneVerifiedAt

appMembershipProjection
  globalIdentityId
  appKey: 'tpa'
  tenantId/locationId
  role: 'admin' | 'ustadz' | 'wali'
  guardianId
  teacherId
  status
  expiresAt
```

TPA **tidak** menyimpan `passwordHash`/`pinHash` global sebagai sumber kebenaran. Jika beta masih membutuhkan login lokal offline, hash lokal dianggap sebagai cache/device credential dengan expiry dan revoke, bukan credential universal.

Aturan migrasi:

- identity global dibuat satu kali per nomor WhatsApp verified;
- membership TPA dibuat terpisah dari identity;
- nomor invalid masuk daftar `needsCredentialSetup`;
- duplikasi nomor harus dilaporkan dan tidak otomatis digabung;
- role TPA tidak boleh menjadi role global;
- data demo hanya boleh memakai mode demo eksplisit.

Aturan migrasi:

- nomor lama dinormalisasi jika valid;
- nomor invalid masuk daftar `needsCredentialSetup`;
- tidak boleh membuat nomor default palsu;
- duplikasi nomor harus dilaporkan dan tidak otomatis digabung;
- data demo hanya boleh memakai mode demo eksplisit.

**Output:** migration/backfill yang idempotent + daftar akun bermasalah.

**Gate:** tidak ada dua akun aktif dengan `phoneE164` yang sama dalam satu lokasi.

## Fase 2 — Normalisasi nomor WhatsApp dan credential

Buat helper terpusat, misalnya:

```text
tpa/services/phone.js
tpa/services/credential.js
```

Fungsi minimum:

- `normalizePhone(input)`;
- `isValidPhoneE164(phone)`;
- `hashPin(pin, salt)`;
- `verifyCredential(input, storedHash)`;
- `validatePassword(password)`;
- `validatePin(pin)`;
- `isLocked(user)`;
- `recordFailedAttempt(userId)`;
- `clearFailedAttempts(userId)`.

Kebijakan:

- PIN: 6 digit;
- password admin: minimal 10 karakter;
- 5 kegagalan: delay/lock sementara;
- lockout harus persisten di database;
- jangan simpan credential di `localStorage`.

**Gate:** unit test normalisasi, hash/verify, lockout, dan duplikasi lulus.

## Fase 3 — Login baru TPA

**Target:** `tpa/pages/landing/login.js` dan helper session.

Flow:

1. User memasukkan nomor WhatsApp.
2. Nomor dinormalisasi.
3. User memasukkan password/PIN.
4. Identity Hub mencari identity global berdasarkan nomor canonical.
5. Credential service memverifikasi credential universal.
6. Hub menerbitkan identity token/session.
7. TPA memilih membership `appKey=tpa` yang aktif dan sesuai tenant/location.
8. TPA membuat session aplikasi canonical dari membership, bukan dari form.
9. Sistem mengarahkan berdasarkan role TPA yang tersimpan di membership.

UI:

```text
Nomor WhatsApp
Password atau PIN
Masuk
Lupa PIN/password?
```

Hapus:

- input/pemilihan role;
- login berdasarkan nama;
- fallback ke user pertama;
- error yang membocorkan keberadaan akun.

**Gate:** admin, ustadz, dan wali dapat login dengan jalur yang benar; role palsu dari client tidak berpengaruh.

## Fase 4 — Session, lockout, dan device safety

Tambahkan:

- session expiry;
- idle timeout untuk ustadz/wali;
- `sessionVersion` global untuk revoke semua session lintas aplikasi;
- app session terpisah untuk `appKey=tpa`;
- tombol `Kunci aplikasi`;
- tombol `Ganti akun`;
- audit event login berhasil/gagal;
- audit perubahan credential;
- revoke session setelah credential diganti.

Tindakan yang wajib re-authentication:

- reset database;
- restore backup;
- mengubah role;
- mengubah nomor akun;
- reset credential user lain;
- menghapus data santri secara permanen.

**Gate:** session lama tidak berlaku setelah revoke/credential reset.

## Fase 5 — Authorization portal dan service layer

**Status:** ✅ Fondasi selesai; perlu regression test setelah login baru.

Validasi wajib:

- wali hanya melihat santri dengan `guardianId` yang sama;
- ustadz hanya melihat kelas dari `classTeachers` miliknya;
- semua query menyaring `locationId`;
- ustadz tidak dapat mengubah pembayaran atau backup;
- wali tidak dapat mengakses halaman admin/guru;
- semua mutasi memvalidasi record target di service layer.

**Gate:** matrix role × resource tidak memiliki akses silang.

## Fase 6 — Recovery dan pengelolaan akun

Flow wali/ustadz:

1. Masukkan nomor WhatsApp.
2. Verifikasi OTP atau approval admin.
3. Buat PIN baru.
4. Revoke session lama.

Flow admin:

- recovery tidak boleh hanya melalui local storage;
- gunakan OTP/email/owner approval;
- perubahan nomor wajib re-authentication;
- semua recovery dicatat di audit log.

Integrasi WhatsApp OTP dilakukan setelah login dasar stabil. Untuk beta lokal, boleh memakai approval admin sebagai fallback terkontrol.

**Gate:** recovery tidak dapat dipakai untuk mengambil alih akun tanpa bukti kepemilikan.

## Fase 7 — Mode offline terbatas

Aturan:

- aktivasi pertama wajib online;
- perangkat yang belum pernah diverifikasi tidak boleh login offline;
- unlock offline hanya untuk user yang pernah terverifikasi;
- session offline memiliki expiry, misalnya 7 hari;
- admin sensitif tetap wajib online;
- PIN lokal disimpan sebagai hash dengan salt;
- data offline dibatasi ke lokasi dan user yang telah diotorisasi;
- sinkronisasi tetap divalidasi server-side saat online.

**Gate:** mode offline tidak membuka data lintas lokasi dan tidak mengizinkan operasi admin sensitif.

## Fase 8 — QA dan beta gate

### Test credential

- nomor `0812...`, `+62812...`, format spasi, tanda hubung;
- nomor invalid;
- password admin valid/invalid;
- PIN valid/invalid;
- akun nonaktif;
- akun terkunci;
- nomor duplikat;
- user tanpa `guardianId`/`teacherId`.

### Test authorization

- wali A tidak melihat santri wali B;
- wali lokasi A tidak melihat data lokasi B;
- ustadz hanya melihat kelas assignment;
- role palsu di local storage ditolak;
- membership dari aplikasi lain tidak otomatis memberi akses TPA;
- session lama ditolak setelah revoke global maupun revoke aplikasi TPA.

### Test recovery

- OTP expired;
- OTP salah berulang;
- reset credential merevoke session lama;
- nomor baru tidak boleh duplikat.

### Test offline/PWA

- login pertama online;
- reload offline setelah aktivasi;
- session expired;
- service worker cache;
- update service worker tidak memutus sesi aktif;
- restore backup hanya untuk admin terautentikasi.

**Artefak wajib:** hasil test, screenshot/error log, dan keputusan pass/fail per gate.

## Fase 9 — Rilis beta dan production

Urutan rilis:

1. Commit perubahan di folder kerja.
2. Jalankan static check dan browser smoke test.
3. Rilis ke mirror beta TPA.
4. Uji manual dengan tiga akun: admin, ustadz, wali.
5. Pantau error login, lockout, session, dan sinkronisasi.
6. Jika stabil, mirror ke production.
7. Setelah production, jangan langsung mengaktifkan OTP tanpa observasi beta.

---

# Urutan final eksekusi khusus TPA

Urutan ini adalah baseline implementasi yang disepakati. Fokusnya menyelesaikan TPA end-to-end, tetapi semua nama field dan boundary sudah kompatibel dengan Identity Hub universal.

## Tahap A — Bekukan kontrak identity dan membership

**Status:** ✅ Selesai — contract module, fail-closed adapter boundary, dokumentasi, dan contract test tersedia.

**Tujuan:** mencegah TPA membuat desain credential lokal yang nanti harus dibongkar.

Deliverable:

- tetapkan `globalIdentityId` sebagai ID identity lintas aplikasi;
- tetapkan `appKey = 'tpa'`;
- tetapkan bentuk membership TPA: `tenantId/locationId`, `role`, `status`;
- tetapkan subject link: `guardianId` dan `teacherId`;
- tetapkan token/session claims minimum;
- tetapkan aturan bahwa credential hash bukan milik TPA.

**Gate A:** lulus. Schema contract disetujui, validator menolak credential fields, adapter default fail-closed, dan tidak ada kode login baru yang menyimpan password/PIN sebagai credential global di IndexedDB TPA.

**Artefak:** `tpa/IDENTITY-CONTRACT.md`, `tpa/services/identity/contract.js`, `tpa/services/identity/adapter.js`, `tpa/services/identity/contract.test.js`.

## Tahap B — Buat identity adapter TPA

**Status:** ✅ Selesai — provider boundary tervalidasi, mock provider QA, Supabase transport boundary, session facade, dan test provider tersedia.

**Tujuan:** TPA memiliki satu adapter yang kelak dapat diarahkan ke Identity Hub tanpa mengubah halaman/servicenya.

Deliverable:

- `identity-adapter.js` dengan operasi `resolveIdentity`, `verifyCredential`, `listMemberships`, `createAppSession`, `revokeSession`;
- adapter sementara untuk development/QA memakai mock provider eksplisit;
- default production tetap fail-closed jika provider belum tersedia;
- response provider divalidasi ulang sebelum masuk ke TPA;
- semua response adapter dinormalisasi ke bentuk TPA;
- halaman TPA tidak memanggil tabel credential secara langsung.

**Artefak:** `tpa/services/identity/adapter.js`, `mock-provider.js`, `supabase-provider.js`, `session.js`, `provider.spec.js`.

**Gate B:** lulus untuk boundary adapter/provider dan session facade. UI login legacy nama/role belum diganti; itu tetap pekerjaan Tahap D.


## Tahap C — Migrasi akun TPA ke projection/membership

**Status:** ✅ Selesai — projection Dexie v8, migrator deterministic/idempotent, report manual review, dokumentasi, dan test tersedia.

**Tujuan:** mengubah data user TPA lama tanpa kehilangan relasi wali/guru.

Deliverable:

- mapping user lama ke `globalIdentityId`;
- normalisasi `phoneE164`;
- deteksi nomor duplikat dan invalid;
- projection membership `appKey=tpa`;
- subject link ke `guardianId`/`teacherId`;
- laporan akun yang perlu dilengkapi manual.

**Gate C:** lulus untuk migrator/projection. Akun valid dipetakan, akun invalid/duplikat/cross-location masuk manual review, dan legacy tables tetap dipertahankan.

**Artefak:** `tpa/services/identity/migration.js`, `tpa/services/identity/migration.spec.js`, `tpa/IDENTITY-MIGRATION.md`, dan Dexie schema v8.

## Tahap D — Implementasi login TPA

**Status:** ✅ Selesai — login UI WhatsApp + credential, adapter-backed session, generic error, dan test tiga role tersedia.

**Tujuan:** mengganti login nama/role picker dengan nomor WhatsApp + credential.

Deliverable:

- input nomor WhatsApp;
- input password/PIN;
- pesan error generik;
- role tidak dipilih dari UI;
- membership `appKey=tpa` dipilih setelah identity terverifikasi;
- session menyimpan `globalIdentityId`, `membershipId`, `locationId`, role TPA, dan expiry;
- `verifySession()` memvalidasi ulang identity dan membership.

**Gate D:** lulus untuk flow adapter-backed dan mock QA. Admin, ustadz, dan wali dapat login; role tidak dipilih dari UI; error credential generik; session canonical dibuat dari membership provider. Provider production tetap menunggu RPC/Edge Function Identity Hub.

**Artefak:** `tpa/login.html`, `tpa/pages/landing/login.js`, `tpa/services/auth.js`, dan `tpa/services/identity/login.spec.js`.

## Tahap E — Lockout, session, dan audit keamanan

**Status:** ✅ Fondasi adapter, lockout QA, session expiry/idle timeout, revoke/version, dan redacted audit event selesai. Production Identity Hub RPC/Edge Function tetap wajib menyediakan enforcement server-side.

**Tujuan:** membuat login aman dipakai di perangkat TPA bersama.

Deliverable:

- failed-attempt counter dan lockout persisten;
- expiry dan idle timeout;
- `sessionVersion`/revoke global dan revoke khusus TPA;
- kunci aplikasi dan ganti akun;
- audit login berhasil/gagal, lockout, revoke, dan perubahan credential;
- re-authentication untuk backup, reset, perubahan role, dan penghapusan sensitif.

**Gate E:** brute-force sederhana terblokir, session lama tidak berlaku setelah revoke, audit tidak menyimpan PIN/password/OTP.

## Tahap F — Authorization dan regresi portal TPA

**Status:** ✅ Guard actor terpusat, isolasi lokasi/subject/assignment pada service inti, perlindungan dashboard, dan pencegahan demo seed production selesai. Regression matrix lokal lulus; hardening server/RLS tetap wajib karena TPA memakai IndexedDB client-side.

**Tujuan:** memastikan login baru tidak merusak isolasi data yang sudah dibangun.

Deliverable:

- wali hanya melihat santri dari subject link miliknya;
- ustadz hanya melihat kelas assignment miliknya;
- semua service memvalidasi membership, lokasi, dan status aktif;
- admin-only action tetap terlindungi;
- tidak ada fallback ke user/role/lokasi pertama.

**Gate F:** matrix akses admin × ustadz × wali × lokasi lulus.

## Tahap G — Recovery credential universal

**Status:** 🟡 Beta admin-approval scaffold implemented in TPA adapter/mock/UI and Supabase recovery challenge/audit schema. WhatsApp OTP and server credential reset RPC remain gated until Identity Hub credential/session tables are connected.
, consumer TPA

**Tujuan:** recovery dibuat sekali di identity layer, bukan berbeda di tiap aplikasi.

Deliverable TPA:

- halaman `Lupa PIN/password` mengarah ke identity adapter;
- TPA meminta recovery untuk identity global, bukan mengubah hash lokal langsung;
- setelah recovery berhasil, session TPA lama direvoke;
- fallback beta dapat berupa approval admin, dengan audit dan expiry;
- OTP WhatsApp ditambahkan setelah provider dan observability siap.

**Gate G:** recovery tidak dapat mengubah akun hanya berdasarkan nomor yang diketik.

## Tahap H — Offline terbatas untuk TPA

**Tujuan:** tetap mendukung operasional kelas saat koneksi putus tanpa menjadikan local storage sebagai sumber kebenaran global.

Deliverable:

- aktivasi awal online;
- device/session TPA diberi expiry;
- projection membership dan data operasional lokal dibatasi ke lokasi;
- unlock offline memakai device credential ter-cache, bukan credential global baru;
- admin sensitif dan perubahan identity wajib online;
- revoke diterapkan saat perangkat kembali online.

**Gate H:** perangkat baru tidak dapat login offline, data lintas lokasi tidak muncul, dan session offline kedaluwarsa.

## Tahap I — QA, beta, dan cutover TPA

Urutan:

1. static check dan migration test;
2. unit test normalizer, adapter, lockout, session, dan authorization;
3. browser smoke test tanpa console error;
4. uji tiga akun beta: admin, ustadz, wali;
5. uji perangkat bersama dan mode offline;
6. rilis ke mirror beta TPA;
7. pantau login, lockout, recovery, session, dan sync;
8. cutover production TPA setelah gate stabil;
9. dokumentasikan adapter dan membership sebagai kontrak consumer pertama untuk Hub.

**Definition of done TPA:** login universal berjalan, membership TPA tervalidasi, authorization terisolasi, recovery dan revoke bekerja, offline terbatas, seluruh QA gate lulus, dan tidak ada credential global yang dimiliki tabel TPA.

---

# Cara memantau progres

## Perintah cepat

Dari root repository:

```bash
git status --short
git log --oneline -10
find tpa -name '*.js' -not -path '*/vendor/*' -print0 | xargs -0 -n1 node --check
git diff --check
node tpa/_verify.js
```

## Checklist per fase

Setiap fase harus memiliki:

- [ ] perubahan kode;
- [ ] migration/backfill jika ada perubahan schema;
- [ ] test otomatis atau smoke test;
- [ ] bukti hasil test;
- [ ] audit diff;
- [ ] status fase di dokumen ini diperbarui.

## Format update progres

Gunakan format berikut pada commit atau catatan kerja:

```text
[TPA][Fase N] judul perubahan

Status: in-progress | ready-for-qa | done
Scope: file/modul yang disentuh
Test: perintah + hasil
Risiko: jika ada
Next gate: kriteria berikutnya
```

---

# Risiko yang harus dipantau

1. **IndexedDB bukan security boundary penuh.** Untuk produksi serius, credential universal harus dipindahkan ke Supabase Auth/Identity Hub/backend; TPA hanya menyimpan projection dan cache device terbatas.
2. **WhatsApp OTP membutuhkan provider dan biaya operasional.** Jangan mengaktifkan sebelum fallback dan observability siap.
3. **Migrasi nomor duplikat harus manual.** Jangan menggabungkan akun otomatis.
4. **Mode offline memperlebar risiko perangkat hilang.** Gunakan expiry, lock, dan revoke.
5. **Perubahan schema harus backward-compatible.** Jangan menghapus field lama sebelum semua akun bermigrasi.
6. **Data anak dan wali adalah data sensitif.** Audit log tidak boleh menyimpan password, PIN, OTP, atau payload sensitif mentah.

# Definisi selesai keseluruhan

Implementasi dianggap selesai jika:

- [ ] login tidak lagi bergantung pada nama/role picker;
- [ ] satu `globalIdentityId` dipakai lintas aplikasi;
- [ ] nomor WhatsApp canonical dan unik secara global setelah verified;
- [ ] credential universal ter-hash dan memiliki lockout;
- [ ] admin memakai password, ustadz/wali memakai PIN melalui credential service;
- [ ] membership, role, tenant, dan relasi TPA ditentukan server/database;
- [ ] TPA tidak menjadi pemilik credential global;
- [ ] recovery dan revoke session bekerja;
- [ ] offline mode dibatasi dan memiliki expiry;
- [ ] matrix authorization lulus;
- [ ] browser smoke test lulus tanpa console error;
- [ ] beta dipantau sebelum production;
- [ ] dokumen ini diperbarui ke status final.
