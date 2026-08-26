import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Signature verification for every inbound webhook provider.
 *
 * Non-negotiables:
 *  - timingSafeEqual ALWAYS (no string == on secrets)
 *  - verify against the RAW request body bytes (re-serialization breaks HMAC)
 *  - unknown providers fail closed
 */
export type Provider = 'whatsapp-meta' | 'twilio' | 'paystack' | 'flutterwave' | 'opay' | 'gig' | 'kwik' | 'sendy';

export function verifyWebhookSignature(
  provider: Provider,
  rawBody: Buffer,
  headers: Record<string, string | string[] | undefined>,
): { valid: boolean; reason?: string } {
  const header = (name: string): string => {
    const v = headers[name];
    return Array.isArray(v) ? (v[0] ?? '') : (v ?? '');
  };

  switch (provider) {
    // Meta signs payloads with app secret via X-Hub-Signature-256
    case 'whatsapp-meta': {
      const signature = header('x-hub-signature-256').replace(/^sha256=/, '');
      const expected = createHmac('sha256', process.env.META_APP_SECRET ?? '')
        .update(rawBody)
        .digest('hex');
      return { valid: safeEqual(signature, expected), reason: 'meta signature mismatch' };
    }

    // Twilio validates with HMAC-SHA1 of url + params (simplified: auth token MAC)
    case 'twilio': {
      const signature = header('x-twilio-signature');
      const expected = createHmac('sha1', process.env.TWILIO_AUTH_TOKEN ?? '')
        .update(rawBody)
        .digest('base64');
      // Twilio's full protocol includes the URL; production deployments
      // should use the official twilio webhook validator. Raw-body MAC is
      // accepted here behind an ALB that fixes scheme/host.
      return { valid: safeEqual(signature, expected), reason: 'twilio signature mismatch' };
    }

    // Paystack: HMAC-SHA512 of raw body with secret key
    case 'paystack': {
      const signature = header('x-paystack-signature');
      const expected = createHmac('sha512', process.env.PAYSTACK_SECRET_KEY ?? '')
        .update(rawBody)
        .digest('hex');
      return { valid: safeEqual(signature, expected), reason: 'paystack signature mismatch' };
    }

    // Flutterwave: `verif-hash` must equal configured secret hash
    case 'flutterwave': {
      const provided = header('verif-hash');
      const expected = process.env.FLUTTERWAVE_WEBHOOK_HASH ?? '';
      return { valid: safeEqual(provided, expected), reason: 'flutterwave hash mismatch' };
    }

    // OPay: HMAC-SHA512 with merchant private key over raw body
    case 'opay': {
      const signature = header('x-opay-signature');
      const expected = createHmac('sha512', process.env.OPAY_PRIVATE_KEY ?? '')
        .update(rawBody)
        .digest('hex');
      return { valid: safeEqual(signature, expected), reason: 'opay signature mismatch' };
    }

    default:
      return { valid: false, reason: `no verifier for provider ${provider}` };
  }
}

function safeEqual(a: string, b: string): boolean {
  if (!a || !b) return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) {
    // Burn equivalent time to avoid length-based oracle
    timingSafeEqual(bufB, bufB);
    return false;
  }
  return timingSafeEqual(bufA, bufB);
}
