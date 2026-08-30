import { describe, it, expect } from 'vitest';
import { cn, formatMoney, formatRelativeTime, formatPercent } from './format';

describe('cn (className joiner)', () => {
  it('joins truthy parts with a single space', () => {
    expect(cn('a', 'b', 'c')).toBe('a b c');
  });

  it('filters falsy values', () => {
    expect(cn('a', false, null, undefined, '', 'b')).toBe('a b');
  });

  it('returns empty string when nothing is passed', () => {
    expect(cn()).toBe('');
    expect(cn(false, null, undefined)).toBe('');
  });
});

describe('formatMoney', () => {
  it('formats naira with the naira symbol and grouping', () => {
    expect(formatMoney(1250000)).toBe('₦1,250,000');
  });

  it('formats smaller amounts without grouping', () => {
    expect(formatMoney(4500)).toBe('₦4,500');
  });

  it('supports other known currencies', () => {
    expect(formatMoney(100, 'GHS')).toBe('GH₵100');
    expect(formatMoney(250, 'KES')).toBe('KSh250');
    expect(formatMoney(50, 'USD')).toBe('$50');
  });

  it('falls back to an ISO prefix for unknown currencies', () => {
    expect(formatMoney(10, 'XOF')).toBe('XOF 10');
  });

  it('limits to two fraction digits', () => {
    expect(formatMoney(1234.567)).toBe('₦1,234.57');
  });
});

describe('formatRelativeTime', () => {
  it('returns "just now" for sub-minute timestamps', () => {
    expect(formatRelativeTime(new Date(Date.now() - 30 * 1000))).toBe('just now');
  });

  it('renders minutes', () => {
    expect(formatRelativeTime(new Date(Date.now() - 5 * 60_000))).toBe('5m ago');
  });

  it('renders hours', () => {
    expect(formatRelativeTime(new Date(Date.now() - 3 * 3_600_000))).toBe('3h ago');
  });

  it('renders days', () => {
    expect(formatRelativeTime(new Date(Date.now() - 2 * 86_400_000))).toBe('2d ago');
  });

  it('accepts string inputs', () => {
    expect(formatRelativeTime(new Date(Date.now() - 60_000).toISOString())).toBe('1m ago');
  });
});

describe('formatPercent', () => {
  it('formats positive values with a leading plus', () => {
    expect(formatPercent(12.34)).toBe('+12.3%');
  });

  it('formats negative values with a leading minus', () => {
    expect(formatPercent(-4.5)).toBe('-4.5%');
  });

  it('formats zero without a sign', () => {
    expect(formatPercent(0)).toBe('0.0%');
  });

  it('returns an em-dash for null (no data)', () => {
    expect(formatPercent(null)).toBe('—');
  });
});
