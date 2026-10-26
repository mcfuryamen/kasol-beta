# Staging RLS Smoke

Run from `tpa/`:

```bash
node scripts/smoke-rls-staging.js
```

The harness is locked to staging project `ozsjflxfkbcygbuxgwyf` and uses the browser anon key with ordinary password login. It never uses the service-role key as an end-user substitute and never creates or mutates business data.

Existing account references must be supplied only in ignored `.env.staging`:

- `TPA_STAGING_ADMIN_EMAIL` / `TPA_STAGING_ADMIN_PASSWORD`
- `TPA_STAGING_USTADZ_EMAIL` / `TPA_STAGING_USTADZ_PASSWORD`
- `TPA_STAGING_WALI_EMAIL` / `TPA_STAGING_WALI_PASSWORD`

If any are absent, the harness prints `BLOCKED` and exits without network login. Current repository inventory found role references but no email-specific existing account values, so the current run is blocked safely.

The smoke currently verifies login, active profile/membership, role mapping, and read access responses for students, classes, schedules, sessions, and attendance. It is not a substitute for a full cross-location fixture matrix; that requires known assigned/unassigned teachers, guardian-child links, and existing sessions.
