import type { Commission } from '@prisma/client';
import { NotFoundError } from '@wco/shared';

import { logger } from '../../../lib/logger.js';
import { prisma } from '../../../lib/prisma.js';

/** Default WCO platform commission rate (2%) */
const DEFAULT_COMMISSION_RATE = 0.02;

/**
 * CommissionsService — platform commission tracking per successful payment.
 *
 * Commission is calculated at payment success time and stored as a ledger
 * entry. Settlement happens in batches via a background worker that scans
 * PENDING commissions daily.
 */
export class CommissionsService {
  constructor(private readonly db: typeof prisma = prisma) {}

  async listByStore(
    storeId: string,
    page: number,
    pageSize: number,
    filters: { status?: string; from?: Date; to?: Date } = {},
  ): Promise<Commission[]> {
    const where: Record<string, unknown> = { storeId };
    if (filters.status) where.status = filters.status;
    if (filters.from || filters.to) {
      where.createdAt = {};
      if (filters.from) (where.createdAt as Record<string, unknown>).gte = filters.from;
      if (filters.to) (where.createdAt as Record<string, unknown>).lte = filters.to;
    }

    return this.db.commission.findMany({
      where: where as never,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });
  }

  async countByStore(storeId: string, filters: { status?: string } = {}): Promise<number> {
    const where: Record<string, unknown> = { storeId };
    if (filters.status) where.status = filters.status;
    return this.db.commission.count({ where: where as never });
  }

  async getByPaymentId(paymentId: string): Promise<Commission[]> {
    return this.db.commission.findMany({
      where: { paymentId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async calculate(
    paymentId: string,
    storeId: string,
    amount: number,
    currency: string,
    rate: number = DEFAULT_COMMISSION_RATE,
  ): Promise<Commission> {
    const commissionAmount = Math.round(amount * rate * 100) / 100;

    const commission = await this.db.commission.create({
      data: {
        storeId,
        paymentId,
        rate,
        amount: commissionAmount,
        currency: currency as never,
        status: 'PENDING',
      },
    });

    logger.info('commission.calculated', {
      commissionId: commission.id,
      paymentId,
      amount: commissionAmount,
      rate,
    });

    return commission;
  }

  async process(commissionId: string): Promise<Commission> {
    const commission = await this.db.commission.findUnique({ where: { id: commissionId } });
    if (!commission) throw new NotFoundError('Commission');
    if (commission.status !== 'PENDING') {
      throw new NotFoundError(`Commission is already ${commission.status}`);
    }

    const updated = await this.db.commission.update({
      where: { id: commissionId },
      data: { status: 'SETTLED', settledAt: new Date() },
    });

    logger.info('commission.processed', { commissionId, amount: commission.amount });
    return updated;
  }

  async settleBatch(commissionIds: string[], settlementRef: string): Promise<number> {
    const result = await this.db.commission.updateMany({
      where: { id: { in: commissionIds }, status: 'PENDING' },
      data: { status: 'SETTLED', settledAt: new Date(), settlementRef },
    });

    logger.info('commission.batch-settled', { count: result.count, settlementRef });
    return result.count;
  }

  async getStoreSummary(storeId: string): Promise<{
    totalPending: number;
    totalSettled: number;
    pendingAmount: number;
    settledAmount: number;
  }> {
    const [pendingCount, settledCount, pendingSum, settledSum] = await Promise.all([
      this.db.commission.count({ where: { storeId, status: 'PENDING' } }),
      this.db.commission.count({ where: { storeId, status: 'SETTLED' } }),
      this.db.commission.aggregate({ where: { storeId, status: 'PENDING' }, _sum: { amount: true } }),
      this.db.commission.aggregate({ where: { storeId, status: 'SETTLED' }, _sum: { amount: true } }),
    ]);

    return {
      totalPending: pendingCount,
      totalSettled: settledCount,
      pendingAmount: Number(pendingSum._sum.amount ?? 0),
      settledAmount: Number(settledSum._sum.amount ?? 0),
    };
  }
}

export const commissionsService = new CommissionsService();
