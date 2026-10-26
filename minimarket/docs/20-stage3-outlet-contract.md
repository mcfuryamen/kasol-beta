# Tahap 3 — Kontrak Outlet Operasional

Status: **staging PASS — NOT NULL diterapkan**  
Tanggal: 2026-10-07

## Keputusan kontrak

1. Tabel produk canonical minimarket = `pos_products`.
2. Identitas produk **unik per outlet**:
   - `unique (outlet_id, sku)` — sudah diterapkan di staging.
   - Barcode mengikuti perilaku yang sama pada tahap final.
   - Dua outlet BOLEH memiliki SKU sama.
3. `order_items.product_id` dan `stock_mutations.product_id` memakai FK ke `pos_products` (`ON DELETE SET NULL`) — ledger stok tidak ikut terhapus.
4. Parent-child outlet consistency WAJIB:
   - mismatch parent vs child → ditolak `23514`;
   - dipicu trigger `trg_<table>_outlet_parent`.
5. `store_settings` = legacy/local (belum masuk kontrak outlet sampai jalur cloud sync tersedia).
6. `loyalty_transactions` = cloud-unsupported (tabel belum pernah dibuat migration).
7. Sentinel `local-default-outlet` dilarang masuk outbox cloud:
   - `resolveOutletContext()` mengembalikan null di cloud tanpa outlet valid → writer menolak enqueue;
   - flush memfilter entry tanpa outlet cloud valid;
   - delete remote memakai predicate `outlet_id`.

## Perubahan aplikasi

- `src/data/sync/outlet-context.ts` — helper tunggal outlet context.
- Semua writer (products, customers, orders/items, finance, stock, suppliers/PO, promos/vouchers) memakai helper; fallback sentinel dihapus.
- `sync-engine.ts`:
  - `enqueue` menolak outlet non-cloud (warning, data tetap lokal);
  - `loadOutbox` menyaring entry legacy tanpa outlet cloud;
  - `flush` memfilter entry tanpa outlet cloud valid;
  - delete remote: `.eq("id", ...).eq("outlet_id", entry.outletId)`.
- Tests: `tests/outlet-context.test.ts` (6 kasus kontrak).

## Migration staging

`014_stage3_outlet_contract` pada project `ozsjflxfkbcygbuxgwyf`:

- FK `order_items_product_fkey` → `pos_products` ON DELETE SET NULL.
- FK `stock_mutations_product_fkey` → `pos_products` ON DELETE SET NULL (mengganti cascade berbahaya ke legacy `products`).
- Unique index `uq_pos_products_outlet_sku (outlet_id, sku)`.
- Trigger parent-child outlet wajib untuk order_items, cash_flows, petty_cash, void_records, stock_mutations, vouchers.
- View gate `stage3_outlet_contract_check`.

## Bukti QA staging (REST, user owner)

| Skenario | Hasil |
|---|---|
| cash_flow outlet B merujuk shift outlet A | DITOLAK 23514 `outlet mismatch` |
| order_item outlet B pada order outlet A | DITOLAK 23514 `outlet mismatch` |
| SKU sama di dua outlet berbeda | BERHASIL 201 (outlet-local identity) |
| stock_mutations outlet A pada produk outlet B | DITOLAK 23514 `outlet mismatch` |
| `stage3_outlet_contract_check` null counts | semua 0 |

Fixture QA yang tersisa (untuk observasi): 1 order, 1 shift, 4 pos_products.

## Gate berikutnya (sebelum NOT NULL)

1. ✅ Zero-null terobservasi pada data nyata (order, shift, produk ditulis dengan outlet valid di staging).
2. ✅ Offline queue invariant terverifikasi: row dibuat dengan outlet A tetap di A setelah "pindah"; delete dengan predicate outlet benar menghapus, predicate outlet salah tidak menghapus apa pun (row tetap ada); insert tanpa outlet ditolak RLS 403.
3. ✅ `NOT NULL` diterapkan (migration `stage3_outlet_not_null` + `stage3_loyalty_outlet_not_null`): semua 14 tabel operasional kini `outlet_id NOT NULL`.
4. Production belum disentuh — migration NOT NULL hanya di staging sampai seluruh regression dua outlet lulus dan pemilik menyetujui rilis.
