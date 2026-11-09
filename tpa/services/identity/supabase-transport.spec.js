/**
 * Supabase Transport Layer Tests
 * Tests RPC invocation, error mapping, and contract adherence
 */

import { describe, it, beforeEach, afterEach } from 'mocha';
import { expect } from 'chai';
import { SupabaseTransport } from './supabase-transport.js';
import { IdentityContractError } from './contract.js';

describe('Supabase Transport Layer (P1.2)', () => {
  let transport;
  let mockClient;

  beforeEach(() => {
    // Mock Supabase client
    mockClient = {
      rpc: async (rpcName, payload) => {
        // Default: success response
        return {
          data: { success: true, rpcName, payload },
          error: null
        };
      }
    };

    transport = new SupabaseTransport(mockClient);
  });

  describe('RPC Invocation', () => {
    it('should invoke RPC function with payload', async () => {
      let capturedRpcCall = null;
      mockClient.rpc = async (rpcName, payload) => {
        capturedRpcCall = { rpcName, payload };
        return { data: { result: 'ok' }, error: null };
      };

      const result = await transport.invoke('identity_verify_credential', {
        globalIdentityId: 'user-123',
        credential: '123456'
      });

      expect(capturedRpcCall.rpcName).to.equal('identity_verify_credential');
      expect(capturedRpcCall.payload.globalIdentityId).to.equal('user-123');
      expect(capturedRpcCall.payload.credential).to.equal('123456');
      expect(result.result).to.equal('ok');
    });

    it('should return RPC response data', async () => {
      mockClient.rpc = async () => {
        return {
          data: {
            id: 'session-123',
            status: 'active',
            expiresAt: '2026-10-09T12:39:41Z'
          },
          error: null
        };
      };

      const result = await transport.invoke('identity_create_app_session', {
        membershipId: 'mem-123',
        deviceId: 'dev-123'
      });

      expect(result.id).to.equal('session-123');
      expect(result.status).to.equal('active');
    });
  });

  describe('Error Mapping - Recovery Errors', () => {
    it('should map CHALLENGE_NOT_FOUND error', async () => {
      mockClient.rpc = async () => ({
        data: null,
        error: { message: 'CHALLENGE_NOT_FOUND' }
      });

      try {
        await transport.invoke('identity_complete_recovery', {
          challengeId: 'invalid-123',
          otp: '000000',
          credential: '123456'
        });
        expect.fail('Should throw error');
      } catch (err) {
        expect(err.code).to.equal('CHALLENGE_NOT_FOUND');
        expect(err.message).to.include('CHALLENGE_NOT_FOUND');
      }
    });

    it('should map CHALLENGE_EXPIRED error', async () => {
      mockClient.rpc = async () => ({
        data: null,
        error: { message: 'CHALLENGE_EXPIRED' }
      });

      try {
        await transport.invoke('identity_complete_recovery', {
          challengeId: 'expired-123',
          otp: '000000',
          credential: '123456'
        });
        expect.fail('Should throw error');
      } catch (err) {
        expect(err.code).to.equal('CHALLENGE_EXPIRED');
      }
    });

    it('should map RECOVERY_THROTTLED error', async () => {
      mockClient.rpc = async () => ({
        data: null,
        error: { message: 'RECOVERY_THROTTLED' }
      });

      try {
        await transport.invoke('identity_request_recovery', {
          phoneE164: '+62812345678'
        });
        expect.fail('Should throw error');
      } catch (err) {
        expect(err.code).to.equal('RECOVERY_THROTTLED');
      }
    });

    it('should map CREDENTIAL_TOO_WEAK error', async () => {
      mockClient.rpc = async () => ({
        data: null,
        error: { message: 'CREDENTIAL_TOO_WEAK' }
      });

      try {
        await transport.invoke('identity_complete_recovery', {
          challengeId: 'chall-123',
          otp: '123456',
          credential: '123' // Too weak (< 6 digits)
        });
        expect.fail('Should throw error');
      } catch (err) {
        expect(err.code).to.equal('CREDENTIAL_TOO_WEAK');
      }
    });

    it('should map INVALID_OTP error', async () => {
      mockClient.rpc = async () => ({
        data: null,
        error: { message: 'INVALID_OTP' }
      });

      try {
        await transport.invoke('identity_complete_recovery', {
          challengeId: 'chall-123',
          otp: 'wrong-otp',
          credential: '123456'
        });
        expect.fail('Should throw error');
      } catch (err) {
        expect(err.code).to.equal('INVALID_OTP');
      }
    });

    it('should map OTP_ATTEMPTS_EXCEEDED error', async () => {
      mockClient.rpc = async () => ({
        data: null,
        error: { message: 'OTP_ATTEMPTS_EXCEEDED' }
      });

      try {
        await transport.invoke('identity_complete_recovery', {
          challengeId: 'chall-123',
          otp: 'wrong-otp',
          credential: '123456'
        });
        expect.fail('Should throw error');
      } catch (err) {
        expect(err.code).to.equal('OTP_ATTEMPTS_EXCEEDED');
      }
    });
  });

  describe('Error Mapping - Auth Errors', () => {
    it('should map IDENTITY_NOT_FOUND error', async () => {
      mockClient.rpc = async () => ({
        data: null,
        error: { message: 'Identity not found' }
      });

      try {
        await transport.invoke('identity_resolve', {
          phoneE164: '+62899999999'
        });
        expect.fail('Should throw error');
      } catch (err) {
        expect(err.code).to.equal('IDENTITY_NOT_FOUND');
      }
    });

    it('should map IDENTITY_UNAUTHORIZED error (credential mismatch)', async () => {
      mockClient.rpc = async () => ({
        data: null,
        error: { message: 'Credential mismatch' }
      });

      try {
        await transport.invoke('identity_verify_credential', {
          globalIdentityId: 'user-123',
          credential: 'wrong-pin'
        });
        expect.fail('Should throw error');
      } catch (err) {
        expect(err.code).to.equal('IDENTITY_UNAUTHORIZED');
      }
    });

    it('should map SESSION_EXPIRED error', async () => {
      mockClient.rpc = async () => ({
        data: null,
        error: { message: 'Session expired' }
      });

      try {
        await transport.invoke('identity_verify_session', {
          appSessionId: 'sess-123'
        });
        expect.fail('Should throw error');
      } catch (err) {
        expect(err.code).to.equal('SESSION_EXPIRED');
      }
    });

    it('should map UNAUTHORIZED error', async () => {
      mockClient.rpc = async () => ({
        data: null,
        error: { message: 'Unauthorized' }
      });

      try {
        await transport.invoke('identity_approve_recovery', {
          challengeId: 'chall-123',
          approverUserId: 'user-123'
        });
        expect.fail('Should throw error');
      } catch (err) {
        expect(err.code).to.equal('UNAUTHORIZED');
      }
    });
  });

  describe('Error Mapping - Generic Fallback', () => {
    it('should return RPC_INVOKE_FAILED for unknown errors', async () => {
      mockClient.rpc = async () => ({
        data: null,
        error: { message: 'Some unknown database error' }
      });

      try {
        await transport.invoke('identity_verify_credential', {
          globalIdentityId: 'user-123',
          credential: '123456'
        });
        expect.fail('Should throw error');
      } catch (err) {
        expect(err.code).to.equal('RPC_INVOKE_FAILED');
      }
    });

    it('should return RPC_INVOKE_FAILED for null error message', async () => {
      mockClient.rpc = async () => ({
        data: null,
        error: { message: null }
      });

      try {
        await transport.invoke('identity_verify_credential', {
          globalIdentityId: 'user-123',
          credential: '123456'
        });
        expect.fail('Should throw error');
      } catch (err) {
        expect(err.code).to.equal('RPC_INVOKE_FAILED');
      }
    });
  });

  describe('Transport Constructor', () => {
    it('should throw if client not provided', () => {
      expect(() => {
        new SupabaseTransport(null);
      }).to.throw('Supabase client required');
    });

    it('should accept valid client', () => {
      expect(() => {
        new SupabaseTransport(mockClient);
      }).to.not.throw();
    });
  });

  describe('Integration with Contract', () => {
    it('should work with IdentityContractError codes', async () => {
      mockClient.rpc = async () => ({
        data: null,
        error: { message: 'CHALLENGE_NOT_FOUND' }
      });

      try {
        await transport.invoke('identity_complete_recovery', {
          challengeId: 'invalid',
          otp: '123456',
          credential: '123456'
        });
        expect.fail('Should throw error');
      } catch (err) {
        // Error code should match contract codes
        expect(err.code).to.be.oneOf([
          'CHALLENGE_NOT_FOUND',
          'CHALLENGE_EXPIRED',
          'RECOVERY_THROTTLED',
          'INVALID_OTP',
          'OTP_ATTEMPTS_EXCEEDED',
          'CREDENTIAL_TOO_WEAK',
          'IDENTITY_NOT_FOUND',
          'IDENTITY_UNAUTHORIZED',
          'SESSION_EXPIRED',
          'UNAUTHORIZED',
          'RPC_INVOKE_FAILED'
        ]);
      }
    });
  });

  describe('Real-world Scenarios', () => {
    it('should handle recovery flow: request → approve → complete', async () => {
      // Step 1: Request recovery
      mockClient.rpc = async (rpcName, payload) => {
        if (rpcName === 'identity_request_recovery') {
          return {
            data: {
              id: 'chall-123',
              status: 'pending',
              expiresAt: new Date(Date.now() + 10 * 60000).toISOString(),
              phoneE164: payload.phoneE164
            },
            error: null
          };
        }
      };

      const requestResult = await transport.invoke('identity_request_recovery', {
        phoneE164: '+62812345678'
      });
      expect(requestResult.status).to.equal('pending');
      expect(requestResult.id).to.equal('chall-123');

      // Step 2: Approve recovery (admin)
      mockClient.rpc = async (rpcName) => {
        if (rpcName === 'identity_approve_recovery') {
          return {
            data: {
              id: 'chall-123',
              status: 'approved',
              approvedAt: new Date().toISOString()
            },
            error: null
          };
        }
      };

      const approveResult = await transport.invoke('identity_approve_recovery', {
        challengeId: 'chall-123',
        approverUserId: 'admin-123'
      });
      expect(approveResult.status).to.equal('approved');

      // Step 3: Complete recovery (user provides OTP + new PIN)
      mockClient.rpc = async (rpcName) => {
        if (rpcName === 'identity_complete_recovery') {
          return {
            data: {
              id: 'chall-123',
              status: 'completed',
              completedAt: new Date().toISOString(),
              sessionsRevoked: 3
            },
            error: null
          };
        }
      };

      const completeResult = await transport.invoke('identity_complete_recovery', {
        challengeId: 'chall-123',
        otp: '123456',
        credential: '654321'
      });
      expect(completeResult.status).to.equal('completed');
      expect(completeResult.sessionsRevoked).to.equal(3);
    });

    it('should handle throttling on repeated requests', async () => {
      let requestCount = 0;
      mockClient.rpc = async (rpcName) => {
        if (rpcName === 'identity_request_recovery') {
          requestCount++;
          if (requestCount > 3) {
            return {
              data: null,
              error: { message: 'RECOVERY_THROTTLED' }
            };
          }
          return {
            data: {
              id: `chall-${requestCount}`,
              status: 'pending'
            },
            error: null
          };
        }
      };

      // First 3 requests should succeed
      for (let i = 0; i < 3; i++) {
        const result = await transport.invoke('identity_request_recovery', {
          phoneE164: '+62812345678'
        });
        expect(result.status).to.equal('pending');
      }

      // 4th request should be throttled
      try {
        await transport.invoke('identity_request_recovery', {
          phoneE164: '+62812345678'
        });
        expect.fail('Should throw throttling error');
      } catch (err) {
        expect(err.code).to.equal('RECOVERY_THROTTLED');
      }
    });
  });
});
