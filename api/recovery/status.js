/**
 * API: GET /api/recovery/status
 * Poll the status of a recovery challenge.
 * Used by recovery.js to check if an admin has approved the recovery request.
 */

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { challengeId } = req.query;

  if (!challengeId) {
    return res.status(400).json({ error: 'challengeId required' });
  }

  try {
    // Get Supabase client (service-role to bypass RLS for admin queries)
    const supabaseAdmin = require('@supabase/supabase-js').createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // Query recovery challenge status
    const { data: challenge, error } = await supabaseAdmin
      .from('identity_recovery_challenges')
      .select('id, status, approved_at, expires_at')
      .eq('id', challengeId)
      .single();

    if (error) {
      return res.status(404).json({ error: 'Challenge not found' });
    }

    if (!challenge) {
      return res.status(404).json({ error: 'Challenge not found' });
    }

    // Check if expired
    const expiresAt = new Date(challenge.expires_at);
    const now = new Date();
    const isExpired = now > expiresAt;

    return res.status(200).json({
      id: challenge.id,
      status: challenge.status,
      approvedAt: challenge.approved_at,
      expiresAt: challenge.expires_at,
      isExpired,
      isApproved: challenge.status === 'approved'
    });
  } catch (error) {
    console.error('[recovery/status] Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
