import { createCipheriv, createDecipheriv, createHmac, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';

import { env } from '../config/env.js';
import { safeEqual } from '../utils/crypto.js';

/**
 * TOTP (RFC 6238) + backup codes - implemented directly on node:crypto so the
 * auth stack stays dependency-free for its most security-critical primitive.
 *
 * - 6-digit codes, SHA-1 HMAC, 30-second step, ±1 step drift tolerance.
 * - Secrets are base32 (RFC 4648, no padding) for authenticator-app QRs.
 * - At rest the shared secret is AES-256-GCM sealed with env.AUTH_SECRET.
 * - Backup codes: 10 single-use 10-char codes; only bcrypt-style digests are
 *   stored (here: SHA-256 - they are high-entropy random, unlike passwords).
 */

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function base32Encode(buf: Buffer): string {
  let bits = 0;
  let value = 0;
  let out = '';
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(input: string): Buffer {
  const clean = input.toUpperCase().replace(/=+$/u, '').replace(/\s+/gu, '');
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (const char of clean) {
    const idx = BASE32_ALPHABET.indexOf(char);
    if (idx === -1) throw new Error('Invalid base32 character');
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

/** HOTP (RFC 4226) truncated digest for a counter value. */
export function hotp(secret: Buffer, counter: number): string {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter));
  const digest = createHmac('sha1', secret).update(buf).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const code =
    (((digest[offset] & 0x7f) << 24) |
      ((digest[offset + 1] & 0xff) << 16) |
      ((digest[offset + 2] & 0xff) << 8) |
      (digest[offset + 3] & 0xff)) %
    1_000_000;
  return String(code).padStart(6, '0');
}

/** Verify a user-supplied TOTP against [now-1, now, now+1] steps. */
export function verifyTotp(base32Secret: string, token: string, stepSeconds = 30, window = 1): boolean {
  if (!/^\d{6}$/u.test(token)) return false;
  const secret = base32Decode(base32Secret);
  const counter = Math.floor(Date.now() / 1000 / stepSeconds);
  for (let drift = -window; drift <= window; drift += 1) {
    const expected = hotp(secret, counter + drift);
    // Constant-time compare per candidate.
    if (expected.length === token.length && timingSafeEqual(Buffer.from(expected), Buffer.from(token))) {
      return true;
    }
  }
  return false;
}

export function generateTotpSecret(): string {
  return base32Encode(randomBytes(20)); // 160-bit secret per RFC 4226 recommendation
}

/** otpauth:// URI for authenticator apps (Google Authenticator, Authy, 1Password). */
export function otpauthUri(secret: string, accountLabel: string, issuer = 'WCO'): string {
  const label = encodeURIComponent(`${issuer}:${accountLabel}`);
  const params = new URLSearchParams({ secret, issuer, algorithm: 'SHA1', digits: '6', period: '30' });
  return `otpauth://totp/${label}?${params.toString()}`;
}

// --- Secret sealing (AES-256-GCM) ---------------------------------------------

function authKey(): Buffer {
  return Buffer.from(env.AUTH_SECRET, 'base64');
}

export function sealSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', authKey(), iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return `${iv.toString('base64url')}.${cipher.getAuthTag().toString('base64url')}.${enc.toString('base64url')}`;
}

export function openSecret(sealed: string): string {
  const [ivB64, tagB64, dataB64] = sealed.split('.');
  if (!ivB64 || !tagB64 || !dataB64) throw new Error('Malformed sealed secret');
  const decipher = createDecipheriv('aes-256-gcm', authKey(), Buffer.from(ivB64, 'base64url'));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(dataB64, 'base64url')), decipher.final()]).toString('utf8');
}

// --- Backup codes --------------------------------------------------------------

export function generateBackupCodes(count = 10): { plain: string[]; hashes: string[] } {
  const plain = Array.from({ length: count }, () => {
    const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // no ambiguous chars
    let code = '';
    for (let i = 0; i < 10; i += 1) code += alphabet[randomInt(alphabet.length)];
    return `${code.slice(0, 5)}-${code.slice(5)}`;
  });
  return { plain, hashes: plain.map((c) => sha(c)) };
}

function sha(input: string): string {
  return createHmac('sha256', env.AUTH_SECRET).update(input).digest('hex');
}

/** Returns the index of the matching unused code, or -1. */
export function matchBackupCode(code: string, hashes: readonly unknown[]): number {
  const normalized = code.trim().toUpperCase();
  const target = sha(normalized);
  for (let i = 0; i < hashes.length; i += 1) {
    const stored = hashes[i];
    if (typeof stored === 'string' && safeEqual(stored, target)) return i;
  }
  return -1;
}
