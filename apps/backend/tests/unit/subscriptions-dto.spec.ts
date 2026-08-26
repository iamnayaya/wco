import {
  createSubscriptionSchema,
  updateSubscriptionSchema,
  cancelSubscriptionSchema,
  renewSubscriptionSchema,
  changePlanSchema,
} from '../../src/modules/payments/subscriptions.dto.js';

import {
  createSubscriptionPlanSchema,
  updateSubscriptionPlanSchema,
  subscriptionPlanIdParams,
  listSubscriptionPlansQuerySchema,
} from '../../src/modules/payments/subscription-plans.dto.js';

/**
 * Subscription & Subscription Plans DTO validation tests — covers all
 * Zod schemas for subscription lifecycle management.
 */

describe('Subscriptions DTOs', () => {
  describe('createSubscriptionSchema', () => {
    it('accepts valid subscription creation', () => {
      const result = createSubscriptionSchema.parse({ planId: 'plan_abc123' });
      expect(result.planId).toBe('plan_abc123');
      expect(result.billingCycle).toBe('MONTHLY');
    });

    it('accepts yearly billing', () => {
      const result = createSubscriptionSchema.parse({
        planId: 'plan_123',
        billingCycle: 'YEARLY',
      });
      expect(result.billingCycle).toBe('YEARLY');
    });

    it('accepts with paymentMethodId', () => {
      const result = createSubscriptionSchema.parse({
        planId: 'plan_123',
        paymentMethodId: 'pm_456',
      });
      expect(result.paymentMethodId).toBe('pm_456');
    });

    it('rejects missing planId', () => {
      expect(() => createSubscriptionSchema.parse({})).toThrow();
    });

    it('rejects invalid billingCycle', () => {
      expect(() =>
        createSubscriptionSchema.parse({ planId: 'plan_123', billingCycle: 'WEEKLY' }),
      ).toThrow();
    });
  });

  describe('updateSubscriptionSchema', () => {
    it('accepts partial update', () => {
      const result = updateSubscriptionSchema.parse({ billingCycle: 'YEARLY' });
      expect(result.billingCycle).toBe('YEARLY');
    });

    it('accepts empty update', () => {
      expect(updateSubscriptionSchema.parse({})).toEqual({});
    });
  });

  describe('cancelSubscriptionSchema', () => {
    it('uses defaults', () => {
      const result = cancelSubscriptionSchema.parse({});
      expect(result.cancelAtPeriodEnd).toBe(true);
    });

    it('accepts immediate cancellation', () => {
      const result = cancelSubscriptionSchema.parse({
        cancelAtPeriodEnd: false,
        reason: 'Too expensive',
      });
      expect(result.cancelAtPeriodEnd).toBe(false);
      expect(result.reason).toBe('Too expensive');
    });
  });

  describe('renewSubscriptionSchema', () => {
    it('accepts empty body', () => {
      expect(renewSubscriptionSchema.parse({})).toEqual({});
    });

    it('accepts billing cycle', () => {
      const result = renewSubscriptionSchema.parse({ billingCycle: 'YEARLY' });
      expect(result.billingCycle).toBe('YEARLY');
    });
  });

  describe('changePlanSchema', () => {
    it('accepts valid plan change', () => {
      const result = changePlanSchema.parse({ planId: 'plan_growth' });
      expect(result.planId).toBe('plan_growth');
    });

    it('accepts with billing cycle', () => {
      const result = changePlanSchema.parse({
        planId: 'plan_scale',
        billingCycle: 'YEARLY',
      });
      expect(result.planId).toBe('plan_scale');
      expect(result.billingCycle).toBe('YEARLY');
    });

    it('rejects missing planId', () => {
      expect(() => changePlanSchema.parse({})).toThrow();
    });
  });
});

describe('Subscription Plans DTOs', () => {
  describe('subscriptionPlanIdParams', () => {
    it('accepts valid id', () => {
      expect(subscriptionPlanIdParams.parse({ id: 'plan_abc' })).toEqual({ id: 'plan_abc' });
    });

    it('rejects empty id', () => {
      expect(() => subscriptionPlanIdParams.parse({ id: '' })).toThrow();
    });
  });

  describe('createSubscriptionPlanSchema', () => {
    it('accepts valid plan', () => {
      const result = createSubscriptionPlanSchema.parse({
        code: 'STARTER',
        name: 'Starter Plan',
        priceMonthly: 5000,
        priceYearly: 50000,
      });
      expect(result.code).toBe('STARTER');
      expect(result.currency).toBe('NGN');
      expect(result.trialDays).toBe(0);
      expect(result.limits).toEqual({});
      expect(result.features).toEqual([]);
    });

    it('accepts all fields', () => {
      const result = createSubscriptionPlanSchema.parse({
        code: 'GROWTH',
        name: 'Growth Plan',
        description: 'For growing businesses',
        priceMonthly: 15000,
        priceYearly: 150000,
        currency: 'GHS',
        trialDays: 14,
        limits: { ordersPerMonth: 1000, aiCredits: 5000 },
        features: ['Priority support', 'Advanced analytics'],
        sortOrder: 2,
      });
      expect(result.trialDays).toBe(14);
      expect(result.features).toHaveLength(2);
    });

    it('rejects invalid code', () => {
      expect(() =>
        createSubscriptionPlanSchema.parse({
          code: 'ULTIMATE',
          name: 'Ultimate',
          priceMonthly: 50000,
          priceYearly: 500000,
        }),
      ).toThrow();
    });

    it('rejects negative price', () => {
      expect(() =>
        createSubscriptionPlanSchema.parse({
          code: 'STARTER',
          name: 'Starter',
          priceMonthly: -100,
          priceYearly: -1000,
        }),
      ).toThrow();
    });
  });

  describe('updateSubscriptionPlanSchema', () => {
    it('accepts partial update', () => {
      const result = updateSubscriptionPlanSchema.parse({ name: 'Updated Plan Name' });
      expect(result.name).toBe('Updated Plan Name');
    });

    it('accepts empty update', () => {
      expect(updateSubscriptionPlanSchema.parse({})).toEqual({});
    });

    it('accepts sortOrder update', () => {
      const result = updateSubscriptionPlanSchema.parse({ sortOrder: 5 });
      expect(result.sortOrder).toBe(5);
    });
  });

  describe('listSubscriptionPlansQuerySchema', () => {
    it('uses defaults', () => {
      const result = listSubscriptionPlansQuerySchema.parse({});
      expect(result).toEqual({ page: 1, pageSize: 20 });
    });

    it('accepts isActive filter', () => {
      const result = listSubscriptionPlansQuerySchema.parse({ isActive: 'true' });
      expect(result.isActive).toBe(true);
    });
  });
});
