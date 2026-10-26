# Kasol App Feature Parity Roadmap

Tanggal: 2026-10-25

## Scope

Kaki5 menjadi referensi pola keamanan dan operasional. Rosok dan Laundry tetap mempertahankan schema/domain masing-masing; porting tidak menyamakan nama tabel, prefix lisensi, salt, atau setting lintas aplikasi.

| Area | Kaki5 | Rosok | Laundry | Prioritas |
|---|---|---|---|---|
| Lisensi/device/quota/offline | Referensi lengkap | Hampir parity; collision/readback lebih kuat | Modul modern sudah ada, legacy wiring perlu diaudit | P1 audit |
| Backup lokal | Signed, validated, atomic | Signed + validated + atomic | Legacy inline/raw JSON; belum terisolasi | P0 Laundry |
| Cloud backup | Envelope SHA-256 + unit binding | Latest-only, belum envelope | Belum setara; receipt/cloud legacy | P0 Rosok/Laundry |
| Storage privacy | Relative path + private-bucket contract | Bukti masih public-read; path policy perlu server gate | Public URL flow | P0 privacy |
| Telemetry | Sanitized diagnostics | Operasional kuat, perlu server constraints | Legacy raw UA path masih ada | P1 |
| PWA/update/settings | Lengkap | Lengkap | Belum ada SW/update overlay | P1 |
| Domain operations | POS/kas/laporan | Rosok/kas/laporan/riwayat | Order status, DP/piutang, stok, pelanggan | P2 preserve domain |

## Kontrak yang tidak boleh tercampur

- Product/license prefix: `K5`, `KSR`, `KSL`.
- Unit identity dan setting keys mengikuti aplikasi asal.
- Rosok backup mempertahankan `kategori`, `transaksi`, `transaksiItem`, `kas`, `kasShift`, `tutupBuku`.
- Laundry backup harus mengikuti schema laundry setelah migrasi storage, bukan menyalin tabel kaki5/rosok.
- Client-side path validation tidak menggantikan RLS/Storage policy server.

## Gate

Setiap gelombang menghasilkan fixture, static/runtime QA, laporan blocker, dan candidate-ready. Tidak ada commit, push, beta release, atau live release otomatis.
