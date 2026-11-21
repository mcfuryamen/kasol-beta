# P7: Staging Deployment Checklist

## Prerequisites
- [x] Supabase staging project: **kasol** (`ozsjflxfkbcygbuxgwyf`), region `ap-southeast-1`, status `ACTIVE_HEALTHY`
- [ ] Supabase CLI installed (`which supabase`) — *opsional; hanya untuk deploy Edge Functions. Apply/verify migrasi bisa tanpa CLI via `apply-migrations-live.js`*
- [x] Node.js 18+ installed
- [x] Git repo initialized
- [x] `SUPABASE_ACCESS_TOKEN` tersedia di root `.env.local`

> ⚠️ `SUPABASE_URL` di root `.env.local` menunjuk project **minimarket**
> (`hhywrvedlwljawgxzpkq`), bukan TPA. Selalu target eksplisit:
> `--ref=ozsjflxfkbcygbuxgwyf`. Lihat `STAGING_DEPLOYMENT.md`.

## Step 1: Setup Staging Environment Credentials
```bash
# Create .env.staging file with:
cat > .env.staging << EOF
# Supabase Staging Credentials
SUPABASE_URL=https://YOUR-PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_DB_PASSWORD=your-database-password-here
SUPABASE_ACCESS_TOKEN=your-management-api-token-here

# Get these from:
# - URL: Supabase Dashboard > Settings > API
# - Keys: Supabase Dashboard > Settings > API > Project API keys
EOF
```

**Where to get credentials:**
1. Go to https://app.supabase.com/
2. Select staging project
3. Settings > API
4. Copy:
   - `Project URL` → `SUPABASE_URL`
   - `anon public key` → `VITE_SUPABASE_ANON_KEY`
   - `Database password` → `SUPABASE_DB_PASSWORD`
   - `Access token` → `SUPABASE_ACCESS_TOKEN`
   - Never use the service-role JWT as a CLI password or access token.

## Step 2: Verify Migrations
```bash
# Check migration files exist
ls -la tpa/supabase/migrations/

# Expected output:
# - 20261009_identity_recovery_system.sql
# - 20261009_fix_rls_policies.sql
# - 20261010_fix_recovery_schema.sql
# - 20261011_admin_approval_hardening.sql
# - 20261012_artifact_only_recovery.sql
```

## Step 3: Apply Migrations to Staging
```bash
# Method A (OTOMATIS, direkomendasikan — dari folder tpa/, tanpa CLI):
#   Management API + SUPABASE_ACCESS_TOKEN dari root .env.local
node apply-migrations-live.js check  --ref=ozsjflxfkbcygbuxgwyf   # read-only dulu
node apply-migrations-live.js apply  --ref=ozsjflxfkbcygbuxgwyf   # atomik per file
node apply-migrations-live.js verify --ref=ozsjflxfkbcygbuxgwyf   # asersi tabel/policy/grants

# Method B: Supabase CLI (jika terinstall)
supabase db push --project-ref ozsjflxfkbcygbuxgwyf

# Method C: Dashboard SQL Editor (fallback manual)
# 1. Go to Supabase Dashboard > SQL Editor (project ozsjflxfkbcygbuxgwyf)
# 2. Paste & Run per file migrasi, urut tanggal
```
Jangan memakai `apply-migrations-staging.js` — dia memanggil RPC `exec_sql`
yang tidak ada di Supabase hosted.

## Step 4: Deploy Edge Functions
```bash
# Set project ref environment variable
export PROJECT_REF="ozsjflxfkbcygbuxgwyf"

# PENTING (CORS fail-closed, 2026-10): set secret origin SEBELUM/bersamaan deploy.
# Tanpa secret ini, function live tapi browser dari origin mana pun ditolak CORS.
supabase secrets set RECOVERY_CORS_ORIGIN=https://<origin-aplikasi-tpa> \
  --project-ref $PROJECT_REF

# Deploy identity-approve-recovery
supabase functions deploy identity-approve-recovery \
  --project-ref $PROJECT_REF

# Deploy identity-complete-recovery
supabase functions deploy identity-complete-recovery \
  --project-ref $PROJECT_REF

# Verify functions deployed:
supabase functions list --project-ref $PROJECT_REF
# atau tanpa CLI: node apply-migrations-live.js functions --ref=ozsjflxfkbcygbuxgwyf
```
Status 2026-10-12: kedua function **belum pernah dideploy** di project ini
(`functions list` kosong).

## Step 5: Run Smoke Tests
```bash
# Set environment variables
export SUPABASE_URL=https://YOUR-PROJECT.supabase.co
export VITE_SUPABASE_ANON_KEY=your-anon-key
# Also set SUPABASE_DB_PASSWORD and SUPABASE_ACCESS_TOKEN for CLI deployment.
# Never substitute SUPABASE_SERVICE_ROLE_KEY for either value.

# Run smoke tests
npm run test -- tests/recovery-smoke.test.js --run

# Expected: All 10 tests pass ✓
```

## Step 6: Verify RLS Policies
```bash
# Run RLS enforcement tests
npm run test -- tests/rls-recovery-challenges.test.js --run

# Expected: All RLS tests pass ✓
```

## Step 7: Manual Testing
1. **Start dev server:**
   ```bash
   npm run dev
   ```

2. **Test recovery flow:**
   - Go to http://127.0.0.1:8088/login
   - Click "Lupa PIN?"
   - Enter phone number → Request Recovery
   - Sign in as admin
   - Go to admin dashboard → approve recovery request
   - Verify user can complete recovery flow

3. **Test RLS isolation:**
   - Create account A, request recovery
   - Create account B, try to access account A's recovery data (should fail)
   - Sign in as admin, verify admin sees all recovery requests

4. **Check logs:**
   ```bash
   # View Edge Function logs
   supabase functions logs identity-approve-recovery --project-ref $PROJECT_REF
   supabase functions logs identity-complete-recovery --project-ref $PROJECT_REF
   ```

## Troubleshooting

### Issue: "Function not found" error
**Fix:**
- Check function deployed: `supabase functions list`
- Verify function path: `supabase/functions/identity-approve-recovery/index.ts`
- Re-deploy: `supabase functions deploy identity-approve-recovery`

### Issue: RLS policy error "new row violates row-level security policy"
**Fix:**
- Verify migrations applied both files:
  - `20261009_identity_recovery_system.sql` (create tables)
  - `20261009_fix_rls_policies.sql` (fix RLS)
- Check user session: `SELECT auth.uid()`

### Issue: Smoke tests fail with 401 Unauthorized
**Fix:**
- Verify credentials in .env.staging
- Check anon key is correct (not service role key)

### Issue: recovery challenge tidak terkait user (owner mismatch)
**Fix:**
- Di project TPA (`ozsjf...`), kolom pemilik challenge adalah **`identity_id`**
  (bukan `global_identity_id` — kolom itu hanya ada di project identity-hub
  penuh seperti minimarket `hhywr...`).
- Verify `identity_id` menunjuk identity yang benar; policy SELECT baru:
  `identity_id = auth.uid() OR auth.jwt() ->> 'app_role' = 'admin'`.
- Check Supabase auth is configured.

## Success Criteria
- ✅ All 10 smoke tests pass
- ✅ All RLS tests enforce user isolation
- ✅ Manual recovery flow works end-to-end
- ✅ Admin can approve/manage recovery requests
- ✅ User cannot read other user's recovery data
- ✅ Edge Functions logs show no errors

## Deployment Status
| Component | Status | Notes |
|-----------|--------|-------|
| Database migrations (identity + akademik) | ✅ Applied | Terverifikasi via `apply-migrations-live.js check` — tabel & helper lengkap |
| Migrasi SPP/keuangan `20261020` + hygiene `20261021` | ✅ Applied (2026-10-12) | Verify 23/23 PASS; 4 tabel SPP + RLS + policy; legacy RPC OTP dihapus |
| RLS policies | ✅ Applied | SPP: admin/wali per lokasi, tanpa DELETE; recovery: SELECT own-or-admin + UPDATE closed |
| Edge Functions | ⏳ Not deployed | `functions list` kosong; butuh `RECOVERY_CORS_ORIGIN` (fail-closed) saat deploy |
| Smoke tests (katalog) | ✅ Ready | `apply-migrations-live.js verify`, `verify-academic-attendance-staging.js` |
| Smoke tests (berautentikasi) | ⏳ Blocked | Butuh akun staging di `.env.staging` (`scripts/smoke-rls-staging.js`) |
| Documentation | ✅ Updated | Lihat `STAGING_DEPLOYMENT.md` untuk kondisi terkini |

---

**Next:** Once P7 passes, recovery system is production-ready!
