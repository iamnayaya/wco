import {
  createPaymentMethodSchema,
  updatePaymentMethodSchema,
  paymentMethodIdParams,
  listPaymentMethodsQuerySchema,
} from '../../src/modules/payments/payment-methods.dto.js';

/**
 * Payment Methods DTO validation tests — covers all Zod schemas for
 * merchant payout account management.
 */

describe('Payment Methods DTOs', () => {
  describe('paymentMethodIdParams', () => {
    it('accepts valid id', () => {
      expect(paymentMethodIdParams.parse({ id: 'pm_abc123' })).toEqual({ id: 'pm_abc123' });
    });

    it('rejects empty id', () => {
      expect(() => paymentMethodIdParams.parse({ id: '' })).toThrow();
    });
  });

  describe('createPaymentMethodSchema', () => {
    it('accepts valid bank account', () => {
      const result = createPaymentMethodSchema.parse({
        type: 'BANK_ACCOUNT',
        providerName: 'GTBank',
        accountName: 'John Doe',
        accountNumber: '0123456789',
      });
      expect(result.type).toBe('BANK_ACCOUNT');
      expect(result.providerName).toBe('GTBank');
      expect(result.isDefault).toBe(false);
      expect(result.meta).toEqual({});
    });

    it('accepts mobile money', () => {
      const result = createPaymentMethodSchema.parse({
        type: 'MOBILE_MONEY',
        providerName: 'MTN MoMo',
        accountName: 'Jane Smith',
        accountNumber: '+2348012345678',
        bankCode: 'MTN',
      });
      expect(result.type).toBe('MOBILE_MONEY');
      expect(result.bankCode).toBe('MTN');
    });

    it('accepts isDefault flag', () => {
      const result = createPaymentMethodSchema.parse({
        type: 'BANK_ACCOUNT',
        providerName: 'OPay',
        accountName: 'Test User',
        accountNumber: '1234567890',
        isDefault: true,
      });
      expect(result.isDefault).toBe(true);
    });

    it('rejects missing type', () => {
      expect(() =>
        createPaymentMethodSchema.parse({
          providerName: 'GTBank',
          accountName: 'Test',
          accountNumber: '123456',
        }),
      ).toThrow();
    });

    it('rejects short account number', () => {
      expect(() =>
        createPaymentMethodSchema.parse({
          type: 'BANK_ACCOUNT',
          providerName: 'GTBank',
          accountName: 'Test',
          accountNumber: '123',
        }),
      ).toThrow();
    });

    it('rejects invalid type', () => {
      expect(() =>
        createPaymentMethodSchema.parse({
          type: 'CRYPTO',
          providerName: 'Bitcoin',
          accountName: 'Test',
          accountNumber: '123456',
        }),
      ).toThrow();
    });
  });

  describe('updatePaymentMethodSchema', () => {
    it('accepts partial update', () => {
      const result = updatePaymentMethodSchema.parse({
        accountName: 'Updated Name',
      });
      expect(result.accountName).toBe('Updated Name');
    });

    it('accepts empty update', () => {
      const result = updatePaymentMethodSchema.parse({});
      expect(result).toEqual({});
    });

    it('accepts meta update', () => {
      const result = updatePaymentMethodSchema.parse({
        meta: { nickname: 'My Savings' },
      });
      expect(result.meta).toEqual({ nickname: 'My Savings' });
    });
  });

  describe('listPaymentMethodsQuerySchema', () => {
    it('uses defaults', () => {
      const result = listPaymentMethodsQuerySchema.parse({});
      expect(result).toEqual({ page: 1, pageSize: 20 });
    });

    it('accepts type filter', () => {
      const result = listPaymentMethodsQuerySchema.parse({ type: 'BANK_ACCOUNT' });
      expect(result.type).toBe('BANK_ACCOUNT');
    });

    it('coerces string numbers', () => {
      const result = listPaymentMethodsQuerySchema.parse({ page: '2', pageSize: '50' });
      expect(result.page).toBe(2);
      expect(result.pageSize).toBe(50);
    });

    it('rejects invalid type', () => {
      expect(() => listPaymentMethodsQuerySchema.parse({ type: 'CRYPTO' })).toThrow();
    });
  });
});
