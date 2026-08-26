import { Prisma } from '@prisma/client';
import { cursorPaginate, NEWEST_FIRST, type Db, type PaginatedResult } from './base.repository';

export type OrderStatusKey = 'PENDING_PAYMENT' | 'PAID' | 'PROCESSING' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED' | 'REFUNDED';

const ORDER_TIMESTAMP_FIELD: Partial<Record<OrderStatusKey, string>> = {
  PAID: 'paidAt',
  SHIPPED: 'shippedAt',
  DELIVERED: 'deliveredAt',
  CANCELLED: 'cancelledAt',
};

export interface OrderListParams {
  status?: keyof typeof Prisma.OrderStatus;
  limit: number;
  cursor?: string;
}

export class OrderRepository {
  constructor(private readonly db: Db) {}

  async listByStore(storeId: string, params: OrderListParams): Promise<PaginatedResult<unknown>> {
    const rows = await this.db.order.findMany({
      where: {
        storeId,
        ...(params.status ? { status: params.status } : {}),
      },
      take: params.limit + 1,
      cursor: params.cursor ? { id: params.cursor } : undefined,
      orderBy: NEWEST_FIRST,
      select: {
        id: true,
        orderNumber: true,
        status: true,
        channel: true,
        total: true,
        currency: true,
        createdAt: true,
        customer: { select: { id: true, name: true, waPhone: true } },
        _count: { select: { items: true } },
      },
    });
    return cursorPaginate(rows, params.limit);
  }

  findById(storeId: string, orderId: string) {
    return this.db.order.findFirst({
      where: { id: orderId, storeId },
      include: {
        items: true,
        customer: { select: { id: true, name: true, waPhone: true } },
        payment: true,
        delivery: true,
      },
    });
  }

  /**
   * Idempotent state transition guard. Returns false when the order is not
   * in the expected source state — callers treat that as a replay/no-op.
   */
  async transitionIfInState(
    tx: Prisma.TransactionClient,
    args: { storeId: string; orderId: string; from: OrderStatusKey; to: OrderStatusKey; at?: Date },
  ): Promise<boolean> {
    const timestampField = ORDER_TIMESTAMP_FIELD[args.to];
    const result = await tx.order.updateMany({
      where: { id: args.orderId, storeId: args.storeId, status: args.from },
      data: {
        status: args.to,
        ...(timestampField ? { [timestampField]: args.at ?? new Date() } : {}),
      },
    });
    return result.count > 0;
  }
}
