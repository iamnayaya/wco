import type { Order, OrderStatus, OrderStatusHistory } from '@prisma/client';
import { NotFoundError } from '@wco/shared';

import { prisma } from '../../../lib/prisma.js';

/**
 * Append-only status history. Every transition (manual or system) appends one
 * row; the timeline endpoint reads these straight - rows are never updated.
 */
export class OrderStatusHistoryService {
  async create(
    storeId: string,
    orderId: string,
    data: { fromStatus: OrderStatus; toStatus: OrderStatus; reason?: string | null; actorId?: string | null },
  ): Promise<OrderStatusHistory> {
    await this.requireOwnedOrder(storeId, orderId);
    return prisma.orderStatusHistory.create({
      data: {
        orderId,
        fromStatus: data.fromStatus,
        toStatus: data.toStatus,
        reason: data.reason ?? null,
        actorId: data.actorId ?? null,
      },
    });
  }

  async list(storeId: string, orderId: string): Promise<OrderStatusHistory[]> {
    await this.requireOwnedOrder(storeId, orderId);
    return prisma.orderStatusHistory.findMany({
      where: { orderId },
      orderBy: [{ createdAt: 'asc' }],
    });
  }

  /** Latest entry's `toStatus` - falls back to the order row for legacy data. */
  async currentStatus(storeId: string, orderId: string): Promise<{ status: OrderStatus; since: Date }> {
    const order = await this.requireOwnedOrder(storeId, orderId);
    const entries = await prisma.orderStatusHistory.findMany({
      where: { orderId },
      orderBy: [{ createdAt: 'desc' }],
      take: 1,
    });
    const last = entries.at(0);
    return last
      ? { status: last.toStatus, since: last.createdAt }
      : { status: order.status, since: order.updatedAt };
  }

  private async requireOwnedOrder(storeId: string, orderId: string): Promise<Order> {
    const rows = await prisma.order.findMany({ where: { id: orderId, storeId }, take: 1 });
    const row = rows.at(0);
    if (!row) throw new NotFoundError('Order');
    return row;
  }
}

export const orderStatusHistoryService = new OrderStatusHistoryService();
