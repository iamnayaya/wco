import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

/** SHA-256 hex digest — API tokens & refresh tokens are stored hashed. */
export function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

export const hashToken = sha256;

/**
 * Public API token: `wco_<32 url-safe bytes>`.
 * Returns the raw secret (shown ONCE to the merchant) + display prefix.
 */
export function generateApiToken(): { token: string; prefix: string } {
  const secret = randomBytes(32).toString('base64url');
  const token = `wco_${secret}`;
  return { token, prefix: token.slice(0, 12) };
}

/** HMAC-SHA256 signature for outgoing merchant webhooks. */
export function signPayload(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('hex');
}

export function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}
