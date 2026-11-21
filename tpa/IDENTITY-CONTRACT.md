# TPA Identity Hub Contract — Stage A

## Scope

TPA adalah consumer pertama dari identity universal Kasir Solo. Credential universal dimiliki oleh Identity Hub/credential service, bukan oleh TPA.

Stage A hanya membekukan boundary dan bentuk data. Stage A belum mengganti login demo dan belum menghubungkan provider Supabase/Identity Hub.

> **Status update (2026-10-12) — jalur login aktif.** Keputusan arsitektur terkini:
> - **Jalur login yang aktif saat ini = Supabase Auth** (`services/auth.js`):
>   nomor WhatsApp + PIN 6 digit sebagai password pada akun email sintetis
>   `<nomor>@accounts.kasirsolo.local`, dengan throttle/backoff lokal
>   (`tpa_login_backoff`) dan pesan error generik.
> - **Identity Hub tetap dormant tapi wire-ready**: kontrak, adapter, transport,
>   dan projection di bawah tidak berubah dan tidak dihapus; adapter default
>   tetap fail-closed sampai provider hub diaktifkan.
> - **Recovery Track C = Edge Functions** (`identity-approve-recovery`,
>   `identity-complete-recovery`, CORS fail-closed via env
>   `RECOVERY_CORS_ORIGIN`). RPC legacy `identity_approve_recovery(UUID,UUID)`
>   dan `identity_complete_recovery(UUID,TEXT,TEXT)` di-DROP oleh migrasi
>   `20261021_identity_rpc_hygiene.sql` (di staging `ozsjf...` sudah applied);
>   policy `identity_recovery_challenges` dirapikan — SELECT milik sendiri atau
>   admin, INSERT/UPDATE browser ditutup total.
> - Kontrak kolom: project TPA staging memakai kolom pemilik **`identity_id`**
>   di `identity_recovery_challenges` (bukan `global_identity_id` seperti di
>   project identity-hub penuh).

## Global identity

```text
globalIdentityId: UUID
phoneE164: E.164 string, globally unique after verification
displayName: string
phoneVerifiedAt: timestamp | null
status: pending | active | suspended
```

`globalIdentityId` stabil lintas TPA, KasirSolo, Control, Rosok, dan aplikasi berikutnya. Nomor invalid atau duplikat legacy harus masuk laporan untuk resolusi manual; tidak boleh otomatis digabung.

## Credential boundary

Password/PIN, salt, algoritma hash, lockout counter, recovery state, dan credential version dimiliki Identity Hub.

TPA:

- tidak membuat tabel credential universal;
- tidak menyimpan `passwordHash`, `pinHash`, `credentialHash`, atau salt global di projection;
- tidak memverifikasi credential secara lokal sebagai source of truth;
- hanya boleh menyimpan device credential offline yang memiliki expiry/revoke setelah Stage H.

## TPA membership

```text
membershipId: UUID
globalIdentityId: UUID
appKey: "tpa"
tenantId: UUID
locationId: UUID
role: admin | ustadz | wali
status: active | suspended | expired
expiresAt: timestamp | null
```

Role adalah role aplikasi, bukan role global. Membership KasirSolo `owner`, `manager`, `cashier`, atau membership aplikasi lain tidak otomatis memberi akses TPA.

## TPA subject links

```text
membershipId: UUID
subjectType: guardian | teacher
subjectId: UUID
locationId: UUID
```

- `guardian` mengarah ke `guardians.id`.
- `teacher` mengarah ke `teachers.id`.
- Link dan location harus diverifikasi oleh provider/service, bukan dipercaya dari form client.

## App-session claims

```text
appSessionId: UUID
globalIdentityId: UUID
membershipId: UUID
appKey: "tpa"
tenantId: UUID
locationId: UUID
role: admin | ustadz | wali
sessionVersion: positive integer
issuedAt: timestamp
expiresAt: timestamp
deviceId: UUID | null
```

`verifySession()` harus melakukan validasi ulang identity status, membership status, app key, tenant/location, session version, dan expiry.

## Adapter boundary

Halaman dan service TPA hanya bergantung pada adapter berikut:

```text
resolveIdentity(phoneE164)
verifyCredential(globalIdentityId, credential)
listMemberships(globalIdentityId, appKey)
createAppSession(membershipId, deviceId?)
verifySession(appSessionId)
revokeSession(appSessionId)
requestRecovery(phoneE164)
approveRecovery(challengeId)
completeRecovery(challengeId, approvalToken, newCredential)
```

Recovery TPA pada fase ini hanya menggunakan persetujuan admin dan one-time approval artifact. OTP, SMS, WhatsApp, Twilio, `proof`, dan `approverSessionId` bukan bagian dari kontrak aktif. Artifact harus berumur pendek, disimpan hanya sebagai hash, dan diklaim atomik satu kali oleh backend.

Implementasi default Stage A adalah fail-closed `NotConfiguredIdentityAdapter`. Adapter tersebut sengaja tidak membaca tabel `users` dan tidak memiliki fallback diam-diam ke login demo.

## Security events

Event minimum yang boleh dicatat:

```text
login_success
login_failure
lockout
session_created
session_revoked
credential_changed
recovery_requested
recovery_approved
recovery_completed
```

Event harus direduksi dan tidak boleh menyimpan password, PIN, OTP, credential hash, atau secret mentah.

## Legacy boundary

TPA `users` lokal dan `demoLogin(role)` tetap diperlakukan sebagai compatibility/demo path sampai Stage B/C. Field `users.role`, `users.locationId`, `users.guardianId`, dan `users.teacherId` bukan kontrak identity universal.

Migration berikutnya harus memetakan data legacy ke:

```text
globalIdentityId
appMembership(appKey=tpa)
appSubjectLink(guardian|teacher)
```

## Stage A exit criteria

- Kontrak dieksekusi oleh validator murni.
- Credential fields ditolak pada identity projection.
- Membership non-TPA ditolak.
- Role global seperti `owner`/`cashier` ditolak sebagai role TPA.
- Session window dan session claims divalidasi.
- Adapter default gagal secara eksplisit saat provider belum tersedia.
- Contract test dan static check lulus.
