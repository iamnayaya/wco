import { formatMoney, timeAgo } from '../src/lib/format';

describe('mobile format helpers', () => {
  it('formats naira amounts with grouping', () => {
    expect(formatMoney(1250000)).toBe('₦1,250,000');
  });

  it('falls back to ISO code for unknown currencies', () => {
    expect(formatMoney(10, 'XOF')).toBe('XOF 10');
  });

  it('renders relative minutes', () => {
    const fiveMinAgo = new Date(Date.now() - 5 * 60_000);
    expect(timeAgo(fiveMinAgo)).toBe('5m');
  });
});
