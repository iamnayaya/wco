import { matchesRule, type MatchableCustomer } from '../../src/modules/customers/services/crm.service.js';

function customer(overrides: Partial<MatchableCustomer> = {}): MatchableCustomer {
  const now = new Date('2026-08-24T12:00:00Z');
  return {
    totalSpent: 0,
    ordersCount: 0,
    lastOrderAt: null,
    createdAt: new Date(now.getTime() - 10 * 86_400_000),
    marketingOptIn: false,
    ...overrides,
  };
}

const NOW = new Date('2026-08-24T12:00:00Z');

describe('matchesRule (AI segmentation engine)', () => {
  it('never matches an empty rule (manual-only segment)', () => {
    expect(matchesRule(customer({ ordersCount: 9 }), {})).toBe(false);
  });

  it('VIP: lifetime spend threshold is inclusive', () => {
    const rule = { minTotalSpent: 50_000 };
    expect(matchesRule(customer({ totalSpent: 50_000 }), rule, NOW)).toBe(true);
    expect(matchesRule(customer({ totalSpent: 49_999 }), rule, NOW)).toBe(false);
  });

  it('FREQUENT: minOrders and maxSpent compose with AND', () => {
    const rule = { minOrders: 5, maxTotalSpent: 49_999 };
    expect(matchesRule(customer({ ordersCount: 6, totalSpent: 20_000 }), rule, NOW)).toBe(true);
    expect(matchesRule(customer({ ordersCount: 6, totalSpent: 60_000 }), rule, NOW)).toBe(false);
    expect(matchesRule(customer({ ordersCount: 4 }), rule, NOW)).toBe(false);
  });

  it('NEW: within window with at most one order', () => {
    const rule = { newWithinDays: 30 };
    expect(matchesRule(customer(), rule, NOW)).toBe(true);
    expect(
      matchesRule(customer({ createdAt: new Date(NOW.getTime() - 31 * 86_400_000) }), rule, NOW),
    ).toBe(false);
    expect(matchesRule(customer({ ordersCount: 2 }), rule, NOW)).toBe(false);
  });

  it('ONE_TIME: single order idle past 30 days', () => {
    const rule = { minOrders: 1, maxOrders: 1, idleDaysMin: 31 };
    const idle40 = customer({
      ordersCount: 1,
      lastOrderAt: new Date(NOW.getTime() - 40 * 86_400_000),
    });
    const idle10 = customer({
      ordersCount: 1,
      lastOrderAt: new Date(NOW.getTime() - 10 * 86_400_000),
    });
    expect(matchesRule(idle40, rule, NOW)).toBe(true);
    expect(matchesRule(idle10, rule, NOW)).toBe(false);
  });

  it('AT_RISK: idle window bounds are inclusive', () => {
    const rule = { minOrders: 2, idleDaysMin: 30, idleDaysMax: 90 };
    const base = { ordersCount: 3 };
    expect(
      matchesRule(customer({ ...base, lastOrderAt: new Date(NOW.getTime() - 30 * 86_400_000) }), rule, NOW),
    ).toBe(true);
    expect(
      matchesRule(customer({ ...base, lastOrderAt: new Date(NOW.getTime() - 90 * 86_400_000) }), rule, NOW),
    ).toBe(true);
    expect(
      matchesRule(customer({ ...base, lastOrderAt: new Date(NOW.getTime() - 91 * 86_400_000) }), rule, NOW),
    ).toBe(false);
    expect(matchesRule(customer(base), rule, NOW)).toBe(false); // never ordered
  });

  it('DORMANT: requires a known last-order date', () => {
    const rule = { idleDaysMin: 91 };
    expect(
      matchesRule(customer({ lastOrderAt: new Date(NOW.getTime() - 120 * 86_400_000) }), rule, NOW),
    ).toBe(true);
    expect(matchesRule(customer(), rule, NOW)).toBe(false);
  });

  it('marketingOptIn filters when specified', () => {
    const rule = { marketingOptIn: true };
    expect(matchesRule(customer({ marketingOptIn: true }), rule, NOW)).toBe(true);
    expect(matchesRule(customer(), rule, NOW)).toBe(false);
  });
});
