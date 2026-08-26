import { randomBytes } from 'node:crypto';

import type { SubscriptionPayment } from '@prisma/client';
import { NotFoundError, PaymentFailedError } from '@wco/shared';

import { logger } from '../../../lib/logger.js';
import { prisma } from '../../../lib/prisma.js';

/**
 * SubscriptionPaymentsService — billing ledger for subscription charges.
 *
 * One row per charge attempt. On recurring billing, this creates the
 * record and invokes the PSP. Success/failure is reconciled via webhooks.
 */
export class SubscriptionPaymentsService {
  constructor(private readonly db: typeof prisma = prisma) {}

  async list(subscriptionId: string, page: number, pageSize: number): Promise<SubscriptionPayment[]> {
    return this.db.subscriptionPayment.findMany({
      where: { subscriptionId },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });
  }

  async count(subscriptionId: string): Promise<number> {
    return this.db.subscriptionPayment.count({ where: { subscriptionId } });
  }

  async getById(subscriptionId: string, id: string): Promise<SubscriptionPayment> {
    const payment = await this.db.subscriptionPayment.findFirst({
      where: { id, subscriptionId },
    });
    if (!payment) throw new NotFoundError('Subscription payment');
    return payment;
  }

  async create(
    subscriptionId: string,
    data: {
      amount: number;
      currency?: string;
      billingReason?: string;
      meta?: Record<string, unknown>;
    },
  ): Promise<SubscriptionPayment> {
    const invoiceNumber = `INV-${Date.now()}-${randomBytes(4).toString('hex').toUpperCase()}`;

    const payment = await this.db.subscriptionPayment.create({
      data: {
        subscriptionId,
        amount: data.amount,
        currency: (data.currency as never) ?? 'NGN',
        status: 'PENDING',
        billingReason: (data.billingReason as never) ?? 'RECURRING',
        invoiceNumber,
        meta: data.meta ?? {},
      },
    });

    logger.info('subscription-payment.created', {
      subscriptionPaymentId: payment.id,
      subscriptionId,
      amount: data.amount,
      billingReason: data.billingReason,
    });

    return payment;
  }

  async markSucceeded(id: string, providerReference: string): Promise<SubscriptionPayment> {
    const payment = await this.db.subscriptionPayment.findUnique({ where: { id } });
    if (!payment) throw new NotFoundError('Subscription payment');

    return this.db.subscriptionPayment.update({
      where: { id },
      data: {
        status: 'SUCCEEDED',
        providerReference,
        paidAt: new Date(),
      },
    });
  }

  async markFailed(id: string, reason: string): Promise<SubscriptionPayment> {
    const payment = await this.db.subscriptionPayment.findUnique({ where: { id } });
    if (!payment) throw new NotFoundError('Subscription payment');

    // Schedule retry with exponential backoff (1h, 4h, 24h)
    const attemptCount = ((payment.meta as Record<string, unknown>)?.retryCount as number) ?? 0;
    const backoffMs = [3600000, 14400000, 86400000][Math.min(attemptCount, 2)];

    return this.db.subscriptionPayment.update({
      where: { id },
      data: {
        status: 'FAILED',
        failureReason: reason,
        nextRetryAt: attemptCount < 3 ? new Date(Date.now() + backoffMs) : null,
        meta: {
          ...(payment.meta as object),
          retryCount: attemptCount + 1,
          lastFailureAt: new Date().toISOString(),
        },
      },
    });
  }

  async processPayment(subscriptionPaymentId: string): Promise<SubscriptionPayment> {
    const payment = await this.db.subscriptionPayment.findUnique({
      where: { id: subscriptionPaymentId },
      include: { subscription: { include: { plan: true } } },
    });
    if (!payment) throw new NotFoundError('Subscription payment');
    if (payment.status !== 'PENDING') throw new PaymentFailedError(`Payment is already ${payment.status}`);

    // In production, this invokes the PSP to charge the merchant's saved payment method.
    // For now, we simulate the PSP call and mark as succeeded.
    logger.info('subscription-payment.processing', {
      subscriptionPaymentId: payment.id,
      amount: payment.amount,
    });

    // Placeholder: actual PSP charge call would go here
    return this.markSucceeded(payment.id, `psp_${randomBytes(8).toString('hex')}`);
  }

  async listPendingRetries(): Promise<SubscriptionPayment[]> {
    return this.db.subscriptionPayment.findMany({
      where: {
        status: 'FAILED',
        nextRetryAt: { lte: new Date() },
      },
      include: { subscription: true },
      take: 50,
    });
  }
}

export const subscriptionPaymentsService = new SubscriptionPaymentsService();
