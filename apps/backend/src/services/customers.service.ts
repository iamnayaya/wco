import type { Customer, Prisma } from '@prisma/client';
import { NotFoundError } from '@wco/shared';

import { prisma } from '../lib/prisma.js';
import { decodeCursor } from '../utils/pagination.js';
import { normalizePhone } from '../utils/phone.js';

/**
 * Customer directory — WhatsApp-first identities (waPhone is the key).
 * `upsertByPhone` is the hot path used by conversations + order intake:
 * every inbound message touches it, so it is intentionally lean.
 */

export interface ListCustomersQuery {
  readonly q?: string;
  readonly segment?: string;
  readonly tag?: string;
  readonly limit: number;
  readonly cursor?: string;
}

export class CustomersService {
  constructor(private readonly db: typeof prisma = prisma) {}

  /** Idempotent identity resolution for inbound WhatsApp traffic. */
  async upsertByPhone(storeId: string, rawPhone: string, name?: string): Promise<Customer> {
    const waPhone = normalizePhone(rawPhone);
    return this.db.customer.upsert({
      where: { storeId_waPhone: { storeId, waPhone } },
      create: { storeId, waPhone, name, lastSeenAt: new Date() },
      update: {
        lastSeenAt: new Date(),
        ...(name ? { name } : {}),
      },
    });
  }

  async list(storeId: string, query: ListCustomersQuery): Promise<{ items: Customer[]; nextCursor: string | null }> {
    const where: Prisma.CustomerWhereInput = {
      storeId,
      ...(query.segment ? { segment: query.segment } : {}),
      ...(query.tag ? { tags: { has: query.tag } } : {}),
      ...(query.q
        ? {
            OR: [
              { name: { contains: query.q, mode: 'insensitive' } },
              { waPhone: { contains: query.q } },
              { email: { contains: query.q, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(query.cursor ? { id: { gt: decodeCursor(query.cursor) } } : {}),
    };
    const items = await this.db.customer.findMany({
      where,
      orderBy: { id: 'asc' },
      take: query.limit,
    });
    const nextCursor = items.length === query.limit && items.length > 0
      ? Buffer.from(items[items.length - 1].id).toString('base64url')
      : null;
    return { items, nextCursor };
  }

  async get(storeId: string, customerId: string): Promise<Customer> {
    const customer = await this.db.customer.findFirst({ where: { id: customerId, storeId } });
    if (!customer) throw new NotFoundError('Customer');
    return customer;
  }

  async update(
    storeId: string,
    customerId: string,
    patch: Partial<Pick<Customer, 'name' | 'email' | 'notes' | 'marketingOptIn'>> & { tags?: string[] },
  ): Promise<Customer> {
    await this.get(storeId, customerId);
    return this.db.customer.update({ where: { id: customerId }, data: patch });
  }

  async addTags(storeId: string, customerId: string, tags: string[]): Promise<Customer> {
    const customer = await this.get(storeId, customerId);
    const merged = Array.from(new Set([...customer.tags, ...tags.map((t) => t.trim()).filter(Boolean)]));
    return this.db.customer.update({ where: { id: customerId }, data: { tags: merged } });
  }

  /**
   * Recompute lifetime stats after a paid order. Called from the payment
   * success path (webhook or manual mark-paid) — idempotent by construction.
   */
  async recomputeStats(storeId: string, customerId: string): Promise<void> {
    const agg = await this.db.order.aggregate({
      where: {
        storeId,
        customerId,
        status: { in: ['PAID', 'PROCESSING', 'SHIPPED', 'DELIVERED'] },
      },
      _sum: { total: true },
      _count: { id: true },
      _max: { createdAt: true },
    });
    await this.db.customer.update({
      where: { id: customerId },
      data: {
        totalSpent: agg._sum.total ?? 0,
        ordersCount: agg._count.id,
        lastOrderAt: agg._max.createdAt ?? undefined,
      },
    });
  }
}

export const customersService = new CustomersService();
