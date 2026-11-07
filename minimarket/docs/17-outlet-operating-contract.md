# Kontrak Operasional Single/Multi-Outlet

Status: **Tahap 1 — kontrak dan acceptance criteria**  
Tanggal: 2026-10-06  
Scope: aplikasi minimarket, Supabase Auth/Postgres, local-first sync

Dokumen ini adalah kontrak penerimaan sebelum hardening schema, isolasi local store, dan QA dua outlet. Dokumen arsitektur historis tetap menjadi referensi target jangka panjang; dokumen ini menetapkan perilaku yang wajib dipenuhi MVP saat ini.

## 1. Model operasi

### Single outlet

- Satu business memiliki minimal satu outlet operasional dan satu outlet default.
- UI tidak mewajibkan kasir memilih outlet.
- Semua transaksi baru menggunakan outlet operasional default yang valid.
- Mengubah mode ke `single` tidak menghapus outlet, user, transaksi, stok, shift, atau histori kas.
- Jika business memiliki beberapa outlet saat mode diubah ke `single`, aplikasi harus memilih satu outlet default secara eksplisit dan tidak boleh diam-diam memindahkan histori.

### Multi outlet

- Business dapat memiliki beberapa outlet aktif.
- User hanya dapat memilih outlet yang diizinkan oleh membership-nya; owner dapat mengakses seluruh outlet business sesuai kebijakan RLS.
- Semua data operasional baru harus membawa `outlet_id` outlet aktif yang valid.
- Perpindahan outlet tidak menghapus histori; state lokal dan pull berikutnya harus menampilkan data outlet yang dipilih saja.
- Outlet yang diarsipkan tidak dapat dipilih untuk operasi baru.

### Perubahan mode

- Perubahan mode hanya boleh dilakukan owner.
- Perubahan mode harus idempotent dan persisten setelah reload/logout-login.
- Perubahan mode tidak mengubah atau menghapus data historis.

## 2. Membership dan akses

- Boundary akses adalah `business_id` dan `outlet_id`, bukan UI saja.
- Setiap membership harus menunjuk ke outlet dalam business yang sama.
- Owner: dapat melihat dan mengelola seluruh outlet business sesuai policy.
- Manager: hanya outlet yang ditugaskan.
- Cashier: POS, shift, dan operasi kas pada outlet yang ditugaskan.
- Stock: stok, penerimaan, dan opname pada outlet yang ditugaskan.
- User tanpa membership outlet yang sah tidak boleh membaca atau menulis data operasional outlet tersebut.
- Cross-outlet read, insert, update, dan delete harus ditolak oleh RLS/constraint walaupun request dibuat langsung, bukan hanya melalui UI.

## 3. Invariant data operasional

Tabel berikut termasuk boundary outlet MVP dan wajib diperiksa:

- `pos_products`
- `customers`
- `orders`
- `order_items`
- `shifts`
- `cash_flows`
- `petty_cash`
- `void_records`
- `stock_mutations`
- `suppliers`
- `purchase_orders`
- `promos`
- `vouchers`
- `loyalty_transactions` bila diklaim cloud-synced

Aturan:

1. Setiap row cloud operasional memiliki `outlet_id` valid atau secara eksplisit didokumentasikan sebagai global/local-only.
2. `outlet_id` tidak boleh berubah setelah row dibuat.
3. Row child harus memiliki outlet yang sama dengan parent:
   - `order_items` = `orders`
   - cash flow/petty cash = `shifts`
   - void/return = `orders`
   - stock mutation = produk/outlet yang sesuai
   - PO item/konfigurasi = PO/outlet yang sesuai
4. Sentinel seperti `local-default-outlet` tidak boleh dikirim ke Supabase.
5. Data lama boleh tetap nullable hanya selama fase observasi; sebelum release final harus ada bukti zero-null dan migration `NOT NULL` terpisah.
6. Identitas produk (SKU/barcode global atau per outlet) harus diputuskan eksplisit dan diuji konsisten dengan constraint database.

### Explicitly local-only

Jika belum ada kontrak remote dan puller, data berikut belum boleh dianggap memenuhi sinkronisasi multi-outlet:

- `opnames`
- `batches`
- `staff` lokal
- `storeSettings`/`store_settings` sampai jalur cloud-nya tersedia
- `loyalty_transactions` sampai writer, puller, dan RLS cloud tersedia

## 4. Active outlet dan local state

- `activeOutletId` harus selalu berasal dari outlet aktif yang sah untuk user/business.
- Saat outlet berpindah, semua signal domain dan local snapshot yang digunakan UI harus disaring/dimuat ulang untuk outlet baru.
- Tidak boleh ada produk, order, shift, kas, customer, supplier, promo, voucher, atau stock movement outlet lama yang tampil sebagai data outlet baru.
- `activeShift`, cart, dan held orders harus mengikuti aturan outlet dan tidak boleh bocor saat perpindahan.
- Pull remote wajib memfilter outlet aktif.
- Local IndexedDB shared store harus dipartisi/difilter berdasarkan `outlet_id`, atau proses switch wajib mengganti snapshot secara atomik.

## 5. Offline queue

- Outbox entry menyimpan `outletId` immutable saat enqueue.
- Flush memakai outlet asal entry, bukan `activeOutletId` saat flush.
- Skenario wajib: enqueue di A → pindah ke B → reconnect → flush; row harus tetap masuk ke A.
- Delete juga harus menggunakan outlet context entry sebagai bagian dari guard/predicate, bukan hanya record ID.
- Entry legacy tanpa outlet valid tidak boleh diam-diam dikirim ke outlet aktif atau ke sentinel; harus diparkir dan dilaporkan untuk pemulihan.
- Queue overflow dan parked entries harus tetap terlihat sebagai status, bukan dianggap sukses.

## 6. Acceptance gate Tahap 1

Tahap 1 dianggap selesai bila:

- kontrak ini disetujui sebagai sumber aturan implementasi;
- seluruh tabel, writer, puller, local store, dan gap sudah diinventarisasi;
- matriks QA dua outlet tersedia;
- setiap gap memiliki tahap remediasi dan bukti yang akan dikumpulkan;
- tidak ada klaim “selesai” hanya berdasarkan tabel kosong atau UI demo.

Tahap 1 **tidak** menyatakan RLS, local isolation, atau two-outlet E2E sudah lulus. Itu harus dibuktikan pada tahap berikutnya dengan test dan artefak hasil.
