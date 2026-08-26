import { randomBytes } from 'node:crypto';

import type { Order, Payment } from '@prisma/client';
import { buildPaymentProviders, type PaymentProvider } from '@wco/payments';
import { NotFoundError, PaymentFailedError, ValidationError } from '@wco/shared';

import { logger } from '../lib/logger.js';
import { prisma } from '../lib/prisma.js';

/**
 * Payments service — PSP-agnostic orchestration on top of @wco/payments.
 *
 * Flow:
 *   initialize(orderId, provider) -> checkoutUrl (Payment row INITIALIZED)
 *   webhook(rawBody, signature)   -> verified -> SUCCEEDED/FAILED (idempotent
 *                                    by providerReference unique constraint)
 *   verify(reference)             -> pull provider truth & reconcile (used by
 *                                    clients when webhooks are delayed)
 *
 * On SUCCESS the order transitions to PAID inside one transaction and the
 * customer lifetime stats recompute; WhatsApp confirmation is enqueued by the
 * outbox relay worker, keeping this path synchronous-fast.
 */

const PROVIDER_BY_NAME: Record<string, PaymentProvider> = buildPaymentProviders();

function provider(name: string): PaymentProvider {
  const found = PROVIDER_BY_NAME[name] as PaymentProvider | undefined;
  if (!found) throw new ValidationError(`Payment provider ${name} is not configured`);
  return found;
}

export class PaymentsService {
  constructor(private readonly db: typeof prisma = prisma) {}

  listConfigured(): string[] {
    return Object.keys(PROVIDER_BY_NAME);
  }

  // ---------------------------------------------------------------------------
  // Initialize checkout
  // ---------------------------------------------------------------------------

  async initialize(
    storeId: string,
    orderId: string,
    providerName: string,
  ): Promise<{ payment: Payment; checkoutUrl: string }> {
    const psp = provider(providerName);
    const order = await this.db.order.findFirst({
      where: { id: orderId, storeId },
      include: { customer: true },
    });
    if (!order) throw new NotFoundError('Order');
    if (['PAID', 'REFUNDED', 'CANCELLED'].includes(order.status)) {
      throw new ValidationError(`Order is already ${order.status}`);
    }

    const reference = `wco_${order.orderNumber}_${randomBytes(6).toString('hex')}`;
    const result = await psp.initialize({
      reference,
      amount: Number(order.total),
      currency: order.currency,
      email: order.customer.email ?? undefined,
      customerPhone: order.customer.waPhone,
      metadata: { orderId: order.id, orderNumber: order.orderNumber, storeId },
    });

    const payment = await this.db.payment.upsert({
      where: { orderId: order.id },
      create: {
        storeId,
        orderId: order.id,
        provider: providerName as never,
        providerReference: result.providerReference,
        amount: order.total,
        currency: order.currency,
        status: 'INITIALIZED',
        checkoutUrl: result.checkoutUrl,
      },
      update: {
        provider: providerName as never,
        providerReference: result.providerReference,
        status: 'INITIALIZED',
        checkoutUrl: result.checkoutUrl,
      },
    });

    await this.db.order.update({
      where: { id: order.id },
      data: { paymentReference: result.providerReference },
    });

    await this.logTransaction(payment.id, payment.providerReference, 'INITIALIZED', payment.amount, 0, payment.currency);

    return { payment, checkoutUrl: result.checkoutUrl };
  }

  // ---------------------------------------------------------------------------
  // Direct send (no order context)
  // ---------------------------------------------------------------------------

  async sendDirect(
    storeId: string,
    data: {
      recipientPhone: string;
      amount: number;
      currency?: string;
      provider: string;
      description?: string;
      metadata?: Record<string, unknown>;
      conversationId?: string;
    },
  ): Promise<{ payment: Payment; checkoutUrl: string }> {
    const psp = provider(data.provider);
    const reference = `wco_direct_${randomBytes(8).toString('hex')}`;

    const result = await psp.initialize({
      reference,
      amount: data.amount,
      currency: data.currency ?? 'NGN',
      customerPhone: data.recipientPhone,
      metadata: { ...data.metadata, storeId, direct: true, description: data.description },
    });

    const payment = await this.db.payment.create({
      data: {
        storeId,
        provider: data.provider as never,
        providerReference: result.providerReference,
        amount: data.amount,
        currency: (data.currency as never) ?? 'NGN',
        status: 'INITIALIZED',
        checkoutUrl: result.checkoutUrl,
        meta: { direct: true, recipientPhone: data.recipientPhone, description: data.description, conversationId: data.conversationId },
      },
    });

    await this.logTransaction(payment.id, payment.providerReference, 'INITIALIZED', payment.amount, 0, payment.currency);

    return { payment, checkoutUrl: result.checkoutUrl };
  }

  // ---------------------------------------------------------------------------
  // Generate payment link (custom amount, no order)
  // ---------------------------------------------------------------------------

  async generatePaymentLink(
    storeId: string,
    data: {
      amount: number;
      currency?: string;
      provider: string;
      customerPhone?: string;
      customerEmail?: string;
      description?: string;
      expiresInMinutes?: number;
      metadata?: Record<string, unknown>;
    },
  ): Promise<{ payment: Payment; checkoutUrl: string }> {
    const psp = provider(data.provider);
    const reference = `wco_link_${randomBytes(8).toString('hex')}`;

    const result = await psp.initialize({
      reference,
      amount: data.amount,
      currency: data.currency ?? 'NGN',
      email: data.customerEmail,
      customerPhone: data.customerPhone ?? 'unknown',
      metadata: { ...data.metadata, storeId, link: true, description: data.description },
    });

    const payment = await this.db.payment.create({
      data: {
        storeId,
        provider: data.provider as never,
        providerReference: result.providerReference,
        amount: data.amount,
        currency: (data.currency as never) ?? 'NGN',
        status: 'INITIALIZED',
        checkoutUrl: result.checkoutUrl,
        meta: { link: true, description: data.description, expiresInMinutes: data.expiresInMinutes },
      },
    });

    await this.logTransaction(payment.id, payment.providerReference, 'INITIALIZED', payment.amount, 0, payment.currency);

    return { payment, checkoutUrl: result.checkoutUrl };
  }

  // ---------------------------------------------------------------------------
  // Webhook ingestion
  // ---------------------------------------------------------------------------

  async handleWebhook(
    providerName: string,
    rawBody: Buffer,
    signature: string,
  ): Promise<Payment | null> {
    const psp = provider(providerName);
    if (!psp.verifyWebhookSignature(rawBody, signature)) {
      throw new ValidationError('Invalid webhook signature');
    }

    const event = JSON.parse(rawBody.toString('utf8')) as {
      reference?: string;
      status?: string;
      amount?: number;
    };
    const reference = event.reference;
    if (!reference) return null;

    const existing = await this.db.payment.findFirst({ where: { providerReference: reference } });
    if (!existing) {
      logger.warn('payments.webhook.unknown-reference', { providerName, reference });
      return null;
    }
    if (existing.status === 'SUCCEEDED' || existing.status === 'FAILED') {
      return existing;
    }

    const verification = await psp.verify(reference);
    return this.reconcile(existing.id, verification);
  }

  // ---------------------------------------------------------------------------
  // Manual verify
  // ---------------------------------------------------------------------------

  async verify(storeId: string, paymentId: string): Promise<Payment> {
    const payment = await this.db.payment.findFirst({ where: { id: paymentId, storeId } });
    if (!payment) throw new NotFoundError('Payment');
    if (payment.status === 'SUCCEEDED') return payment;

    const psp = provider(payment.provider);
    const verification = await psp.verify(payment.providerReference);
    return this.reconcile(payment.id, verification);
  }

  // ---------------------------------------------------------------------------
  // Refund
  // ---------------------------------------------------------------------------

  async refund(storeId: string, paymentId: string, amount?: number, reason?: string): Promise<Payment> {
    const payment = await this.db.payment.findFirst({ where: { id: paymentId, storeId } });
    if (!payment) throw new NotFoundError('Payment');
    if (payment.status !== 'SUCCEEDED') throw new ValidationError('Only successful payments can be refunded');

    const psp = provider(payment.provider);
    const refundResult = await psp.refund(payment.providerReference, amount);
    if (!refundResult.accepted) throw new PaymentFailedError('Refund rejected by provider');

    await this.db.orderRefund.create({
      data: {
        storeId,
        orderId: payment.orderId ?? '',
        amount: amount ? amount : Number(payment.amount),
        reason: reason ?? 'Refund requested',
        status: 'PROCESSING',
        providerReference: refundResult.refundReference,
      },
    });

    const refunded = await this.db.payment.update({
      where: { id: paymentId },
      data: { status: 'REFUNDED', refundedAt: new Date() },
    });

    if (payment.orderId) {
      await this.db.order.update({
        where: { id: payment.orderId },
        data: { status: 'REFUNDED' },
      });
    }

    await this.logTransaction(paymentId, payment.providerReference, 'REFUNDED', payment.amount, 0, payment.currency, { refundReason: reason, refundAmount: amount });

    return refunded;
  }

  // ---------------------------------------------------------------------------
  // Reconciliation (single transaction)
  // ---------------------------------------------------------------------------

  async reconcile(
    paymentId: string,
    verification: { readonly status: string; readonly amountPaid: number; readonly failureReason?: string; readonly fee?: number; readonly paidAt?: Date },
  ): Promise<Payment> {
    return this.db.$transaction(async (tx) => {
      const payment = await tx.payment.findUniqueOrThrow({ where: { id: paymentId }, include: { order: true } });

      const succeeded = verification.status === 'SUCCEEDED';
      const updated = await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: succeeded ? 'SUCCEEDED' : verification.status === 'PENDING' ? 'PENDING' : 'FAILED',
          fee: verification.fee ?? payment.fee,
          paidAt: succeeded ? (verification.paidAt ?? new Date()) : null,
          failureReason: succeeded ? null : (verification.failureReason ?? 'unknown'),
        },
      });

      if (succeeded && payment.order && payment.order.status === 'PENDING_PAYMENT') {
        await tx.order.update({
          where: { id: payment.order.id },
          data: { status: 'PAID', paidAt: new Date(), paymentReference: payment.providerReference },
        });
        await tx.customer.update({
          where: { id: payment.order.customerId },
          data: {
            totalSpent: { increment: Number(payment.amount) },
            ordersCount: { increment: 1 },
            lastOrderAt: new Date(),
          },
        });
        await tx.outboxEvent.create({
          data: {
            aggregateType: 'payment',
            aggregateId: payment.id,
            eventType: 'payment.succeeded',
            payload: {
              storeId: payment.storeId,
              paymentId: payment.id,
              orderId: payment.orderId,
              orderNumber: payment.order.orderNumber,
              amount: Number(payment.amount),
              currency: payment.currency,
            },
          },
        });

        // --- Commission & Fee calculation on payment success ---
        const amount = Number(payment.amount);
        const COMMISSION_RATE = 0.02; // 2% platform commission
        const commissionAmount = Math.round(amount * COMMISSION_RATE * 100) / 100;

        await tx.commission.create({
          data: {
            storeId: payment.storeId,
            paymentId: payment.id,
            rate: COMMISSION_RATE,
            amount: commissionAmount,
            currency: payment.currency,
            status: 'PENDING',
          },
        });

        // Record the PSP processing fee if provided
        if (verification.fee && verification.fee > 0) {
          await tx.fee.create({
            data: {
              storeId: payment.storeId,
              paymentId: payment.id,
              type: 'PROCESSING',
              calculatedAmount: verification.fee,
              providerFee: verification.fee,
              currency: payment.currency,
              status: 'CHARGED',
              settledAt: new Date(),
            },
          });
        }
      }

      await this.logTransaction(paymentId, payment.providerReference, updated.status as never, payment.amount, verification.fee ?? 0, payment.currency, { gatewayResponse: verification.failureReason });

      return updated;
    });
  }

  // ---------------------------------------------------------------------------
  // Read operations
  // ---------------------------------------------------------------------------

  async getById(storeId: string, paymentId: string): Promise<Payment> {
    const payment = await this.db.payment.findFirst({ where: { id: paymentId, storeId } });
    if (!payment) throw new NotFoundError('Payment');
    return payment;
  }

  async getByOrderId(storeId: string, orderId: string): Promise<Payment | null> {
    return this.db.payment.findFirst({ where: { orderId, storeId } });
  }

  // ---------------------------------------------------------------------------
  // List (cursor-based, original)
  // ---------------------------------------------------------------------------

  async list(storeId: string, limit: number, cursor?: string): Promise<{ items: Payment[]; nextCursor: string | null }> {
    const items = await this.db.payment.findMany({
      where: { storeId, ...(cursor ? { id: { gt: Buffer.from(cursor, 'base64url').toString('utf8') } } : {}) },
      orderBy: { id: 'asc' },
      take: limit,
    });
    return {
      items,
      nextCursor: items.length === limit && items.length > 0
        ? Buffer.from(items[items.length - 1].id).toString('base64url')
        : null,
    };
  }

  // ---------------------------------------------------------------------------
  // List (offset-based, with filters)
  // ---------------------------------------------------------------------------

  buildWhereClause(storeId: string, q: Record<string, unknown>): Record<string, unknown> {
    const where: Record<string, unknown> = { storeId };

    if (q.status) where.status = q.status;
    if (q.provider) where.provider = q.provider;
    if (q.orderId) where.orderId = q.orderId;

    if (q.minAmount || q.maxAmount) {
      where.amount = {};
      if (q.minAmount) (where.amount as Record<string, unknown>).gte = Number(q.minAmount);
      if (q.maxAmount) (where.amount as Record<string, unknown>).lte = Number(q.maxAmount);
    }

    if (q.from || q.to) {
      where.createdAt = {};
      if (q.from) (where.createdAt as Record<string, unknown>).gte = new Date(String(q.from));
      if (q.to) (where.createdAt as Record<string, unknown>).lte = new Date(String(q.to));
    }

    return where;
  }

  async listOffset(
    storeId: string,
    where: Record<string, unknown>,
    page: number,
    pageSize: number,
    sortBy: string,
    sortOrder: string,
  ): Promise<Payment[]> {
    const validSortFields = ['createdAt', 'amount', 'paidAt', 'status'];
    const field = validSortFields.includes(sortBy) ? sortBy : 'createdAt';
    const order = sortOrder === 'asc' ? 'asc' : 'desc';

    return this.db.payment.findMany({
      where: where as never,
      orderBy: { [field]: order },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });
  }

  async count(where: Record<string, unknown>): Promise<number> {
    return this.db.payment.count({ where: where as never });
  }

  // ---------------------------------------------------------------------------
  // Search (by reference, order number, customer phone)
  // ---------------------------------------------------------------------------

  async search(storeId: string, query: string, page: number, pageSize: number): Promise<Payment[]> {
    return this.db.payment.findMany({
      where: {
        storeId,
        OR: [
          { providerReference: { contains: query, mode: 'insensitive' } },
          { checkoutUrl: { contains: query, mode: 'insensitive' } },
          { order: { orderNumber: { contains: query, mode: 'insensitive' } } },
          { order: { customer: { waPhone: { contains: query } } } },
          { order: { customer: { name: { contains: query, mode: 'insensitive' } } } },
        ],
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });
  }

  async searchCount(storeId: string, query: string): Promise<number> {
    return this.db.payment.count({
      where: {
        storeId,
        OR: [
          { providerReference: { contains: query, mode: 'insensitive' } },
          { checkoutUrl: { contains: query, mode: 'insensitive' } },
          { order: { orderNumber: { contains: query, mode: 'insensitive' } } },
          { order: { customer: { waPhone: { contains: query } } } },
          { order: { customer: { name: { contains: query, mode: 'insensitive' } } } },
        ],
      },
    });
  }

  // ---------------------------------------------------------------------------
  // Export
  // ---------------------------------------------------------------------------

  async exportData(where: Record<string, unknown>, format: string): Promise<string | Payment[]> {
    const items = await this.db.payment.findMany({
      where: where as never,
      orderBy: { createdAt: 'desc' },
      take: 10_000, // hard cap for exports
    });

    if (format === 'csv') {
      const header = 'id,orderId,provider,providerReference,amount,fee,currency,status,paidAt,refundedAt,createdAt';
      const rows = items.map((p) =>
        [p.id, p.orderId ?? '', p.provider, p.providerReference, p.amount, p.fee, p.currency, p.status, p.paidAt?.toISOString() ?? '', p.refundedAt?.toISOString() ?? '', p.createdAt.toISOString()].join(','),
      );
      return [header, ...rows].join('\n');
    }

    return items;
  }

  // ---------------------------------------------------------------------------
  // Stats
  // ---------------------------------------------------------------------------

  async stats(
    storeId: string,
    from?: Date,
    to?: Date,
    groupBy: string = 'day',
  ): Promise<Record<string, unknown>> {
    const dateFilter: Record<string, Date> = {};
    if (from) dateFilter.gte = from;
    if (to) dateFilter.lte = to;
    const hasDate = Boolean(from || to);

    const where = { storeId, ...(hasDate ? { createdAt: dateFilter } : {}) };

    const [
      totalPayments,
      succeededPayments,
      failedPayments,
      refundedPayments,
      totalAmount,
      totalFee,
      amountAggregate,
    ] = await Promise.all([
      this.db.payment.count({ where }),
      this.db.payment.count({ where: { ...where, status: 'SUCCEEDED' } }),
      this.db.payment.count({ where: { ...where, status: 'FAILED' } }),
      this.db.payment.count({ where: { ...where, status: 'REFUNDED' } }),
      this.db.payment.aggregate({ where: { ...where, status: 'SUCCEEDED' }, _sum: { amount: true } }),
      this.db.payment.aggregate({ where: { ...where, status: 'SUCCEEDED' }, _sum: { fee: true } }),
      this.db.payment.aggregate({ where: { ...where, status: 'SUCCEEDED' }, _avg: { amount: true } }),
    ]);

    const byProvider = await this.db.payment.groupBy({
      by: ['provider'],
      where: { ...where, status: 'SUCCEEDED' },
      _count: { id: true },
      _sum: { amount: true },
    });

    const byDay = await this.db.$queryRaw<Array<{ date: Date; count: bigint; total: bigint }>>`
      SELECT
        DATE("createdAt") as "date",
        COUNT(*)::int as "count",
        COALESCE(SUM(CASE WHEN "status" = 'SUCCEEDED' THEN "amount" ELSE 0 END), 0)::bigint as "total"
      FROM "payments"
      WHERE "storeId" = ${storeId}
        ${hasDate ? this.db.$queryRaw`AND "createdAt" >= ${dateFilter.gte!} AND "createdAt" <= ${dateFilter.lte!}` : this.db.$queryRaw``}
      GROUP BY DATE("createdAt")
      ORDER BY DATE("createdAt") ASC
    `;

    return {
      summary: {
        totalPayments,
        succeededPayments,
        failedPayments,
        refundedPayments,
        successRate: totalPayments > 0 ? Math.round((succeededPayments / totalPayments) * 10000) / 100 : 0,
        totalRevenue: Number(totalAmount._sum.amount ?? 0),
        totalFees: Number(totalFee._sum.fee ?? 0),
        avgPaymentAmount: Number(amountAggregate._avg.amount ?? 0),
      },
      byProvider: byProvider.map((p) => ({
        provider: p.provider,
        count: p._count.id,
        totalAmount: Number(p._sum.amount ?? 0),
      })),
      byDay: byDay.map((r) => ({
        date: r.date.toISOString().slice(0, 10),
        count: Number(r.count),
        total: Number(r.total),
      })),
    };
  }

  // ---------------------------------------------------------------------------
  // Refunds (list for a payment)
  // ---------------------------------------------------------------------------

  async listRefunds(
    storeId: string,
    paymentId: string,
    page: number,
    pageSize: number,
    sortBy: string,
    sortOrder: string,
  ): Promise<unknown[]> {
    const payment = await this.db.payment.findFirst({ where: { id: paymentId, storeId } });
    if (!payment) throw new NotFoundError('Payment');

    const field = ['createdAt', 'amount'].includes(sortBy) ? sortBy : 'createdAt';
    const order = sortOrder === 'asc' ? 'asc' : 'desc';

    return this.db.orderRefund.findMany({
      where: { orderId: payment.orderId ?? '' },
      orderBy: { [field]: order },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });
  }

  async countRefunds(storeId: string, paymentId: string): Promise<number> {
    const payment = await this.db.payment.findFirst({ where: { id: paymentId, storeId } });
    if (!payment) throw new NotFoundError('Payment');
    return this.db.orderRefund.count({ where: { orderId: payment.orderId ?? '' } });
  }

  // ---------------------------------------------------------------------------
  // Transactions (audit log)
  // ---------------------------------------------------------------------------

  async listTransactions(storeId: string, paymentId: string, page: number, pageSize: number): Promise<unknown[]> {
    const payment = await this.db.payment.findFirst({ where: { id: paymentId, storeId } });
    if (!payment) throw new NotFoundError('Payment');

    return this.db.paymentTransaction.findMany({
      where: { paymentId },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });
  }

  async countTransactions(storeId: string, paymentId: string): Promise<number> {
    const payment = await this.db.payment.findFirst({ where: { id: paymentId, storeId } });
    if (!payment) throw new NotFoundError('Payment');
    return this.db.paymentTransaction.count({ where: { paymentId } });
  }

  // ---------------------------------------------------------------------------
  // Internal: log a payment transaction (append-only audit)
  // ---------------------------------------------------------------------------

  private async logTransaction(
    paymentId: string,
    providerReference: string,
    status: string,
    amount: number | { toNumber: () => number },
    fee: number | { toNumber: () => number },
    currency: string,
    extra?: Record<string, unknown>,
  ): Promise<void> {
    try {
      await this.db.paymentTransaction.create({
        data: {
          paymentId,
          providerReference,
          status: status as never,
          amount: typeof amount === 'number' ? amount : amount.toNumber(),
          fee: typeof fee === 'number' ? fee : fee.toNumber(),
          currency: currency as never,
          metadata: extra ?? {},
        },
      });
    } catch (err) {
      // Audit log failure must never block the payment flow
      logger.warn('payments.transaction.log-failed', {
        paymentId,
        status,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
}

export type { Order };
export const paymentsService = new PaymentsService();
