# Migrasi Arsitektur Minimarket ke Single/Multi-Outlet

**Status:** Draft spesifikasi migrasi  
**Ruang lingkup:** aplikasi kasir minimarket, Supabase Auth/Postgres, sinkronisasi offline-first  
**Target:** satu unit usaha dapat beroperasi sebagai single outlet atau multi outlet tanpa mengganti arsitektur database.

---

## 1. Tujuan

Aplikasi harus mendukung pola operasional minimarket nyata:

```text
Satu usaha / business
├── Master produk
├── Master supplier
├── Satu atau banyak outlet
│   ├── stok
│   ├── harga lokal
│   ├── kas dan shift
│   ├── transaksi
│   ├── pengguna yang ditugaskan
│   └── perangkat POS
└── laporan outlet dan laporan gabungan
```

Pengguna boleh memilih mode:

- **Single outlet:** satu outlet aktif, UI sederhana, tanpa kewajiban memilih cabang.
- **Multi outlet:** beberapa outlet aktif, tersedia pemilihan outlet, assignment staf, dan laporan per outlet.

Mode dapat diubah kapan saja. Perubahan mode tidak boleh menghapus transaksi, stok, histori kas, atau user.

### Prinsip utama

1. Single outlet dan multi outlet memakai model data yang sama.
2. Single outlet berarti business memiliki satu outlet operasional default; bukan database berbeda.
3. Produk master bersifat global di level business.
4. Stok, harga, shift, kas, transaksi, dan user assignment bersifat per outlet.
5. Outlet yang dinonaktifkan diarsipkan, bukan dihapus.
6. RLS adalah pengaman utama; pembatasan UI saja tidak cukup.
7. `outlet_id` harus tersimpan permanen pada record dan outbox, bukan ditentukan ulang saat flush.
8. Data historis selalu mempertahankan outlet asalnya.

---

## 2. Kondisi Saat Ini

Aplikasi saat ini sudah memiliki fondasi awal:

- `profiles` untuk identitas user dan role.
- `storeSettings` sebagai konfigurasi toko global pada perangkat.
- IndexedDB sebagai penyimpanan local-first.
- Supabase sebagai backend dan sinkronisasi.
- Migration `009_multi_outlet.sql` yang membuat:
  - `businesses`
  - `outlets`
  - `outlet_memberships`
  - kolom `outlet_id` pada sejumlah tabel operasional
- `activeOutletId` dan daftar `outlets` di state aplikasi.
- Tab Pengaturan pertama sudah bernama **Outlet**, sebelum **Data Usaha**.
- Sync pull/push sudah mulai mengenali outlet aktif.

Fondasi tersebut belum sama dengan multi-outlet penuh. Pekerjaan lanjutan wajib menutup celah berikut:

- produk masih tercampur antara master produk dan konfigurasi outlet;
- RLS belum seragam untuk seluruh tabel operasional;
- local store belum benar-benar terpartisi berdasarkan outlet;
- perpindahan outlet belum me-reload seluruh signal/domain state;
- outbox harus mengunci `outlet_id` pada saat enqueue;
- belum ada assignment outlet pada UI staf;
- belum ada harga khusus per outlet;
- belum ada transfer antar outlet;
- belum ada alur gudang/penerimaan yang eksplisit;
- counter transaksi harus dipisah per outlet;
- identitas `businesses.name` harus memakai nama usaha, bukan nama pemilik;
- migrasi data lama harus mengambil konfigurasi lama secara aman, bukan mengandalkan nilai kosong.

---

## 3. Model Domain Target

### 3.1 Business / Data Usaha

Data global yang dimiliki satu unit usaha:

- `id`
- `name`
- `owner_id`
- `operating_mode`: `single` atau `multi`
- identitas pemilik
- nomor WhatsApp
- alamat legal/kantor
- NPWP/NIB bila digunakan
- pengaturan global pajak dan pembulatan
- konfigurasi lisensi

`operating_mode` hanya mengatur pengalaman operasional dan visibilitas UI. Ia tidak mengubah struktur relasi data.

### 3.2 Outlet

Data lokasi operasional:

- `id`
- `business_id`
- `code` unik dalam business, contoh `UTM`, `KTS`, `SLR`
- `name`
- `address`
- `phone`
- `tax_rate` bila berbeda dari default business
- `receipt_footer`
- `default_warehouse_id` bila modul gudang telah tersedia
- `is_default`
- `is_active`
- `archived_at`
- `created_at`, `updated_at`

Invariant:

- Setiap business memiliki minimal satu outlet.
- Hanya satu outlet default untuk kebutuhan single outlet.
- Outlet yang memiliki histori tidak boleh dihapus.
- `code` tidak boleh berubah tanpa audit/alias karena dapat dipakai pada nomor transaksi.

### 3.3 Membership

Assignment user tidak cukup hanya dengan role global. Relasi operasional harus memuat:

```text
user_id + business_id + outlet_id + role
```

Role minimal:

- `owner`: semua outlet dalam business.
- `manager`: outlet yang ditugaskan, dapat mengelola operasional outlet.
- `cashier`: POS dan shift pada outlet yang ditugaskan.
- `stock`: penerimaan, stok opname, transfer, dan stok outlet.

Owner boleh melihat seluruh outlet tanpa harus membuat membership satu per satu, tetapi membership default tetap dapat dibuat untuk konsistensi audit.

### 3.4 Produk dan konfigurasi outlet

Produk dibuat satu kali di level business:

```text
products
- id
- business_id
- sku
- barcode
- name
- category
- unit
- buy_unit
- sell_unit
- conversion_factor
- is_active
```

Atribut yang dapat berbeda antar outlet berada di tabel relasi:

```text
outlet_products
- outlet_id
- product_id
- sell_price
- wholesale_price
- min_stock
- max_stock
- is_active
- created_at
- updated_at
```

Stok dipisahkan dari master produk:

```text
stock_balances
- outlet_id atau warehouse_id
- product_id
- quantity
- reserved_quantity
- updated_at
```

Tahap sementara boleh mempertahankan `products.outlet_id` untuk kompatibilitas, tetapi target akhir adalah produk global + konfigurasi `outlet_products`.

### 3.5 Transaksi operasional

Tabel berikut minimal harus memiliki `business_id` atau dapat diturunkan secara aman dari `outlet_id`, dan wajib memiliki `outlet_id` bila aktivitasnya terjadi di outlet:

- `orders`
- `order_items`
- `shifts`
- `cash_flows`
- `petty_cash`
- `void_records`
- `stock_mutations`
- `purchase_orders`
- `promos`
- `vouchers`
- `loyalty_transactions`
- `customers` bila pelanggan memang dibatasi per outlet

Relasi antar-record yang terkait transaksi harus konsisten. `order_items` tidak boleh memiliki outlet berbeda dari `orders` induknya.

### 3.6 Gudang dan lokasi stok

Outlet bukan gudang. Untuk tahap awal, satu outlet dapat memiliki gudang default. Target evolusi:

```text
warehouses
- id
- business_id
- outlet_id nullable
- code
- name
- type: outlet | central | transit | damaged
- is_active
```

Gunakan gudang pusat hanya ketika operasi nyata memiliki pembelian pusat atau distribusi antar cabang. Jangan memaksa semua pengguna membuat gudang pusat saat baru memakai satu outlet.

---

## 4. Perilaku Single Outlet dan Multi Outlet

### 4.1 Single outlet

Konfigurasi:

```text
business.operating_mode = 'single'
```

Perilaku:

- sistem memilih outlet default otomatis;
- outlet switcher dapat disembunyikan dari kasir;
- laporan default hanya outlet default;
- user baru diarahkan ke outlet default;
- stok, shift, kas, transaksi, dan printer tetap memiliki `outlet_id`;
- owner tetap dapat melihat konfigurasi outlet tersebut.

Single outlet adalah mode sederhana, bukan mode tanpa outlet.

### 4.2 Multi outlet

Konfigurasi:

```text
business.operating_mode = 'multi'
```

Perilaku:

- owner melihat outlet switcher dan daftar outlet;
- manager/kasir hanya melihat outlet sesuai membership;
- outlet aktif dipulihkan dari sesi/perangkat;
- laporan memiliki filter `outlet tertentu` dan `semua outlet` sesuai hak akses;
- tambah outlet tidak menyalin stok secara otomatis;
- outlet baru mulai dari konfigurasi dan stok yang eksplisit.

### 4.3 Perubahan single → multi

Alur:

1. Owner memilih Multi Outlet di **Data Usaha**.
2. Sistem mempertahankan outlet default yang sudah ada.
3. Sistem menampilkan konfirmasi bahwa histori tetap berada di outlet lama.
4. Owner dapat menambahkan outlet kedua dan seterusnya.
5. Tidak ada duplikasi produk, transaksi, atau stok.

### 4.4 Perubahan multi → single

Alur:

1. Owner memilih Single Outlet.
2. Jika ada lebih dari satu outlet aktif, sistem meminta memilih outlet utama.
3. Outlet terpilih menjadi default operasional.
4. Outlet lain diarsipkan/disembunyikan dari operasional, bukan dihapus.
5. Histori, stok, transaksi, dan laporan outlet lain tetap tersimpan.
6. Saat mode Multi Outlet diaktifkan kembali, outlet yang diarsipkan dapat dipulihkan.

Jangan otomatis menggabungkan stok, kas, atau transaksi saat berpindah ke single outlet. Penggabungan adalah proses rekonsiliasi terpisah.

---

## 5. Pengaturan UI

Urutan Pengaturan:

1. **Outlet**
2. **Data Usaha**
3. **POS & Tampilan**
4. **Printer**
5. **Lisensi**

### Outlet

- outlet aktif;
- daftar outlet;
- tambah/edit outlet;
- kode outlet;
- alamat dan telepon;
- tarif pajak dan footer struk;
- status aktif/arsip;
- perangkat/printer outlet bila telah tersedia.

### Data Usaha

- nama usaha;
- pemilik;
- nomor WhatsApp;
- alamat legal;
- mode operasional Single Outlet/Multi Outlet;
- pengaturan global dan lisensi.

### Aturan UI

- Mode operasional hanya dapat diubah owner.
- Manager/kasir tidak dapat mengubah mode.
- Pengubahan mode memakai dialog konfirmasi.
- UI tidak boleh menghapus histori ketika outlet diarsipkan.
- Pesan konfirmasi harus menyebut dampak nyata terhadap data.

Contoh dialog:

> Mode Single Outlet akan memakai satu outlet utama untuk operasional. Outlet lain tidak dihapus; outlet tersebut hanya disembunyikan sampai mode Multi Outlet diaktifkan kembali.

---

## 6. Migrasi Database Bertahap

Migration harus additive dan dapat diulang. Jangan mengubah migration lama yang sudah diterapkan di production.

### Fase DB-1 — Business dan outlet

1. Tambahkan `businesses.operating_mode` dengan default `single`.
2. Tambahkan `outlets.code` dengan unique constraint per business.
3. Tambahkan `archived_at`.
4. Pastikan setiap owner memiliki business.
5. Buat satu outlet default untuk business lama.
6. Ambil nama outlet dari konfigurasi toko lama bila tersedia.
7. Isi `businesses.name` dari `namaUsaha`, bukan nama pemilik.

### Fase DB-2 — Backfill outlet_id

1. Tambahkan `outlet_id` nullable pada tabel operasional.
2. Backfill record lama ke outlet default.
3. Verifikasi jumlah record sebelum dan sesudah backfill.
4. Tambahkan index `(outlet_id, created_at)` pada tabel transaksi dan kas.
5. Setelah seluruh writer sudah mengisi outlet, ubah menjadi `not null` pada tabel yang memang selalu terjadi di outlet.

### Fase DB-3 — Membership dan RLS

RLS harus menggunakan helper yang konsisten, misalnya:

```sql
public.is_business_owner(business_id uuid)
public.can_access_outlet(outlet_id uuid)
public.can_manage_outlet(outlet_id uuid)
```

Kebijakan minimal:

- owner dapat mengelola semua outlet business-nya;
- manager/kasir/stock hanya dapat membaca/menulis outlet membership-nya;
- user tanpa membership tidak dapat membaca data outlet;
- insert/update harus memvalidasi outlet yang ditulis, bukan hanya user login;
- `outlet_id` tidak boleh diganti ke outlet lain oleh kasir;
- tabel anak mengikuti outlet induk.

### Fase DB-4 — Produk global

1. Tambahkan `business_id` ke master produk.
2. Buat unique `(business_id, sku)` dan `(business_id, barcode)`.
3. Buat `outlet_products`.
4. Salin harga/stok lokal dari produk lama ke relasi outlet.
5. Setelah consumer selesai dimigrasikan, hentikan penggunaan atribut outlet dari master product.

### Fase DB-5 — Warehouse dan transfer

Dilakukan hanya saat operasi membutuhkan distribusi pusat atau transfer antarcabang. Jangan memasukkan kompleksitas ini ke onboarding single outlet.

---

## 7. Sinkronisasi Offline-First

### Context

Semua operasi domain harus memperoleh `activeOutletId` dari context terpusat. Tidak boleh mengambil outlet dari state UI secara acak.

### Local storage

Record lokal perlu memiliki `outletId` atau `outlet_id`. Penyimpanan harus memakai salah satu strategi konsisten:

- object store terpisah per domain dengan filter `outlet_id`; atau
- key komposit `(outlet_id, id)`; atau
- store per outlet bila volume dan kebutuhan benar-benar membenarkannya.

Strategi minimum yang aman:

- simpan `outlet_id` pada setiap record;
- query local selalu memfilter outlet aktif;
- saat switch outlet, reload seluruh signal domain;
- kosongkan cart/held order yang tidak boleh terbawa antar outlet;
- counter order menggunakan key `order_counter_{outlet_id}_{tanggal}`.

### Outbox

Setiap outbox entry wajib menyimpan:

```text
outletId
recordId
table
operation
row
createdAt
```

Saat flush, gunakan `outletId` entry, bukan outlet aktif saat itu. Ini mencegah transaksi yang dibuat di Outlet A terkirim ke Outlet B jika user berpindah outlet sebelum internet kembali.

### Pull

Pull harus selalu:

- mengambil outlet yang diizinkan user;
- memfilter `outlet_id` untuk tabel outlet-scoped;
- menggabungkan data tanpa menimpa perubahan pending lokal;
- menolak/mencatat row tanpa `outlet_id` setelah fase backfill selesai.

### Perpindahan outlet

Urutan aman:

1. flush atau simpan pending lokal;
2. hentikan mutasi sementara;
3. ubah `activeOutletId`;
4. clear transient state seperti cart/held order bila kebijakan mengharuskan;
5. pull outlet baru;
6. isi ulang products, stock, customers, orders, shift, kas, dan promo;
7. aktifkan kembali transaksi.

---

## 8. Transaksi, Kas, Stok, dan Harga

### Transaksi

Nomor transaksi harus memiliki counter per outlet dan tanggal. Contoh:

```text
KTS-202603-000123
```

`orders.outlet_id` wajib konsisten dengan shift dan kasir.

### Shift dan kas

Shift wajib menyimpan:

- `outlet_id`
- `cashier_id`
- `device_id` atau register
- saldo awal
- saldo yang diharapkan
- saldo fisik
- selisih
- waktu buka/tutup

### Harga

Gunakan hirarki:

```text
harga dasar business
→ harga khusus outlet bila ada
→ harga promosi aktif bila memenuhi syarat
```

Jangan membuat produk duplikat hanya karena harga outlet berbeda.

### Transfer stok

Transfer antar outlet harus menjadi dokumen dengan status:

```text
draft → requested → approved → shipped → received
```

Kuantitas diminta, dikirim, dan diterima harus terpisah. Stok outlet tujuan bertambah ketika penerimaan dikonfirmasi, bukan ketika permintaan dibuat.

---

## 9. Perubahan Kode yang Dibutuhkan

### State dan context

- `businessContext`
- `operatingMode`
- `outlets`
- `activeOutletId`
- `activeWarehouseId` bila warehouse sudah digunakan

### Service

- `outlet-service`: load, create, update, archive, switch
- `membership-service`: daftar dan assignment user
- `business-service`: mode operasional dan data usaha
- `transfer-service`: transfer stok
- `pricing-service`: harga dasar dan override outlet

### Domain types

Tambahkan `outletId` ke interface domain yang outlet-scoped:

- `Order`
- `Shift`
- `CashFlow`
- `ProductStock`
- `StockMovement`
- `PurchaseOrder`
- `Promo`
- `Voucher` bila promo dibatasi outlet
- `LoyaltyTransaction`

### UI

- Outlet switcher yang mengikuti role.
- Mode selector di Data Usaha.
- Outlet assignment pada Staff.
- Filter outlet pada laporan.
- Dialog archive/restore outlet.
- Indikator outlet aktif pada POS dan header laporan.

---

## 10. Validasi dan Acceptance Criteria

### Onboarding

- User pertama menjadi owner.
- Business dan satu outlet default dibuat otomatis.
- Nama usaha masuk ke business.
- Nama outlet masuk ke outlet.
- Mode default adalah single outlet.

### Single outlet

- Kasir tidak perlu memilih outlet.
- Semua transaksi memiliki `outlet_id`.
- Counter transaksi tidak tercampur dengan business lain.
- Perubahan nama outlet tidak mengubah nama usaha.

### Single → multi

- Outlet lama tetap ada.
- Data lama tidak berpindah.
- Owner dapat menambah outlet.
- User dapat ditugaskan ke outlet tertentu.

### Multi → single

- Owner memilih outlet utama.
- Outlet lain tidak dihapus.
- Histori tetap dapat dilaporkan.
- Multi outlet dapat diaktifkan kembali.

### Isolasi

- Kasir Outlet A tidak dapat membaca order Outlet B.
- Produk global dapat muncul di beberapa outlet.
- Harga dan stok dapat berbeda antar outlet.
- RLS menolak insert dengan outlet yang tidak dimiliki.
- Outbox offline tidak salah outlet setelah perpindahan context.

### Operasional

- Shift memiliki outlet.
- Kas memiliki outlet.
- Stok opname memiliki outlet/gudang.
- Laporan outlet dan gabungan menghasilkan total yang konsisten.
- Transfer stok meninggalkan audit trail.

### Teknis

- `tsc --noEmit` lulus.
- production build lulus.
- migration dapat diterapkan pada database existing tanpa menghapus data.
- pull/push online dan offline diuji pada minimal dua outlet.
- RLS diuji menggunakan owner, manager, cashier, dan user tanpa membership.

---

## 11. MVP dan Roadmap Modul

### 11.1 Definisi MVP: Multi-Outlet Core

MVP bukan seluruh sistem cabang. MVP selesai bila dua outlet dapat beroperasi tanpa data tertukar, baik online maupun offline.

**MVP wajib mencakup:**

1. **Business dan mode operasional**
   - satu business per unit usaha;
   - `operating_mode`: `single` atau `multi`;
   - mode default single;
   - mode dapat diubah owner tanpa menghapus data.
2. **Outlet**
   - satu outlet default otomatis saat onboarding;
   - tambah, edit, aktifkan, dan arsipkan outlet;
   - kode outlet unik;
   - satu outlet aktif pada satu context perangkat.
3. **Membership dan akses**
   - owner dapat mengakses semua outlet;
   - manager/kasir/stok ditugaskan ke outlet;
   - RLS memblokir akses outlet yang tidak ditugaskan.
4. **Konteks aplikasi**
   - outlet aktif tampil jelas di POS, header, dan laporan;
   - switch outlet hanya untuk role yang berhak;
   - kasir tidak dapat pindah outlet saat shift aktif.
5. **Data operasional inti**
   - produk, stok, order, shift, kas, dan laporan memiliki `outlet_id`;
   - counter order terpisah per outlet dan tanggal;
   - histori lama dibackfill ke outlet default.
6. **Offline-first**
   - local records difilter berdasarkan outlet;
   - outbox menyimpan outlet asal secara permanen;
   - pull/push tidak dapat mengirim data ke outlet aktif yang berbeda.
7. **Produk dan harga tahap MVP**
   - master produk boleh tetap kompatibel dengan struktur lama;
   - harga jual, stok minimum, dan status aktif harus dapat berbeda per outlet;
   - tidak boleh membuat produk duplikat hanya karena outlet berbeda.
8. **Validasi keamanan dan QA**
   - test owner, manager, kasir, dan user tanpa membership;
   - test dua outlet online/offline;
   - test perubahan single ke multi dan multi ke single.

**Bukan bagian MVP:** gudang pusat, transfer stok, purchase workflow kompleks, loyalty lintas outlet, promosi lintas outlet, dan rekonsiliasi antar-gudang.

### 11.2 Modul pengembangan setelah MVP

#### Modul A — Master produk dan pricing

- pisahkan `products` global dari `outlet_products`;
- harga dasar business;
- harga khusus outlet;
- minimum/maksimum stok per outlet;
- produk aktif/tidak dijual per outlet;
- riwayat perubahan harga;
- bulk price update.

#### Modul B — Staff dan device management

- assignment staff ke banyak outlet;
- pembatasan role per outlet;
- daftar device/register per outlet;
- printer per device;
- pencabutan device;
- audit login dan perpindahan outlet.

#### Modul C — Purchasing dan receiving

- supplier global;
- purchase order dengan outlet tujuan;
- approval manager/owner;
- penerimaan parsial;
- stok bertambah saat penerimaan, bukan saat PO dibuat;
- retur ke supplier.

#### Modul D — Stock control

- stock opname per outlet;
- mutasi dengan alasan;
- barang rusak, kadaluarsa, dan retur;
- approval koreksi stok;
- kartu stok dan audit trail.

#### Modul E — Transfer antar outlet

- permintaan transfer;
- persetujuan;
- pengiriman/transit;
- penerimaan parsial;
- rekonsiliasi selisih;
- status `draft`, `requested`, `approved`, `shipped`, `received`, `cancelled`.

#### Modul F — Warehouse dan distribution center

Dibangun hanya jika bisnis benar-benar membeli terpusat atau mendistribusikan barang ke cabang:

- gudang pusat;
- gudang belakang outlet;
- lokasi transit;
- stok rusak/retur;
- replenishment otomatis atau manual.

#### Modul G — Promotion dan loyalty

- promo per outlet;
- promo semua outlet;
- periode dan kuota promo;
- voucher berbatas outlet;
- loyalty lintas outlet atau per outlet sesuai kebijakan bisnis.

#### Modul H — Reporting dan reconciliation

- laporan outlet;
- laporan semua outlet;
- perbandingan omzet dan margin;
- kas outlet vs sistem;
- stok dan shrinkage;
- penjualan per device/kasir;
- export dengan filter outlet.

#### Modul I — Audit dan governance

- audit perubahan mode;
- audit outlet archive/restore;
- audit perubahan harga;
- audit koreksi stok;
- audit transfer;
- approval matrix untuk owner dan manager.

### 11.3 Tahapan implementasi MVP

Bagian ini adalah checklist eksekusi tahap pertama. Implementasi berhenti setelah acceptance criteria MVP terpenuhi; modul pengembangan berikutnya tidak boleh ditarik masuk ke MVP.

Setiap pekerjaan MVP mengikuti urutan:

```text
Domain & migration → service/API → local/offline → UI → RLS/security → QA operasional
```

#### MVP-0 — Persiapan dan baseline

**Tujuan:** mengunci kondisi awal sebelum migrasi.

- inventaris tabel, signal, service, dan query yang memakai data toko;
- backup database dan verifikasi restore;
- tetapkan outlet default untuk seluruh data lama;
- dokumentasikan mapping field lama ke field baru;
- siapkan data uji minimal dua outlet, dua manager/kasir, dan produk yang sama;
- ukur baseline: jumlah produk, order, shift, stok, dan record kas.

**Selesai jika:** backup tervalidasi, mapping disetujui, dan dataset uji dapat diulang.

#### MVP-1 — Business, mode, dan outlet core

**Tujuan:** dua outlet dapat beroperasi tanpa data tertukar.

1. Tambahkan `operating_mode`, `outlet.code`, status aktif/arsip, dan membership.
2. Backfill seluruh record lama ke outlet default.
3. Tambahkan `outlet_id` pada domain type, local record, outbox, dan remote row.
4. Implementasikan outlet context dan switch dengan reload state.
5. Terapkan RLS pada outlet, membership, order, produk/stok, shift, kas, dan laporan.
6. Pisahkan counter transaksi per outlet dan tanggal.
7. Tambahkan selector Single/Multi Outlet di Data Usaha.
8. Sembunyikan kompleksitas outlet untuk kasir pada mode single.
9. Uji perpindahan outlet, shift aktif, cart, offline queue, dan login ulang.

**Selesai jika:** owner dapat mengelola dua outlet, kasir hanya melihat outletnya, dan transaksi offline tetap kembali ke outlet asal.

### 11.4 Tahapan implementasi pengembangan berikutnya

Bagian ini **bukan MVP**. Modul hanya dikerjakan setelah MVP-0 dan MVP-1 lulus QA dua outlet, RLS, dan offline queue.

#### Pengembangan-1 — Modul A: Master Produk dan Pricing

**Tujuan:** satu produk dapat digunakan banyak outlet dengan harga/stok lokal.

1. Tambahkan `business_id` pada master produk.
2. Buat `outlet_products` untuk harga, minimum/maksimum stok, dan status aktif.
3. Migrasikan harga/stok lama ke konfigurasi outlet.
4. Tetapkan aturan resolusi harga: harga outlet → harga dasar business.
5. Update pencarian barcode, POS, stok, dan laporan.
6. Tambahkan bulk update harga dengan preview dan audit.
7. Terapkan RLS business/outlet pada master dan konfigurasi produk.

**Selesai jika:** SKU/barcode hanya satu di level business, tetapi harga dan status jual dapat berbeda antar outlet.

#### Pengembangan-2 — Modul B: Staff dan Device Management

**Tujuan:** setiap user dan perangkat hanya bekerja dalam konteks yang sah.

1. Tambahkan UI assignment user ke satu atau beberapa outlet.
2. Bedakan role business-level owner dari role outlet-level manager/kasir/stok.
3. Tambahkan daftar device/register per outlet.
4. Kaitkan printer dan konfigurasi POS ke device, bukan hanya outlet.
5. Tolak login/operasi jika user tidak memiliki outlet yang valid.
6. Cegah pindah outlet saat kasir masih memiliki shift aktif.
7. Catat audit login, assignment, pencabutan akses, dan perpindahan outlet.

**Selesai jika:** manager/kasir hanya dapat login dan bertransaksi di outlet yang ditugaskan serta owner dapat mencabut akses tanpa menghapus histori.

#### Pengembangan-3 — Modul C: Purchasing dan Receiving

**Tujuan:** pembelian menambah stok pada outlet yang benar dan dapat diaudit.

1. Pertahankan supplier sebagai master business.
2. Tambahkan tujuan penerimaan pada purchase order.
3. Buat status `draft`, `submitted`, `approved`, `partially_received`, `received`, `cancelled`.
4. Pisahkan kuantitas dipesan, diterima, dan ditolak.
5. Tambah stok hanya saat receiving dikonfirmasi.
6. Tambahkan retur supplier dan koreksi penerimaan.
7. Kaitkan PO, receiving, stock mutation, dan outlet dalam satu audit trail.

**Selesai jika:** PO yang belum diterima tidak mengubah stok dan penerimaan parsial menghasilkan saldo yang benar.

#### Pengembangan-4 — Modul D: Stock Control

**Tujuan:** setiap perubahan stok memiliki alasan dan histori.

1. Buat/rapikan `stock_mutations` per outlet atau warehouse.
2. Tambahkan stock opname dengan snapshot, hitung fisik, selisih, dan approval.
3. Tambahkan alasan wajib untuk koreksi stok.
4. Tambahkan alur barang rusak, kadaluarsa, dan retur.
5. Hitung stok berjalan dari mutasi dan sediakan balance untuk pembacaan cepat.
6. Tambahkan kartu stok dan audit perubahan.
7. Batasi koreksi besar pada owner/manager.

**Selesai jika:** saldo stok dapat direkonsiliasi ke histori mutasi dan setiap selisih memiliki pelaku serta alasan.

#### Pengembangan-5 — Modul E: Transfer Antar Outlet

**Tujuan:** pemindahan barang antar outlet tidak menghilangkan jejak transit.

1. Buat `stock_transfers` dan `stock_transfer_items`.
2. Implementasikan status `draft`, `requested`, `approved`, `shipped`, `received`, `cancelled`.
3. Pisahkan qty diminta, dikirim, diterima, dan selisih.
4. Kurangi stok asal saat barang dikirim, bukan saat permintaan dibuat.
5. Tambah stok tujuan saat penerimaan dikonfirmasi.
6. Dukung penerimaan parsial dan penolakan selisih.
7. Tambahkan notifikasi dan audit untuk pengirim/penerima.

**Selesai jika:** stok transit, selisih kirim-terima, dan histori kedua outlet dapat ditelusuri.

#### Pengembangan-6 — Modul F: Warehouse dan Distribution Center

**Tujuan:** mendukung pembelian/distribusi pusat hanya bila operasi bisnis membutuhkannya.

1. Tambahkan `warehouses` dan tipe lokasi: outlet, central, transit, damaged.
2. Pindahkan saldo stok dari outlet langsung ke warehouse/location bila diperlukan.
3. Tentukan pemilik stok dan aturan replenishment.
4. Ubah receiving dan transfer agar dapat memakai warehouse sebagai tujuan.
5. Tambahkan laporan stok pusat, transit, dan outlet.
6. Migrasikan secara bertahap; jangan menghapus histori outlet.

**Selesai jika:** stok pusat dan stok outlet dapat dipisahkan serta distribusi tidak dihitung sebagai penjualan.

#### Pengembangan-7 — Modul G: Promotion dan Loyalty

**Tujuan:** promo dapat berlaku global atau terbatas pada outlet tanpa konflik.

1. Tambahkan scope promo: business, outlet tertentu, atau kelompok outlet.
2. Validasi periode, kuota, kombinasi produk, dan prioritas promo.
3. Kaitkan voucher dengan scope outlet bila diperlukan.
4. Tentukan apakah saldo/poin pelanggan bersifat lintas outlet atau per outlet.
5. Uji konflik promo dan pembatalan transaksi.
6. Simpan snapshot aturan promo pada order agar histori tidak berubah ketika promo diedit.

**Selesai jika:** order lama tetap menghitung promo sesuai aturan saat transaksi dan promo outlet tidak bocor ke outlet lain.

#### Pengembangan-8 — Modul H: Reporting dan Reconciliation

**Tujuan:** owner memperoleh angka gabungan yang dapat direkonsiliasi.

1. Sediakan filter outlet, tanggal, kasir, device, produk, dan kategori.
2. Buat laporan omzet, transaksi, margin, stok, kas, retur, dan shrinkage per outlet.
3. Buat laporan gabungan dengan aturan agregasi yang jelas.
4. Rekonsiliasi kas: opening, penjualan, cash flow, expected, actual, variance.
5. Rekonsiliasi stok: saldo awal, pembelian, penjualan, mutasi, koreksi, saldo akhir.
6. Kunci data periode yang sudah ditutup bila diperlukan.
7. Uji total outlet sama dengan total gabungan.

**Selesai jika:** owner dapat membandingkan outlet dan total laporan dapat ditelusuri kembali ke transaksi sumber.

#### Pengembangan-9 — Modul I: Audit dan Governance

**Tujuan:** perubahan penting dapat dipertanggungjawabkan.

1. Buat audit log append-only untuk mode, outlet, membership, harga, stok, transfer, dan kas.
2. Tentukan approval matrix owner/manager.
3. Tambahkan alasan wajib untuk void, refund, koreksi stok, dan perubahan harga.
4. Sediakan pencarian histori berdasarkan user, outlet, waktu, dan record.
5. Tambahkan prosedur restore dan pemeriksaan integritas data.
6. Dokumentasikan siapa yang boleh melakukan tindakan destruktif.

**Selesai jika:** setiap perubahan sensitif memiliki actor, waktu, outlet, nilai sebelum/sesudah, dan alasan.

### 11.5 Urutan implementasi sprint

#### Sprint 1 — MVP context dan security

- `operating_mode`;
- business/outlet default yang benar;
- outlet code;
- membership;
- helper RLS;
- outbox outlet scope;
- switcher dan mode selector.

#### Sprint 2 — MVP data operasional

- reload state saat switch outlet;
- local filter;
- counter per outlet;
- shift, kas, order, stok dengan outlet scope;
- assignment staf dasar;
- dua-outlet online/offline QA.

#### Sprint 3 — Produk dan pricing

- master produk global;
- `outlet_products`;
- harga dan minimum stok per outlet;
- laporan stok per outlet.

#### Sprint 4 — Purchasing dan stock control

- penerimaan pembelian;
- stock opname;
- barang rusak/retur;
- audit mutasi.

#### Sprint 5 — Transfer dan warehouse

- transfer antar outlet;
- gudang pusat bila diperlukan;
- stok transit;
- replenishment.

#### Sprint 6 — Reporting dan governance

- laporan outlet;
- laporan gabungan;
- perbandingan outlet;
- rekonsiliasi kas dan stok;
- audit log lengkap.

---

## 12. Keputusan yang Tidak Boleh Diambil Sembarangan

Jangan:

- membuat database berbeda untuk single dan multi outlet;
- menghapus outlet ketika mode dikembalikan ke single;
- menggabungkan stok dan kas otomatis;
- menggandakan master produk untuk setiap outlet;
- memakai role global tanpa outlet membership;
- mengandalkan filter UI sebagai pengganti RLS;
- menentukan outlet outbox dari outlet aktif saat flush;
- menambah gudang pusat sebelum proses bisnisnya memang ada;
- membuat semua pengaturan outlet menjadi global;
- mengubah `outlet_id` histori transaksi.

---

## Kesimpulan

Arsitektur yang dituju adalah **satu business dengan satu atau banyak outlet**, bukan dua aplikasi atau dua skema terpisah. Mode Single Outlet menyederhanakan pengalaman pengguna, sedangkan struktur database tetap siap untuk ekspansi. Dengan begitu, minimarket kecil dapat mulai sederhana tanpa migrasi besar di kemudian hari, sementara owner yang membuka cabang dapat mengaktifkan mode Multi Outlet tanpa kehilangan histori operasional.
