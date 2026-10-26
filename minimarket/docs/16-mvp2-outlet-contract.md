# MVP-2 — Kontrak Operasional Multi-Outlet

Status: implementasi awal, belum diterapkan ke Supabase produksi.

## Scope

MVP-2 mengamankan operasi POS, shift, kas, stok, pelanggan, supplier, promo, dan sinkronisasi offline per outlet. Warehouse pusat, transfer antar-outlet, dan master produk global tetap di luar scope.

## Perubahan

- `supabase/migrations/011_mvp2_outlet_contract.sql` menambah/backfill `outlet_id`, FK outlet, index outlet-scoped, trigger konsistensi parent-child, view pemeriksaan null, dan policy membership ketat.
- `src/data/sync/sync-engine.ts` menyimpan `outletId` immutable di setiap outbox entry. Flush menggunakan outlet asal, bukan outlet aktif saat flush.
- Writer domain membawa `outlet_id` pada payload produk, order/item, shift/kas, stok, supplier/PO, customer/loyalty, promo/voucher.
- Typecheck dan unit test aplikasi lulus: 24 test.

## Urutan penerapan remote

1. Ambil logical backup dan snapshot schema.
2. Review SQL migration pada staging/branch terlebih dahulu.
3. Terapkan migration 011.
4. Jalankan:

```sql
select * from public.mvp2_outlet_contract_check;
select table_name, row_count, null_outlet_count
from public.mvp2_outlet_contract_check
where null_outlet_count > 0;
```

5. Pastikan `null_outlet_count = 0` untuk semua tabel target.
6. Jalankan QA dua outlet: owner melihat keduanya, kasir hanya outlet assignment, insert/update lintas outlet ditolak.
7. Jalankan QA offline: buat mutasi di outlet A, pindah ke B, online kembali; outbox harus flush ke A.
8. Hanya setelah writer terobservasi tanpa null write, buat migration lanjutan yang menambahkan `NOT NULL`.

## Guard dan rollback

Migration ini tidak menjadikan kolom `outlet_id` `NOT NULL` dan tidak menghapus data. Jika verifikasi gagal, hentikan sebelum writer/QA berikutnya dan pulihkan dari backup. Jangan menjalankan migration langsung di production tanpa review constraint dan nama kolom yang cocok dengan schema aktif.
