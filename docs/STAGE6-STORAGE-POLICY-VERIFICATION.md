# Stage 6 — Kaki5 Storage policy verification

## Scope

Tahap ini menutup trust-boundary yang tersisa setelah Stage 5 untuk bucket
private `bukti` dan `backups`. Proposal SQL tersedia di
`kaki5/docs/STAGE6-STORAGE-POLICY-PROPOSAL.sql`, tetapi **belum dijalankan**.

## Status

**BLOCKED / NOT RUN** — belum ada target Supabase staging yang disetujui,
fixture dua unit, kredensial authenticated yang aman, atau evidence policy
`storage.objects` dari target schema. Static helper dan test lokal bukan bukti
RLS server aktif.

## Matrix wajib di staging

| Bucket | Aktor | Operasi | Ekspektasi |
|---|---|---|---|
| `bukti`, `backups` | owner unit A | list/read/insert/update/delete prefix A | allow |
| `bukti`, `backups` | owner unit A | list/read/insert/update/delete prefix B | deny |
| `bukti`, `backups` | anonymous | semua operasi | deny |
| `bukti`, `backups` | admin proxy | signed URL | allow sampai expiry |

Evidence harus mencakup `storage.buckets.public=false`, `pg_policies`, hasil API
per operasi, object IDs, expiry signed URL, dan cleanup. Tabel kosong atau hasil
static code review tidak cukup untuk PASS.
