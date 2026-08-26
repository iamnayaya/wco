import type { Order, OrderItem } from '@prisma/client';
import { NotFoundError } from '@wco/shared';

import { prisma } from '../../../lib/prisma.js';

/** Shared helpers for the orders module services. */

export type OrderWithItems = Order & { items: OrderItem[] };

/** Loads an order owned by the store or throws a leak-safe 404. */
export async function requireOrder(storeId: string, orderId: string): Promise<Order> {
  const rows = await prisma.order.findMany({ where: { id: orderId, storeId }, take: 1 });
  const row = rows.at(0);
  if (!row) throw new NotFoundError('Order');
  return row;
}

export async function requireOrderWithItems(storeId: string, orderId: string): Promise<OrderWithItems> {
  const order = await requireOrder(storeId, orderId);
  const items = await prisma.orderItem.findMany({ where: { orderId: order.id } });
  return { ...order, items };
}

/** Resolves the acting user id (user JWT) or null (API token / system). */
export function actorIdFrom(auth: { mode: 'user' | 'api'; userId: string | null }): string | null {
  return auth.mode === 'user' ? auth.userId : null;
}
