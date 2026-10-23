# P1: FOUNDATION SETUP - MANUAL DEPLOYMENT GUIDE

## Status: IN PROGRESS

Karena Supabase CLI ada issue di Windows, saya akan setup manual via Supabase Dashboard atau SQL Editor.

---

## P1.1: Deploy Supabase Migration

### Step 1: Get Your Supabase Credentials

1. Login ke [Supabase Dashboard](https://app.supabase.com)
2. Select your project (atau create baru jika belum ada)
3. Go to **Settings → API**
4. Copy:
   - **Project URL** → `SUPABASE_URL` for deployment scripts (the browser build uses `VITE_SUPABASE_URL`)
   - **anon (public) key** → `VITE_SUPABASE_ANON_KEY`
   - **Database password** → `SUPABASE_DB_PASSWORD` (CLI database password; keep secret)
   - **Management API token** → `SUPABASE_ACCESS_TOKEN` (CLI auth token; keep secret)
   - Do not use the service-role JWT as either CLI password or management API token.

### Step 2: Deploy Migration SQL

> **Update 2026-10-12:** cara otomatis kini tersedia dan lebih disarankan —
> dari folder `tpa/`: `node apply-migrations-live.js apply --ref=ozsjflxfkbcygbuxgwyf`
> (Management API + `SUPABASE_ACCESS_TOKEN` dari root `.env.local`; verifikasi
> via mode `verify`). Wajib pakai `--ref` karena `SUPABASE_URL` di `.env.local`
> menunjuk project minimarket, bukan TPA. Opsi SQL Editor di bawah tetap valid
> sebagai fallback manual.

**Option A: Via Supabase SQL Editor (RECOMMENDED)**

1. Open Supabase Dashboard → Your Project → **SQL Editor**
2. Click **New Query**
3. Paste entire content dari: `supabase/migrations/20261009_identity_recovery_system.sql`
4. Click **Run** (akan execute semua DDL + RPCs)
5. Verify: Check **Table Editor** → lihat tables baru:
   - `identity_recovery_challenges`
   - `identity_security_events`
   - `identity_otp_attempts`

**Option B: Via psql command line (jika psql terinstall)**

```bash
# Get connection string dari Supabase Dashboard → Settings → Database
export SUPABASE_DB_PASSWORD="your-database-password"
# Pass the password through PGPASSWORD without printing or committing it.
export PGPASSWORD="$SUPABASE_DB_PASSWORD"

psql -h db.your-project.supabase.co \
     -U postgres \
     -d postgres \
     -f supabase/migrations/20261009_identity_recovery_system.sql
```

### Step 3: Verify RPC Functions Created

Di Supabase SQL Editor, run:

```sql
-- List RPC functions
SELECT proname FROM pg_proc 
WHERE proname LIKE 'identity_%'
ORDER BY proname;
```

Should return (kondisi per 2026-10-12, setelah migrasi `20261021_identity_rpc_hygiene.sql`):
- `identity_request_recovery` — tetap ada (pre-login request by-design)
- `identity_record_security_event` — hanya di project identity-hub penuh (bukan di staging TPA)

⚠️ `identity_approve_recovery` dan `identity_complete_recovery` (versi RPC lama
yang menerima OTP apa pun) **sudah di-DROP** — alur approve/complete sekarang
lewat Edge Functions Track C (`identity-approve-recovery`,
`identity-complete-recovery`), yang sampai 2026-10-12 **belum di-deploy** di
project staging TPA.

### Step 4: Verify RLS Policies

Di SQL Editor:

```sql
-- Check RLS policies
SELECT policyname, tablename 
FROM pg_policies 
WHERE tablename LIKE 'identity_%'
ORDER BY tablename, policyname;
```

Should show policies:
- `identity_recovery_challenges` - 3 policies (SELECT, INSERT, UPDATE)
- `identity_security_events` - 2 policies (SELECT, INSERT)
- `identity_otp_attempts` - 2 policies (SELECT, INSERT)

---

## P1.2: Verify Supabase Transport Layer

### Check Transport Wrapper

File: `services/identity/supabase-transport.js`

Should have:
```javascript
export async function invokeRPC(rpcName, params) {
  // Calls Supabase RPC via supabaseClient.rpc()
  // Maps errors to IdentityContractError codes
}
```

### Run Transport Tests

```bash
cd /c/Users/Admin/Documents/kasol/tpa

# Run tests
npm test -- services/identity/supabase-transport.spec.js

# Expected output:
# ✓ RPC invoke handler works
# ✓ Error mapping: Postgres error → IdentityContractError
# ✓ Throttling error detected
# ✓ Enumeration prevention working
```

If tests fail:
- Check Supabase RPC functions deployed correctly (P1.1)
- Verify env vars loaded (P1.3)

---

## P1.3: Configure Environment Variables

### Create .env.local

Copy dari `.env.local.example` dan fill credentials:

```bash
# File: .env.local
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGc...your-anon-key...
```

### Verify Env Vars Loaded

In browser console, test:

```javascript
// Should print your Supabase URL
console.log(import.meta.env.VITE_SUPABASE_URL);
```

### Server-side Secrets

For Vercel/production deployment:
- Go to Vercel Dashboard → Project → Settings → Environment Variables
- Add:
  - `SUPABASE_SERVICE_ROLE_KEY` (secret key only!)
  - Other production secrets

**NEVER commit `.env.local` ke git!**

---

## Summary: P1 Completion Checklist

- [ ] P1.1: Migration deployed
  - [ ] Tables created (identity_recovery_challenges, etc)
  - [ ] RPC functions callable (identity_request_recovery, etc)
  - [ ] RLS policies active
  
- [ ] P1.2: Transport layer verified
  - [ ] Tests passing
  - [ ] Error mapping working
  - [ ] Throttling detected
  
- [ ] P1.3: Env vars configured
  - [ ] VITE_SUPABASE_URL set
  - [ ] VITE_SUPABASE_ANON_KEY set
  - [ ] Server-side keys secure

---

## Next Steps (After P1 Complete)

→ **P2: APP INITIALIZATION**
- Integrate `app-boot.js` to `index.html`
- Bind Supabase to IdentityAdapter
- Setup auth session listener

---

## Troubleshooting

### "RPC not found" Error
- Check migration ran successfully (P1.1)
- Verify RPC name spelling

### "ANON_KEY not valid" Error
- Check anon key copied correctly from Supabase Dashboard
- Verify not using Service Role key

### "RLS policy rejected" Error
- Check user authenticated (logged in)
- Check RLS policies created (P1.1 Step 4)

### "Throttling: too many requests" Error
- ✓ This is expected! Throttling working correctly
- Wait 1 hour before retry

---

## Files Created

```
/tpa/
  ├── supabase/
  │   ├── config.toml
  │   └── migrations/
  │       └── 20261009_identity_recovery_system.sql
  ├── .env.local.example
  ├── services/identity/
  │   ├── supabase-transport.js (already exists)
  │   └── supabase-transport.spec.js (already exists)
  └── app-boot.js (already exists)
```

---

## Useful Links

- Supabase Dashboard: https://app.supabase.com
- Supabase Docs - RPC: https://supabase.com/docs/guides/database/functions
- Supabase Docs - RLS: https://supabase.com/docs/guides/auth/row-level-security

---

**Date**: 2026-10-09
**Status update (2026-10-12)**: migrasi identity + SPP/hygiene sudah applied ke staging
`ozsjflxfkbcygbuxgwyf` via `apply-migrations-live.js` (verify 23/23 PASS). Edge Functions
recovery masih belum di-deploy (lihat `STAGING_DEPLOYMENT.md`).
**Next**: Confirm P1 complete, then proceed to P2
