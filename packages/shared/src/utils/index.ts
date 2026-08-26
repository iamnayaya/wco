import { randomUUID } from 'node:crypto';

/** E.164 normalization with Nigerian/Ghanaian/Kenyan local formats. */
export function normalizePhone(raw: string, defaultCountry = 'NG'): string {
  const digits = raw.replace(/[^\d+]/g, '');
  if (digits.startsWith('+')) return digits;

  const prefixes: Record<string, string> = { NG: '+234', GH: '+233', KE: '+254' };
  const prefix = prefixes[defaultCountry] ?? '+234';
  const national = digits.replace(/^0+/, '');
  return `${prefix}${national}`;
}

export function isValidPhone(phone: string): boolean {
  return /^\+[1-9]\d{7,14}$/.test(phone);
}

/** Money is stored as Decimal; APIs speak integer minor units where possible. */
export function formatMoney(amount: number, currency = 'NGN'): string {
  const symbols: Record<string, string> = { NGN: '₦', GHS: 'GH₵', KES: 'KSh', USD: '$', ZAR: 'R', XOF: 'CFA' };
  const formatted = amount.toLocaleString('en-NG', { maximumFractionDigits: 2 });
  return `${symbols[currency] ?? currency}${formatted}`;
}

export function koboToNaira(kobo: number): number {
  return Math.round(kobo) / 100;
}

export function nairaToKobo(naira: number): number {
  return Math.round(naira * 100);
}

export interface PaginationInput {
  limit?: number;
  cursor?: string;
}

export function clampPageSize(limit: number | undefined, max = 100, fallback = 25): number {
  if (!limit || limit < 1) return fallback;
  return Math.min(limit, max);
}

export function newRequestId(): string {
  return randomUUID();
}

export function humanOrderNumber(): string {
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < 6; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return `WC-${out}`;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Exponential backoff with jitter — for outbound provider calls. */
export function backoffMs(attempt: number, baseMs = 300, capMs = 10_000): number {
  const exp = Math.min(capMs, baseMs * 2 ** attempt);
  return Math.floor(exp / 2 + Math.random() * (exp / 2));
}
