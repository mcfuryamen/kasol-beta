# TPA Identity Projection Migration — Stage C

## Tujuan

Memetakan akun legacy Dexie ke projection identity universal tanpa mengubah atau menghapus tabel legacy.

Projection lokal:

- `identityProjections`
- `appMembershipProjections`
- `appSubjectLinks`
- `migrationReports`

Projection ini bukan pemilik credential. Password, PIN, hash, salt, lockout, dan recovery tetap berada di Identity Hub.

## Mapping

| Legacy | Projection |
|---|---|
| `users` | `identityProjections` + `appMembershipProjections` |
| `users.guardianId` + `guardians` | subject link `guardian` |
| `users.teacherId` + `teachers` | subject link `teacher` |
| `users.locationId` + `locations` | `locationId` dan deterministic `tenantId` |
| `users.phone` | canonical `phoneE164` |

Admin tidak membutuhkan subject link. Ustadz harus memiliki teacher aktif di lokasi yang sama. Wali harus memiliki guardian aktif di lokasi yang sama.

## Nomor telepon

Nomor Indonesia `08...`, `62...`, dan `+62...` dinormalisasi ke E.164. Nomor kosong atau invalid masuk `invalidPhones` dan tidak dipromosikan.

Prioritas sumber nomor:

1. `users.phone`;
2. nomor relation `guardians.phone` atau `teachers.phone`.

Jika nomor canonical sama pada lokasi yang sama, akun tidak digabung otomatis. Semua akun terkait masuk `duplicates` dan `conflicts` untuk resolusi manual.

## Deterministic IDs

UUID projection dibuat dari namespace + key legacy/phone. ID tidak bergantung pada auto-increment Dexie, sehingga rerun tidak menggandakan projection.

- identity: canonical phone;
- membership: legacy user ID + location;
- tenant: location ID;
- subject link: membership + subject relation.

## Mode migrasi

```js
await migrateLegacyAccounts({ db, dryRun: true });  // report saja
await migrateLegacyAccounts({ db });                  // apply atomic
await migrateLegacyAccounts({ db, force: true });    // apply ulang eksplisit
```

Apply menggunakan satu transaksi Dexie dan hanya clear/put projection. Tabel `users`, `guardians`, `teachers`, dan `locations` tidak disentuh.

## Report dan manual review

Report memiliki status:

- `ready`: semua akun dapat dipetakan;
- `completed`: projection berhasil ditulis;
- `needs_manual_review`: ada nomor invalid, duplikat, relasi hilang/inactive, lokasi silang, atau konflik;
- `failed`: reserved untuk error transaksi/provider.

Field review:

- `invalidPhones`;
- `duplicates`;
- `missingRelations`;
- `crossLocationRelations`;
- `conflicts`.

Akun bermasalah tidak diberi membership aktif. Tidak ada auto-merge.

## Rollback

Rollback hanya menghapus projection dan report migration. Jangan menghapus atau mengubah data legacy. Setelah resolusi manual, jalankan migrasi dengan `force: true`.
