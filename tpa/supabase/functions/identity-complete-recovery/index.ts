/**
 * Completes an admin-approved recovery.
 * Track C deliberately has no OTP, Twilio, or caller-supplied proof bypass.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

// CORS fail-closed: origin hanya diizinkan jika tercantum di RECOVERY_CORS_ORIGIN (dipisah koma).
// Env kosong/tak diset atau origin di luar daftar → tanpa header Access-Control-Allow-Origin.
const allowedOrigins = (Deno.env.get('RECOVERY_CORS_ORIGIN') ?? '')
  .split(',').map((origin) => origin.trim()).filter(Boolean);

function corsHeaders(req: Request): Record<string, string> {
  const headers: Record<string, string> = {
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
    'Vary': 'Origin',
  };
  const origin = req.headers.get('Origin') ?? '';
  if (origin && allowedOrigins.includes(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
  }
  return headers;
}

function json(req: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders(req) });
}

async function tokenHash(token: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function handleCompleteRecovery(
  req: Request,
  { supabaseClient, supabaseServiceClient }: { supabaseClient: any; supabaseServiceClient: any },
) {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(req) });
  if (req.method !== 'POST') return json(req, { error: 'Method not allowed' }, 405);

  const authorization = req.headers.get('Authorization');
  if (!authorization?.startsWith('Bearer ')) return json(req, { error: 'Authentication required' }, 401);
  const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
  if (authError || !user) return json(req, { error: 'Invalid authentication token' }, 401);

  let body: any;
  try { body = await req.json(); } catch { return json(req, { error: 'Invalid JSON body' }, 400); }
  const { challengeId, approvalToken, newCredential } = body ?? {};
  // Explicitly reject legacy proof/OTP fields; they must never become an alternate path.
  if ('otpCode' in (body ?? {}) || 'proof' in (body ?? {})) return json(req, { error: 'OTP/proof recovery is not supported' }, 400);
  if (!challengeId || typeof challengeId !== 'string' || !approvalToken || typeof approvalToken !== 'string' || newCredential == null) {
    return json(req, { error: 'Missing required fields: challengeId, approvalToken, newCredential' }, 400);
  }
  if (newCredential === null || (typeof newCredential !== 'object' && typeof newCredential !== 'string')) {
    return json(req, { error: 'Invalid newCredential format' }, 400);
  }

  try {
    const { data: membership, error: membershipError } = await supabaseServiceClient
      .from('app_memberships').select('role').eq('user_id', user.id).eq('role', 'admin').maybeSingle();
    if (membershipError || !membership || membership.role !== 'admin') return json(req, { error: 'Admin membership required' }, 403);

    const { data: challenge, error: challengeError } = await supabaseServiceClient
      .from('identity_recovery_challenges')
      .select('id, global_identity_id, status, expires_at, approval_artifact_hash, approval_artifact_expires_at, approval_artifact_used_at')
      .eq('id', challengeId).maybeSingle();
    if (challengeError || !challenge) return json(req, { error: 'Challenge not found' }, 404);
    if (challenge.status !== 'approved') return json(req, { error: 'Challenge is not approved' }, 409);
    if (!challenge.expires_at || new Date(challenge.expires_at).getTime() <= Date.now()) return json(req, { error: 'Recovery challenge has expired' }, 410);

    const hash = await tokenHash(approvalToken);
    const artifactExpires = challenge.approval_artifact_expires_at;
    if (challenge.approval_artifact_used_at || !challenge.approval_artifact_hash || challenge.approval_artifact_hash !== hash) {
      return json(req, { error: 'Invalid or already used approval artifact' }, 401);
    }
    if (!artifactExpires || new Date(artifactExpires).getTime() <= Date.now()) return json(req, { error: 'Approval artifact has expired' }, 410);

    // Resolve the provider-owned identity before consuming the artifact. If the
    // provider is unavailable, fail closed without irreversibly completing the challenge.
    const { data: identity, error: identityError } = await supabaseServiceClient
      .from('identity_identities').select('id').eq('global_identity_id', challenge.global_identity_id).maybeSingle();
    if (identityError || !identity) return json(req, { error: 'Recovery provider is not configured' }, 503);

    // Claim the artifact before changing credentials. A retry or concurrent request cannot reuse it.
    const usedAt = new Date().toISOString();
    const { data: claimed, error: claimError } = await supabaseServiceClient
      .from('identity_recovery_challenges')
      .update({ status: 'completed', approval_artifact_used_at: usedAt, completed_at: usedAt, updated_at: usedAt })
      .eq('id', challengeId).eq('status', 'approved')
      .eq('approval_artifact_hash', hash)
      .is('approval_artifact_used_at', null)
      .gt('approval_artifact_expires_at', new Date().toISOString())
      .select('id, status, global_identity_id').maybeSingle();
    if (claimError || !claimed) return json(req, { error: 'Approval artifact is no longer available' }, 409);

    const { error: updateError } = await supabaseServiceClient.from('identity_identities')
      .update({ credential: newCredential, updated_at: new Date().toISOString() }).eq('id', identity.id);
    if (updateError) {
      console.error('credential update failed');
      return json(req, { error: 'Recovery could not be completed' }, 500);
    }

    await supabaseServiceClient.from('identity_security_events').insert({
      global_identity_id: challenge.global_identity_id,
      event_type: 'recovery_completed',
      metadata: { challenge_id: challengeId, completed_by: user.id, method: 'admin_approval' },
    });
    return json(req, { challengeId: claimed.id, status: claimed.status, globalIdentityId: claimed.global_identity_id, message: 'Recovery completed successfully.' });
  } catch (error) {
    console.error('complete recovery failed');
    return json(req, { error: 'Unable to complete recovery' }, 500);
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(req) });
  const authorization = req.headers.get('Authorization') ?? undefined;
  const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, { global: { headers: authorization ? { Authorization: authorization } : {} } });
  const supabaseServiceClient = createClient(supabaseUrl, supabaseServiceRoleKey);
  return handleCompleteRecovery(req, { supabaseClient, supabaseServiceClient });
});
