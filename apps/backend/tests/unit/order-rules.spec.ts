import {
  predictFulfillment,
  scoreOrderFraud,
  type FraudInput,
} from '../../src/modules/orders/services/ai.service.js';
import {
  mapImportRow,
  parseItemsSpec,
} from '../../src/modules/orders/services/import-export.service.js';
import { sortNotes } from '../../src/modules/orders/services/notes.service.js';
import {
  buildOrderStatusMessage,
  type OrderMessageContext,
} from '../../src/modules/orders/services/whatsapp.service.js';
import {
  buildEmailBody,
  buildEmailSubject,
  buildSmsBody,
  type OrderNotificationPayload,
} from '../../src/services/notification.service.js';

function fraud(overrides: Partial<FraudInput>): FraudInput {
  return {
    total: 5_000,
    avgOrderValue: 10_000,
    customerOrdersCount: 4,
    customerAgeDays: 30,
    maxLineQty: 2,
    hasDeliveryAddress: true,
    ...overrides,
  };
}

describe('predictFulfillment (delivery ETA heuristics)', () => {
  it('minimal single-line pickup order costs base plus pickup minutes', () => {
    const out = predictFulfillment({
      lineCount: 1,
      totalQty: 1,
      hasDeliveryAddress: false,
      city: null,
      storeCity: null,
      channel: 'DASHBOARD',
    });
    expect(out.predictedMinutes).toBe(55); // 45 base + 10 pickup
    expect(out.basis.map((b) => b.label)).toEqual(['Base handling', 'Pickup / hand delivery']);
  });

  it('stacks every factor: multi-line, bulk units, courier, intercity, WhatsApp', () => {
    const out = predictFulfillment({
      lineCount: 3,
      totalQty: 20,
      hasDeliveryAddress: true,
      city: 'Ikeja',
      storeCity: 'Abuja',
      channel: 'WHATSAPP',
    });
    // 45 + 12 (extra lines) + 24 (bulk ceil(15/5)*8) + 30 (courier) + 45 (intercity) - 5 (WA)
    expect(out.predictedMinutes).toBe(151);
    expect(out.basis).toHaveLength(6);
  });

  it('bulk penalty applies per full 5-unit block above five', () => {
    const six = predictFulfillment({ lineCount: 1, totalQty: 6, hasDeliveryAddress: false, channel: 'DASHBOARD' });
    const ten = predictFulfillment({ lineCount: 1, totalQty: 10, hasDeliveryAddress: false, channel: 'DASHBOARD' });
    expect(six.predictedMinutes - 55).toBe(8);
    expect(ten.predictedMinutes - 55).toBe(8); // ceil(5/5)*8
    expect(predictFulfillment({ lineCount: 1, totalQty: 11, hasDeliveryAddress: false, channel: 'DASHBOARD' }).predictedMinutes).toBe(71);
  });

  it('city comparison is case-insensitive and whitespace tolerant', () => {
    const same = predictFulfillment({ lineCount: 1, totalQty: 1, hasDeliveryAddress: true, city: ' Lagos ', storeCity: 'lagos', channel: 'DASHBOARD' });
    expect(same.basis.some((b) => b.label === 'Intercity dispatch')).toBe(false);
  });

  it('confidence decays with each added factor but never drops below 0.5', () => {
    const simple = predictFulfillment({ lineCount: 1, totalQty: 1, hasDeliveryAddress: false, channel: 'DASHBOARD' });
    const complex = predictFulfillment({ lineCount: 9, totalQty: 99, hasDeliveryAddress: true, city: 'A', storeCity: 'B', channel: 'WHATSAPP' });
    expect(simple.confidence).toBeCloseTo(0.81);
    expect(complex.confidence).toBeGreaterThanOrEqual(0.5);
    expect(complex.confidence).toBeLessThan(simple.confidence);
  });
});

describe('scoreOrderFraud (additive risk engine)', () => {
  it('a boring order scores zero and reads LOW', () => {
    const v = scoreOrderFraud(fraud({}));
    expect(v.riskScore).toBe(0);
    expect(v.level).toBe('LOW');
    expect(v.signals).toHaveLength(0);
  });

  it('HIGH_VALUE fires above 3x the store average (+35)', () => {
    const v = scoreOrderFraud(fraud({ total: 40_000, avgOrderValue: 10_000 }));
    expect(v.riskScore).toBe(35);
    expect(v.level).toBe('LOW'); // 35 sits under the MEDIUM cut-off
    expect(v.signals[0]?.code).toBe('HIGH_VALUE');
  });

  it('NEW_CUSTOMER_HIGH_VALUE needs a brand-new buyer AND an unusual amount (+25)', () => {
    const fresh = scoreOrderFraud(fraud({ total: 25_000, avgOrderValue: 5_000, customerAgeDays: 0, customerOrdersCount: 0 }));
    expect(fresh.signals.map((s) => s.code)).toContain('NEW_CUSTOMER_HIGH_VALUE');

    const loyalButBig = scoreOrderFraud(fraud({ total: 25_000, avgOrderValue: 5_000, customerOrdersCount: 12 }));
    expect(loyalButBig.signals.map((s) => s.code)).not.toContain('NEW_CUSTOMER_HIGH_VALUE');
  });

  it('BULK_QUANTITY triggers at ten units of one product (+15)', () => {
    const nine = scoreOrderFraud(fraud({ maxLineQty: 9 }));
    const ten = scoreOrderFraud(fraud({ maxLineQty: 10 }));
    expect(nine.riskScore).toBe(0);
    expect(ten.signals[0]?.code).toBe('BULK_QUANTITY');
  });

  it('NO_ADDRESS and ROUND_AMOUNT add their weights independently (+10 each)', () => {
    // avg 9000 keeps 25k under the 3x line so ONLY the address signal fires
    const bare = scoreOrderFraud(
      fraud({ total: 25_000, avgOrderValue: 9_000, hasDeliveryAddress: false }),
    );
    expect(bare.riskScore).toBe(10);

    const round = scoreOrderFraud(
      fraud({ total: 60_000, avgOrderValue: 21_000, customerOrdersCount: 3 }),
    );
    expect(round.signals.map((s) => s.code)).toEqual(['ROUND_AMOUNT']);
    expect(round.riskScore).toBe(10);
  });

  it('every signal can coexist; the sum caps below the clamp', () => {
    const v = scoreOrderFraud(
      fraud({
        total: 80_000,
        avgOrderValue: 10_000,
        customerAgeDays: 0,
        customerOrdersCount: 0,
        maxLineQty: 12,
        hasDeliveryAddress: false,
      }),
    );
    expect(v.signals.map((s) => s.code)).toEqual([
      'HIGH_VALUE',
      'NEW_CUSTOMER_HIGH_VALUE',
      'BULK_QUANTITY',
      'NO_ADDRESS',
      'ROUND_AMOUNT',
    ]);
    expect(v.riskScore).toBe(95); // 35+25+15+10+10
    expect(v.level).toBe('HIGH');
  });

  it('levels split at exactly 40 (MEDIUM) and exactly 70 (HIGH)', () => {
    // 25 (new customer) + 15 (bulk) = 40
    const forty = scoreOrderFraud(
      fraud({ total: 25_000, avgOrderValue: 10_000, customerAgeDays: 0, customerOrdersCount: 0, maxLineQty: 10 }),
    );
    expect(forty.riskScore).toBe(40);
    expect(forty.level).toBe('MEDIUM');

    // 35 (high value) + 25 (new customer) + 10 (no address) = 70
    const seventy = scoreOrderFraud(
      fraud({ total: 30_000, avgOrderValue: 9_000, customerAgeDays: 0, customerOrdersCount: 0, hasDeliveryAddress: false }),
    );
    expect(seventy.riskScore).toBe(70);
    expect(seventy.level).toBe('HIGH');
  });
});

describe('parseItemsSpec (CSV items grammar)', () => {
  it('parses semicolon separated SKU:QTY pairs', () => {
    expect(parseItemsSpec('RICE:2; OIL:3')).toEqual([
      { sku: 'RICE', quantity: 2 },
      { sku: 'OIL', quantity: 3 },
    ]);
  });

  it('accepts x separators and newlines, uppercases SKUs', () => {
    expect(parseItemsSpec('rice x2\nOIL:1')).toEqual([
      { sku: 'RICE', quantity: 2 },
      { sku: 'OIL', quantity: 1 },
    ]);
  });

  it('rejects an empty list', () => {
    expect(() => parseItemsSpec(';;;')).toThrow(/at least one SKU:QTY/);
  });

  it('rejects missing SKU, bad quantities, and absurd sizes', () => {
    expect(() => parseItemsSpec(':2')).toThrow(/missing SKU/);
    expect(() => parseItemsSpec('RICE:0')).toThrow(/positive integer/);
    expect(() => parseItemsSpec('RICE:-3')).toThrow(/positive integer/);
    expect(() => parseItemsSpec('RICE:abc')).toThrow(/positive integer/);
    expect(() => parseItemsSpec('RICE:1000')).toThrow(/over 999/);
  });
});

describe('mapImportRow (CSV row normalization)', () => {
  it('maps a fully populated row', () => {
    const row = mapImportRow({
      customerphone: ' 0803 123 4567',
      items: 'RICE:2',
      discount: '500',
      deliveryfee: '1500',
      address: ' 12 Allen Ave ',
      city: ' Lagos ',
      channel: 'whatsapp',
    });
    expect(row).toEqual({
      customerPhone: '08031234567',
      itemsSpec: 'RICE:2',
      discount: 500,
      deliveryFee: 1500,
      address: '12 Allen Ave',
      city: 'Lagos',
      channel: 'WHATSAPP',
    });
  });

  it('defaults optional columns and falls back to DASHBOARD channel', () => {
    const row = mapImportRow({ customerphone: '081', items: 'RICE:1', channel: 'carrier-pigeon' });
    expect(row.discount).toBeNull();
    expect(row.deliveryFee).toBeNull();
    expect(row.address).toBeNull();
    expect(row.city).toBeNull();
    expect(row.channel).toBe('DASHBOARD');
  });

  it('enforces the two required columns and numeric hygiene', () => {
    expect(() => mapImportRow({ items: 'RICE:1' })).toThrow(/customerPhone is required/);
    expect(() => mapImportRow({ customerphone: '081', items: '   ' })).toThrow(/items is required/);
    expect(() => mapImportRow({ customerphone: '081', items: 'R:1', discount: '-5' })).toThrow(
      /discount must be a non-negative number/,
    );
  });
});

const WA_CONTEXT: OrderMessageContext = {
  orderNumber: 'WC-ABC123',
  status: 'PENDING_PAYMENT',
  total: '12500.00',
  currency: 'NGN',
  customerName: 'Ada',
};

describe('buildOrderStatusMessage (WhatsApp copy)', () => {
  it('uses the per-status headline and echoes order facts', () => {
    const msg = buildOrderStatusMessage(WA_CONTEXT);
    expect(msg).toContain('Hi Ada');
    expect(msg).toContain('WC-ABC123');
    expect(msg).toContain('awaiting payment');
    expect(msg).toContain('NGN 12500.00');
    expect(msg).not.toContain('tracking');
  });

  it('adds the tracking promise exactly when shipped', () => {
    const shipped = buildOrderStatusMessage({ ...WA_CONTEXT, status: 'SHIPPED' });
    expect(shipped).toContain('on the way');
    expect(shipped).toContain('tracking details shortly');

    for (const status of ['PAID', 'PROCESSING', 'DELIVERED', 'CANCELLED', 'REFUNDED'] as const) {
      expect(buildOrderStatusMessage({ ...WA_CONTEXT, status })).not.toContain('tracking');
    }
  });
});

const NOTIFY_PAYLOAD: OrderNotificationPayload = {
  orderNumber: 'WC-XYZ789',
  status: 'PENDING_PAYMENT',
  total: '999.99',
  currency: 'NGN',
  customerName: 'Musa',
  customerPhone: '+2348030000000',
};

describe('notification builders (email + SMS bodies)', () => {
  it('subject carries the event name', () => {
    expect(buildEmailSubject(NOTIFY_PAYLOAD, 'paid')).toBe('Order WC-XYZ789 paid');
  });

  it('body humanizes snake_case statuses and appends tracking when present', () => {
    const plain = buildEmailBody(NOTIFY_PAYLOAD);
    expect(plain).toContain('now pending payment.');
    expect(plain).toContain('NGN 999.99');
    expect(plain).not.toContain('Tracking code');

    const tracked = buildEmailBody({ ...NOTIFY_PAYLOAD, status: 'SHIPPED', trackingCode: 'GIG-42' });
    expect(tracked).toContain('now shipped.');
    expect(tracked).toContain('Tracking code: GIG-42');
  });

  it('SMS stays short, GSM-friendly, and informative', () => {
    const sms = buildSmsBody(NOTIFY_PAYLOAD);
    expect(sms).toBe('Order WC-XYZ789: pending payment. Total NGN 999.99.');
    expect(sms.length).toBeLessThanOrEqual(160);
  });
});

describe('sortNotes (timeline ordering)', () => {
  const note = (
    id: string,
    pinned: boolean,
    at: string,
  ): { id: string; pinned: boolean; createdAt: Date; updatedAt: Date; orderId: string; body: string; authorId: string | null } =>
    ({
      id,
      pinned,
      createdAt: new Date(at),
      orderId: 'o1',
      body: id,
      authorId: null,
      updatedAt: new Date(at),
    });

  it('pinned notes lead, newest first inside each group', () => {
    const sorted = sortNotes([
      note('old-free', false, '2026-01-01T00:00:00Z'),
      note('newest-pin', true, '2026-01-02T00:00:00Z'),
      note('older-pin', true, '2026-01-01T00:00:00Z'),
      note('new-free', false, '2026-03-01T00:00:00Z'),
    ]);
    expect(sorted.map((n) => n.id)).toEqual(['newest-pin', 'older-pin', 'new-free', 'old-free']);
  });
});
