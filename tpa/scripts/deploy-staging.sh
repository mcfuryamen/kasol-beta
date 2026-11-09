#!/bin/bash
# P7: Deploy ke Staging Environment + Smoke Test
# Prerequisites:
#   - Supabase staging project already created
#   - .env.staging contains SUPABASE_URL, SUPABASE_DB_PASSWORD,
#     SUPABASE_ACCESS_TOKEN, and (for the smoke tests) VITE_SUPABASE_ANON_KEY
#   - Edge Functions deployed

set -Eeuo pipefail

echo "========================================="
echo "P7: Deploy Recovery System to Staging"
echo "========================================="

# Load staging environment
if [ ! -f .env.staging ]; then
  echo "❌ .env.staging not found"
  echo "Create .env.staging with:"
  echo "  SUPABASE_URL=https://your-project.supabase.co"
  echo "  SUPABASE_DB_PASSWORD=your-database-password"
  echo "  SUPABASE_ACCESS_TOKEN=your-management-api-token"
  echo "  VITE_SUPABASE_ANON_KEY=your-anon-key"
  exit 1
fi

# Source only shell-safe assignments; never print the loaded values.
set -a
. ./.env.staging
set +a

: "${SUPABASE_URL:?Missing SUPABASE_URL in .env.staging}"
: "${SUPABASE_DB_PASSWORD:?Missing SUPABASE_DB_PASSWORD in .env.staging}"
: "${SUPABASE_ACCESS_TOKEN:?Missing SUPABASE_ACCESS_TOKEN in .env.staging}"
: "${VITE_SUPABASE_ANON_KEY:?Missing VITE_SUPABASE_ANON_KEY in .env.staging}"

PROJECT_REF="${SUPABASE_URL#https://}"
PROJECT_REF="${PROJECT_REF%%.supabase.co/*}"
PROJECT_REF="${PROJECT_REF%%/*}"
if [ -z "$PROJECT_REF" ] || [ "$PROJECT_REF" = "$SUPABASE_URL" ]; then
  echo "Invalid SUPABASE_URL; expected https://<project-ref>.supabase.co" >&2
  exit 1
fi

echo "✓ Environment loaded"
echo "  Project ref: $PROJECT_REF"

# ============================================================================
# STEP 1: Apply migrations
# ============================================================================
echo ""
echo "Step 1: Applying Supabase migrations..."

supabase db push --project-ref "$PROJECT_REF" \
  --password "$SUPABASE_DB_PASSWORD"
echo "✓ Migrations applied successfully"

# ============================================================================
# STEP 2: Deploy Edge Functions
# ============================================================================
echo ""
echo "Step 2: Deploying Edge Functions..."

# Deploy identity-approve-recovery function
supabase functions deploy identity-approve-recovery \
  --project-ref "$PROJECT_REF" \
  --auth-token "$SUPABASE_ACCESS_TOKEN"
echo "✓ identity-approve-recovery deployed"

# Deploy identity-complete-recovery function
supabase functions deploy identity-complete-recovery \
  --project-ref "$PROJECT_REF" \
  --auth-token "$SUPABASE_ACCESS_TOKEN"
echo "✓ identity-complete-recovery deployed"

# ============================================================================
# STEP 3: Run smoke tests
# ============================================================================
echo ""
echo "Step 3: Running smoke tests..."

npm run test -- tests/recovery-smoke.test.js --run
echo "✓ Smoke tests passed"

# ============================================================================
# STEP 4: Verify RLS policies
# ============================================================================
echo ""
echo "Step 4: Verifying RLS enforcement..."

npm run test -- tests/rls-recovery-challenges.test.js --run
echo "✓ RLS policies enforced correctly"

# ============================================================================
# STEP 5: Summary
# ============================================================================
echo ""
echo "========================================="
echo "✓ P7 Deployment Complete!"
echo "========================================="
echo ""
echo "Staging URLs:"
echo "  - Dashboard: https://app.supabase.com/project/$PROJECT_REF/"
echo "  - API: $SUPABASE_URL/rest/v1/"
echo ""
echo "Next steps:"
echo "  1. Test UI at http://127.0.0.1:8088"
echo "  2. Request recovery, approve as admin"
echo "  3. Verify RLS: user A cannot access user B data"
echo "  4. Monitor Edge Function logs:"
echo "     supabase functions logs identity-approve-recovery"
echo ""
