import { createHmac } from 'node:crypto';
import { verifyWebhookSignature } from '../../src/middleware/signature-verification';

describe('signature verification', () => {
  const secret = 'test-secret-key-for-ci';
  const body = Buffer.from(JSON.stringify({ event: 'charge.success' }));

  beforeAll(() => {
    process.env.PAYSTACK_SECRET_KEY = secret;
  });

  it('accepts a valid paystack HMAC-SHA512 signature', () => {
    const sig = createHmac('sha512', secret).update(body).digest('hex');
    const result = verifyWebhookSignature('paystack', body, {
      'x-paystack-signature': sig,
    });
    expect(result.valid).toBe(true);
  });

  it('rejects a tampered paystack payload', () => {
    const sig = createHmac('sha512', secret).update(body).digest('hex');
    const tampered = Buffer.from(JSON.stringify({ event: 'charge.success', amount: 999_999_999 }));
    const result = verifyWebhookSignature('paystack', tampered, {
      'x-paystack-signature': sig,
    });
    expect(result.valid).toBe(false);
  });

  it('rejects missing signatures fail-closed', () => {
    const result = verifyWebhookSignature('paystack', body, {});
    expect(result.valid).toBe(false);
  });

  it('uses constant-time comparison (no throw on length mismatch)', () => {
    const result = verifyWebhookSignature('paystack', body, {
      'x-paystack-signature': 'short',
    });
    expect(result.valid).toBe(false);
  });

  it('fails closed for unknown providers', () => {
    const result = verifyWebhookSignature('gig', body, {});
    expect(result.valid).toBe(false);
  });
});
