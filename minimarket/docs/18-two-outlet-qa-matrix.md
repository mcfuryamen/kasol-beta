# Matriks QA Dua Outlet dan Single/Multi

Status: **Tahap 1 — rencana acceptance test**  
Tanggal: 2026-10-06

Dokumen ini mendefinisikan bukti yang harus dikumpulkan. Baris `planned` bukan bukti lulus.

## Data uji minimum

| ID | Data | Harapan |
|---|---|---|
| B1 | Satu business QA | Semua outlet dan user berada pada business yang sama |
| O-A | Outlet A aktif | Kode/nama unik, memiliki produk dan data transaksi pembeda |
| O-B | Outlet B aktif | Kode/nama unik, memiliki produk dan data transaksi pembeda |
| U-O | Owner | Akses sesuai policy ke A dan B |
| U-A | Cashier A | Membership hanya ke A |
| P-A/P-B | Produk pembeda | Tidak memakai nama/SKU yang membuat hasil ambigu |

Simpan ID aktual, role, membership, dan timestamp di artefak hasil; jangan mengandalkan tabel operasional kosong.

## Skenario penerimaan

| ID | Area | Langkah | Expected | Bukti |
|---|---|---|---|---|
| MODE-01 | Single | Set mode `single`, reload/logout-login | UI tidak memaksa pilihan outlet; outlet default valid | screenshot + row `businesses` |
| MODE-02 | Multi | Set mode `multi`, reload/logout-login | Pemilih outlet tersedia; data mode persisten | screenshot + row `businesses` |
| MODE-03 | Retensi | Ubah single↔multi setelah ada histori | Transaksi, stok, shift, kas, user tetap ada | row counts/IDs sebelum-sesudah |
| OUT-01 | Active outlet | Owner pilih A lalu pull | Hanya data A tampil | UI + query filtered |
| OUT-02 | Active outlet | Owner pilih B lalu pull | Hanya data B tampil; A tidak bocor | UI + query filtered |
| OUT-03 | Reload | Reload setelah memilih B | B tetap aktif dan state B termuat | persisted active outlet + UI |
| OUT-04 | Guard shift | Buka shift A lalu coba pindah outlet | Perilaku sesuai kontrak: ditolak atau ditutup secara eksplisit | screenshot + event/log |
| ACL-01 | Membership | U-O login dan baca A/B | Owner melihat outlet yang diizinkan | API response + UI |
| ACL-02 | Membership | U-A login dan baca A | Berhasil | API response |
| ACL-03 | RLS read | U-A query/read B langsung | Ditolak atau hasil kosong sesuai policy | request + response |
| ACL-04 | RLS insert | U-A insert row `outlet_id=B` | Ditolak | SQL/API error |
| ACL-05 | RLS update | U-A update row B | Ditolak | SQL/API error |
| ACL-06 | RLS delete | U-A delete row B | Ditolak | SQL/API error |
| ACL-07 | Parent-child | Child memakai outlet berbeda dari parent | Ditolak trigger/constraint | SQL/API error |
| DATA-01 | Outlet ID | Buat order, shift, kas, stok, product di A/B | Semua row menyimpan outlet yang benar | SQL snapshot |
| DATA-02 | Immutability | Coba ubah `outlet_id` row existing | Ditolak | SQL/API error |
| DATA-03 | Null/sentinel | Audit seluruh target tables | Zero null dan zero `local-default-outlet` sebelum final NOT NULL | contract view + SQL |
| LOCAL-01 | Local state | Pull A → switch B → pull | Signal/IndexedDB hanya data B | IndexedDB dump + UI |
| LOCAL-02 | Shift/cart | Shift/cart/held order A → switch B | Tidak tampil atau terbawa ke B secara salah | UI + local dump |
| QUEUE-01 | Offline | Aktif A, offline, enqueue mutation | Outbox entry menyimpan outlet A | outbox dump |
| QUEUE-02 | Switch | Pindah aktif ke B sebelum reconnect | Entry tetap memiliki A | outbox dump |
| QUEUE-03 | Flush | Reconnect/flush | Row server masuk A, bukan B | server row + request log |
| QUEUE-04 | Delete | Queue delete A, pindah B, flush | Hanya target A terpengaruh; outlet context tetap dijaga | before/after SQL |
| QUEUE-05 | Legacy | Load entry tanpa outlet | Diparkir/dilaporkan, tidak dikirim ke sentinel | outbox + notification |
| PROD-01 | Product identity | Produk dengan SKU/barcode sama pada A/B | Hasil sesuai keputusan global/per-outlet yang terdokumentasi | insert result |

## Bukti struktural sebelum E2E

1. `public.mvp2_outlet_contract_check` menunjukkan semua target table dan `null_outlet_count`.
2. FK outlet dan trigger immutability/parent-child terdaftar.
3. Policy RLS terdaftar untuk seluruh target table.
4. `pos_products` dan relasi stock mutation/order item mengarah ke kontrak produk yang benar.
5. Tidak ada writer cloud yang mengirim `local-default-outlet`.

## Bukti fungsional minimum

- Satu artefak JSON bertimestamp berisi setup, test case, expected, actual, dan verdict.
- SQL/API response untuk ACL-03 sampai ACL-07; screenshot saja tidak cukup.
- Before/after snapshot untuk queue A→B→flush.
- Browser evidence desktop dan mobile untuk mode/outlet switching.
- Catat build/commit, project ref, migration version, dan user test IDs.

## Verdict

- `PASS`: actual memenuhi expected dan bukti tersimpan.
- `FAIL`: actual melanggar expected atau bukti tidak lengkap.
- `BLOCKED`: test tidak dapat dijalankan karena setup/permission/fixture; bukan PASS.
- `NOT RUN`: belum dijalankan.

Checklist dua outlet baru boleh diberi status selesai bila semua `MODE-*`, `OUT-*`, `ACL-*`, `DATA-*`, `LOCAL-*`, dan `QUEUE-*` yang relevan berstatus `PASS`.
