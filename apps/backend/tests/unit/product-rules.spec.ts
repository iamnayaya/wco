import {
  computeDiscountedPrice,
  isDiscountLive,
} from '../../src/modules/products/services/discounts.service.js';
import {
  buildCatalogEntry,
  computeSuggestedPrice,
  generateLocalDescription,
  guessCategoryName,
} from '../../src/modules/products/services/enrichment.service.js';
import { mapImportRow } from '../../src/modules/products/services/import-export.service.js';

describe('computeDiscountedPrice (promo pricing)', () => {
  it('PERCENTAGE takes a share of the base price', () => {
    expect(computeDiscountedPrice(10_000, 'PERCENTAGE', 25)).toBe(7_500);
    expect(computeDiscountedPrice(999, 'PERCENTAGE', 10)).toBe(899.1);
  });

  it('FIXED subtracts an absolute amount', () => {
    expect(computeDiscountedPrice(2_000, 'FIXED', 500)).toBe(1_500);
  });

  it('never goes below zero even for absurd discounts', () => {
    expect(computeDiscountedPrice(100, 'FIXED', 5_000)).toBe(0);
    expect(computeDiscountedPrice(100, 'PERCENTAGE', 300)).toBe(0);
  });

  it('rounds to kobo precision', () => {
    expect(computeDiscountedPrice(100, 'PERCENTAGE', 33.33)).toBe(66.67);
  });
});

describe('isDiscountLive (scheduling windows)', () => {
  const NOW = new Date('2026-08-24T12:00:00Z');

  it('inactive codes never apply', () => {
    expect(
      isDiscountLive({ active: false, startsAt: null, endsAt: null } as never, NOW),
    ).toBe(false);
  });

  it('respects startsAt and endsAt bounds', () => {
    const live = { active: true, startsAt: new Date('2026-08-20T00:00:00Z'), endsAt: new Date('2026-08-30T00:00:00Z') };
    expect(isDiscountLive(live as never, NOW)).toBe(true);

    const early = { active: true, startsAt: new Date('2026-08-25T00:00:00Z'), endsAt: null };
    expect(isDiscountLive(early as never, NOW)).toBe(false);

    const late = { active: true, startsAt: null, endsAt: new Date('2026-08-23T23:59:59Z') };
    expect(isDiscountLive(late as never, NOW)).toBe(false);
  });
});

describe('guessCategoryName (keyword categorizer)', () => {
  it('maps food keywords', () => {
    expect(guessCategoryName('Mama Gold Rice 5kg')).toBe('Food Stuff');
  });

  it('maps electronics and fashion', () => {
    expect(guessCategoryName('Phone charger USB-C')).toBe('Electronics');
    expect(guessCategoryName('Ankara fabric 6 yards')).toBe('Fashion');
  });

  it('falls back to General on no match', () => {
    expect(guessCategoryName('Mystery item')).toBe('General');
  });
});

describe('mapImportRow (CSV import mapping)', () => {
  it('maps a full row with tags split on ; or |', () => {
    // Keys arrive lowercased/stripped by normalizeHeader upstream.
    const row = mapImportRow({
      name: 'Rice 5kg',
      sku: 'rc-001',
      price: '8500',
      stockquantity: '12',
      category: 'Food Stuff',
      tags: 'bulk; staple | promo',
      description: 'Parboiled',
    });
    expect(row).toMatchObject({
      name: 'Rice 5kg',
      sku: 'RC-001',
      price: 8_500,
      stockQuantity: 12,
      category: 'Food Stuff',
      description: 'Parboiled',
    });
    expect(row.tags).toEqual(['bulk', 'staple', 'promo']);
  });

  it('treats missing optional columns as empty', () => {
    const row = mapImportRow({ name: 'Soap', sku: 'SP1', price: '300' });
    expect(row.stockQuantity).toBeNull();
    expect(row.tags).toEqual([]);
    expect(row.category).toBeNull();
  });

  it('rejects missing required fields with human messages', () => {
    expect(() => mapImportRow({ sku: 'X', price: '1' })).toThrow('name is required');
    expect(() => mapImportRow({ name: 'X', price: '1' })).toThrow('sku is required');
    expect(() => mapImportRow({ name: 'X', sku: 'Y', price: '-5' })).toThrow(
      'price must be a non-negative number',
    );
    expect(() => mapImportRow({ name: 'X', sku: 'Y', price: 'abc' })).toThrow(
      'price must be a non-negative number',
    );
    expect(() => mapImportRow({ name: 'X', sku: 'Y', price: '10', stockquantity: '-2' })).toThrow(
      'stockQuantity must be a non-negative integer',
    );
  });
});

describe('computeSuggestedPrice (AI price heuristics)', () => {
  it('raises price under scarcity and anchors above compare-at', () => {
    const out = computeSuggestedPrice({
      price: 1_000,
      costPrice: null,
      compareAtPrice: null,
      stockQuantity: 2,
      lowStockThreshold: 5,
    });
    expect(out.suggestedPrice).toBeGreaterThan(1_000);
    expect(out.confidence).toBeGreaterThan(0);
    expect(out.confidence).toBeLessThanOrEqual(1);
  });

  it('lowers price on overstock but respects the cost floor', () => {
    const out = computeSuggestedPrice({
      price: 1_000,
      costPrice: 990,
      compareAtPrice: null,
      stockQuantity: 80,
      lowStockThreshold: 5,
    });
    // 1000 * 0.94 overstock pressure, floored at cost*1.15
    expect(out.suggestedPrice).toBe(1_138.5);
    expect(out.factors.costFloor).toBe(1_138.5);
  });

  it('keeps confidence within [0,1] always', () => {
    const out = computeSuggestedPrice({
      price: 50,
      costPrice: 1,
      compareAtPrice: 500,
      stockQuantity: 3,
      lowStockThreshold: 5,
    });
    expect(out.confidence).toBeGreaterThanOrEqual(0);
    expect(out.confidence).toBeLessThanOrEqual(1);
  });
});

describe('generateLocalDescription (offline AI fallback)', () => {
  const product = { name: 'Rice 5kg', description: null, price: 8_500 };

  it('changes tone by request', () => {
    const friendly = generateLocalDescription(product, 'friendly');
    const promo = generateLocalDescription(product, 'promotional');
    const professional = generateLocalDescription(product, 'professional');
    expect(friendly).toContain('Rice 5kg');
    expect(promo).toContain('Hot deal');
    expect(professional).toContain('Introducing');
  });

  it('includes the price when present', () => {
    expect(generateLocalDescription(product, 'friendly')).toContain('8,500');
  });
});

describe('buildCatalogEntry (WhatsApp payload limits)', () => {
  it('truncates name and retailer id to Meta limits', () => {
    const entry = buildCatalogEntry(
      {
        id: 'p1',
        sku: 'SKU'.repeat(40),
        name: 'N'.repeat(400),
        price: 1_500,
      } as never,
      'https://example.com/'.concat('x'.repeat(4_096)),
    );
    expect(entry.retailerId.length).toBeLessThanOrEqual(64);
    expect(entry.name.length).toBeLessThanOrEqual(200);
    expect(entry.imageUrl?.length).toBeLessThanOrEqual(2_048);
    expect(entry.price).toBe(1_500);
  });
});
