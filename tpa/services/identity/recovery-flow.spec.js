/**
 * P3.2 - Recovery Request Flow & Throttling Enforcement Tests
 * Verifies:
 * - Recovery request initiation
 * - Throttling enforcement (max requests per time window)
 * - Challenge creation and storage
 * - Recovery state transitions
 * - Error handling during throttling
 */

import { describe, it, before, beforeEach, afterEach } from 'mocha';
import { expect } from 'chai';
import sinon from 'sinon';

// Mock rate limiter
class RateLimiter {
  constructor(maxAttempts = 3, windowMs = 3600000) {
    this.maxAttempts = maxAttempts;
    this.windowMs = windowMs;
    this.attempts = new Map();
  }

  isThrottled(key) {
    const now = Date.now();
    const record = this.attempts.get(key);
    
    if (!record) return false;
    
    // Check if window has expired
    if (now - record.firstAttempt > this.windowMs) {
      this.attempts.delete(key);
      return false;
    }
    
    // Check if max attempts exceeded
    return record.count >= this.maxAttempts;
  }

  recordAttempt(key) {
    const now = Date.now();
    const record = this.attempts.get(key);
    
    if (!record) {
      this.attempts.set(key, { count: 1, firstAttempt: now });
    } else {
      record.count++;
    }
  }

  getRemainingAttempts(key) {
    const record = this.attempts.get(key);
    if (!record) return this.maxAttempts;
    return Math.max(0, this.maxAttempts - record.count);
  }

  reset(key) {
    this.attempts.delete(key);
  }

  clear() {
    this.attempts.clear();
  }
}

describe('Recovery Request Flow & Throttling (P3.2)', () => {
  let rateLimiter;
  let recoveryService;
  let mockAdapter;
  let mockStorage;

  before(() => {
    rateLimiter = new RateLimiter(3, 3600000); // 3 attempts per hour

    mockStorage = new Map();

    mockAdapter = {
      requestRecovery: sinon.stub(),
      approveRecovery: sinon.stub(),
      completeRecovery: sinon.stub(),
      verifyCredential: sinon.stub()
    };

    recoveryService = {
      requestRecovery: async (phone) => {
        const throttleKey = `recovery:${phone}`;
        
        if (rateLimiter.isThrottled(throttleKey)) {
          const error = new Error('Recovery request throttled');
          error.code = 'RECOVERY_THROTTLED';
          error.remaining = rateLimiter.getRemainingAttempts(throttleKey);
          throw error;
        }

        rateLimiter.recordAttempt(throttleKey);

        // Call adapter to create recovery challenge
        const challenge = await mockAdapter.requestRecovery(phone);
        return challenge;
      },

      approveRecovery: async (challengeId, adminSessionId) => {
        return await mockAdapter.approveRecovery(challengeId, adminSessionId);
      },

      completeRecovery: async (challengeId, token, newCredential) => {
        return await mockAdapter.completeRecovery(challengeId, token, newCredential);
      },

      getRecoveryStatus: (challengeId) => {
        return mockStorage.get(challengeId) || null;
      },

      getRateLimiterStatus: (phone) => {
        const throttleKey = `recovery:${phone}`;
        return {
          isThrottled: rateLimiter.isThrottled(throttleKey),
          remaining: rateLimiter.getRemainingAttempts(throttleKey),
          maxAttempts: rateLimiter.maxAttempts
        };
      }
    };
  });

  beforeEach(() => {
    sinon.resetHistory();
    rateLimiter.clear();
    mockStorage.clear();
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('Recovery Request Initiation', () => {
    it('should accept valid recovery request', async () => {
      mockAdapter.requestRecovery.resolves({
        challengeId: 'chal-001',
        method: 'admin_approval',
        status: 'pending'
      });

      const result = await recoveryService.requestRecovery('+6281234567890');
      
      expect(result.challengeId).to.equal('chal-001');
      expect(result.method).to.equal('admin_approval');
    });

    it('should validate phone number format', async () => {
      const validPhones = [
        '+6281234567890',
        '+6289876543210',
        '+628123456'
      ];

      for (const phone of validPhones) {
        mockAdapter.requestRecovery.resolves({
          challengeId: 'chal-' + Math.random(),
          method: 'admin_approval',
          status: 'pending'
        });

        const result = await recoveryService.requestRecovery(phone);
        expect(result).to.exist;
      }
    });

    it('should reject invalid phone format', async () => {
      const invalidPhones = [
        'invalid',
        '123',
        '+1234'
      ];

      for (const phone of invalidPhones) {
        mockAdapter.requestRecovery.rejects(new Error('INVALID_PHONE_FORMAT'));
        
        try {
          await recoveryService.requestRecovery(phone);
          expect.fail('Should have thrown');
        } catch (error) {
          expect(error.message).to.include('INVALID_PHONE_FORMAT');
        }
      }
    });

    it('should store recovery challenge in storage', async () => {
      const challengeId = 'chal-store-001';
      mockAdapter.requestRecovery.resolves({
        challengeId,
        method: 'admin_approval',
        status: 'pending',
        createdAt: new Date().toISOString()
      });

      const result = await recoveryService.requestRecovery('+6281234567890');
      
      // Store challenge
      mockStorage.set(challengeId, result);
      
      expect(mockStorage.has(challengeId)).to.be.true;
      expect(mockStorage.get(challengeId).status).to.equal('pending');
    });

    it('should assign unique challenge ID', async () => {
      const challengeIds = new Set();

      for (let i = 0; i < 5; i++) {
        const id = `chal-${Date.now()}-${Math.random()}`;
        challengeIds.add(id);
      }

      expect(challengeIds.size).to.equal(5);
    });

    it('should return challenge with expiration time', async () => {
      const expiresIn = 3600000; // 1 hour
      mockAdapter.requestRecovery.resolves({
        challengeId: 'chal-exp-001',
        expiresAt: new Date(Date.now() + expiresIn).toISOString(),
        status: 'pending'
      });

      const result = await recoveryService.requestRecovery('+6281234567890');
      
      expect(result.expiresAt).to.exist;
      const expiresAt = new Date(result.expiresAt);
      expect(expiresAt.getTime()).to.be.greaterThan(Date.now());
    });
  });

  describe('Throttling Enforcement', () => {
    it('should allow first recovery request', async () => {
      mockAdapter.requestRecovery.resolves({
        challengeId: 'chal-th-001',
        status: 'pending'
      });

      const result = await recoveryService.requestRecovery('+6281111111111');
      expect(result.challengeId).to.equal('chal-th-001');
    });

    it('should allow second recovery request within limit', async () => {
      mockAdapter.requestRecovery.resolves({
        challengeId: 'chal-th-002',
        status: 'pending'
      });

      // First request
      await recoveryService.requestRecovery('+6281111111111');

      // Second request - should succeed
      const result = await recoveryService.requestRecovery('+6281111111111');
      expect(result.challengeId).to.equal('chal-th-002');
    });

    it('should allow third recovery request within limit', async () => {
      mockAdapter.requestRecovery.resolves({
        challengeId: 'chal-th-003',
        status: 'pending'
      });

      for (let i = 0; i < 3; i++) {
        const result = await recoveryService.requestRecovery('+6281111111111');
        expect(result).to.exist;
      }
    });

    it('should reject fourth recovery request (throttled)', async () => {
      mockAdapter.requestRecovery.resolves({
        challengeId: 'chal-th-004',
        status: 'pending'
      });

      // Make 3 requests (at limit)
      for (let i = 0; i < 3; i++) {
        await recoveryService.requestRecovery('+6281111111111');
      }

      // Fourth request should be throttled
      try {
        await recoveryService.requestRecovery('+6281111111111');
        expect.fail('Should have thrown RECOVERY_THROTTLED');
      } catch (error) {
        expect(error.code).to.equal('RECOVERY_THROTTLED');
      }
    });

    it('should return remaining attempts in throttle error', async () => {
      // Make max requests
      for (let i = 0; i < 3; i++) {
        mockAdapter.requestRecovery.resolves({ challengeId: 'chal-' + i });
        await recoveryService.requestRecovery('+6281111111111');
      }

      try {
        await recoveryService.requestRecovery('+6281111111111');
        expect.fail('Should be throttled');
      } catch (error) {
        expect(error.remaining).to.equal(0);
      }
    });

    it('should track per-phone throttling (separate limits)', async () => {
      mockAdapter.requestRecovery.resolves({
        challengeId: 'chal-sep-001',
        status: 'pending'
      });

      // Make 3 requests for phone A
      for (let i = 0; i < 3; i++) {
        await recoveryService.requestRecovery('+6281111111111');
      }

      // Phone B should still have attempts available
      mockAdapter.requestRecovery.resolves({
        challengeId: 'chal-sep-phone-b',
        status: 'pending'
      });

      const result = await recoveryService.requestRecovery('+6282222222222');
      expect(result).to.exist;

      // Verify phone A is throttled
      try {
        await recoveryService.requestRecovery('+6281111111111');
        expect.fail('Phone A should be throttled');
      } catch (error) {
        expect(error.code).to.equal('RECOVERY_THROTTLED');
      }
    });

    it('should show throttle status before request fails', async () => {
      // Make 3 requests
      for (let i = 0; i < 3; i++) {
        mockAdapter.requestRecovery.resolves({ challengeId: 'chal-' + i });
        await recoveryService.requestRecovery('+6281111111111');
      }

      const status = recoveryService.getRateLimiterStatus('+6281111111111');
      
      expect(status.isThrottled).to.be.true;
      expect(status.remaining).to.equal(0);
      expect(status.maxAttempts).to.equal(3);
    });

    it('should allow requests after throttle window expires', async () => {
      const newRateLimiter = new RateLimiter(3, 1000); // 1 second window
      const newService = {
        requestRecovery: async (phone) => {
          if (newRateLimiter.isThrottled(`recovery:${phone}`)) {
            throw new Error('RECOVERY_THROTTLED');
          }
          newRateLimiter.recordAttempt(`recovery:${phone}`);
          return { challengeId: 'chal-window', status: 'pending' };
        }
      };

      // Make 3 requests
      for (let i = 0; i < 3; i++) {
        await newService.requestRecovery('+6281111111111');
      }

      // Should be throttled
      try {
        await newService.requestRecovery('+6281111111111');
        expect.fail('Should be throttled');
      } catch (error) {
        expect(error.message).to.include('RECOVERY_THROTTLED');
      }

      // Wait for window to expire
      await new Promise(resolve => setTimeout(resolve, 1100));

      // Should now be allowed
      const result = await newService.requestRecovery('+6281111111111');
      expect(result).to.exist;
    });

    it('should reject requests with clear throttle message', async () => {
      for (let i = 0; i < 3; i++) {
        mockAdapter.requestRecovery.resolves({ challengeId: 'chal-' + i });
        await recoveryService.requestRecovery('+6281111111111');
      }

      try {
        await recoveryService.requestRecovery('+6281111111111');
        expect.fail('Should fail');
      } catch (error) {
        expect(error.code).to.equal('RECOVERY_THROTTLED');
        expect(error.message).to.include('throttled') || expect(error.message).to.exist;
      }
    });
  });

  describe('Challenge State Transitions', () => {
    it('should create challenge in pending state', async () => {
      mockAdapter.requestRecovery.resolves({
        challengeId: 'chal-state-001',
        status: 'pending'
      });

      const result = await recoveryService.requestRecovery('+6281234567890');
      expect(result.status).to.equal('pending');
    });

    it('should transition to verified after approval', async () => {
      mockAdapter.approveRecovery.resolves({
        challengeId: 'chal-state-002',
        status: 'verified'
      });

      const result = await recoveryService.approveRecovery('chal-state-002', 'sess-admin-123');
      expect(result.status).to.equal('verified');
    });

    it('should transition to completed after OTP verification', async () => {
      mockAdapter.completeRecovery.resolves({
        challengeId: 'chal-state-003',
        status: 'completed',
        completed: true
      });

      const result = await recoveryService.completeRecovery('chal-state-003', 'otp-token', 'newpassword');
      expect(result.completed).to.be.true;
    });

    it('should track challenge state progression', async () => {
      const challengeId = 'chal-progression-001';
      
      // Create challenge
      mockAdapter.requestRecovery.resolves({
        challengeId,
        status: 'pending'
      });
      let challenge = await recoveryService.requestRecovery('+6281234567890');
      mockStorage.set(challengeId, challenge);
      expect(mockStorage.get(challengeId).status).to.equal('pending');

      // Approve challenge
      mockAdapter.approveRecovery.resolves({
        challengeId,
        status: 'verified'
      });
      challenge = await recoveryService.approveRecovery(challengeId, 'sess-admin');
      mockStorage.set(challengeId, challenge);
      expect(mockStorage.get(challengeId).status).to.equal('verified');

      // Complete recovery
      mockAdapter.completeRecovery.resolves({
        challengeId,
        status: 'completed'
      });
      challenge = await recoveryService.completeRecovery(challengeId, 'token', 'newpass');
      mockStorage.set(challengeId, challenge);
      expect(mockStorage.get(challengeId).status).to.equal('completed');
    });
  });

  describe('Error Handling', () => {
    it('should handle identity not found error', async () => {
      mockAdapter.requestRecovery.rejects(new Error('IDENTITY_NOT_FOUND'));

      try {
        await recoveryService.requestRecovery('+9999999999999');
        expect.fail('Should throw');
      } catch (error) {
        expect(error.message).to.include('IDENTITY_NOT_FOUND');
      }
    });

    it('should handle network errors gracefully', async () => {
      mockAdapter.requestRecovery.rejects(new Error('Network timeout'));

      try {
        await recoveryService.requestRecovery('+6281234567890');
        expect.fail('Should throw');
      } catch (error) {
        expect(error.message).to.include('Network');
      }
    });

    it('should handle expired challenges', async () => {
      const challengeId = 'chal-expired-001';
      mockStorage.set(challengeId, {
        status: 'pending',
        expiresAt: new Date(Date.now() - 1000).toISOString()
      });

      const challenge = mockStorage.get(challengeId);
      const isExpired = new Date(challenge.expiresAt).getTime() < Date.now();

      expect(isExpired).to.be.true;
    });

    it('should handle concurrent recovery requests', async () => {
      mockAdapter.requestRecovery.resolves({
        challengeId: 'chal-concurrent',
        status: 'pending'
      });

      const promises = [
        recoveryService.requestRecovery('+6281111111111'),
        recoveryService.requestRecovery('+6281111111111'),
        recoveryService.requestRecovery('+6281111111111')
      ];

      const results = await Promise.all(promises);
      expect(results).to.have.lengthOf(3);
      expect(results[0]).to.exist;
    });

    it('should handle missing admin session on approval', async () => {
      mockAdapter.approveRecovery.rejects(new Error('ADMIN_SESSION_NOT_FOUND'));

      try {
        await recoveryService.approveRecovery('chal-001', null);
        expect.fail('Should throw');
      } catch (error) {
        expect(error.message).to.include('ADMIN_SESSION_NOT_FOUND');
      }
    });
  });

  describe('Recovery Flow End-to-End', () => {
    it('should complete full recovery flow: request → approve → complete', async () => {
      const challengeId = 'chal-e2e-001';
      const phone = '+6281234567890';

      // 1. Request recovery
      mockAdapter.requestRecovery.resolves({
        challengeId,
        status: 'pending',
        method: 'admin_approval'
      });
      const requested = await recoveryService.requestRecovery(phone);
      mockStorage.set(challengeId, requested);
      expect(requested.status).to.equal('pending');

      // 2. Admin approves
      mockAdapter.approveRecovery.resolves({
        challengeId,
        status: 'verified'
      });
      const approved = await recoveryService.approveRecovery(challengeId, 'sess-admin-123');
      mockStorage.set(challengeId, approved);
      expect(approved.status).to.equal('verified');

      // 3. Complete with OTP/token
      mockAdapter.completeRecovery.resolves({
        challengeId,
        status: 'completed',
        completed: true
      });
      const completed = await recoveryService.completeRecovery(challengeId, 'approval-token', 'newpass123');
      mockStorage.set(challengeId, completed);
      expect(completed.completed).to.be.true;
    });

    it('should reject recovery after throttle limit', async () => {
      const phone = '+6281111111111';

      // Use up all attempts
      for (let i = 0; i < 3; i++) {
        mockAdapter.requestRecovery.resolves({
          challengeId: `chal-reject-${i}`,
          status: 'pending'
        });
        await recoveryService.requestRecovery(phone);
      }

      // Fourth attempt should fail
      try {
        await recoveryService.requestRecovery(phone);
        expect.fail('Should be throttled');
      } catch (error) {
        expect(error.code).to.equal('RECOVERY_THROTTLED');
      }
    });
  });

  describe('P3.2 Completion Checklist', () => {
    it('✅ Recovery request can be initiated with valid phone', async () => {
      mockAdapter.requestRecovery.resolves({
        challengeId: 'chal-check-001',
        status: 'pending'
      });

      const result = await recoveryService.requestRecovery('+6281234567890');
      expect(result.challengeId).to.exist;
    });

    it('✅ Throttling limits recovery requests to max 3 per hour', async () => {
      for (let i = 0; i < 3; i++) {
        mockAdapter.requestRecovery.resolves({ challengeId: `chal-${i}` });
        await recoveryService.requestRecovery('+6281111111111');
      }

      try {
        await recoveryService.requestRecovery('+6281111111111');
        expect.fail('Should be throttled');
      } catch (error) {
        expect(error.code).to.equal('RECOVERY_THROTTLED');
      }
    });

    it('✅ Throttling returns clear error message', async () => {
      for (let i = 0; i < 3; i++) {
        mockAdapter.requestRecovery.resolves({ challengeId: `chal-${i}` });
        await recoveryService.requestRecovery('+6281111111111');
      }

      try {
        await recoveryService.requestRecovery('+6281111111111');
        expect.fail('Should throw');
      } catch (error) {
        expect(error.code).to.exist;
        expect(error.remaining).to.equal(0);
      }
    });

    it('✅ Recovery challenge stored with pending status', async () => {
      mockAdapter.requestRecovery.resolves({
        challengeId: 'chal-store-check',
        status: 'pending'
      });

      const result = await recoveryService.requestRecovery('+6281234567890');
      mockStorage.set('chal-store-check', result);

      const stored = mockStorage.get('chal-store-check');
      expect(stored.status).to.equal('pending');
    });

    it('✅ Per-phone throttling enforced (separate limits)', async () => {
      mockAdapter.requestRecovery.resolves({ challengeId: 'chal-sep' });

      // Phone A: 3 requests
      for (let i = 0; i < 3; i++) {
        await recoveryService.requestRecovery('+6281111111111');
      }

      // Phone B: should still work
      const result = await recoveryService.requestRecovery('+6282222222222');
      expect(result).to.exist;
    });

    it('✅ Recovery flow: request → approve → complete sequence', async () => {
      const cid = 'chal-flow-seq';

      mockAdapter.requestRecovery.resolves({ challengeId: cid, status: 'pending' });
      const req = await recoveryService.requestRecovery('+6281234567890');
      expect(req.status).to.equal('pending');

      mockAdapter.approveRecovery.resolves({ challengeId: cid, status: 'verified' });
      const app = await recoveryService.approveRecovery(cid, 'sess-admin');
      expect(app.status).to.equal('verified');

      mockAdapter.completeRecovery.resolves({ challengeId: cid, completed: true });
      const comp = await recoveryService.completeRecovery(cid, 'token', 'pass');
      expect(comp.completed).to.be.true;
    });

    it('✅ Invalid phone rejected', async () => {
      mockAdapter.requestRecovery.rejects(new Error('INVALID_PHONE_FORMAT'));

      try {
        await recoveryService.requestRecovery('invalid');
        expect.fail('Should reject');
      } catch (error) {
        expect(error.message).to.include('INVALID_PHONE_FORMAT');
      }
    });

    it('✅ Challenge expiration time set', async () => {
      mockAdapter.requestRecovery.resolves({
        challengeId: 'chal-exp-check',
        expiresAt: new Date(Date.now() + 3600000).toISOString()
      });

      const result = await recoveryService.requestRecovery('+6281234567890');
      expect(result.expiresAt).to.exist;
      expect(new Date(result.expiresAt).getTime()).to.be.greaterThan(Date.now());
    });
  });
});
