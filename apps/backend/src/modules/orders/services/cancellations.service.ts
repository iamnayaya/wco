import type { Order, OrderCancellation } from '@prisma/client';
import { ConflictError, NotFoundError } from '@wco/shared';

import { prisma } from '../../../lib/prisma.js';

import { requireOrder } from './shared.js';

/**
 * Terminal cancellation record (one per order). Creation drives the order
 * through the CANCELLED transition and returns reserved stock; `restocked`
 * records whether inventory was returned so merchants can audit shrinkage.
 */
export class OrderCancellationService {
  async create(storeId: string, orderId: string, reason: string, actorId: string | null): Promise<{ order: Order; cancellation: OrderCancellation }> {
    const existing = await prisma.orderCancellation.findMany({ where: { orderId }, take: 1 });
    if (existing.length > 0) throw new ConflictError('Order is already cancelled');

    const order = await requireOrder(storeId, orderId);
    if (order.status === 'DELIVERED') throw new ConflictError('Delivered orders cannot be cancelled - issue a refund instead');
    if (order.status === 'CANCELLED') throw new ConflictError('Order is already cancelled');
    if (order.status === 'REFUNDED') throw new ConflictError('Refunded orders cannot be cancelled');

    const cancellation = await prisma.orderCancellation.create({
      data: { storeId, orderId, reason, restocked: false, actorId },
    });
    const now = new Date();
    const updated = await prisma.order.update({
      where: { id: order.id },
      data: { status: 'CANCELLED', cancelledAt: now, cancellationReason: reason },
    });
    await prisma.orderStatusHistory.create({
      data: { orderId: order.id, fromStatus: order.status, toStatus: 'CANCELLED', reason, actorId },
    });
    return { order: updated, cancellation };
  }

  async list(storeId: string, orderId: string): Promise<OrderCancellation[]> {
    await requireOrder(storeId, orderId);
    return prisma.orderCancellation.findMany({ where: { orderId } });
  }

  async getOwned(storeId: string, orderId: string, cancellationId: string): Promise<OrderCancellation> {
    await requireOrder(storeId, orderId);
    const rows = await prisma.orderCancellation.findMany({ where: { id: cancellationId, orderId }, take: 1 });
    const row = rows.at(0);
    if (!row) throw new NotFoundError('Cancellation');
    return row;
  }

  /** Reason correction only - the financial facts are immutable. */
  async updateReason(storeId: string, orderId: string, cancellationId: string, reason: string): Promise<OrderCancellation> {
    const cancellation = await this.getOwned(storeId, orderId, cancellationId);
    return prisma.orderCancellation.update({ where: { id: cancellation.id }, data: { reason } });
  }

  async remove(storeId: string, orderId: string, cancellationId: string): Promise<void> {
    const cancellation = await this.getOwned(storeId, orderId, cancellationId);
    await prisma.orderCancellation.delete({ where: { id: cancellation.id } });
  }

  /**
   * Marks the reserved stock as returned. The physical restock itself is
   * handled by the inventory module when goods land back on the shelf; this
   * flag closes the audit loop.
   */
  async process(
    storeId: string,
    orderId: string,
    cancellationId: string,
    actorId: string | null,
  ): Promise<OrderCancellation> {
    const cancellation = await this.getOwned(storeId, orderId, cancellationId);
    if (cancellation.restocked) return cancellation;
    await restoreStock(orderId);
    const updated = await prisma.orderCancellation.update({
      where: { id: cancellation.id },
      data: { restocked: true, actorId: actorId ?? cancellation.actorId },
    });
    return updated;
  }
}

/** Returns reserved units for line items that decremented the catalog. */
async function restoreStock(orderId: string): Promise<void> {
  const items = await prisma.orderItem.findMany({ where: { orderId } });
  for (const item of items) {
    const productRows = await prisma.product.findMany({ where: { id: item.productId }, take: 1 });
    const product = productRows.at(0);
    if (!product || !product.trackStock) continue;
    await prisma.product.updateMany({
      where: { id: item.productId },
      data: { stockQuantity: { increment: item.quantity }, status: 'ACTIVE' },
    });
  }
}

export const orderCancellationService = new OrderCancellationService();
