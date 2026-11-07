import { describe, it, beforeEach } from 'mocha';
import { expect } from 'chai';
import sinon from 'sinon';
import { TwilioOTPProvider } from './twilio-provider.js';

describe('Twilio OTP Provider', () => {
  let provider;
  let mockClient;

  beforeEach(() => {
    // Mock Twilio client
    mockClient = {
      messages: {
        create: sinon.stub().resolves({ sid: 'SM_test_123' })
      }
    };

    // Create provider with mocked Twilio
    provider = new TwilioOTPProvider({
      accountSid: 'AC' + '0'.repeat(32),
      authToken: 'test_token',
      fromPhoneNumber: '+16175551234',
      whatsappNumber: '+16175551234'
    });

    // Replace Twilio client with mock
    provider.client = mockClient;
  });

  describe('OTP Generation', () => {
    it('should generate 6-digit OTP', () => {
      const otp = provider.generateOTP();
      expect(otp).to.match(/^\d{6}$/);
    });

    it('should generate different OTPs on each call', () => {
      const otp1 = provider.generateOTP();
      const otp2 = provider.generateOTP();
      expect(otp1).to.not.equal(otp2);
    });
  });

  describe('Send OTP', () => {
    it('should send SMS OTP successfully', async () => {
      const result = await provider.sendOTP('+6281234567890', 'sms');

      expect(result.otp).to.match(/^\d{6}$/);
      expect(result.expiresAt).to.be.instanceof(Date);
      expect(mockClient.messages.create.called).to.be.true;

      const callArgs = mockClient.messages.create.getCall(0).args[0];
      expect(callArgs.to).to.equal('+6281234567890');
      expect(callArgs.body).to.include(result.otp);
    });

    it('should send WhatsApp OTP successfully', async () => {
      const result = await provider.sendOTP('+6281234567890', 'whatsapp');

      expect(result.otp).to.match(/^\d{6}$/);
      const callArgs = mockClient.messages.create.getCall(0).args[0];
      expect(callArgs.from).to.include('whatsapp:');
      expect(callArgs.to).to.include('whatsapp:');
    });

    it('should reject invalid phone number', async () => {
      try {
        await provider.sendOTP('not-a-phone', 'sms');
        expect.fail('Should reject invalid phone');
      } catch (error) {
        expect(error.message).to.include('Invalid phone number');
      }
    });

    it('should store OTP with expiration', async () => {
      await provider.sendOTP('+6281234567890', 'sms');

      const stored = provider.otpStore.get('+6281234567890');
      expect(stored).to.exist;
      expect(stored.otp).to.match(/^\d{6}$/);
      expect(stored.expiresAt).to.be.instanceof(Date);
      expect(stored.attempts).to.equal(0);
      expect(stored.maxAttempts).to.equal(3);
    });
  });

  describe('Verify OTP', () => {
    it('should verify correct OTP', async () => {
      const { otp } = await provider.sendOTP('+6281234567890', 'sms');
      const result = await provider.verifyOTP('+6281234567890', otp);

      expect(result.valid).to.be.true;
      expect(result.remaining).to.equal(0);
    });

    it('should reject invalid OTP', async () => {
      await provider.sendOTP('+6281234567890', 'sms');
      const result = await provider.verifyOTP('+6281234567890', '000000');

      expect(result.valid).to.be.false;
      expect(result.remaining).to.equal(2);
      expect(result.error).to.equal('INVALID_OTP');
    });

    it('should track failed OTP attempts', async () => {
      await provider.sendOTP('+6281234567890', 'sms');

      // First attempt
      let result = await provider.verifyOTP('+6281234567890', '000000');
      expect(result.remaining).to.equal(2);

      // Second attempt
      result = await provider.verifyOTP('+6281234567890', '111111');
      expect(result.remaining).to.equal(1);

      // Third attempt
      result = await provider.verifyOTP('+6281234567890', '222222');
      expect(result.remaining).to.equal(0);
    });

    it('should reject after max attempts exceeded', async () => {
      await provider.sendOTP('+6281234567890', 'sms');

      // Use up all attempts
      for (let i = 0; i < 3; i++) {
        await provider.verifyOTP('+6281234567890', `00000${i}`);
      }

      // Fourth attempt should fail with OTP_ATTEMPTS_EXCEEDED
      const result = await provider.verifyOTP('+6281234567890', '999999');
      expect(result.valid).to.be.false;
      expect(result.error).to.equal('OTP_ATTEMPTS_EXCEEDED');
    });

    it('should reject expired OTP', async () => {
      await provider.sendOTP('+6281234567890', 'sms');

      // Manually expire OTP
      const stored = provider.otpStore.get('+6281234567890');
      stored.expiresAt = new Date(Date.now() - 1000); // 1 second ago

      const result = await provider.verifyOTP('+6281234567890', stored.otp);
      expect(result.valid).to.be.false;
      expect(result.error).to.equal('OTP_EXPIRED');
    });

    it('should return OTP_NOT_FOUND for unknown phone', async () => {
      const result = await provider.verifyOTP('+6289999999999', '123456');
      expect(result.valid).to.be.false;
      expect(result.error).to.equal('OTP_NOT_FOUND');
    });
  });

  describe('Clear OTP', () => {
    it('should clear stored OTP', async () => {
      await provider.sendOTP('+6281234567890', 'sms');
      expect(provider.otpStore.has('+6281234567890')).to.be.true;

      provider.clearOTP('+6281234567890');
      expect(provider.otpStore.has('+6281234567890')).to.be.false;
    });
  });
});
