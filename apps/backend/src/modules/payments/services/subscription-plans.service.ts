import type { SubscriptionPlan } from '@prisma/client';
import { ConflictError, NotFoundError } from '@wco/shared';

import { logger } from '../../../lib/logger.js';
import { prisma } from '../../../lib/prisma.js';

/**
 * SubscriptionPlansService — platform plan catalog management.
 *
 * Plans are platform-level entities (not merchant-scoped). SUPER_ADMIN creates
 * and manages plans; all authenticated users can read them.
 */
export class SubscriptionPlansService {
  constructor(private readonly db: typeof prisma = prisma) {}

  async list(opts: { page: number; pageSize: number; isActive?: boolean }): Promise<SubscriptionPlan[]> {
    const where: Record<string, unknown> = {};
    if (opts.isActive !== undefined) where.isActive = opts.isActive;

    return this.db.subscriptionPlan.findMany({
      where: where as never,
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      skip: (opts.page - 1) * opts.pageSize,
      take: opts.pageSize,
    });
  }

  async count(isActive?: boolean): Promise<number> {
    const where: Record<string, unknown> = {};
    if (isActive !== undefined) where.isActive = isActive;
    return this.db.subscriptionPlan.count({ where: where as never });
  }

  async getById(id: string): Promise<SubscriptionPlan> {
    const plan = await this.db.subscriptionPlan.findUnique({ where: { id } });
    if (!plan) throw new NotFoundError('Subscription plan');
    return plan;
  }

  async getBySlug(slug: string): Promise<SubscriptionPlan> {
    const plan = await this.db.subscriptionPlan.findFirst({ where: { code: slug.toUpperCase() } });
    if (!plan) throw new NotFoundError('Subscription plan');
    return plan;
  }

  async create(data: {
    code: string;
    name: string;
    description?: string;
    priceMonthly: number;
    priceYearly: number;
    currency?: string;
    trialDays?: number;
    limits?: Record<string, unknown>;
    features?: string[];
    sortOrder?: number;
  }): Promise<SubscriptionPlan> {
    const existing = await this.db.subscriptionPlan.findFirst({ where: { code: data.code } });
    if (existing) throw new ConflictError(`Plan with code ${data.code} already exists`);

    const plan = await this.db.subscriptionPlan.create({
      data: {
        code: data.code,
        name: data.name,
        description: data.description ?? null,
        priceMonthly: data.priceMonthly,
        priceYearly: data.priceYearly,
        currency: (data.currency as never) ?? 'NGN',
        trialDays: data.trialDays ?? 0,
        limits: data.limits ?? {},
        features: data.features ?? [],
        sortOrder: data.sortOrder ?? 0,
      },
    });

    logger.info('subscription-plan.created', { planId: plan.id, code: plan.code });
    return plan;
  }

  async update(id: string, data: Partial<{
    name: string;
    description: string;
    priceMonthly: number;
    priceYearly: number;
    currency: string;
    trialDays: number;
    limits: Record<string, unknown>;
    features: string[];
    sortOrder: number;
    isActive: boolean;
  }>): Promise<SubscriptionPlan> {
    const plan = await this.getById(id);

    const updated = await this.db.subscriptionPlan.update({
      where: { id: plan.id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.priceMonthly !== undefined && { priceMonthly: data.priceMonthly }),
        ...(data.priceYearly !== undefined && { priceYearly: data.priceYearly }),
        ...(data.currency !== undefined && { currency: data.currency as never }),
        ...(data.trialDays !== undefined && { trialDays: data.trialDays }),
        ...(data.limits !== undefined && { limits: data.limits }),
        ...(data.features !== undefined && { features: data.features }),
        ...(data.sortOrder !== undefined && { sortOrder: data.sortOrder }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
      },
    });

    logger.info('subscription-plan.updated', { planId: id });
    return updated;
  }

  async remove(id: string): Promise<void> {
    const plan = await this.getById(id);
    const activeSubscriptions = await this.db.subscription.count({
      where: { planId: plan.id, status: { in: ['ACTIVE', 'TRIALING'] } },
    });
    if (activeSubscriptions > 0) {
      throw new ConflictError('Cannot delete plan with active subscriptions');
    }
    await this.db.subscriptionPlan.delete({ where: { id: plan.id } });
    logger.info('subscription-plan.deleted', { planId: id });
  }
}

export const subscriptionPlansService = new SubscriptionPlansService();
