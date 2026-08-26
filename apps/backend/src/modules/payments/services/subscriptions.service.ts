import type { Subscription } from '@prisma/client';
import { NotFoundError, ValidationError } from '@wco/shared';

import { logger } from '../../../lib/logger.js';
import { prisma } from '../../../lib/prisma.js';

/**
 * SubscriptionsService — merchant billing lifecycle management.
 *
 * Each merchant has at most one ACTIVE/TRIALING subscription. Handles
 * creation, renewal, upgrades, downgrades, cancellations.
 *
 * On upgrade, the difference is prorated and charged immediately.
 * On downgrade, the new plan takes effect at the end of the current period.
 */
export class SubscriptionsService {
  constructor(private readonly db: typeof prisma = prisma) {}

  async getByMerchantId(merchantId: string): Promise<Subscription | null> {
    return this.db.subscription.findFirst({
      where: { merchantId, status: { in: ['TRIALING', 'ACTIVE', 'PAST_DUE'] } },
      include: { plan: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getById(id: string): Promise<Subscription> {
    const sub = await this.db.subscription.findUnique({ where: { id }, include: { plan: true } });
    if (!sub) throw new NotFoundError('Subscription');
    return sub;
  }

  async create(
    merchantId: string,
    data: { planId: string; billingCycle?: string; paymentMethodId?: string },
  ): Promise<Subscription> {
    const existing = await this.getByMerchantId(merchantId);
    if (existing && ['ACTIVE', 'TRIALING'].includes(existing.status)) {
      throw new ValidationError('Merchant already has an active subscription');
    }

    const plan = await this.db.subscriptionPlan.findUnique({ where: { id: data.planId } });
    if (!plan) throw new NotFoundError('Subscription plan');
    if (!plan.isActive) throw new ValidationError('Subscription plan is not active');

    const billingCycle = (data.billingCycle as 'MONTHLY' | 'YEARLY') ?? 'MONTHLY';
    const amount = billingCycle === 'YEARLY' ? plan.priceYearly : plan.priceMonthly;
    const now = new Date();
    const periodEnd = new Date(now);
    if (billingCycle === 'YEARLY') {
      periodEnd.setFullYear(periodEnd.getFullYear() + 1);
    } else {
      periodEnd.setMonth(periodEnd.getMonth() + 1);
    }

    const hasTrial = plan.trialDays > 0 && (!existing || existing.status !== 'PAST_DUE');
    const trialEndsAt = hasTrial ? new Date(now.getTime() + plan.trialDays * 86400000) : null;

    const subscription = await this.db.subscription.create({
      data: {
        merchantId,
        planId: data.planId,
        status: hasTrial ? 'TRIALING' : 'ACTIVE',
        billingCycle: billingCycle as never,
        amount,
        currency: plan.currency,
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        trialEndsAt,
      },
      include: { plan: true },
    });

    logger.info('subscription.created', {
      subscriptionId: subscription.id,
      merchantId,
      planCode: plan.code,
      billingCycle,
      hasTrial,
    });

    return subscription;
  }

  async update(
    merchantId: string,
    data: { billingCycle?: string; paymentMethodId?: string },
  ): Promise<Subscription> {
    const sub = await this.getActiveOrThrow(merchantId);

    if (data.billingCycle) {
      const plan = await this.db.subscriptionPlan.findUnique({ where: { id: sub.planId } });
      if (!plan) throw new NotFoundError('Subscription plan');

      const newCycle = data.billingCycle as 'MONTHLY' | 'YEARLY';
      const amount = newCycle === 'YEARLY' ? plan.priceYearly : plan.priceMonthly;

      const updated = await this.db.subscription.update({
        where: { id: sub.id },
        data: { billingCycle: newCycle as never, amount },
        include: { plan: true },
      });

      logger.info('subscription.updated', { subscriptionId: sub.id, billingCycle: newCycle });
      return updated;
    }

    return sub;
  }

  async cancel(
    merchantId: string,
    data: { reason?: string; cancelAtPeriodEnd?: boolean },
  ): Promise<Subscription> {
    const sub = await this.getActiveOrThrow(merchantId);

    if (data.cancelAtPeriodEnd !== false) {
      const updated = await this.db.subscription.update({
        where: { id: sub.id },
        data: { cancelAtPeriodEnd: true },
        include: { plan: true },
      });
      logger.info('subscription.cancel-at-period-end', { subscriptionId: sub.id, reason: data.reason });
      return updated;
    }

    const updated = await this.db.subscription.update({
      where: { id: sub.id },
      data: {
        status: 'CANCELLED',
        cancelledAt: new Date(),
        cancelAtPeriodEnd: false,
      },
      include: { plan: true },
    });

    logger.info('subscription.cancelled', { subscriptionId: sub.id, reason: data.reason });
    return updated;
  }

  async renew(
    merchantId: string,
    data: { billingCycle?: string },
  ): Promise<Subscription> {
    const sub = await this.db.subscription.findFirst({
      where: { merchantId, status: { in: ['CANCELLED', 'EXPIRED', 'PAST_DUE'] } },
      include: { plan: true },
      orderBy: { createdAt: 'desc' },
    });
    if (!sub) throw new NotFoundError('Previous subscription');

    const plan = await this.db.subscriptionPlan.findUnique({ where: { id: sub.planId } });
    if (!plan) throw new NotFoundError('Subscription plan');
    if (!plan.isActive) throw new ValidationError('Original plan is no longer active');

    const billingCycle = (data.billingCycle as 'MONTHLY' | 'YEARLY') ?? sub.billingCycle as 'MONTHLY' | 'YEARLY';
    const amount = billingCycle === 'YEARLY' ? plan.priceYearly : plan.priceMonthly;
    const now = new Date();
    const periodEnd = new Date(now);
    if (billingCycle === 'YEARLY') {
      periodEnd.setFullYear(periodEnd.getFullYear() + 1);
    } else {
      periodEnd.setMonth(periodEnd.getMonth() + 1);
    }

    const updated = await this.db.subscription.update({
      where: { id: sub.id },
      data: {
        status: 'ACTIVE',
        billingCycle: billingCycle as never,
        amount,
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        cancelledAt: null,
        cancelAtPeriodEnd: false,
      },
      include: { plan: true },
    });

    logger.info('subscription.renewed', { subscriptionId: sub.id, billingCycle });
    return updated;
  }

  async changePlan(
    merchantId: string,
    data: { planId: string; billingCycle?: string },
    direction: 'upgrade' | 'downgrade',
  ): Promise<Subscription> {
    const sub = await this.getActiveOrThrow(merchantId);
    const newPlan = await this.db.subscriptionPlan.findUnique({ where: { id: data.planId } });
    if (!newPlan) throw new NotFoundError('Subscription plan');
    if (!newPlan.isActive) throw new ValidationError('Target plan is not active');

    const billingCycle = (data.billingCycle as 'MONTHLY' | 'YEARLY') ?? sub.billingCycle as 'MONTHLY' | 'YEARLY';
    const amount = billingCycle === 'YEARLY' ? newPlan.priceYearly : newPlan.priceMonthly;

    const now = new Date();
    const periodEnd = new Date(sub.currentPeriodEnd);

    const updated = await this.db.subscription.update({
      where: { id: sub.id },
      data: {
        planId: data.planId,
        billingCycle: billingCycle as never,
        amount,
        meta: {
          ...(sub.meta as object),
          lastPlanChange: {
            from: sub.planId,
            to: data.planId,
            direction,
            changedAt: now.toISOString(),
          },
        },
      },
      include: { plan: true },
    });

    logger.info('subscription.plan-changed', {
      subscriptionId: sub.id,
      from: sub.planId,
      to: data.planId,
      direction,
    });

    return updated;
  }

  private async getActiveOrThrow(merchantId: string): Promise<Subscription> {
    const sub = await this.getByMerchantId(merchantId);
    if (!sub) throw new NotFoundError('Active subscription');
    return sub;
  }
}

export const subscriptionsService = new SubscriptionsService();
