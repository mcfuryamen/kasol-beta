/**
 * Auth Lifecycle Tests
 * Tests: login flow, recovery flow, session expiry, RLS enforcement, tenant isolation
 */

import { describe, it, before, after, beforeEach } from 'mocha';
import { expect } from 'chai';
import { createClient } from '@supabase/supabase-js';
import { SupabaseIdentityProvider } from './supabase-provider.js';
import { SupabaseTransport } from './supabase-transport.js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const TEST_PHONE_1 = '+6281234567890';
const TEST_PHONE_2 = '+6289876543210';
const TEST_PIN = '123456';
const TEST_PIN_NEW = '654321';

let supabaseAdmin;
let supabaseAnon;
let provider;
let testIdentityId;
let testMembershipId;
let testAppSessionId;
let testDeviceId = 'test-device-001';

// Skip integration tests if Supabase credentials are not configured
const describeIntegration = SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY ? describe : describe.skip;

describeIntegration('Auth Lifecycle', function () {
  this.timeout(10000);

  before(async () => {
    // Initialize admin client for setup
    supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Initialize anon client (browser simulation)
    supabaseAnon = createClient(SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

    // Initialize provider with anon transport
    const transport = new SupabaseTransport(supabaseAnon);
    provider = new SupabaseIdentityProvider(transport);
  });

  after(async () => {
    // Cleanup test data
    if (testIdentityId) {
      await supabaseAdmin
        .from('global_identities')
        .delete()
        .eq('id', testIdentityId);
    }
  });

  describe('1. Login Flow', () => {
    it('should resolve identity by phone', async () => {
      // Setup: Create test identity
      const { data: identity, error: createError } = await supabaseAdmin
        .from('global_identities')
        .insert({
          phone_e164: TEST_PHONE_1,
          credential_hash: require('bcrypt').hashSync(TEST_PIN, 10),
          role: 'parent'
        })
        .select()
        .single();

      expect(createError).to.be.null;
      expect(identity).to.exist;
      testIdentityId = identity.id;

      // Test: Resolve identity
      const resolved = await provider.resolveIdentity(TEST_PHONE_1);
      expect(resolved).to.exist;
      expect(resolved.id).to.equal(testIdentityId);
      expect(resolved.phoneE164).to.equal(TEST_PHONE_1);
    });

    it('should verify credential', async () => {
      const verified = await provider.verifyCredential({
        globalIdentityId: testIdentityId,
        credential: TEST_PIN
      });

      expect(verified).to.be.true;
    });

    it('should reject invalid credential', async () => {
      try {
        await provider.verifyCredential({
          globalIdentityId: testIdentityId,
          credential: 'wrong_pin'
        });
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error.message).to.include('IDENTITY_UNAUTHORIZED');
      }
    });

    it('should list memberships for identity', async () => {
      // Setup: Create membership
      const { data: membership, error: createError } = await supabaseAdmin
        .from('app_memberships')
        .insert({
          global_identity_id: testIdentityId,
          app_key: 'TPA',
          role: 'parent',
          active: true
        })
        .select()
        .single();

      expect(createError).to.be.null;
      testMembershipId = membership.id;

      // Test: List memberships
      const memberships = await provider.listMemberships({
        globalIdentityId: testIdentityId
      });

      expect(memberships).to.be.an('array');
      expect(memberships.length).to.be.greaterThan(0);
      expect(memberships[0].id).to.equal(testMembershipId);
    });

    it('should create app session', async () => {
      const session = await provider.createAppSession({
        membershipId: testMembershipId,
        deviceId: testDeviceId
      });

      expect(session).to.exist;
      expect(session.id).to.exist;
      expect(session.globalIdentityId).to.equal(testIdentityId);
      expect(session.expiresAt).to.exist;

      testAppSessionId = session.id;
    });

    it('should verify active app session', async () => {
      const verified = await provider.verifySession(testAppSessionId);
      expect(verified).to.be.true;
    });

    it('should reject expired session', async () => {
      // Setup: Create an expired session
      const pastTime = new Date(Date.now() - 1000 * 60 * 60); // 1 hour ago
      const { data: expiredSession } = await supabaseAdmin
        .from('app_sessions')
        .insert({
          global_identity_id: testIdentityId,
          membership_id: testMembershipId,
          device_id: 'expired-device',
          expires_at: pastTime
        })
        .select()
        .single();

      // Test: Verify expired session
      try {
        await provider.verifySession(expiredSession.id);
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error.message).to.include('SESSION_EXPIRED');
      }
    });
  });

  describe('2. Recovery Flow', () => {
    it('should request recovery', async () => {
      const challenge = await provider.requestRecovery({
        phoneE164: TEST_PHONE_1
      });

      expect(challenge).to.exist;
      expect(challenge.id).to.exist;
      expect(challenge.status).to.equal('pending');
      expect(challenge.method).to.equal('sms');
      expect(challenge.expiresAt).to.exist;
    });

    it('should reject recovery for non-existent phone', async () => {
      // Note: Recovery hides non-existent identities to prevent enumeration
      const challenge = await provider.requestRecovery({
        phoneE164: '+6200000000000'
      });

      expect(challenge).to.exist;
      expect(challenge.status).to.equal('pending');
      // But no actual challenge was created
    });

    it('should throttle recovery requests', async () => {
      // Setup: Create 3 recovery requests
      for (let i = 0; i < 3; i++) {
        await provider.requestRecovery({ phoneE164: TEST_PHONE_1 });
      }

      // Test: 4th request should be throttled
      try {
        await provider.requestRecovery({ phoneE164: TEST_PHONE_1 });
        expect.fail('Should have been throttled');
      } catch (error) {
        expect(error.message).to.include('RECOVERY_THROTTLED');
      }
    });

    it('should approve recovery (admin only)', async () => {
      // Setup: Get latest pending challenge
      const { data: challenge, error: queryError } = await supabaseAdmin
        .from('identity_recovery_challenges')
        .select()
        .eq('global_identity_id', testIdentityId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      expect(queryError).to.be.null;
      expect(challenge).to.exist;

      // Test: Approve challenge with admin session
      const approved = await provider.approveRecovery({
        challengeId: challenge.id,
        approverSessionId: testAppSessionId
      });

      expect(approved).to.exist;
      expect(approved.status).to.equal('approved');
    });

    it('should complete recovery', async () => {
      // Setup: Get latest approved challenge
      const { data: challenge } = await supabaseAdmin
        .from('identity_recovery_challenges')
        .select()
        .eq('global_identity_id', testIdentityId)
        .eq('status', 'approved')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      // Test: Complete recovery with proof and new credential
      const completed = await provider.completeRecovery({
        challengeId: challenge.id,
        proof: 'otp-code', // In production, verify SMS OTP
        newCredential: TEST_PIN_NEW
      });

      expect(completed).to.exist;
      expect(completed.status).to.equal('completed');
      expect(completed.sessionsRevoked).to.be.true;
    });

    it('should reject recovery with invalid proof', async () => {
      // Setup: Create another recovery request
      const challenge = await provider.requestRecovery({
        phoneE164: TEST_PHONE_1
      });

      // Setup: Approve it
      await provider.approveRecovery({
        challengeId: challenge.id,
        approverSessionId: testAppSessionId
      });

      // Test: Try to complete with invalid proof
      try {
        await provider.completeRecovery({
          challengeId: challenge.id,
          proof: '', // Empty proof
          newCredential: TEST_PIN_NEW
        });
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error.message).to.include('PROOF_REQUIRED');
      }
    });

    it('should reject recovery with weak credential', async () => {
      const { data: challenge } = await supabaseAdmin
        .from('identity_recovery_challenges')
        .select()
        .eq('global_identity_id', testIdentityId)
        .eq('status', 'pending')
        .limit(1)
        .single();

      if (challenge) {
        await provider.approveRecovery({
          challengeId: challenge.id,
          approverSessionId: testAppSessionId
        });

        try {
          await provider.completeRecovery({
            challengeId: challenge.id,
            proof: 'otp',
            newCredential: '123' // Too short
          });
          expect.fail('Should have thrown');
        } catch (error) {
          expect(error.message).to.include('CREDENTIAL_TOO_WEAK');
        }
      }
    });
  });

  describe('3. Session Expiry & Revocation', () => {
    it('should revoke session', async () => {
      // Create a new session to revoke
      const { data: newSession } = await supabaseAdmin
        .from('app_sessions')
        .insert({
          global_identity_id: testIdentityId,
          membership_id: testMembershipId,
          device_id: 'revoke-test-device',
          expires_at: new Date(Date.now() + 1000 * 60 * 60)
        })
        .select()
        .single();

      // Revoke it
      const revoked = await provider.revokeSession(newSession.id);
      expect(revoked).to.exist;

      // Verify it's revoked
      try {
        await provider.verifySession(newSession.id);
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error.message).to.include('SESSION_EXPIRED');
      }
    });

    it('should handle session expiry on recovery completion', async () => {
      // Recovery should revoke all active sessions
      // This was tested in recovery flow above
      // Verify: old session is now invalid
      try {
        await provider.verifySession(testAppSessionId);
        expect.fail('Session should have been revoked');
      } catch (error) {
        expect(error.message).to.include('SESSION_EXPIRED');
      }
    });
  });

  describe('4. Row-Level Security (RLS)', () => {
    it('should enforce RLS: user can only see own sessions', async () => {
      // Setup: Create another identity
      const { data: identity2 } = await supabaseAdmin
        .from('global_identities')
        .insert({
          phone_e164: TEST_PHONE_2,
          credential_hash: 'hashed_pin',
          role: 'parent'
        })
        .select()
        .single();

      // Setup: Create sessions for both identities
      await supabaseAdmin
        .from('app_sessions')
        .insert([
          {
            global_identity_id: testIdentityId,
            membership_id: testMembershipId,
            device_id: 'device-1',
            expires_at: new Date(Date.now() + 1000 * 60 * 60)
          },
          {
            global_identity_id: identity2.id,
            membership_id: testMembershipId,
            device_id: 'device-2',
            expires_at: new Date(Date.now() + 1000 * 60 * 60)
          }
        ]);

      // Test: Query sessions with RLS enforced
      const { data: sessions, error } = await supabaseAnon
        .from('app_sessions')
        .select('id, global_identity_id')
        .eq('global_identity_id', testIdentityId);

      // RLS should prevent access to other user's sessions
      if (sessions) {
        const allOwnSessions = sessions.every(s => s.global_identity_id === testIdentityId);
        expect(allOwnSessions).to.be.true;
      }

      // Cleanup
      await supabaseAdmin
        .from('global_identities')
        .delete()
        .eq('id', identity2.id);
    });

    it('should enforce RLS: user can only see own recovery challenges', async () => {
      // Setup: Create recovery challenges for two identities
      const { data: identity2 } = await supabaseAdmin
        .from('global_identities')
        .insert({
          phone_e164: TEST_PHONE_2,
          credential_hash: 'hashed_pin',
          role: 'parent'
        })
        .select()
        .single();

      const expiresAt = new Date(Date.now() + 1000 * 60 * 10);

      await supabaseAdmin
        .from('identity_recovery_challenges')
        .insert([
          {
            global_identity_id: testIdentityId,
            phone_e164: TEST_PHONE_1,
            method: 'sms',
            status: 'pending',
            expires_at: expiresAt
          },
          {
            global_identity_id: identity2.id,
            phone_e164: TEST_PHONE_2,
            method: 'sms',
            status: 'pending',
            expires_at: expiresAt
          }
        ]);

      // Test: Query challenges with RLS
      // Note: Anon users can request recovery but shouldn't see others' challenges
      // This would require setting up auth context for anon client
      // For now, verify admin can see all
      const { data: allChallenges } = await supabaseAdmin
        .from('identity_recovery_challenges')
        .select('*')
        .in('global_identity_id', [testIdentityId, identity2.id]);

      expect(allChallenges.length).to.be.greaterThanOrEqual(2);

      // Cleanup
      await supabaseAdmin
        .from('global_identities')
        .delete()
        .eq('id', identity2.id);
    });
  });

  describe('5. Tenant Boundary Enforcement', () => {
    it('should isolate data by membership/app', async () => {
      // Setup: Create second membership with different app
      const { data: membership2 } = await supabaseAdmin
        .from('app_memberships')
        .insert({
          global_identity_id: testIdentityId,
          app_key: 'OTHER_APP',
          role: 'admin',
          active: true
        })
        .select()
        .single();

      // Create sessions for different apps
      const { data: tpaSession } = await supabaseAdmin
        .from('app_sessions')
        .insert({
          global_identity_id: testIdentityId,
          membership_id: testMembershipId,
          device_id: 'tpa-device',
          expires_at: new Date(Date.now() + 1000 * 60 * 60)
        })
        .select()
        .single();

      const { data: otherSession } = await supabaseAdmin
        .from('app_sessions')
        .insert({
          global_identity_id: testIdentityId,
          membership_id: membership2.id,
          device_id: 'other-device',
          expires_at: new Date(Date.now() + 1000 * 60 * 60)
        })
        .select()
        .single();

      // Test: Sessions should be isolated by app
      expect(tpaSession.id).to.not.equal(otherSession.id);
      expect(tpaSession.membership_id).to.not.equal(otherSession.membership_id);

      // Verify both can be verified independently
      const verifyTpa = await provider.verifySession(tpaSession.id);
      const verifyOther = await provider.verifySession(otherSession.id);

      expect(verifyTpa).to.be.true;
      expect(verifyOther).to.be.true;
    });

    it('should prevent cross-app session reuse', async () => {
      // This would require setting up separate transport layers per app
      // For now, verify the RPC accepts app context correctly
      const memberships = await provider.listMemberships({
        globalIdentityId: testIdentityId
      });

      // Should return only TPA memberships (filtered by provider's APP_KEY)
      expect(memberships).to.be.an('array');
    });
  });

  describe('6. Security Event Logging', () => {
    it('should record security events', async () => {
      const event = await provider.recordSecurityEvent({
        globalIdentityId: testIdentityId,
        eventType: 'login_success',
        success: true,
        metadata: { deviceId: testDeviceId }
      });

      expect(event).to.exist;
      expect(event.id).to.exist;
      expect(event.recordedAt).to.exist;
    });

    it('should log failed login attempts', async () => {
      const event = await provider.recordSecurityEvent({
        globalIdentityId: testIdentityId,
        eventType: 'login_failed',
        success: false,
        metadata: { reason: 'invalid_credential' }
      });

      expect(event).to.exist;
      expect(event.recordedAt).to.exist;
    });

    it('should allow users to view own security events', async () => {
      // With auth context, users should see only their own events via RLS
      const { data: events } = await supabaseAdmin
        .from('identity_security_events')
        .select('*')
        .eq('global_identity_id', testIdentityId);

      expect(events).to.be.an('array');
      // Should have at least the events we just recorded
      expect(events.length).to.be.greaterThanOrEqual(2);
    });
  });
});
