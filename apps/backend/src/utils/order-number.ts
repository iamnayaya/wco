import { randomBytes } from 'node:crypto';

/**
 * Human-readable order numbers: WC-7F3K9Q.
 * Crockford-style alphabet (no I/L/O/0/1) — traders read these out loud over
 * WhatsApp voice calls, so ambiguity costs real money.
 */
const ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';

export function generateOrderNumber(): string {
  const bytes = randomBytes(6);
  let out = '';
  for (const byte of bytes) out += ALPHABET[byte % ALPHABET.length];
  return `WC-${out}`;
}
