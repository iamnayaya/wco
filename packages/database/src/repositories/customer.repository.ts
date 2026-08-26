import { Prisma } from '@prisma/client';
import { cursorPaginate, NEWEST_FIRST, type Db, type PaginatedResult } from './base.repository';

export interface CustomerUpsertInput {
  storeId: string;
  waPhone: string;
  name?: string;
  lastSeenAt?: Date;
}

export class CustomerRepository {
  constructor(private readonly db: Db) {}

  /** Find-or-create by store + WhatsApp phone. The identity primitive of WCO. */
  async upsertByPhone(input: CustomerUpsertInput) {
    return this.db.customer.upsert({
      where: { storeId_waPhone: { storeId: input.storeId, waPhone: input.waPhone } },
      create: {
        storeId: input.storeId,
        waPhone: input.waPhone,
        name: input.name,
        lastSeenAt: input.lastSeenAt ?? new Date(),
      },
      update: {
        ...(input.name ? { name: input.name } : {}),
        lastSeenAt: input.lastSeenAt ?? new Date(),
      },
    });
  }

  listByStore(storeId: string, params: { search?: string; segment?: string; limit: number; cursor?: string }): Promise<PaginatedResult<unknown>> {
    return this.db.customer
      .findMany({
        where: {
          storeId,
          ...(params.search
            ? {
                OR: [
                  { name: { contains: params.search, mode: 'insensitive' as const } },
                  { waPhone: { contains: params.search } },
                ],
              }
            : {}),
          ...(params.segment ? { segment: params.segment } : {}),
        },
        take: params.limit + 1,
        cursor: params.cursor ? { id: params.cursor } : undefined,
        orderBy: [{ totalSpent: 'desc' }, { id: 'desc' }],
      })
      .then((rows) => cursorPaginate(rows as Array<{ id: string }>, params.limit));
  }

  /** Recompute denormalized lifetime stats after an order is paid. */
  async applyPaidOrderStats(tx: Prisma.TransactionClient, customerId: string, orderTotal: Prisma.Decimal): Promise<void> {
    await tx.customer.update({
      where: { id: customerId },
      data: {
        totalSpent: { increment: orderTotal },
        ordersCount: { increment: 1 },
        lastOrderAt: new Date(),
      },
    });
  }

  /** NDPR/GDPR erasure — pseudonymize instead of cascade-delete to keep ledger integrity. */
  async anonymize(tx: Prisma.TransactionClient, customerId: string): Promise<void> {
    await tx.customer.update({
      where: { id: customerId },
      data: {
        name: null,
        email: null,
        notes: null,
        waPhone: `erased-${customerId}`,
        marketingOptIn: false,
        tags: [],
      },
    });
  }
}
