import type { Order, OrderRefund } from '@prisma/client';
import { ConflictError, NotFoundError, ValidationError } from '@wco/shared';

import { prisma } from '../../../lib/prisma.js';

import { requireOrder } from './shared.js';

/**
 * Money-back flow. Refunds are created PENDING, processed through the payment
 * provider seam (`processRefund`), and only when the SUCCEEDED amount covers
 * the full payable does the order itself flip to REFUNDED via the state
 * machine - partial refunds leave the order untouched.
 */
export class OrderRefundService {
  async create(
    storeId: string,
    orderId: string,
    data: { amount: number; reason?: string },
    actorId: string | null,
  ): Promise<OrderRefund> {
    const order = await requireOrder(storeId, orderId);
    if (order.status === 'PENDING_PAYMENT') {
      throw new ConflictError('Nothing to refund before payment');
    }
    const refunded = await this.succeededTotal(order.id);
    const payable = Number(order.total) - Number(order.deliveryFee) * 0; // total already includes fee
    if (data.amount > payable - refunded + 1e-9) {
      throw new ValidationError(`Refund exceeds refundable balance (${round2(payable - refunded)})`);
    }
  return prisma.orderRefund.create({
    data: {
      storeId,
      orderId,
      amount: data.amount,
      status: 'PENDING',
      reason: data.reason ?? null,
      actorId,
    },
  });
  }

  async list(storeId: string, orderId: string): Promise<OrderRefund[]> {
    await requireOrder(storeId, orderId);
    return prisma.orderRefund.findMany({ where: { orderId }, orderBy: [{ createdAt: 'asc' }] });
  }

  async getOwned(storeId: string, orderId: string, refundId: string): Promise<OrderRefund> {
    await requireOrder(storeId, orderId);
    const rows = await prisma.orderRefund.findMany({ where: { id: refundId, orderId }, take: 1 });
    const refund = rows.at(0);
    if (!refund) throw new NotFoundError('Refund');
    return refund;
  }

  async update(
    storeId: string,
    orderId: string,
    refundId: string,
    patch: { amount?: number; reason?: string },
  ): Promise<OrderRefund> {
    const refund = await this.getOwned(storeId, orderId, refundId);
    assertMutable(refund);
    return prisma.orderRefund.update({
      where: { id: refund.id },
      data: {
        ...(patch.amount !== undefined ? { amount: patch.amount } : {}),
        ...(patch.reason !== undefined ? { reason: patch.reason } : {}),
      },
    });
  }

  async remove(storeId: string, orderId: string, refundId: string): Promise<void> {
    const refund = await this.getOwned(storeId, orderId, refundId);
    assertMutable(refund);
    await prisma.orderRefund.delete({ where: { id: refund.id } });
  }

  /**
   * Runs a PENDING refund through the provider seam. The transport here is a
   * controlled stub (env-gated failure) until the PSP refund API lands; the
   * ledger semantics around it are production behavior.
   */
  async process(
    storeId: string,
    orderId: string,
    refundId: string,
    actorId: string | null,
  ): Promise<{ refund: OrderRefund; order: Order }> {
    const order = await requireOrder(storeId, orderId);
    const refund = await this.getOwned(storeId, orderId, refundId);
    assertMutable(refund);

    let updated = await prisma.orderRefund.update({
      where: { id: refund.id },
      data: { status: 'PROCESSING' },
    });

    if (process.env.PAYMENT_REFUND_PUSH === 'fail') {
      updated = await prisma.orderRefund.update({
        where: { id: refund.id },
        data: { status: 'FAILED', reason: 'Provider rejected the refund', processedAt: new Date() },
      });
      return { refund: updated, order };
    }

    updated = await prisma.orderRefund.update({
      where: { id: refund.id },
      data: {
        status: 'SUCCEEDED',
        processedAt: new Date(),
        providerReference: `rfnd_${refund.id}`,
        actorId: actorId ?? refund.actorId,
      },
    });

    // Full coverage -> drive the order through the REFUNDED transition.
    const succeeded = await this.succeededTotal(order.id);
    if (succeeded >= Number(order.total) - 1e-9 && order.status !== 'REFUNDED' && order.status !== 'CANCELLED') {
      const refreshed = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
      const driven = await prisma.order.update({
        where: { id: order.id },
        data: { status: 'REFUNDED' },
      });
      await prisma.orderStatusHistory.create({
        data: {
          orderId: order.id,
          fromStatus: refreshed.status,
          toStatus: 'REFUNDED',
          reason: `Full refund ${refund.id}`,
          actorId,
        },
      });
      return { refund: updated, order: driven };
    }
    return { refund: updated, order };
  }

  private async succeededTotal(orderId: string): Promise<number> {
    const refunds = await prisma.orderRefund.findMany({ where: { orderId, status: 'SUCCEEDED' } });
    return refunds.reduce((sum, r) => sum + Number(r.amount), 0);
  }
}

function assertMutable(refund: OrderRefund): void {
  if (refund.status !== 'PENDING') {
    throw new ConflictError(`Refund is ${refund.status} and can no longer be modified`);
  }
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export const orderRefundService = new OrderRefundService();
