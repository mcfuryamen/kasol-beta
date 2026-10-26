# MVP-0 — Baseline Audit dan Temuan Implementasi

**Tanggal audit:** 2026-10-05  
**Scope:** aplikasi minimarket dan Supabase project `hhywrvedlwljawgxzpkq`  
**Status:** audit selesai; belum menjalankan migration korektif/destruktif

## Ringkasan

Baseline MVP-0 menemukan bahwa Supabase sudah memiliki satu business, satu outlet default, satu owner, satu membership owner, dan sembilan produk dengan `outlet_id` terisi. Namun schema remote belum memiliki tabel operasional minimarket seperti `orders`, `shifts`, `cash_flows`, `customers`, dan lainnya. Data operasional aplikasi saat ini masih terutama berada di IndexedDB lokal.

Kesimpulan: **belum aman melanjutkan ke RLS operasional atau mengubah kolom menjadi NOT NULL**. Langkah berikutnya harus menyamakan schema migration minimarket dengan database remote terlebih dahulu, lalu baru menguji backfill dan isolasi outlet.

## 1. Baseline repository

Branch saat audit: `main`.

Working tree sudah memiliki perubahan yang belum di-commit, termasuk:

- `src/logic/state/app-state.ts`
- `src/logic/services/outlet-service.ts`
- `src/ui/pages/settings.tsx`
- `src/data/db/hydrate.ts`
- `src/data/sync/sync-engine.ts`
- `supabase/migrations/009_multi_outlet.sql`
- dokumentasi arsitektur single/multi outlet
- perubahan phone authentication sebelumnya

Perubahan tersebut diperlakukan sebagai kondisi kerja dan tidak di-reset oleh audit ini.

Migration lokal minimarket yang relevan:

```text
001_users.sql
002_products.sql
003_orders.sql
004_finance.sql
005_stock.sql
006_promos.sql
007_settings.sql
008_phone_auth.sql
009_multi_outlet.sql
```

Migration remote yang tercatat Supabase:

```text
20261005020911 create_minimarket_auth_schema
20261005030215 promote_first_profile_owner
20261005030245 fix_first_user_owner_trigger
20261005033811 multi_outlet_foundation
```

## 2. Kondisi business, outlet, dan membership

Hasil query remote:

| Entitas | Jumlah | Temuan |
|---|---:|---|
| `profiles` | 1 | 1 user owner |
| `businesses` | 1 | sudah ada |
| `outlets` | 1 | aktif dan default |
| `outlet_memberships` | 1 | owner terhubung ke outlet |
| `settings` | 8 | konfigurasi Control Center, bukan `store_settings` minimarket |
| `products` | 9 | semua memiliki `outlet_id` |

Outlet remote saat ini:

```text
Business: amin maghfuri
Outlet: Outlet Utama
is_default: true
```

ID outlet default harus diperlakukan sebagai data runtime, bukan di-hardcode ke source code.

## 3. Temuan konfigurasi legacy

Tabel remote `public.store_settings` tidak ada. Percobaan awal migration yang membaca tabel tersebut gagal karena relasi memang tidak tersedia. Migration lokal perlu menggunakan sumber konfigurasi yang benar:

- konfigurasi perangkat `storeSettings` berada di IndexedDB key `store_settings`;
- `settings` remote yang ada saat ini adalah tabel konfigurasi Control Center dan berisi `biz_info`, bukan konfigurasi toko POS per user;
- karena itu, nilai outlet lama tidak dapat diambil otomatis dari `public.store_settings` pada server.

Keputusan MVP-0:

1. Jangan menebak alamat, telepon, pajak, atau footer dari tabel yang salah.
2. Outlet default dibuat dengan nilai aman kosong/default.
3. Perangkat owner harus melakukan hydration dari `storeSettings` lokal dan menyimpan konfigurasi outlet setelah login.
4. Migration korektif berikutnya harus menyediakan jalur idempotent untuk mengisi data outlet dari device owner, bukan memalsukan data legacy di SQL.

## 4. Temuan schema operasional remote

Tabel yang diharapkan aplikasi minimarket tetapi **belum ada di remote** saat audit:

```text
categories
customers
orders
order_items
shifts
cash_flows
petty_cash
void_records
stock_mutations
suppliers
purchase_orders
promos
vouchers
loyalty_transactions
store_settings
```

Tabel `products` ada, tetapi schema remote yang aktif adalah gabungan schema product katalog lama dan minimarket. Sembilan row produk sudah memiliki `outlet_id`.

Implikasi:

- RLS operasional belum dapat diuji untuk tabel-tabel yang belum ada.
- Backfill operasional belum dapat diverifikasi di remote.
- Menambahkan policy ke tabel yang belum ada tidak boleh dilakukan sekarang.
- Migration `003`–`007` perlu diverifikasi/applied ke project target sebelum migration outlet berikutnya dianggap selesai.

## 5. Keputusan baseline

### Yang sudah dianggap benar

- Satu business dan satu outlet default sudah ada.
- Owner pertama sudah memiliki membership outlet.
- Produk remote yang ada sudah memiliki `outlet_id`.
- Tidak ada indikasi data order/keuangan remote yang harus dibackfill pada saat audit karena tabelnya belum ada.

### Yang belum boleh dilakukan

- Mengubah `outlet_id` menjadi `NOT NULL` di semua tabel.
- Menambahkan RLS operasional sebelum tabel target ada.
- Menganggap sembilan produk sebagai bukti seluruh data lokal sudah tersinkron.
- Mengambil data outlet dari `public.settings` Control Center.
- Menghapus atau mengganti outlet default.
- Menjalankan migration destruktif untuk menyamakan schema.

## 6. Rencana korektif MVP-0

### MVP0-A — Samakan schema remote

1. Review dependency dan urutan migration `001`–`009`.
2. Bandingkan schema lokal migration dengan schema remote melalui `list_tables`.
3. Terapkan migration minimarket `003`–`007` ke project target hanya setelah SQL idempotency dan konflik nama diverifikasi.
4. Pastikan foreign key, trigger, index, dan RLS dari schema dasar tetap kompatibel dengan outlet.
5. Catat hasil migration dan jumlah row setiap tabel.

### MVP0-B — Koreksi identitas business

1. Verifikasi `profiles` owner dan sumber `namaUsaha` pada device owner.
2. Update `businesses.name` hanya dari input owner yang terverifikasi.
3. Jangan memakai nama pemilik sebagai nama business kecuali owner secara eksplisit memilihnya.

### MVP0-C — Konfigurasi outlet dari device

1. Load `storeSettings` lokal owner.
2. Tampilkan preview nilai yang akan disimpan ke outlet default.
3. Simpan nama, alamat, telepon, pajak, dan footer ke row outlet.
4. Catat timestamp dan actor.
5. Jika device offline, simpan pending mutation dengan outlet ID tetap.

### MVP0-D — Verifikasi dua outlet

Setelah schema tersedia:

1. Buat outlet kedua non-produksi.
2. Buat user manager/kasir untuk outlet kedua.
3. Masukkan produk yang sama ke dua outlet.
4. Buat data order/shift/stok berbeda.
5. Uji owner melihat keduanya.
6. Uji kasir outlet A tidak melihat outlet B.
7. Uji outbox offline setelah berpindah outlet.
8. Hapus/arsipkan data uji setelah evidence disimpan, jika kebijakan data mengizinkan.

## 7. Acceptance criteria MVP-0

MVP-0 dianggap selesai jika:

- baseline database terdokumentasi;
- schema operasional remote sudah ada dan cocok dengan migration aplikasi;
- business/outlet/membership dapat diverifikasi;
- konfigurasi outlet default memiliki sumber data yang jelas;
- tidak ada SQL yang membaca tabel legacy yang tidak ada;
- row produk remote memiliki outlet yang valid;
- migration korektif dapat dijalankan ulang tanpa menggandakan business/outlet/membership;
- rencana dua-outlet QA memiliki data uji dan expected result;
- belum ada perubahan destruktif tanpa backup dan verifikasi.

## 8. Hasil eksekusi langkah berikutnya

Schema operasional baseline sudah dibuat langsung pada Supabase melalui migration `minimarket_ops_schema_baseline`.

Tabel yang sekarang tersedia:

```text
categories
customers
orders
order_items
shifts
cash_flows
petty_cash
void_records
stock_mutations
suppliers
purchase_orders
promos
vouchers
loyalty_transactions
store_settings
```

Backfill outlet juga sudah dijalankan melalui migration `mvp0_backfill_operational_outlets`.

Hasil verifikasi:

| Tabel | Total row | `outlet_id` null |
|---|---:|---:|
| `products` | 9 | 0 |
| `customers` | 0 | 0 |
| `orders` | 0 | 0 |
| `order_items` | 0 | 0 |
| `shifts` | 0 | 0 |
| `cash_flows` | 0 | 0 |
| `petty_cash` | 0 | 0 |
| `void_records` | 0 | 0 |
| `stock_mutations` | 0 | 0 |
| `suppliers` | 0 | 0 |
| `purchase_orders` | 0 | 0 |
| `promos` | 0 | 0 |
| `vouchers` | 0 | 0 |
| `loyalty_transactions` | 0 | 0 |

Catatan: semua kolom `outlet_id` masih nullable. Ini sengaja karena writer aplikasi belum seluruhnya diverifikasi. RLS yang ditambahkan pada tahap ini baru baseline authenticated read; pembatasan berbasis membership/outlet harus menjadi langkah berikutnya sebelum data produksi ditulis ke tabel operasional.

## 9. Next action teknis

Langkah berikutnya adalah **MVP-1 Business, mode, dan outlet core**:

1. Tambahkan `operating_mode` pada `businesses`.
2. Tambahkan `outlets.code`, `archived_at`, dan constraint default outlet.
3. Koreksi `businesses.name` menggunakan nama usaha yang terverifikasi.
4. Ganti baseline authenticated-read policy dengan policy membership/outlet.
5. Tambahkan writer aplikasi untuk seluruh tabel operasional dengan `outlet_id` eksplisit.
6. Setelah writer dan test lulus, baru pertimbangkan `NOT NULL` pada tabel yang wajib outlet-scoped.
7. Buat test dua outlet untuk owner, manager, kasir, dan offline outbox.

Tidak ada data operasional remote yang hilang atau diubah secara destruktif dalam langkah ini.

---

## 10. Eksekusi MVP-1 (2026-10-05)

MVP-1 diterapkan melalui migration `mvp1_business_mode_outlet_core` (salinan lokal: `supabase/migrations/010_mvp1_business_mode_outlet_core.sql`).

### Database

| Perubahan | Status |
|---|---|
| `businesses.operating_mode` (`single`/`multi`, default single) | ✅ |
| `outlets.code` + unique `(business_id, code)`; outlet lama = `UTM` | ✅ |
| `outlets.archived_at` + unique satu-default-per-business | ✅ |
| Helper `can_access_outlet`, `can_manage_outlet`, `has_role` (security definer) | ✅ |
| Trigger `handle_new_user`: user pertama → business + outlet `UTM` + membership owner; berikutnya → cashier | ✅ |
| Tabel `pos_products` (katalog kasir) — tabel `products` ternyata milik katalog Control dengan schema berbeda | ✅ |
| RLS `mvp1_*` menggantikan baseline `mvp0_*` di 16 tabel: member baca/tulis outlet, owner/manager kelola, master global (categories) ditulis owner global | ✅ |

Keputusan penting: tabel remote `products` bukan tabel produk kasir — itu katalog Control (kolom `tagline`, `tutorials`, dst). Katalog kasir memakai `pos_products`, dan sync engine memetakan tabel logis `products` → remote `pos_products` (`REMOTE_NAME` di sync-engine). `outlet_id` tetap nullable sampai QA dua outlet lulus.

### Aplikasi

- `app-state.ts`: `Outlet` dapat `code`/`archivedAt`; sinyal `operatingMode` + `businessId`.
- `outlet-service.ts`: load business+outlets, guard pindah outlet saat shift aktif (kasir/stok), validasi kode unik, `setOperatingMode` (owner-only), `setArchived` (tolak arsip default & outlet terakhir).
- `auth-service.ts`: fix `addStaff` yang masih memanggil `signUp({ phone })` (akan 400) → kini email sintetis sama dengan `register`, plus insert `outlet_memberships` ke outlet aktif.
- `settings.tsx`: selector Mode Operasional di Data Usaha (owner, dengan dialog konfirmasi), kode outlet, tombol Tambah Outlet (multi saja), daftar outlet dengan arsip/pulihkan.

### QA

`tsc --noEmit` ✅ · `npm run build` ✅ · QA Playwright mode demo (port terpisah, tanpa menyentuh Supabase) **11/11 PASS**: boot demo → login owner → Pengaturan/Outlet → kode UTM → mode selector → aktifkan Multi (konfirmasi) → tambah outlet `UT02 · Outlet QA` → tampil di daftar → arsip (konfirmasi) → kembali Single.

### Checklist QA dua outlet (sebelum `NOT NULL`)

1. Owner melihat outlet A dan B, kasir outlet A tidak melihat order outlet B.
2. Insert order/shift/kas dengan `outlet_id` outlet lain ditolak RLS.
3. Outbox offline yang dibuat di outlet A tetap terkirim ke outlet A walau user berpindah ke B sebelum online.
4. Counter order terpisah per outlet (`order_counter_{outlet_id}_{tanggal}`).
5. Kasir dengan shift aktif dicegah pindah outlet dari UI.
6. Staf baru (addStaff) bisa login dengan nomor WhatsApp-nya dan hanya melihat outlet assignment-nya.

### 11. Penutupan MVP-0 (2026-10-05)

| Gap acceptance | Evidence | Status |
|---|---|---|
| Backup database + verifikasi restore/read-back | `backups/mvp0-backup-2026-10-05.json` (lokal, di-ignore Git): 30 tabel, 823 baris, 464.4 KB; parse balik dan row count live cocok 30/30. `backups/mvp0-schema-snapshot-2026-10-05.json`: snapshot PostgREST 173,783 byte. Skrip restore aditif: `scripts/restore-backup.cjs`. | ✅ |
| Dataset QA dua outlet | Outlet `UT02` dibuat sebagai outlet non-default; user manager/kasir QA dibuat sementara, diberi membership ke UT02, lalu seluruh data QA dibersihkan dan UT02 diarsipkan. | ✅ |
| Isolasi RLS per outlet | User kasir outlet A hanya melihat order A; user kasir outlet B hanya melihat order B (`isolated: true`). | ✅ |
| Insert lintas outlet | Kasir outlet B mencoba insert order dengan `outlet_id` outlet A dan ditolak RLS (`cross_outlet_insert: rejected`). | ✅ |

Catatan batasan: backup dilakukan sebagai logical JSON export melalui service-role REST karena mesin QA tidak memiliki `pg_dump`/Docker. Ini cukup sebagai backup/read-back MVP-0, bukan pengganti physical PITR Supabase.

**Kesimpulan:** seluruh acceptance criteria MVP-0 pada bagian 7, termasuk backup terverifikasi dan dataset/QA dua outlet, telah ditutup. Kolom `outlet_id` sengaja tetap nullable sampai seluruh writer aplikasi dan kontrak outbox produksi diaudit pada fase berikutnya.
