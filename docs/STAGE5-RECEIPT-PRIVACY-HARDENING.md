# Stage 5 — Receipt privacy hardening kaki5

## Perubahan aplikasi

- Bukti pembayaran diunggah ke bucket `bukti` memakai object path:
  `<unit_id>/<timestamp>-<random>.jpg`.
- `clients.bukti_url` menyimpan path relatif tersebut, bukan URL publik.
- `getPublicUrl()` tidak lagi dipakai untuk bukti pembayaran.
- Unit ID, suffix, path traversal, URL absolut, dan tipe file divalidasi.
- JPG, PNG, dan WebP dibatasi maksimal 5 MB.

## Trust boundary

Bucket `bukti` harus dikonfigurasi private. Aplikasi kaki5 hanya mengunggah
bukti milik unitnya melalui session/RLS. Control Center/admin harus menghasilkan
signed URL berumur pendek melalui service-role/proxy untuk melihat bukti.

Repository belum memiliki migration canonical `storage.objects` untuk bucket ini,
sehingga policy own-unit/cross-unit belum dinyatakan PASS. Policy harus diterapkan
dan diuji di staging terpisah sebelum perubahan production.
