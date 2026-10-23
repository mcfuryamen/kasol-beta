# Staging Academic/Attendance Verification

Target staging: `ozsjflxfkbcygbuxgwyf`.

Run the non-destructive catalog verifier from `tpa/`:

```bash
node scripts/verify-academic-attendance-staging.js
```

The verifier uses `SUPABASE_ACCESS_TOKEN` from the ignored root `.env.local` and calls only the Supabase Management API database query endpoint with catalog `SELECT` SQL. It does not create, update, or delete business data.

It checks:

- 11 TPA people, academic, session, and attendance tables;
- required session/attendance columns;
- RLS enabled on academic and attendance tables;
- required academic/session/attendance policies;
- tenant, audit, and timestamp triggers;
- required validation functions.

A passing result proves the schema and catalog objects exist. It does **not** prove end-user role behavior. Admin, assigned ustadz, unassigned ustadz, wali, and cross-location RLS behavior still require authenticated fixtures and must not be tested with the service-role key as a user substitute.

The current admin and wali portals still use local Dexie for attendance; only the Guru attendance flow is remote-backed. Do not treat admin/wali UI smoke as remote attendance proof.

---

## Update 2026-10-12 — SPP/finance naik ke staging + tool verifikasi baru

- Migrasi `20261020_tpa_spp_finance.sql` dan `20261021_identity_rpc_hygiene.sql`
  sudah di-apply ke staging `ozsjflxfkbcygbuxgwyf`; verifikasi katalog
  **23/23 PASS** (4 tabel SPP/kas + RLS + policy admin/wali + grants tanpa
  DELETE; hygiene RPC/policy recovery).
- Tool verifikasi/apply generik baru: `node apply-migrations-live.js
  check|apply|verify --ref=ozsjflxfkbcygbuxgwyf` (Management API +
  `SUPABASE_ACCESS_TOKEN` dari root `.env.local`) — pola yang sama dengan
  verifier di folder `scripts/`. Wajib `--ref`: `SUPABASE_URL` di `.env.local`
  menunjuk project minimarket, bukan TPA.
- Pull remote SPP di admin/wali memakai service `services/tpa-spp-remote.js`;
  mutasi keuangan kini push ke cloud setelah commit lokal (soft-delete +
  tombstone, tanpa DELETE).
