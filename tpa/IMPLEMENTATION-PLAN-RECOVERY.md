---
name: implementation-plan-identity-recovery
description: Urutan implementasi identity recovery system berdasarkan prioritas dan dependencies
metadata:
  type: project
  status: active
  date: 2026-10-09
---

# PLAN IMPLEMENTASI IDENTITY RECOVERY SYSTEM
**Priority-based sequential implementation with dependencies**

> **⚠️ Status update (2026-10-12) — plan ini tidak lagi menggambarkan jalur final.**
> Arah yang terjadi berbeda dari plan di bawah:
> - Recovery final memakai **Edge Functions Track C** (`identity-approve-recovery`,
>   `identity-complete-recovery`), BUKAN RPC — RPC legacy
>   `identity_approve_recovery(UUID,UUID)` / `identity_complete_recovery(UUID,TEXT,TEXT)`
>   di-DROP oleh migrasi `20261021_identity_rpc_hygiene.sql` (sudah applied di
>   staging `ozsjf...`), bersama penutupan INSERT/UPDATE browser pada
>   `identity_recovery_challenges`.
> - Flow "admin approve → OTP apa pun diterima" di P4/P5 **tidak berlaku lagi**.
> - Edge Functions **belum di-deploy** ke project staging (butuh secret
>   `RECOVERY_CORS_ORIGIN`, CORS fail-closed). Lihat `STAGING_DEPLOYMENT.md`
>   untuk status terkini.
> - Dokumen ini disimpan sebagai riwayat perencanaan; jangan dijadikan panduan eksekusi.

---

## PHASE 1: FOUNDATION (HARI 1)
**Dependencies: Supabase database access**

### P1.1 Deploy Supabase Migration [CRITICAL]
- **File**: `supabase/migration-identity-recovery.sql`
- **Urutan**:
  1. Run: `supabase db push` di environment staging
  2. Verify: tables created (identity_recovery_challenges, identity_security_events)
  3. Verify: RLS policies active
  4. Verify: 3 RPCs callable (request_recovery, approve_recovery, complete_recovery)
- **Output**: Migration deployed, RPCs accessible via Supabase client
- **Estimasi**: 15 menit
- **Blocker**: Harus ada akses Supabase CLI + credentials

### P1.2 Verify Supabase Transport Layer [CRITICAL]
- **File**: `services/identity/supabase-transport.js` (sudah ada)
- **Urutan**:
  1. Run unit tests: `mocha services/identity/supabase-transport.spec.js`
  2. Verify error mapping (Postgres error → IdentityContractError code)
  3. Check RPC invoke handler works
- **Output**: Transport layer tested, ready untuk app-boot
- **Estimasi**: 10 menit
- **Dependencies**: P1.1 (migration deployed)

### P1.3 Configure Environment Variables [CRITICAL]
- **Files**: `.env.local`, `.env.production`
- **Urutan**:
  1. Set `VITE_SUPABASE_URL` (public, anon client)
  2. Set `VITE_SUPABASE_ANON_KEY` (public)
  3. Set server-side: `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` (secret!)
  4. Verify env vars loaded in `app-boot.js`
- **Output**: Env vars configured, app-boot.js can initialize Supabase
- **Estimasi**: 5 menit
- **Security**: Service role key hanya di server, NEVER expose ke browser

---

## PHASE 2: APP INITIALIZATION (HARI 1)
**Dependencies: P1 completed**

### P2.1 Integrate App Bootstrap [HIGH]
- **File**: `app-boot.js` (sudah ada)
- **Urutan**:
  1. Update `index.html`: tambah `<script type="module">` untuk load app-boot.js sebelum rendering
  2. Verify: `waitForAppReady()` blocks rendering sampai auth restored
  3. Verify: session restore prevents login-screen flash
  4. Test: reload halaman → user tetap logged in (jika session valid)
- **Output**: App bootstrap active, session persists across reloads
- **Estimasi**: 20 menit
- **Test**: Reload halaman setelah login, verify tetap authenticated

### P2.2 Bind Supabase to IdentityAdapter [HIGH]
- **File**: `services/identity/adapter.js`, `app-boot.js`
- **Urutan**:
  1. In `app-boot.js`: call `bootstrapSupabaseIdentity(supabaseClient)`
  2. Verify: IdentityAdapter methods mapped ke SupabaseTransport
  3. Verify: `createIdentityAdapter()` uses Supabase transport
- **Output**: Semua IdentityAdapter method calls → Supabase RPC
- **Estimasi**: 10 menit
- **Test**: Call `adapter.requestRecovery(phone)` → should invoke RPC

### P2.3 Setup Auth State Listener [HIGH]
- **File**: `app-boot.js` (sudah ada)
- **Urutan**:
  1. Verify `setupAuthListener()` active (auto-runs di initializeApp)
  2. Test: Manual logout via Supabase console → app detects, clears session
  3. Test: Manual token refresh → app updates session
- **Output**: Auth listener tracking Supabase state changes
- **Estimasi**: 15 menit
- **Test**: Open browser console, logout from Supabase, verify app responds

---

## PHASE 3: RECOVERY UI & FLOW (HARI 2)
**Dependencies: P2 completed**

### P3.1 Link Recovery UI to Login [MEDIUM]
- **Files**: `login.html`, `recovery.html` (recovery.html sudah ada dari context prior)
- **Urutan**:
  1. In `login.html`: add "Lupa PIN?" link → `<a href="recovery.html">`
  2. Verify: recovery.html loads correctly
  3. Test: Click link from login → navigate to recovery.html
- **Output**: Recovery UI accessible from login
- **Estimasi**: 5 menit

### P3.2 Test Recovery Request Flow [MEDIUM]
- **File**: `recovery.js` (sudah ada dari prior context)
- **Urutan**:
  1. Run tests: `mocha services/identity/auth-lifecycle.spec.js --grep "Recovery Flow"`
  2. Test in browser:
     - Enter phone number → submit
     - Verify: challenge created (check Supabase `identity_recovery_challenges` table)
     - Verify: status = `pending`
  3. Test throttling: Submit 4x dalam 5 menit → 4th request rejected
- **Output**: Request flow working, throttling enforced
- **Estimasi**: 20 menit
- **Blocker**: Harus ada admin approval (P4) untuk complete flow

### P3.3 Test Polling Status Endpoint [MEDIUM]
- **File**: `api/recovery/status.js` (sudah ada)
- **Urutan**:
  1. Test endpoint: `GET /api/recovery/status?challengeId=<id>`
  2. Verify response format: `{ status, approvedAt, expiresAt, isExpired, isApproved }`
  3. Test polling from recovery.js: should hit endpoint every 60s
  4. Test expiry: wait 10 min → status changes to expired
- **Output**: Polling working, status updates reflected
- **Estimasi**: 15 menit
- **Test**: Use curl/Postman to call endpoint

---

## PHASE 4: ADMIN APPROVAL FLOW (HARI 2-3)
**Dependencies: P3 completed**

### P4.1 Create Admin Recovery Dashboard [HIGH]
- **File**: Create `admin-recovery-requests.html`
- **Urutan**:
  1. Query: `SELECT * FROM identity_recovery_challenges WHERE status = 'pending'` (admin only)
  2. UI: List pending challenges dengan phone, requested_at, requested_by
  3. Action: Approve button → call `identity_approve_recovery()` RPC
  4. Action: Reject button → set status = `rejected`, notify user
  5. Verify: RLS allows admins only
- **Output**: Admin can see & approve recovery requests
- **Estimasi**: 45 menit
- **Security**: Auth gate to admin role only

### P4.2 Test Approval Flow [HIGH]
- **Urutan**:
  1. User requests recovery (P3.2)
  2. Admin approves via dashboard (P4.1)
  3. recovery.js polling detects `isApproved = true`
  4. UI shows: "Request approved, enter OTP"
  5. Test: Verify `approved_at` timestamp in DB
- **Output**: Full request → approval → UI update flow working
- **Estimasi**: 20 menit
- **Test**: E2E dari user request sampai admin approve

### P4.3 Test Rejection Flow [MEDIUM]
- **Urutan**:
  1. User requests recovery
  2. Admin rejects request
  3. recovery.js detects `status = rejected`
  4. UI shows: "Request rejected, try again later"
  5. Verify: challenge can't be completed
- **Output**: Rejection flow working
- **Estimasi**: 15 menit

---

## PHASE 5: OTP & COMPLETION (HARI 3)
**Dependencies: P4 completed**

### P5.1 Integrate SMS/WhatsApp OTP Provider [CRITICAL]
- **Tentang**: Kirim OTP ke phone user saat request recovery
- **Urutan**:
  1. Setup: Create `services/otp-provider.js`
  2. Integrate: `sendOTP(phone, challengeId)` → call SMS/WhatsApp API
  3. Test: Request recovery → verify SMS received
  4. Store OTP hash di table `identity_otp_attempts` (untuk verify)
- **Output**: OTP sent to user's phone
- **Estimasi**: 60 menit (tergantung SMS provider)
- **Blocker**: Butuh SMS/WhatsApp provider credentials (Twilio, etc)

### P5.2 Test OTP Verification [HIGH]
- **Urutan**:
  1. recovery.js: user enters OTP
  2. Verify: call `identity_complete_recovery(challengeId, otp, newPin)`
  3. Backend: verify OTP matches + not expired
  4. Backend: hash newPin, update `credential_hash` di `global_identities`
  5. Backend: revoke ALL active sessions (force re-login)
  6. Test: Try login dengan old PIN → FAIL
  7. Test: Try login dengan new PIN → SUCCESS
- **Output**: Recovery complete, old PIN revoked
- **Estimasi**: 30 menit
- **Test**: Full flow dari recovery request → new PIN working

### P5.3 Test Weak Credential Rejection [MEDIUM]
- **Urutan**:
  1. User completes recovery dengan PIN terlalu pendek (< 6 digit)
  2. Backend reject: `CREDENTIAL_TOO_WEAK`
  3. UI: show error "PIN minimal 6 digit"
  4. User retry dengan PIN valid
- **Output**: Weak credential validation enforced
- **Estimasi**: 10 menit
- **Test**: Submit recovery dengan PIN = "123" → rejected

---

## PHASE 6: SECURITY AUDIT (HARI 4)
**Dependencies: P5 completed**

### P6.1 Run Comprehensive Auth Lifecycle Tests [HIGH]
- **File**: `services/identity/auth-lifecycle.spec.js`
- **Urutan**:
  1. Run: `mocha services/identity/auth-lifecycle.spec.js --timeout 10000`
  2. Verify: ALL tests pass (login, recovery, expiry, RLS, tenant boundary)
  3. Coverage: 6 test suites, 20+ test cases
  4. Report: any failures
- **Output**: 100% tests passing
- **Estimasi**: 30 menit
- **Blocker**: Jika ada test failures, fix sebelum produksi

### P6.2 Verify RLS Enforcement [HIGH]
- **Urutan**:
  1. Create 2 identities (user A, user B)
  2. Query challenges sebagai user A → hanya lihat challenges milik A
  3. Query challenges sebagai user B → hanya lihat challenges milik B
  4. Verify: tidak bisa cross-read data
  5. Verify: admin can see semua
- **Output**: RLS policies working correctly
- **Estimasi**: 20 menit
- **Test**: Unit test sudah di P6.1, ini manual verification

### P6.3 Verify Tenant Boundary Isolation [HIGH]
- **Urutan**:
  1. User A login ke TPA app → session A
  2. User A login ke OTHER_APP → session B
  3. Verify: session A tidak bisa akses OTHER_APP resources
  4. Verify: session B tidak bisa akses TPA resources
  5. Test: session revocation hanya affect relevant app
- **Output**: Tenant boundaries enforced
- **Estimasi**: 25 menit

### P6.4 Verify Audit Logging [MEDIUM]
- **Urutan**:
  1. Perform: login success, login failed, recovery request, recovery complete
  2. Query: `SELECT * FROM identity_security_events` WHERE globalIdentityId = ...
  3. Verify: ALL events logged dengan correct eventType, success flag, metadata
  4. Verify: events tidak bisa di-modify/delete oleh user (RLS)
- **Output**: Audit trail complete & immutable
- **Estimasi**: 15 menit

---

## PHASE 7: DEPLOYMENT & MONITORING (HARI 4-5)
**Dependencies: P6 passed**

### P7.1 Deploy to Staging [HIGH]
- **Urutan**:
  1. Commit changes: `git commit -m "feat: identity recovery system"`
  2. Deploy: `vercel --prod` atau CI/CD pipeline
  3. Verify: all files deployed (app-boot.js, recovery.html, api endpoints)
  4. Smoke test: login → recovery flow → new PIN working
- **Output**: Staging environment live
- **Estimasi**: 20 menit

### P7.2 Setup Monitoring & Alerts [MEDIUM]
- **Urutan**:
  1. Monitor: `identity_security_events` table untuk suspicious patterns
  2. Alert: IF recovery_request > 10/hour dari same phone → block
  3. Alert: IF approval_rate < 50% → review admin workflow
  4. Dashboard: show metrics (pending challenges, completion rate, failures)
- **Output**: Monitoring active
- **Estimasi**: 45 menit
- **Tools**: Supabase realtime + alerts

### P7.3 Production Deploy & Validation [CRITICAL]
- **Urutan**:
  1. Final QA: full recovery flow di production
  2. Deploy: `git push main` → production
  3. Verify: all users can recovery password
  4. Monitor: error rates, performance
  5. Runbook: escalation path jika issue
- **Output**: Production live, monitored
- **Estimasi**: 30 menit
- **Blocker**: JANGAN deploy jika tests belum 100% pass

---

## TIMELINE SUMMARY

| Phase | Items | Priority | Est. Time | End Date |
|-------|-------|----------|-----------|----------|
| P1: Foundation | 3 items | CRITICAL | 30 min | Day 1, morning |
| P2: App Init | 3 items | HIGH | 45 min | Day 1, morning |
| P3: UI & Flow | 3 items | MEDIUM | 40 min | Day 2, morning |
| P4: Admin | 3 items | HIGH | 80 min | Day 2, afternoon |
| P5: OTP & Complete | 3 items | CRITICAL | 100 min | Day 3 |
| P6: Security Audit | 4 items | HIGH | 90 min | Day 4, morning |
| P7: Deploy & Monitor | 3 items | HIGH | 95 min | Day 4-5 |
| **TOTAL** | **22 items** | - | **480 min (8 hrs)** | **Day 5** |

---

## BLOCKERS & DEPENDENCIES

### Critical Path (Harus selesai dulu)
1. P1.1 (Deploy migration) → semua yang lain depend on ini
2. P1.3 (Env vars) → P2.1 (App bootstrap)
3. P2.1 + P2.2 (App init) → P3 (UI)
4. P3.2 (Recovery request) → P4 (Admin approval)
5. P4.3 (Approval working) → P5 (OTP & completion)
6. P5.2 (Completion) → P6 (Security audit)
7. P6.1-P6.4 (All tests pass) → P7 (Deploy)

### Known Issues & Workarounds
- **OTP Provider**: P5.1 butuh SMS/WhatsApp credentials
  - Workaround: Mock OTP untuk development (`otp = '000000'`)
  - Production: Integrate real provider (Twilio/MessageBird)

- **Admin Dashboard**: P4.1 butuh admin auth gate
  - Assumption: Admin role defined di `app_memberships.role = 'admin'`
  - Verify: RLS policy allow admins to see all challenges

- **Session Revocation**: P5.2 revoke all sessions
  - Verify: doesn't break other apps (P6.3)
  - Test: revoke TPA session, OTHER_APP session still valid

---

## SUCCESS CRITERIA

✅ **P1-P2**: App bootstrap active, Supabase connected
✅ **P3-P4**: User can request recovery, admin can approve
✅ **P5**: User receives OTP, completes recovery with new PIN
✅ **P6**: 100% tests pass, RLS enforced, audit trail complete
✅ **P7**: Staging live, production ready, monitored

**Go-live criteria**: ALL tests pass + P6 security audit complete + no blockers

---

**Why**: Clear prioritization prevents dependency hell. Critical path (P1→P7) ensures foundation first, then UI, then security verification.

**How to apply**: Follow phases sequentially. Para-task items within same phase (yang independent) bisa dikerjain parallel. Stop di masing-masing phase untuk verification sebelum lanjut.

**Related**: [[identity-recovery-system-complete]], [[tpa-identity-system]]
