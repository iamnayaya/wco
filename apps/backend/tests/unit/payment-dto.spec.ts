import {
  initializePaymentSchema,
  refundSchema,
  listPaymentsQuerySchema,
  listPaymentsOffsetSchema,
  searchPaymentsSchema,
  exportPaymentsSchema,
  sendPaymentSchema,
  generatePaymentLinkSchema,
  paymentStatsSchema,
  idParams,
  paymentIdParams,
} from '../../src/modules/payments/payments.dto.js';

/**
 * Payment DTO validation tests — covers all Zod schemas for the payment module.
 * Validates happy paths, edge cases, and error messages.
 */

describe('Payment DTOs', () => {
  describe('idParams', () => {
    it('accepts valid id', () => {
      expect(idParams.parse({ id: 'pay_abc123' })).toEqual({ id: 'pay_abc123' });
    });

    it('rejects empty id', () => {
      expect(() => idParams.parse({ id: '' })).toThrow();
    });
  });

  describe('paymentIdParams', () => {
    it('accepts id with optional refundId', () => {
      expect(paymentIdParams.parse({ id: 'pay_123', refundId: 'ref_456' })).toEqual({
        id: 'pay_123',
        refundId: 'ref_456',
      });
    });

    it('accepts id without refundId', () => {
      expect(paymentIdParams.parse({ id: 'pay_123' })).toEqual({ id: 'pay_123' });
    });
  });

  describe('initializePaymentSchema', () => {
    it('accepts valid initialization', () => {
      const result = initializePaymentSchema.parse({
        orderId: 'ord_abc123',
        provider: 'PAYSTACK',
      });
      expect(result).toEqual({ orderId: 'ord_abc123', provider: 'PAYSTACK' });
    });

    it('accepts all valid providers', () => {
      expect(initializePaymentSchema.parse({ orderId: 'x', provider: 'PAYSTACK' }).provider).toBe('PAYSTACK');
      expect(initializePaymentSchema.parse({ orderId: 'x', provider: 'FLUTTERWAVE' }).provider).toBe('FLUTTERWAVE');
      expect(initializePaymentSchema.parse({ orderId: 'x', provider: 'OPAY' }).provider).toBe('OPAY');
    });

    it('rejects invalid provider', () => {
      expect(() => initializePaymentSchema.parse({ orderId: 'x', provider: 'STRIPE' })).toThrow();
    });

    it('rejects missing orderId', () => {
      expect(() => initializePaymentSchema.parse({ provider: 'PAYSTACK' })).toThrow();
    });
  });

  describe('refundSchema', () => {
    it('accepts valid refund amount', () => {
      expect(refundSchema.parse({ amount: 1500 })).toEqual({ amount: 1500 });
    });

    it('accepts empty body (full refund)', () => {
      expect(refundSchema.parse({})).toEqual({});
    });

    it('accepts amount with reason', () => {
      expect(refundSchema.parse({ amount: 500, reason: 'Customer returned item' })).toEqual({
        amount: 500,
        reason: 'Customer returned item',
      });
    });

    it('rejects negative amount', () => {
      expect(() => refundSchema.parse({ amount: -100 })).toThrow();
    });

    it('rejects zero amount', () => {
      expect(() => refundSchema.parse({ amount: 0 })).toThrow();
    });
  });

  describe('listPaymentsQuerySchema', () => {
    it('uses defaults', () => {
      const result = listPaymentsQuerySchema.parse({});
      expect(result).toEqual({ limit: 25 });
    });

    it('coerces string numbers', () => {
      const result = listPaymentsQuerySchema.parse({ limit: '50', cursor: 'abc' });
      expect(result).toEqual({ limit: 50, cursor: 'abc' });
    });

    it('rejects limit > 100', () => {
      expect(() => listPaymentsQuerySchema.parse({ limit: 200 })).toThrow();
    });
  });

  describe('listPaymentsOffsetSchema', () => {
    it('uses defaults', () => {
      const result = listPaymentsOffsetSchema.parse({});
      expect(result).toEqual({
        page: 1,
        pageSize: 20,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      });
    });

    it('accepts valid filters', () => {
      const result = listPaymentsOffsetSchema.parse({
        page: 2,
        pageSize: 50,
        status: 'SUCCEEDED',
        provider: 'PAYSTACK',
        minAmount: 1000,
        maxAmount: 50000,
        from: '2024-01-01',
        to: '2024-12-31',
        sortBy: 'amount',
        sortOrder: 'asc',
      });
      expect(result.status).toBe('SUCCEEDED');
      expect(result.provider).toBe('PAYSTACK');
      expect(result.sortBy).toBe('amount');
    });

    it('rejects invalid status', () => {
      expect(() => listPaymentsOffsetSchema.parse({ status: 'INVALID' })).toThrow();
    });

    it('rejects invalid sortBy', () => {
      expect(() => listPaymentsOffsetSchema.parse({ sortBy: 'email' })).toThrow();
    });
  });

  describe('searchPaymentsSchema', () => {
    it('accepts valid search', () => {
      const result = searchPaymentsSchema.parse({ q: 'WCO_7F3K9Q' });
      expect(result).toEqual({ q: 'WCO_7F3K9Q', page: 1, pageSize: 20 });
    });

    it('rejects short query', () => {
      expect(() => searchPaymentsSchema.parse({ q: 'a' })).toThrow();
    });
  });

  describe('exportPaymentsSchema', () => {
    it('uses csv default', () => {
      const result = exportPaymentsSchema.parse({});
      expect(result.format).toBe('csv');
    });

    it('accepts json format', () => {
      const result = exportPaymentsSchema.parse({ format: 'json' });
      expect(result.format).toBe('json');
    });

    it('accepts filters', () => {
      const result = exportPaymentsSchema.parse({
        from: '2024-01-01',
        to: '2024-06-30',
        status: 'SUCCEEDED',
        provider: 'FLUTTERWAVE',
      });
      expect(result.status).toBe('SUCCEEDED');
      expect(result.provider).toBe('FLUTTERWAVE');
    });
  });

  describe('sendPaymentSchema', () => {
    it('accepts valid send payment', () => {
      const result = sendPaymentSchema.parse({
        recipientPhone: '+2348012345678',
        amount: 5000,
        provider: 'PAYSTACK',
      });
      expect(result).toEqual({
        recipientPhone: '+2348012345678',
        amount: 5000,
        currency: 'NGN',
        provider: 'PAYSTACK',
      });
    });

    it('rejects invalid phone', () => {
      expect(() =>
        sendPaymentSchema.parse({
          recipientPhone: '123',
          amount: 5000,
          provider: 'PAYSTACK',
        }),
      ).toThrow();
    });

    it('rejects negative amount', () => {
      expect(() =>
        sendPaymentSchema.parse({
          recipientPhone: '+2348012345678',
          amount: -100,
          provider: 'PAYSTACK',
        }),
      ).toThrow();
    });
  });

  describe('generatePaymentLinkSchema', () => {
    it('accepts valid link generation', () => {
      const result = generatePaymentLinkSchema.parse({
        amount: 10000,
        provider: 'FLUTTERWAVE',
      });
      expect(result).toEqual({
        amount: 10000,
        currency: 'NGN',
        provider: 'FLUTTERWAVE',
        expiresInMinutes: 1440,
      });
    });

    it('accepts optional fields', () => {
      const result = generatePaymentLinkSchema.parse({
        amount: 2500,
        provider: 'PAYSTACK',
        currency: 'GHS',
        customerPhone: '+233241234567',
        customerEmail: 'test@example.com',
        description: 'Payment for rice',
        expiresInMinutes: 60,
      });
      expect(result.currency).toBe('GHS');
      expect(result.expiresInMinutes).toBe(60);
    });

    it('rejects expiresInMinutes > 7 days', () => {
      expect(() =>
        generatePaymentLinkSchema.parse({
          amount: 1000,
          provider: 'PAYSTACK',
          expiresInMinutes: 20000,
        }),
      ).toThrow();
    });
  });

  describe('paymentStatsSchema', () => {
    it('uses defaults', () => {
      const result = paymentStatsSchema.parse({});
      expect(result).toEqual({ groupBy: 'day' });
    });

    it('accepts date range', () => {
      const result = paymentStatsSchema.parse({
        from: '2024-01-01',
        to: '2024-12-31',
        groupBy: 'month',
      });
      expect(result.groupBy).toBe('month');
    });

    it('rejects invalid groupBy', () => {
      expect(() => paymentStatsSchema.parse({ groupBy: 'hour' })).toThrow();
    });
  });
});
