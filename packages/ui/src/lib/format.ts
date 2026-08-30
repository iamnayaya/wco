/**
 * WCO formatting utilities — locale-aware, SSR-safe number/currency/phone
 * helpers used by the advanced form components (NumberInput, CurrencyInput,
 * PhoneInput, StatCard). Internationalization first: 50+ locales out of the box.
 */

/** Parse a localized number string, returning NaN if unparseable. */
export function parseLocalizedNumber(input: string): number {
  const cleaned = input.replace(/[^\d.,-]/g, '');
  if (/[0-9]/.test(cleaned) === false) return NaN;
  const n = Number(cleaned.replace(/,/g, ''));
  return Number.isFinite(n) ? n : NaN;
}

/** Format a number with thousands separators + optional max fraction digits. */
export function formatNumber(value: number, opts: { locale?: string; maximumFractionDigits?: number } = {}): string {
  const { locale = 'en-US', maximumFractionDigits = 2 } = opts;
  if (!Number.isFinite(value)) return '';
  return new Intl.NumberFormat(locale, { maximumFractionDigits }).format(value);
}

export interface Currency {
  code: string;
  symbol: string;
  /** Position of symbol relative to amount. */
  position?: 'before' | 'after';
}

/** Common WCO currencies (emerging markets focus). */
export const currencies: Record<string, Currency> = {
  NGN: { code: 'NGN', symbol: '₦', position: 'before' },
  GHS: { code: 'GHS', symbol: 'GH₵', position: 'before' },
  KES: { code: 'KES', symbol: 'KSh', position: 'before' },
  ZAR: { code: 'ZAR', symbol: 'R', position: 'before' },
  USD: { code: 'USD', symbol: '$', position: 'before' },
  EUR: { code: 'EUR', symbol: '€', position: 'before' },
  GBP: { code: 'GBP', symbol: '£', position: 'before' },
  XOF: { code: 'XOF', symbol: 'CFA', position: 'after' },
  EGP: { code: 'EGP', symbol: 'E£', position: 'before' },
  ETB: { code: 'ETB', symbol: 'Br', position: 'before' },
  TZS: { code: 'TZS', symbol: 'TSh', position: 'before' },
  UGX: { code: 'UGX', symbol: 'USh', position: 'before' },
  RWF: { code: 'RWF', symbol: 'FRw', position: 'before' },
};

/** Format an amount for a currency/locale. Falls back to a symbolic form. */
export function formatCurrency(value: number, opts: { currency?: string; locale?: string } = {}): string {
  const { currency = 'USD', locale = 'en-US' } = opts;
  const code = currency.toUpperCase();
  const meta = currencies[code];
  if (!Number.isFinite(value)) return '';
  // Prefer our explicit symbol map so the right glyph shows in every ICU.
  if (meta) {
    const formatted = formatNumber(value, { locale, maximumFractionDigits: 2 });
    return meta.position === 'after' ? `${formatted} ${meta.symbol}` : `${meta.symbol}${formatted}`;
  }
  try {
    return new Intl.NumberFormat(locale, { style: 'currency', currency: code }).format(value);
  } catch {
    return `${formatNumber(value)} ${code}`;
  }
}

/** Parse a currency/phone-style input, removing symbols, spaces, and grouping. */
export function stripNonDigits(input: string): string {
  return input.replace(/\D/g, '');
}

/**
 * Countries with phone metadata (dial code + preferred length). Emerging
 * markets first; extend freely.
 */
export const phoneMetadata: Record<string, { code: string; dialCode: string; maxLength: number }> = {
  NG: { code: 'NG', dialCode: '+234', maxLength: 13 },
  GH: { code: 'GH', dialCode: '+233', maxLength: 12 },
  KE: { code: 'KE', dialCode: '+254', maxLength: 12 },
  ZA: { code: 'ZA', dialCode: '+27', maxLength: 12 },
  US: { code: 'US', dialCode: '+1', maxLength: 11 },
  GB: { code: 'GB', dialCode: '+44', maxLength: 12 },
  FR: { code: 'FR', dialCode: '+33', maxLength: 12 },
  IN: { code: 'IN', dialCode: '+91', maxLength: 12 },
};

/** Format a phone number with its dial code prefix. */
export function formatPhone(digits: string, countryCode = 'NG'): string {
  const meta = phoneMetadata[countryCode];
  const d = stripNonDigits(digits).slice(0, meta?.maxLength ?? 13);
  if (!d) return meta ? `${meta.dialCode} ` : '';
  if (meta && d.startsWith(meta.dialCode.replace('+', ''))) return `+${d}`;
  return meta ? `${meta.dialCode} ${d}` : `+${d}`;
}

/** Format a date for a locale. */
export function formatDate(date: Date, opts: { locale?: string; dateStyle?: Intl.DateTimeFormatOptions['dateStyle'] } = {}): string {
  const { locale = 'en-US', dateStyle = 'medium' } = opts;
  try {
    return new Intl.DateTimeFormat(locale, { dateStyle }).format(date);
  } catch {
    return date.toDateString();
  }
}

/** Format a relative timestamp ("2m ago", "just now"). */
export function formatRelative(date: Date | number | string, now = Date.now()): string {
  const d = typeof date === 'number' || typeof date === 'string' ? new Date(date) : date;
  const diff = now - d.getTime();
  const sec = Math.round(diff / 1000);
  if (sec < 45) return 'just now';
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.round(hr / 24);
  if (day < 7) return `${day}d ago`;
  return formatDate(d, { dateStyle: 'medium' });
}
