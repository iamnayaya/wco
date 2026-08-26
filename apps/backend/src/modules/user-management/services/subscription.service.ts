import type { Prisma } from '@prisma/client';
import { ConflictError, NotFoundError } from '@wco/shared';

import { prisma } from '../../../lib/prisma.js';

type SubWithPlan = Prisma.SubscriptionGetPayload<{ include: { plan: true } }>;

/**
 * Subscription lifecycle. One live subscription per merchant (TRIALING or
 * ACTIVE); plan changes keep history by cancelling the old row first.
 */
export class SubscriptionService {
  private async requireUser(userId: string): Promise<{ id: string; merchantId: string; email: string }> {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.status === 'DELETED') throw new NotFoundError('User not found');
    return user;
  }

  private async activeSubscription(merchantId: string): Promise<{ id: string; planId: string; billingCycle: 'MONTHLY' | 'YEARLY'; currentPeriodEnd: Date } | null> {
    const subs = await prisma.subscription.findMany({
      where: { merchantId, status: { in: ['TRIALING', 'ACTIVE'] } },
      take: 1,
    });
    return subs.at(0) ?? null;
  }

  async createSubscription(userId: string, planCode: 'FREE' | 'STARTER' | 'GROWTH' | 'SCALE', billingCycle: 'MONTHLY' | 'YEARLY'): Promise<SubWithPlan> {
    const user = await this.requireUser(userId);
    const plans = await prisma.subscriptionPlan.findMany({ where: { code: planCode }, take: 1 });
    const plan = plans.at(0);
    if (!plan || !plan.isActive) throw new NotFoundError(`Plan ${planCode} not found`);

    const current = await this.activeSubscription(user.merchantId);
    if (current && current.planId === plan.id && current.billingCycle === billingCycle) {
      throw new ConflictError('Merchant already has this subscription');
    }
    if (current) {
      await prisma.subscription.update({ where: { id: current.id }, data: { status: 'CANCELLED', cancelledAt: new Date() } });
    }

    const now = new Date();
    const periodEnd = new Date(now);
    if (billingCycle === 'YEARLY') periodEnd.setFullYear(periodEnd.getFullYear() + 1);
    else periodEnd.setMonth(periodEnd.getMonth() + 1);

    const trialEndsAt = plan.trialDays > 0 ? new Date(now.getTime() + plan.trialDays * 86_400_000) : null;
    const amount = billingCycle === 'YEARLY' ? plan.priceYearly : plan.priceMonthly;

    return prisma.subscription.create({
      data: {
        merchantId: user.merchantId,
        planId: plan.id,
        status: trialEndsAt ? 'TRIALING' : 'ACTIVE',
        billingCycle,
        amount,
        currency: plan.currency,
        currentPeriodStart: now,
        currentPeriodEnd: trialEndsAt ? new Date(trialEndsAt) : periodEnd,
        trialEndsAt,
      },
      include: { plan: true },
    });
  }

  async getSubscriptionByUserId(userId: string): Promise<SubWithPlan | null> {
    const user = await this.requireUser(userId);
    const sub = await this.activeSubscription(user.merchantId);
    if (!sub) throw new NotFoundError('No active subscription');
    return prisma.subscription.findUnique({ where: { id: sub.id }, include: { plan: true } });
  }

  async updateSubscription(userId: string, data: { billingCycle?: 'MONTHLY' | 'YEARLY'; cancelAtPeriodEnd?: boolean }): Promise<SubWithPlan> {
    const user = await this.requireUser(userId);
    const sub = await this.activeSubscription(user.merchantId);
    if (!sub) throw new NotFoundError('No active subscription');
    const next: Record<string, unknown> = {};
    if (data.cancelAtPeriodEnd !== undefined) next.cancelAtPeriodEnd = data.cancelAtPeriodEnd;
    if (data.billingCycle && data.billingCycle !== sub.billingCycle) {
      const plans = await prisma.subscriptionPlan.findMany({ where: { id: sub.planId }, take: 1 });
      const plan = plans.at(0);
      if (!plan) throw new NotFoundError('Plan not found');
      next.billingCycle = data.billingCycle;
      next.amount = data.billingCycle === 'YEARLY' ? plan.priceYearly : plan.priceMonthly;
    }
    return prisma.subscription.update({ where: { id: sub.id }, data: next, include: { plan: true } });
  }

  /** Cancel at period end by default - merchants keep paid time. */
  async cancelSubscription(userId: string): Promise<void> {
    const user = await this.requireUser(userId);
    const sub = await this.activeSubscription(user.merchantId);
    if (!sub) throw new NotFoundError('No active subscription');
    await prisma.subscription.update({
      where: { id: sub.id },
      data: { cancelAtPeriodEnd: true, status: 'CANCELLED', cancelledAt: new Date() },
    });
  }

  async renewSubscription(userId: string): Promise<SubWithPlan> {
    const user = await this.requireUser(userId);
    const subs = await prisma.subscription.findMany({ where: { merchantId: user.merchantId }, orderBy: [{ createdAt: 'desc' }], take: 1 });
    const sub = subs.at(0);
    if (!sub) throw new NotFoundError('No subscription to renew');

    const start = sub.currentPeriodEnd > new Date() ? sub.currentPeriodEnd : new Date();
    const end = new Date(start);
    if (sub.billingCycle === 'YEARLY') end.setFullYear(end.getFullYear() + 1);
    else end.setMonth(end.getMonth() + 1);

    return prisma.subscription.update({
      where: { id: sub.id },
      data: {
        status: 'ACTIVE',
        cancelAtPeriodEnd: false,
        cancelledAt: null,
        currentPeriodStart: start,
        currentPeriodEnd: end,
      },
      include: { plan: true },
    });
  }
}

export const subscriptionService = new SubscriptionService();
