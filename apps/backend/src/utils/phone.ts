import { ValidationError } from '@wco/shared';
import { SUPPORTED_COUNTRIES } from '@wco/shared';

/**
 * E.164 phone normalization — the canonical identity for WhatsApp customers.
 *
 * Informal traders type numbers every possible wrong way (spaces, leading 0,
 + missing country code). We normalize aggressively at the boundary so
 * `customers.waPhone` stays unique and provider payloads are valid.
 */

const DEFAULT_COUNTRY = 'NG';
const COUNTRY_CALLING_CODES: Record<string, string> = {
  NG: '234',
  GH: '233',
  KE: '254',
};

export function normalizePhone(raw: string, country = DEFAULT_COUNTRY): string {
  const digits = raw.replace(/[^\d+]/g, '');
  if (!digits) throw new ValidationError('Phone number is required');

  // Already international.
  if (digits.startsWith('+')) return digits;

  const code = COUNTRY_CALLING_CODES[country] ?? COUNTRY_CALLING_CODES[DEFAULT_COUNTRY];

  // Local trunk zero: 0801... -> +234801...
  if (digits.startsWith('0')) return `+${code}${digits.slice(1)}`;

  // Missing country code entirely but plausible local length.
  if (digits.length <= 10) return `+${code}${digits}`;

  return `+${digits}`;
}

export function isSupportedCountry(country: string): boolean {
  return (SUPPORTED_COUNTRIES as readonly string[]).includes(country);
}
