import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import type { PaymentProvider, ProviderRegistry } from '@wco/payments';
import { buildPaymentProviders } from '@wco/payments';
import { PrismaService } from '@wco/database';
import { OrdersEventPublisher } from '../orders/orders.event-publisher';
import { TenantContext } from '../../common/context/tenant-context';

/**
 * PaymentsService — payment link lifecycle.
 *
 * Flow: merchant requests link for order -> provider.initialize ->
 * row persisted with providerReference -> customer pays on checkout_url ->
 * PSP webhook hits webhook-handler -> verify + idempotent confirmPayment.
 *
 * The webhook path is authoritative; this service also exposes manual
 * verification for "customer says they paid" support flows.
 */
@Injectable()
export class PaymentsService {
  private readonly registry: ProviderRegistry;

  constructor(
    private readonly prisma: PrismaService,
    private readonly events: OrdersEventPublisher,
  ) {
    this.registry = buildPaymentProviders();
  }

  listConfigured(): Array<{ name: string }> {
    return Object.values(this.registry)
      .filter((p): p is PaymentProvider => Boolean(p))
      .map((p) => ({ name: p.name }));
  }

  async createLink(orderId: string, providerName = 'PAYSTACK') {
    const { storeId } = TenantContext.require();
    const provider = this.registry[providerName];
    if (!provider) throw new BadRequestException(`Payment provider ${providerName} not configured`);

    const order = await this.prisma.order.findFirst({
      where: { id: orderId, storeId },
      include: {
        customer: { select: { waPhone: true, name: true, email: true } },
        store: { select: { currency: true, name: true } },
      },
    });
    if (!order) throw new NotFoundException('Order not found');
    if (order.status !== 'PENDING_PAYMENT') {
      throw new BadRequestException(`Order is already ${order.status}`);
    }

    // Our reference — deterministic retry-safety lives in the PSP reference
    const reference = `WCO-${randomBytes(6).toString('hex').toUpperCase()}`;
    const result = await provider.initialize({
      reference,
      amount: Number(order.total),
      currency: order.currency,
      email: order.customer.email ?? undefined,
      customerPhone: order.customer.waPhone,
      customerName: order.customer.name ?? undefined,
      metadata: { orderNumber: order.orderNumber, storeId },
    });

    await this.prisma.payment.create({
      data: {
        storeId,
        orderId: order.id,
        provider: providerName as never,
        providerReference: result.providerReference,
        amount: order.total,
        currency: order.currency,
        status: 'INITIALIZED',
        checkoutUrl: result.checkoutUrl,
      },
    });
    await this.prisma.order.update({
      where: { id: order.id },
      data: { paymentReference: reference },
    });

    return {
      paymentReference: reference,
      checkoutUrl: result.checkoutUrl,
      amount: Number(order.total),
      currency: order.currency,
    };
  }

  /** Support flow: poll PSP for truth when webhook hasn't arrived. */
  async verify(paymentReference: string) {
    const { storeId } = TenantContext.require();
    const payment = await this.prisma.payment.findFirst({
      where: { OR: [{ providerReference: paymentReference }, { orderId: paymentReference }], storeId },
    });
    if (!payment) throw new NotFoundException('Payment not found');

    const provider = this.registry[payment.provider as string];
    if (!provider) throw new BadRequestException('Provider no longer configured');

    const verified = await provider.verify(payment.providerReference);
    await this.prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: verified.status,
        fee: verified.fee != null ? verified.fee : undefined,
        paidAt: verified.paidAt ?? undefined,
        failureReason: verified.failureReason ?? undefined,
      },
    });

    if (verified.status === 'SUCCEEDED' && payment.orderId) {
      await this.confirmOrderPaid(payment.orderId, payment.providerReference);
    }
    return verified;
  }

  async refund(orderId: string) {
    const { storeId } = TenantContext.require();
    const payment = await this.prisma.payment.findFirst({
      where: { orderId, storeId, status: 'SUCCEEDED' },
    });
    if (!payment) throw new NotFoundException('No successful payment found for this order');

    const provider = this.registry[payment.provider as string];
    const refund = await provider.refund(payment.providerReference);

    if (refund.accepted) {
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: { status: 'REFUNDED', refundedAt: new Date() },
      });
      await this.events.emit({
        aggregateType: 'payment',
        aggregateId: payment.id,
        storeId,
        eventType: 'payment.refunded',
        payload: { orderId, providerReference: payment.providerReference },
      });
    }
    return refund;
  }

  async list(params: { cursor?: string; limit?: number }) {
    const { storeId } = TenantContext.require();
    const limit = Math.min(params.limit ?? 25, 100);
    const items = await this.prisma.payment.findMany({
      where: { storeId },
      take: limit + 1,
      cursor: params.cursor ? { id: params.cursor } : undefined,
      orderBy: [{ initializedAt: 'desc' }, { id: 'asc' }],
      select: {
        id: true, provider: true, amount: true, fee: true, status: true,
        checkoutUrl: true, paidAt: true, initializedAt: true,
        order: { select: { orderNumber: true, id: true } },
      },
    });
    const hasNext = items.length > limit;
    return { items: hasNext ? items.slice(0, -1) : items, nextCursor: hasNext ? items[items.length - 2]?.id ?? null : null };
  }

  /** Idempotent state transition — shared with webhook-handler flow. */
  private async confirmOrderPaid(orderId: string, paymentReference: string) {
    const { storeId } = TenantContext.require();
    const result = await this.prisma.order.updateMany({
      where: { id: orderId, storeId, status: 'PENDING_PAYMENT' },
      data: { status: 'PAID', paidAt: new Date() },
    });
    if (result.count > 0) {
      await this.events.emit({
        aggregateType: 'payment',
        aggregateId: orderId,
        storeId,
        eventType: 'payment.succeeded',
        payload: { orderId, paymentReference },
      });
    }
  }
}
