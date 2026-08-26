import {
  createRefundSchema,
  listRefundsQuerySchema,
  paymentIdParam,
  refundIdParam,
} from '../../src/modules/payments/payment-refunds.dto.js';

/**
 * Payment Refunds DTO validation tests — covers all Zod schemas for
 * dedicated refund management endpoints.
 */

describe('Payment Refunds DTOs', () => {
  describe('paymentIdParam', () => {
    it('accepts valid id', () => {
      expect(paymentIdParam.parse({ id: 'pay_abc123' })).toEqual({ id: 'pay_abc123' });
    });

    it('rejects empty id', () => {
      expect(() => paymentIdParam.parse({ id: '' })).toThrow();
    });
  });

  describe('refundIdParam', () => {
    it('accepts valid ids', () => {
      const result = refundIdParam.parse({ id: 'pay_123', refundId: 'ref_456' });
      expect(result).toEqual({ id: 'pay_123', refundId: 'ref_456' });
    });

    it('rejects missing refundId', () => {
      expect(() => refundIdParam.parse({ id: 'pay_123' })).toThrow();
    });
  });

  describe('createRefundSchema', () => {
    it('accepts empty body (full refund)', () => {
      const result = createRefundSchema.parse({});
      expect(result).toEqual({});
    });

    it('accepts partial refund with reason', () => {
      const result = createRefundSchema.parse({
        amount: 2500,
        reason: 'Item returned damaged',
      });
      expect(result.amount).toBe(2500);
      expect(result.reason).toBe('Item returned damaged');
    });

    it('accepts metadata', () => {
      const result = createRefundSchema.parse({
        amount: 1000,
        metadata: { returnId: 'ret_123', condition: 'damaged' },
      });
      expect(result.metadata).toEqual({ returnId: 'ret_123', condition: 'damaged' });
    });

    it('rejects negative amount', () => {
      expect(() => createRefundSchema.parse({ amount: -500 })).toThrow();
    });

    it('rejects zero amount', () => {
      expect(() => createRefundSchema.parse({ amount: 0 })).toThrow();
    });

    it('rejects reason exceeding 500 chars', () => {
      expect(() =>
        createRefundSchema.parse({ reason: 'x'.repeat(501) }),
      ).toThrow();
    });
  });

  describe('listRefundsQuerySchema', () => {
    it('uses defaults', () => {
      const result = listRefundsQuerySchema.parse({});
      expect(result).toEqual({
        page: 1,
        pageSize: 20,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      });
    });

    it('accepts valid filters', () => {
      const result = listRefundsQuerySchema.parse({
        page: 2,
        pageSize: 10,
        status: 'SUCCEEDED',
        sortBy: 'amount',
        sortOrder: 'asc',
      });
      expect(result.status).toBe('SUCCEEDED');
      expect(result.sortBy).toBe('amount');
      expect(result.sortOrder).toBe('asc');
    });

    it('rejects invalid status', () => {
      expect(() => listRefundsQuerySchema.parse({ status: 'CANCELLED' })).toThrow();
    });

    it('rejects pageSize > 100', () => {
      expect(() => listRefundsQuerySchema.parse({ pageSize: 200 })).toThrow();
    });

    it('rejects invalid sortBy', () => {
      expect(() => listRefundsQuerySchema.parse({ sortBy: 'email' })).toThrow();
    });
  });
});
