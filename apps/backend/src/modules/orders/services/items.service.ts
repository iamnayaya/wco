import type { Order, OrderItem } from '@prisma/client';
import { InsufficientStockError, NotFoundError } from '@wco/shared';

import { prisma } from '../../../lib/prisma.js';

import { requireOrderWithItems } from './shared.js';

/**
 * Line-item maintenance on live orders. Quantities are re-verified against
 * stock on every change (conditional decrement like checkout), and the parent
 * order totals are recomputed so `total` always equals
 * max(0, subtotal - discount + deliveryFee) over the surviving lines.
 */
export class OrderItemService {
  async list(storeId: string, orderId: string): Promise<OrderItem[]> {
    return (await requireOrderWithItems(storeId, orderId)).items;
  }

  async getOwned(storeId: string, orderId: string, itemId: string): Promise<OrderItem> {
    const { items } = await requireOrderWithItems(storeId, orderId);
    const item = items.find((i) => i.id === itemId);
    if (!item) throw new NotFoundError('Order item');
    return item;
  }

  async update(
    storeId: string,
    orderId: string,
    itemId: string,
    patch: { quantity?: number; note?: string | null },
  ): Promise<Order> {
    const order = await requireOrderWithItems(storeId, orderId);
    const item = order.items.find((i) => i.id === itemId);
    if (!item) throw new NotFoundError('Order item');
    if (patch.quantity !== undefined && patch.quantity !== item.quantity) {
      await this.rebalanceStock(item, patch.quantity - item.quantity);
    }
    if (patch.quantity !== undefined || patch.note !== undefined) {
      await prisma.orderItem.update({
        where: { id: item.id },
        data: {
          ...(patch.quantity !== undefined ? { quantity: patch.quantity } : {}),
          ...(patch.note !== undefined ? { note: patch.note } : {}),
        },
      });
    }
    return this.recalcTotals(order);
  }

  async remove(storeId: string, orderId: string, itemId: string): Promise<Order> {
    const order = await requireOrderWithItems(storeId, orderId);
    const item = order.items.find((i) => i.id === itemId);
    if (!item) throw new NotFoundError('Order item');
    if (order.items.length === 1) throw new NotFoundError('Cannot remove the last item of an order');
    await this.rebalanceStock(item, -item.quantity); // return reserved units
    await prisma.orderItem.delete({ where: { id: item.id } });
    return this.recalcTotals(order);
  }

  /** Conditional delta adjustment - floors at zero available stock. */
  private async rebalanceStock(item: OrderItem, delta: number): Promise<void> {
    if (delta === 0) return;
    const productRows = await prisma.product.findMany({ where: { id: item.productId }, take: 1 });
    const product = productRows.at(0);
    if (!product || !product.trackStock) return;

    if (delta > 0) {
      // Taking more units: guard against overselling.
      const hit = await prisma.product.updateMany({
        where: { id: item.productId, stockQuantity: { gte: delta }, trackStock: true },
        data: { stockQuantity: { decrement: delta } },
      });
      if (hit.count === 0) throw new InsufficientStockError(item.productName);
    } else {
      await prisma.product.updateMany({
        where: { id: item.productId },
        data: { stockQuantity: { increment: -delta }, status: 'ACTIVE' },
      });
    }
  }

  /** Recomputes subtotal/total from the surviving items after any mutation. */
  private async recalcTotals(order: Order): Promise<Order> {
    const items = await prisma.orderItem.findMany({ where: { orderId: order.id } });
    const subtotal = items.reduce((sum, i) => sum + Number(i.unitPrice) * i.quantity, 0);
    const total = Math.max(0, subtotal - Number(order.discount) + Number(order.deliveryFee));
    return prisma.order.update({ where: { id: order.id }, data: { subtotal, total } });
  }
}

export const orderItemService = new OrderItemService();
