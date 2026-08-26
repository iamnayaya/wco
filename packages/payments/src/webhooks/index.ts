import { createHmac, timingSafeEqual as cryptoTimingSafeEqual } from 'node:crypto';

/**
 * PSP webhook verification — shared by webhook-handler (enforcement) and
 * backend tests (fixture generation).
 *
 * Every function is "fail closed": missing/short headers reject, and
 * comparisons are constant-time.
 */

function safeEqual(a: string | Buffer, b: string | Buffer): boolean {
  const bufA = Buffer.isBuffer(a) ? a : Buffer.from(a);
  const bufB = Buffer.isBuffer(b) ? b : Buffer.from(b);
  if (bufA.length !== bufB.length) {
    // Burn equivalent time to avoid a length oracle
    cryptoTimingSafeEqual(bufA, bufA);
    return false;
  }
  return cryptoTimingSafeEqual(bufA, bufB);
}

/** Paystack: HMAC-SHA512 of raw body with secret key → x-paystack-signature */
export function verifyPaystackSignature(rawBody: string, signature: string | undefined, secretKey: string): boolean {
  if (!signature || signature.length === 0) return false;
  const expected = createHmac('sha512', secretKey).update(rawBody).digest('hex');
  return safeEqual(expected, signature);
}

/** Flutterwave: static hash header compared to configured value → verif-hash */
export function verifyFlutterwaveSignature(hashHeader: string | undefined, configuredHash: string): boolean {
  if (!hashHeader || hashHeader.length === 0) return false;
  return safeEqual(configuredHash, hashHeader);
}

/** OPay: HMAC-SHA512 of raw body with merchant private key → x-opay-signature */
export function verifyOpaySignature(rawBody: string, signature: string | undefined, privateKey: string): boolean {
  if (!signature || signature.length === 0) return false;
  const expected = createHmac('sha512', privateKey).update(rawBody).digest('hex');
  return safeEqual(expected, signature);
}

export type PaymentProviderName = 'paystack' | 'flutterwave' | 'opay';

/**
 * Dispatch by provider. Unknown providers always fail closed.
 * Returns true only when authenticity is proven.
 */
export function verifyPaymentWebhook(
  provider: PaymentProviderName,
  rawBody: string,
  headers: Record<string, string | string[] | undefined>,
  secrets: { paystackSecret?: string; flutterwaveHash?: string; opayKey?: string },
): boolean {
  const get = (name: string): string | undefined => {
    const value = headers[name] ?? headers[name.toLowerCase()];
    return Array.isArray(value) ? value[0] : value;
  };

  switch (provider) {
    case 'paystack':
      if (!secrets.paystackSecret) return false;
      return verifyPaystackSignature(rawBody, get('x-paystack-signature'), secrets.paystackSecret);
    case 'flutterwave':
      if (!secrets.flutterwaveHash) return false;
      return verifyFlutterwaveSignature(get('verif-hash'), secrets.flutterwaveHash);
    case 'opay':
      if (!secrets.opayKey) return false;
      return verifyOpaySignature(rawBody, get('x-opay-signature'), secrets.opayKey);
    default:
      return false;
  }
}

/** Test/fixture helper — sign a payload exactly as a PSP would. */
export function signPaystackPayload(rawBody: string, secretKey: string): string {
  return createHmac('sha512', secretKey).update(rawBody).digest('hex');
}
