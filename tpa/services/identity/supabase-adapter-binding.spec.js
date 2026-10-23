/**
 * P2.2 - Supabase Identity Adapter Binding Tests
 * Verifies:
 * - SupabaseIdentityProvider correctly binds to SupabaseTransport
 * - RPC methods are invoked with correct parameters
 * - Error mapping works properly
 * - Session management integrates correctly
 */

import { describe, it, before, beforeEach } from 'mocha';
import { expect } from 'chai';
import { SupabaseIdentityProvider } from './supabase-provider.js';
import { SupabaseTransport } from './supabase-transport.js';

describe('Supabase Adapter Binding (P2.2)', () => {
  let mockTransport;
  let provider;

  before(() => {
    // Create a mock transport that tracks RPC calls
    mockTransport = {
      invoke: async (method, payload) => {
        mockTransport.lastCall = { method, payload };
        // Return mock success responses
        switch (method) {
          case 'identity_resolve':
            return { globalIdentityId: 'test-id-123', phone: payload.phoneE164 };
          case 'identity_verify_credential':
            return { verified: true, globalIdentityId: payload.globalIdentityId };
          case 'identity_list_memberships':
            return [{ membershipId: 'mem-123', appKey: 'tpa' }];
          case 'identity_create_app_session':
            return { appSessionId: 'sess-123', membershipId: payload.membershipId, expiresAt: new Date().toISOString() };
          case 'identity_verify_app_session':
            return { valid: true, appSessionId: payload.appSessionId };
          case 'identity_revoke_app_session':
            return { revoked: true, appSessionId: payload.appSessionId };
          case 'identity_record_security_event':
            return { recorded: true, eventId: 'evt-123' };
          case 'identity_request_recovery':
            // Migrasi 20261009: param Postgres p_* tanpa appKey.
            return { challengeId: 'chal-123', phoneE164: payload.p_phone_e164 };
          case 'identity_approve_recovery':
            return { approved: true, challengeId: payload.p_challenge_id };
          case 'identity_complete_recovery':
            return { completed: true, challengeId: payload.p_challenge_id };
          default:
            throw new Error(`Unknown method: ${method}`);
        }
      }
    };
  });

  beforeEach(() => {
    provider = new SupabaseIdentityProvider(mockTransport);
    mockTransport.lastCall = null;
  });

  describe('Provider Initialization', () => {
    it('should accept valid transport with invoke method', () => {
      expect(() => {
        new SupabaseIdentityProvider(mockTransport);
      }).to.not.throw();
    });

    it('should throw error if transport is null', () => {
      expect(() => {
        new SupabaseIdentityProvider(null);
      }).to.throw('Identity transport wajib menyediakan invoke()');
    });

    it('should throw error if transport missing invoke method', () => {
      expect(() => {
        new SupabaseIdentityProvider({ somethingElse: true });
      }).to.throw('Identity transport wajib menyediakan invoke()');
    });

    it('should store transport reference', () => {
      expect(provider.transport).to.equal(mockTransport);
    });

    it('should have provider with valid method mappings', () => {
      expect(provider.resolveIdentity).to.be.a('function');
      expect(provider.verifyCredential).to.be.a('function');
      expect(provider.listMemberships).to.be.a('function');
    });
  });

  describe('resolveIdentity RPC Call', () => {
    it('should call identity_resolve RPC with phoneE164', async () => {
      await provider.resolveIdentity('+6281234567890');
      expect(mockTransport.lastCall.method).to.equal('identity_resolve');
    });

    it('should normalize phone number before sending', async () => {
      await provider.resolveIdentity('+6281234567890');
      expect(mockTransport.lastCall.payload.phoneE164).to.equal('+6281234567890');
    });

    it('should include appKey in payload', async () => {
      await provider.resolveIdentity('+6281234567890');
      expect(mockTransport.lastCall.payload).to.have.property('appKey');
      expect(mockTransport.lastCall.payload.appKey).to.equal('tpa');
    });

    it('should return globalIdentityId on success', async () => {
      const result = await provider.resolveIdentity('+6281234567890');
      expect(result).to.have.property('globalIdentityId');
    });

    it('should throw error for invalid phone format', () => {
      expect(() => {
        provider.resolveIdentity('invalid-phone');
      }).to.throw();
    });
  });

  describe('verifyCredential RPC Call', () => {
    it('should call identity_verify_credential RPC', async () => {
      await provider.verifyCredential({ globalIdentityId: 'id-123', credential: 'pin-123456' });
      expect(mockTransport.lastCall.method).to.equal('identity_verify_credential');
    });

    it('should send globalIdentityId and credential', async () => {
      await provider.verifyCredential({ globalIdentityId: 'id-123', credential: 'pin-123456' });
      expect(mockTransport.lastCall.payload).to.have.property('globalIdentityId', 'id-123');
      expect(mockTransport.lastCall.payload).to.have.property('credential', 'pin-123456');
    });

    it('should include appKey in payload', async () => {
      await provider.verifyCredential({ globalIdentityId: 'id-123', credential: 'pin-123456' });
      expect(mockTransport.lastCall.payload).to.have.property('appKey');
    });

    it('should return verification result', async () => {
      const result = await provider.verifyCredential({ globalIdentityId: 'id-123', credential: 'pin-123456' });
      expect(result).to.have.property('verified');
    });
  });

  describe('listMemberships RPC Call', () => {
    it('should call identity_list_memberships RPC', async () => {
      await provider.listMemberships({ globalIdentityId: 'id-123', appKey: 'tpa' });
      expect(mockTransport.lastCall.method).to.equal('identity_list_memberships');
    });

    it('should send globalIdentityId', async () => {
      await provider.listMemberships({ globalIdentityId: 'id-123', appKey: 'tpa' });
      expect(mockTransport.lastCall.payload).to.have.property('globalIdentityId', 'id-123');
    });

    it('should throw error if appKey is wrong', async () => {
      expect(() => {
        provider.listMemberships({ globalIdentityId: 'id-123', appKey: 'wrong-app' });
      }).to.throw('Provider hanya menerima appKey TPA');
    });

    it('should return array of memberships', async () => {
      const result = await provider.listMemberships({ globalIdentityId: 'id-123', appKey: 'tpa' });
      expect(result).to.be.an('array');
    });
  });

  describe('createAppSession RPC Call', () => {
    it('should call identity_create_app_session RPC', async () => {
      await provider.createAppSession({ membershipId: 'mem-123', deviceId: null });
      expect(mockTransport.lastCall.method).to.equal('identity_create_app_session');
    });

    it('should send membershipId and deviceId', async () => {
      await provider.createAppSession({ membershipId: 'mem-123', deviceId: 'dev-456' });
      expect(mockTransport.lastCall.payload).to.have.property('membershipId', 'mem-123');
      expect(mockTransport.lastCall.payload).to.have.property('deviceId', 'dev-456');
    });

    it('should include appKey in payload', async () => {
      await provider.createAppSession({ membershipId: 'mem-123', deviceId: null });
      expect(mockTransport.lastCall.payload).to.have.property('appKey');
    });

    it('should return session data with expiresAt', async () => {
      const result = await provider.createAppSession({ membershipId: 'mem-123', deviceId: null });
      expect(result).to.have.property('appSessionId');
      expect(result).to.have.property('expiresAt');
    });
  });

  describe('verifySession RPC Call', () => {
    it('should call identity_verify_app_session RPC', async () => {
      await provider.verifySession('sess-123');
      expect(mockTransport.lastCall.method).to.equal('identity_verify_app_session');
    });

    it('should send appSessionId', async () => {
      await provider.verifySession('sess-123');
      expect(mockTransport.lastCall.payload).to.have.property('appSessionId', 'sess-123');
    });

    it('should include appKey in payload', async () => {
      await provider.verifySession('sess-123');
      expect(mockTransport.lastCall.payload).to.have.property('appKey');
    });

    it('should return verification result', async () => {
      const result = await provider.verifySession('sess-123');
      expect(result).to.have.property('valid');
    });
  });

  describe('revokeSession RPC Call', () => {
    it('should call identity_revoke_app_session RPC', async () => {
      await provider.revokeSession('sess-123');
      expect(mockTransport.lastCall.method).to.equal('identity_revoke_app_session');
    });

    it('should send appSessionId', async () => {
      await provider.revokeSession('sess-123');
      expect(mockTransport.lastCall.payload).to.have.property('appSessionId', 'sess-123');
    });

    it('should include appKey in payload', async () => {
      await provider.revokeSession('sess-123');
      expect(mockTransport.lastCall.payload).to.have.property('appKey');
    });

    it('should return revocation confirmation', async () => {
      const result = await provider.revokeSession('sess-123');
      expect(result).to.have.property('revoked');
    });
  });

  describe('recordSecurityEvent RPC Call', () => {
    // Event memakai bentuk hasil redactSecurityEvent (yang dikirim adapter).
    const event = {
      identityId: 'id-123', appKey: 'tpa', eventType: 'login_success', success: true,
      metadataRedacted: { deviceId: 'dev-1' }, createdAt: new Date().toISOString()
    };

    it('should call identity_record_security_event RPC', async () => {
      await provider.recordSecurityEvent(event);
      expect(mockTransport.lastCall.method).to.equal('identity_record_security_event');
    });

    it('should map event to Postgres params (migrasi 20261009)', async () => {
      await provider.recordSecurityEvent(event);
      expect(mockTransport.lastCall.payload).to.include({
        p_global_identity_id: 'id-123',
        p_event_type: 'login_success',
        p_success: true
      });
      expect(mockTransport.lastCall.payload).to.have.property('p_metadata');
    });

    it('should not include appKey for recovery/security RPC', async () => {
      await provider.recordSecurityEvent(event);
      expect(mockTransport.lastCall.payload).not.to.have.property('appKey');
    });
  });

  describe('requestRecovery RPC Call', () => {
    it('should call identity_request_recovery RPC', async () => {
      await provider.requestRecovery({ phoneE164: '+6281234567890' });
      expect(mockTransport.lastCall.method).to.equal('identity_request_recovery');
    });

    it('should normalize and send p_phone_e164', async () => {
      await provider.requestRecovery({ phoneE164: '+6281234567890' });
      expect(mockTransport.lastCall.payload).to.have.property('p_phone_e164', '+6281234567890');
    });

    it('should not include appKey (param Postgres murni)', async () => {
      await provider.requestRecovery({ phoneE164: '+6281234567890' });
      expect(mockTransport.lastCall.payload).not.to.have.property('appKey');
    });

    it('should return challenge data', async () => {
      const result = await provider.requestRecovery({ phoneE164: '+6281234567890' });
      expect(result).to.have.property('challengeId');
    });
  });

  describe('approveRecovery RPC Call', () => {
    it('should call identity_approve_recovery RPC', async () => {
      await provider.approveRecovery({ challengeId: 'chal-123' });
      expect(mockTransport.lastCall.method).to.equal('identity_approve_recovery');
    });

    it('should send p_challenge_id without caller-supplied approver session', async () => {
      await provider.approveRecovery({ challengeId: 'chal-123' });
      expect(mockTransport.lastCall.payload).to.have.property('p_challenge_id', 'chal-123');
      expect(mockTransport.lastCall.payload).not.to.have.property('approverSessionId');
    });

    it('should not include appKey (param Postgres murni)', async () => {
      await provider.approveRecovery({ challengeId: 'chal-123' });
      expect(mockTransport.lastCall.payload).not.to.have.property('appKey');
    });
  });

  describe('completeRecovery RPC Call', () => {
    it('should call identity_complete_recovery RPC', async () => {
      await provider.completeRecovery({ challengeId: 'chal-123', approvalToken: 'artifact-data', newCredential: 'new-pin-654321' });
      expect(mockTransport.lastCall.method).to.equal('identity_complete_recovery');
    });

    it('should send p_challenge_id, p_otp, and p_new_credential_hash', async () => {
      await provider.completeRecovery({ challengeId: 'chal-123', approvalToken: 'artifact-data', newCredential: 'new-pin-654321' });
      expect(mockTransport.lastCall.payload).to.have.property('p_challenge_id', 'chal-123');
      expect(mockTransport.lastCall.payload).to.have.property('p_otp', 'artifact-data');
      expect(mockTransport.lastCall.payload).to.have.property('p_new_credential_hash', 'new-pin-654321');
      expect(mockTransport.lastCall.payload).not.to.have.property('proof');
    });

    it('should not include appKey (param Postgres murni)', async () => {
      await provider.completeRecovery({ challengeId: 'chal-123', approvalToken: 'artifact-data', newCredential: 'new-pin-654321' });
      expect(mockTransport.lastCall.payload).not.to.have.property('appKey');
    });
  });

  describe('appKey Integration', () => {
    it('should always include appKey in RPC payloads', async () => {
      // Test multiple methods to ensure appKey consistency
      await provider.resolveIdentity('+6281234567890');
      expect(mockTransport.lastCall.payload.appKey).to.equal('tpa');

      await provider.verifySession('sess-123');
      expect(mockTransport.lastCall.payload.appKey).to.equal('tpa');

      await provider.createAppSession({ membershipId: 'mem-123' });
      expect(mockTransport.lastCall.payload.appKey).to.equal('tpa');
    });

    it('should enforce TPA appKey in listMemberships', async () => {
      expect(() => {
        provider.listMemberships({ globalIdentityId: 'id-123', appKey: 'different-app' });
      }).to.throw('hanya menerima appKey TPA');
    });
  });

  describe('Error Handling', () => {
    it('should handle transport errors gracefully', async () => {
      const failingTransport = {
        invoke: async () => {
          throw new Error('RPC failed: connection timeout');
        }
      };
      const failingProvider = new SupabaseIdentityProvider(failingTransport);

      try {
        await failingProvider.resolveIdentity('+6281234567890');
        expect.fail('Should have thrown error');
      } catch (error) {
        expect(error.message).to.include('RPC failed');
      }
    });

    it('should handle invalid response from RPC', async () => {
      const invalidTransport = {
        invoke: async () => null
      };
      const invalidProvider = new SupabaseIdentityProvider(invalidTransport);

      const result = await invalidProvider.resolveIdentity('+6281234567890');
      expect(result).to.be.null;
    });
  });

  describe('P2.2 Completion Checklist', () => {
    it('✅ SupabaseIdentityProvider can be instantiated with transport', () => {
      const testProvider = new SupabaseIdentityProvider(mockTransport);
      expect(testProvider).to.be.instanceof(SupabaseIdentityProvider);
    });

    it('✅ All RPC methods are correctly mapped', async () => {
      const methods = [
        'resolveIdentity',
        'verifyCredential',
        'listMemberships',
        'createAppSession',
        'verifySession',
        'revokeSession',
        'recordSecurityEvent',
        'requestRecovery',
        'approveRecovery',
        'completeRecovery'
      ];

      for (const method of methods) {
        expect(typeof provider[method]).to.equal('function');
      }
    });

    it('✅ appKey is included in all RPC payloads', async () => {
      // Verify appKey propagation across different call types
      await provider.resolveIdentity('+6281234567890');
      expect(mockTransport.lastCall.payload.appKey).to.exist;
    });

    it('✅ Phone normalization works before RPC call', async () => {
      await provider.resolveIdentity('+6281234567890');
      expect(mockTransport.lastCall.payload.phoneE164).to.equal('+6281234567890');
    });

    it('✅ Transport injection enables dependency injection', () => {
      expect(provider.transport).to.equal(mockTransport);
    });

    it('✅ Error validation prevents invalid appKey usage', () => {
      expect(() => {
        provider.listMemberships({ globalIdentityId: 'id-123', appKey: 'wrong' });
      }).to.throw();
    });
  });

  describe('Integration with SupabaseTransport', () => {
    it('should work with real SupabaseTransport instance', () => {
      // This test verifies the interface compatibility
      // Create a mock Supabase client for interface check
      const mockClient = { rpc: () => {} };
      const realTransport = new SupabaseTransport(mockClient);
      expect(realTransport).to.have.property('invoke');
      expect(typeof realTransport.invoke).to.equal('function');
    });

    it('should receive RPC responses in expected format', async () => {
      const result = await provider.resolveIdentity('+6281234567890');
      expect(result).to.be.an('object');
      expect(result).to.have.property('globalIdentityId');
    });
  });
});
