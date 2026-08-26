import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@wco/database';

/**
 * OrdersRepository — all order persistence goes through here so tenant
 * scoping is impossible to forget. Services never touch prisma.order
 * directly.
 */
@Injectable()
export class OrdersRepository {
  constructor(private readonly prisma: PrismaService) {}

  findByIdScoped(storeId: string, orderId: string, tx?: Prisma.TransactionClient) {
    const client = tx ?? this.prisma;
    return client.order.findFirst({
      where: { id: orderId, storeId },
      include: { items: true, customer: true, payment: true, delivery: true },
    });
  }

  findByStorePaginated(storeId: string, params: { cursor?: string; limit: number; status?: string }) {
    return this.prisma.order.findMany({
      where: { storeId, ...(params.status ? { status: params.status as never } : {}) },
      take: params.limit + 1,
      cursor: params.cursor ? { id: params.cursor } : undefined,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: { id: true, orderNumber: true, status: true, subtotal: true, createdAt: true },
    });
  }

  countTodayByStore(storeId: string) {
    const startOfDay = new Date();
    startOfDay.setUTCHours(0, 0, 0, 0);
    return this.prisma.order.count({ where: { storeId, createdAt: { gte: startOfDay } } });
  }
}
