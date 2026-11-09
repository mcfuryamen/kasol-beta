# Stage 4 — Auth/session hardening kaki5

Stage 4 memperketat binding session anonim terhadap `unit_id` sebelum query RLS
ke tabel `clients`.

## Invariants

- Session tanpa user ditolak sebagai `no-session`.
- Session dengan claim `unit_id` kosong atau berbeda ditolak sebagai `claim-mismatch`.
- Jika session lama perlu claim baru, client menjalankan `updateUser` lalu
  `refreshSession`; token lama tidak dipakai untuk query berikutnya.
- Hasil refresh diverifikasi ulang sebelum caller boleh melanjutkan.
- Kegagalan refresh diklasifikasikan sebagai `claim-refresh`, bukan `no-profile`.
- Jalur sign-in anonim baru juga diverifikasi claim-nya.

## Batasan

Ini hanya memperbaiki client-side session sequencing. RLS, RPC
`device_known/device_assign`, policy Storage, dan policy `sync_errors` tetap
memerlukan verifikasi authenticated di staging Supabase. Tidak ada migration
atau perubahan production yang dilakukan pada tahap ini.
