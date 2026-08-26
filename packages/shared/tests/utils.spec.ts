import { formatMoney, normalizePhone, humanOrderNumber, backoffMs } from '../index';

describe('shared utils', () => {
  it('normalizes Nigerian local phone formats to E.164', () => {
    expect(normalizePhone('0801 234 5678')).toBe('+2348012345678');
    expect(normalizePhone('+2348012345678')).toBe('+2348012345678');
  });

  it('normalizes Ghanaian and Kenyan numbers with country hint', () => {
    expect(normalizePhone('0201234567', 'GH')).toBe('+233201234567');
    expect(normalizePhone('0712345678', 'KE')).toBe('+254712345678');
  });

  it('formats money with currency symbol', () => {
    expect(formatMoney(62000, 'NGN')).toBe('₦62,000');
    expect(formatMoney(1234.5, 'KES')).toBe('KSh1,234.5');
  });

  it('generates unambiguous order numbers', () => {
    const n = humanOrderNumber();
    expect(n).toMatch(/^WC-[A-HJ-NP-Z2-9]{6}$/);
  });

  it('caps exponential backoff and adds jitter', () => {
    for (let i = 0; i < 50; i++) {
      const ms = backoffMs(10, 300, 2000);
      expect(ms).toBeGreaterThanOrEqual(0);
      expect(ms).toBeLessThanOrEqual(2000);
    }
  });
});
