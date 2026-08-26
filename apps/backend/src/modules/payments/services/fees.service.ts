import type { Fee } from '@prisma/client';
import { NotFoundError } from '@wco/shared';

import { logger } from '../../../lib/logger.js';
import { prisma } from '../../../lib/prisma.js';

/**
 * FeesService — payment processing fee tracking.
 *
 * Fees cover PSP charges (Paystack 1.5%, Flutterwave 1.4%, etc.) and
 * platform fees. Each fee is calculated per transaction and stored in
 * the ledger for reconciliation and merchant billing.
 */
export class FeesService {
  constructor(private readonly db: typeof prisma = prisma) {}

  async listByStore(
    storeId: string,
    page: number,
    pageSize: number,
    filters: { type?: string; status?: string } = {},
  ): Promise<Fee[]> {
    const where: Record<string, unknown> = { storeId };
    if (filters.type) where.type = filters.type;
    if (filters.status) where.status = filters.status;

    return this.db.fee.findMany({
      where: where as never,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });
  }

  async countByStore(storeId: string, filters: { type?: string; status?: string } = {}): Promise<number> {
    const where: Record<string, unknown> = { storeId };
    if (filters.type) where.type = filters.type;
    if (filters.status) where.status = filters.status;
    return this.db.fee.count({ where: where as never });
  }

  async getByPaymentId(paymentId: string): Promise<Fee[]> {
    return this.db.fee.findMany({ where: { paymentId }, orderBy: { createdAt: 'desc' } });
  }

  async calculate(
    paymentId: string,
    storeId: string,
    data: {
      type: string;
      rate?: number;
      flatAmount?: number;
      providerFee?: number;
      currency: string;
    },
  ): Promise<Fee> {
    let calculatedAmount: number;
    if (data.flatAmount !== undefined) {
      calculatedAmount = data.flatAmount;
    } else if (data.rate !== undefined) {
      // Rate is applied to the payment amount — look it up
      const payment = await this.db.payment.findUnique({ where: { id: paymentId } });
      const baseAmount = payment ? Number(payment.amount) : 0;
      calculatedAmount = Math.round(baseAmount * data.rate * 100) / 100;
    } else {
      calculatedAmount = 0;
    }

    const fee = await this.db.fee.create({
      data: {
        storeId,
        paymentId,
        type: data.type as never,
        rate: data.rate !== undefined ? data.rate : null,
        flatAmount: data.flatAmount !== undefined ? data.flatAmount : null,
        calculatedAmount,
        currency: data.currency as never,
        status: 'PENDING',
        providerFee: data.providerFee !== undefined ? data.providerFee : null,
      },
    });

    logger.info('fee.calculated', {
      feeId: fee.id,
      paymentId,
      type: data.type,
      amount: calculatedAmount,
    });

    return fee;
  }

  async process(feeId: string): Promise<Fee> {
    const fee = await this.db.fee.findUnique({ where: { id: feeId } });
    if (!fee) throw new NotFoundError('Fee');
    if (fee.status !== 'PENDING') throw new NotFoundError(`Fee is already ${fee.status}`);

    const updated = await this.db.fee.update({
      where: { id: feeId },
      data: { status: 'CHARGED', settledAt: new Date() },
    });

    logger.info('fee.processed', { feeId, amount: fee.calculatedAmount });
    return updated;
  }

  async waive(feeId: string, reason?: string): Promise<Fee> {
    const fee = await this.db.fee.findUnique({ where: { id: feeId } });
    if (!fee) throw new NotFoundError('Fee');

    const updated = await this.db.fee.update({
      where: { id: feeId },
      data: {
        status: 'WAIVED',
        meta: { ...(fee.meta as object), waivedReason: reason ?? 'Platform waiver' },
      },
    });

    logger.info('fee.waived', { feeId, reason });
    return updated;
  }

  async getStoreSummary(storeId: string): Promise<{
    totalCharged: number;
    totalWaived: number;
    chargedAmount: number;
    waivedAmount: number;
  }> {
    const [chargedCount, waivedCount, chargedSum, waivedSum] = await Promise.all([
      this.db.fee.count({ where: { storeId, status: 'CHARGED' } }),
      this.db.fee.count({ where: { storeId, status: 'WAIVED' } }),
      this.db.fee.aggregate({ where: { storeId, status: 'CHARGED' }, _sum: { calculatedAmount: true } }),
      this.db.fee.aggregate({ where: { storeId, status: 'WAIVED' }, _sum: { calculatedAmount: true } }),
    ]);

    return {
      totalCharged: chargedCount,
      totalWaived: waivedCount,
      chargedAmount: Number(chargedSum._sum.calculatedAmount ?? 0),
      waivedAmount: Number(waivedSum._sum.calculatedAmount ?? 0),
    };
  }
}

export const feesService = new FeesService();
