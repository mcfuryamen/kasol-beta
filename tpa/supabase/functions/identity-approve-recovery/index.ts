/**
 * Admin-only recovery approval.
 * OTP/Twilio and caller-supplied proof are intentionally not supported in Track C.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const ARTIFACT_TTL_MS = 10 * 60 * 1000;

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

function randomToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes)).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

async function tokenHash(token: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function handleApproveRecovery(
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
  const { challengeId } = body ?? {};
  if (!challengeId || typeof challengeId !== 'string') return json(req, { error: 'Missing required field: challengeId' }, 400);
  if (Object.prototype.hasOwnProperty.call(body ?? {}, 'approverSessionId')) {
    return json(req, { error: 'Legacy approverSessionId is not supported' }, 400);
  }

  try {
    const { data: membership, error: membershipError } = await supabaseServiceClient
      .from('app_memberships').select('role').eq('user_id', user.id).eq('role', 'admin').maybeSingle();
    if (membershipError || !membership || membership.role !== 'admin') return json(req, { error: 'Admin membership required' }, 403);

    const { data: challenge, error: challengeError } = await supabaseServiceClient
      .from('identity_recovery_challenges')
      .select('id, global_identity_id, status, expires_at')
      .eq('id', challengeId).maybeSingle();
    if (challengeError || !challenge) return json(req, { error: 'Challenge not found' }, 404);
    if (challenge.status !== 'pending') return json(req, { error: 'Challenge is not pending' }, 409);
    if (!challenge.expires_at || new Date(challenge.expires_at).getTime() <= Date.now()) return json(req, { error: 'Challenge has expired' }, 410);

    const approvalToken = randomToken();
    const approvalExpiresAt = new Date(Math.min(Date.now() + ARTIFACT_TTL_MS, new Date(challenge.expires_at).getTime())).toISOString();
    const { data: updated, error: updateError } = await supabaseServiceClient
      .from('identity_recovery_challenges')
      .update({
        status: 'approved',
        approved_at: new Date().toISOString(),
        approved_by_user_id: user.id,
        approval_artifact_hash: await tokenHash(approvalToken),
        approval_artifact_expires_at: approvalExpiresAt,
        approval_artifact_used_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', challengeId).eq('status', 'pending')
      .select('id, status, expires_at').maybeSingle();
    if (updateError || !updated) return json(req, { error: 'Challenge could not be approved' }, 409);

    await supabaseServiceClient.from('identity_security_events').insert({
      global_identity_id: challenge.global_identity_id,
      event_type: 'recovery_approved',
      metadata: { challenge_id: challengeId, approved_by: user.id, method: 'admin_approval' },
    });
    return json(req, { challengeId: updated.id, status: updated.status, expiresAt: updated.expires_at, approvalToken, approvalExpiresAt });
  } catch (error) {
    console.error('approve recovery failed');
    return json(req, { error: 'Unable to approve recovery' }, 500);
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(req) });
  const authorization = req.headers.get('Authorization') ?? undefined;
  const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, { global: { headers: authorization ? { Authorization: authorization } : {} } });
  const supabaseServiceClient = createClient(supabaseUrl, supabaseServiceRoleKey);
  return handleApproveRecovery(req, { supabaseClient, supabaseServiceClient });
});
