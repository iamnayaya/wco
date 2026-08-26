import {
  verifyPaystackSignature,
  verifyFlutterwaveSignature,
  verifyOpaySignature,
  verifyPaymentWebhook,
  signPaystackPayload,
} from '@wco/payments';

/**
 * Payment webhook signature verification tests.
 * Covers all three PSPs with valid, invalid, and edge cases.
 * All comparisons must be timing-safe (constant-time).
 */

describe('Payment webhook signature verification', () => {
  const FAKE_SECRET = 'sk_test_abcdef1234567890abcdef1234567890';
  const FAKE_PAYLOAD = '{"event":"charge.success","data":{"reference":"wco_test_123","status":"success"}}';

  describe('verifyPaystackSignature', () => {
    it('returns true for valid HMAC-SHA512 signature', () => {
      const sig = signPaystackPayload(FAKE_PAYLOAD, FAKE_SECRET);
      expect(verifyPaystackSignature(FAKE_PAYLOAD, sig, FAKE_SECRET)).toBe(true);
    });

    it('returns false for invalid signature', () => {
      expect(verifyPaystackSignature(FAKE_PAYLOAD, 'wrong_signature', FAKE_SECRET)).toBe(false);
    });

    it('returns false for empty signature', () => {
      expect(verifyPaystackSignature(FAKE_PAYLOAD, '', FAKE_SECRET)).toBe(false);
    });

    it('returns false for undefined signature', () => {
      expect(verifyPaystackSignature(FAKE_PAYLOAD, undefined, FAKE_SECRET)).toBe(false);
    });

    it('returns false for different payload', () => {
      const sig = signPaystackPayload(FAKE_PAYLOAD, FAKE_SECRET);
      const tampered = FAKE_PAYLOAD.replace('success', 'failed');
      expect(verifyPaystackSignature(tampered, sig, FAKE_SECRET)).toBe(false);
    });
  });

  describe('verifyFlutterwaveSignature', () => {
    it('returns true when header matches configured hash', () => {
      expect(verifyFlutterwaveSignature('my-secret-hash', 'my-secret-hash')).toBe(true);
    });

    it('returns false for mismatched hash', () => {
      expect(verifyFlutterwaveSignature('wrong-hash', 'my-secret-hash')).toBe(false);
    });

    it('returns false for empty header', () => {
      expect(verifyFlutterwaveSignature('', 'my-secret-hash')).toBe(false);
    });

    it('returns false for undefined header', () => {
      expect(verifyFlutterwaveSignature(undefined, 'my-secret-hash')).toBe(false);
    });
  });

  describe('verifyOpaySignature', () => {
    const opayKey = 'opay_private_key_12345';

    it('returns true for valid HMAC-SHA512 signature', () => {
      const { createHmac } = require('node:crypto');
      const expected = createHmac('sha512', opayKey).update(FAKE_PAYLOAD).digest('hex');
      expect(verifyOpaySignature(FAKE_PAYLOAD, expected, opayKey)).toBe(true);
    });

    it('returns false for invalid signature', () => {
      expect(verifyOpaySignature(FAKE_PAYLOAD, 'bad', opayKey)).toBe(false);
    });

    it('returns false for empty signature', () => {
      expect(verifyOpaySignature(FAKE_PAYLOAD, '', opayKey)).toBe(false);
    });
  });

  describe('verifyPaymentWebhook (dispatcher)', () => {
    const secrets = {
      paystackSecret: FAKE_SECRET,
      flutterwaveHash: 'flw-hash-123',
      opayKey: 'opay-key-456',
    };

    it('dispatches to Paystack verifier', () => {
      const sig = signPaystackPayload(FAKE_PAYLOAD, FAKE_SECRET);
      const result = verifyPaymentWebhook('paystack', FAKE_PAYLOAD, { 'x-paystack-signature': sig }, secrets);
      expect(result).toBe(true);
    });

    it('dispatches to Flutterwave verifier', () => {
      const result = verifyPaymentWebhook('flutterwave', FAKE_PAYLOAD, { 'verif-hash': 'flw-hash-123' }, secrets);
      expect(result).toBe(true);
    });

    it('dispatches to OPay verifier', () => {
      const { createHmac } = require('node:crypto');
      const sig = createHmac('sha512', 'opay-key-456').update(FAKE_PAYLOAD).digest('hex');
      const result = verifyPaymentWebhook('opay', FAKE_PAYLOAD, { 'x-opay-signature': sig }, secrets);
      expect(result).toBe(true);
    });

    it('returns false for unknown provider', () => {
      const result = verifyPaymentWebhook('unknown' as never, FAKE_PAYLOAD, {}, secrets);
      expect(result).toBe(false);
    });

    it('returns false when secret is missing', () => {
      const result = verifyPaymentWebhook('paystack', FAKE_PAYLOAD, { 'x-paystack-signature': 'sig' }, {});
      expect(result).toBe(false);
    });
  });
});
