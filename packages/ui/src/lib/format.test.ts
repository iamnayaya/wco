import { describe, it, expect } from 'vitest';
import {
  parseLocalizedNumber,
  formatNumber,
  formatCurrency,
  stripNonDigits,
  formatPhone,
  formatRelative,
  currencies,
} from './format';

describe('parseLocalizedNumber', () => {
  it('parses plain integers', () => {
    expect(parseLocalizedNumber('42')).toBe(42);
  });

  it('strips currency symbols and grouping separators', () => {
    expect(parseLocalizedNumber('₦1,250.50')).toBe(1250.5);
  });

  it('returns NaN for unparseable input', () => {
    expect(Number.isNaN(parseLocalizedNumber('abc'))).toBe(true);
  });
});

describe('formatNumber', () => {
  it('formats with thousands separators', () => {
    expect(formatNumber(1234567)).toBe('1,234,567');
  });

  it('respects locale', () => {
    // de-DE uses '.' as thousands separator.
    expect(formatNumber(1234, { locale: 'de-DE' })).toBe('1.234');
  });

  it('limits fraction digits', () => {
    expect(formatNumber(3.14159, { maximumFractionDigits: 2 })).toBe('3.14');
  });

  it('returns empty string for non-finite', () => {
    expect(formatNumber(Number.NaN)).toBe('');
  });
});

describe('formatCurrency', () => {
  it('formats USD with the dollar sign', () => {
    expect(formatCurrency(25)).toContain('$');
  });

  it('formats NGN with the naira symbol', () => {
    expect(formatCurrency(1250, { currency: 'NGN' })).toContain('₦');
  });

  it('handles an unknown currency gracefully', () => {
    const out = formatCurrency(100, { currency: 'XYZ' });
    expect(out).toContain('XYZ');
  });
});

describe('currencies', () => {
  it('covers the core emerging markets', () => {
    for (const c of ['NGN', 'GHS', 'KES', 'ZAR', 'XOF', 'EGP', 'ETB', 'TZS', 'UGX']) {
      expect(currencies[c]).toBeDefined();
    }
  });
});

describe('stripNonDigits', () => {
  it('removes everything but digits', () => {
    expect(stripNonDigits('+234 803 123 4567')).toBe('2348031234567');
  });
});

describe('formatPhone', () => {
  it('prepends the Nigerian dial code', () => {
    expect(formatPhone('8031234567', 'NG')).toBe('+234 8031234567');
  });

  it('does not duplicate an existing dial code', () => {
    expect(formatPhone('+2348031234567', 'NG')).toBe('+2348031234567');
  });

  it('caps at the country max length', () => {
    const out = formatPhone('80312345678901', 'NG');
    expect(stripNonDigits(out).length).toBeLessThanOrEqual(16); // +234 + 13
  });
});

describe('formatRelative', () => {
  const now = 1_700_000_000_000;

  it('says just now for recent timestamps', () => {
    expect(formatRelative(now - 5_000, now)).toBe('just now');
  });

  it('reports minutes', () => {
    expect(formatRelative(now - 120_000, now)).toBe('2m ago');
  });

  it('reports hours', () => {
    expect(formatRelative(now - 3_600_000 * 5, now)).toBe('5h ago');
  });

  it('reports days', () => {
    expect(formatRelative(now - 86_400_000 * 3, now)).toBe('3d ago');
  });
});
