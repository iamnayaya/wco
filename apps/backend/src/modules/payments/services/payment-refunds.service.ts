import type { OrderRefund } from '@prisma/client';
import { NotFoundError, ValidationError, PaymentFailedError } from '@wco/shared';

import { logger } from '../../../lib/logger.js';
import { prisma } from '../../../lib/prisma.js';

/**
 * PaymentRefundsService — dedicated refund management.
 *
 * Wraps the existing OrderRefund table with richer CRUD, PSP integration,
 * and status tracking. Supports full and partial refunds.
 */
export class PaymentRefundsService {
  constructor(private readonly db: typeof prisma = prisma) {}

  async list(
    storeId: string,
    paymentId: string,
    opts: {
      page: number;
      pageSize: number;
      status?: string;
      sortBy: string;
      sortOrder: string;
    },
  ): Promise<OrderRefund[]> {
    await this.verifyPaymentOwnership(storeId, paymentId);
    const payment = await this.db.payment.findFirst({ where: { id: paymentId, storeId } });
    if (!payment) throw new NotFoundError('Payment');

    const where: Record<string, unknown> = { orderId: payment.orderId ?? '' };
    if (opts.status) where.status = opts.status;

    const sortField = ['createdAt', 'amount'].includes(opts.sortBy) ? opts.sortBy : 'createdAt';
    const order = opts.sortOrder === 'asc' ? 'asc' : 'desc';

    return this.db.orderRefund.findMany({
      where: where as never,
      orderBy: { [sortField]: order },
      skip: (opts.page - 1) * opts.pageSize,
      take: opts.pageSize,
    });
  }

  async count(storeId: string, paymentId: string): Promise<number> {
    const payment = await this.db.payment.findFirst({ where: { id: paymentId, storeId } });
    if (!payment) throw new NotFoundError('Payment');
    return this.db.orderRefund.count({ where: { orderId: payment.orderId ?? '' } });
  }

  async getById(storeId: string, paymentId: string, refundId: string): Promise<OrderRefund> {
    await this.verifyPaymentOwnership(storeId, paymentId);
    const refund = await this.db.orderRefund.findFirst({ where: { id: refundId } });
    if (!refund) throw new NotFoundError('Refund');
    return refund;
  }

  async create(
    storeId: string,
    paymentId: string,
    data: { amount?: number; reason?: string; metadata?: Record<string, unknown> },
  ): Promise<OrderRefund> {
    const payment = await this.db.payment.findFirst({ where: { id: paymentId, storeId } });
    if (!payment) throw new NotFoundError('Payment');
    if (payment.status !== 'SUCCEEDED') throw new ValidationError('Only successful payments can be refunded');

    const refundAmount = data.amount ?? Number(payment.amount);
    if (refundAmount > Number(payment.amount)) {
      throw new ValidationError('Refund amount cannot exceed payment amount');
    }

    // Check total refunded amount for partial refunds
    const existingRefunds = await this.db.orderRefund.aggregate({
      where: { orderId: payment.orderId ?? '', status: { in: ['SUCCEEDED', 'PROCESSING', 'PENDING'] } },
      _sum: { amount: true },
    });
    const totalRefunded = Number(existingRefunds._sum.amount ?? 0);
    if (totalRefunded + refundAmount > Number(payment.amount)) {
      throw new ValidationError(`Total refund amount would exceed payment amount. Already refunded: ${totalRefunded}`);
    }

    const refund = await this.db.orderRefund.create({
      data: {
        storeId,
        orderId: payment.orderId ?? '',
        amount: refundAmount,
        reason: data.reason ?? 'Refund requested',
        status: 'PENDING',
        actorId: null,
      },
    });

    logger.info('refund.created', {
      refundId: refund.id,
      paymentId,
      amount: refundAmount,
      reason: data.reason,
    });

    return refund;
  }

  async process(storeId: string, paymentId: string, refundId: string): Promise<OrderRefund> {
    await this.verifyPaymentOwnership(storeId, paymentId);
    const refund = await this.db.orderRefund.findFirst({ where: { id: refundId, orderId: { not: '' } } });
    if (!refund) throw new NotFoundError('Refund');
    if (refund.status !== 'PENDING') throw new ValidationError(`Refund is already ${refund.status}`);

    const payment = await this.db.payment.findFirst({ where: { id: paymentId } });
    if (!payment) throw new NotFoundError('Payment');

    // Build a dynamic import for the payments provider
    const { buildPaymentProviders } = await import('@wco/payments');
    const providers = buildPaymentProviders();
    const psp = providers[payment.provider as string];
    if (!psp) throw new ValidationError(`Payment provider ${payment.provider} is not configured`);

    const result = await psp.refund(payment.providerReference, refund.amount);

    if (!result.accepted) {
      await this.db.orderRefund.update({
        where: { id: refundId },
        data: { status: 'FAILED' },
      });
      throw new PaymentFailedError('Refund rejected by payment provider');
    }

    const updated = await this.db.orderRefund.update({
      where: { id: refundId },
      data: {
        status: 'PROCESSING',
        providerReference: result.refundReference ?? null,
      },
    });

    logger.info('refund.processing', {
      refundId,
      paymentId,
      providerReference: result.refundReference,
    });

    return updated;
  }

  async cancel(storeId: string, paymentId: string, refundId: string): Promise<OrderRefund> {
    await this.verifyPaymentOwnership(storeId, paymentId);
    const refund = await this.db.orderRefund.findFirst({ where: { id: refundId } });
    if (!refund) throw new NotFoundError('Refund');
    if (refund.status !== 'PENDING') throw new ValidationError('Only pending refunds can be cancelled');

    const updated = await this.db.orderRefund.update({
      where: { id: refundId },
      data: { status: 'FAILED', reason: `Cancelled: ${refund.reason}` },
    });

    logger.info('refund.cancelled', { refundId, paymentId });
    return updated;
  }

  private async verifyPaymentOwnership(storeId: string, paymentId: string): Promise<void> {
    const payment = await this.db.payment.findFirst({ where: { id: paymentId, storeId } });
    if (!payment) throw new NotFoundError('Payment');
  }
}

export const paymentRefundsService = new PaymentRefundsService();
