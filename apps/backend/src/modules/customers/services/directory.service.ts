import type { Customer, Message, Order, Prisma } from '@prisma/client';
import { ConflictError, NotFoundError } from '@wco/shared';
import type { z } from 'zod';

import { prisma } from '../../../lib/prisma.js';
import { normalizePhone } from '../../../utils/phone.js';
import type { createCustomerSchema, ListCustomersV2Query } from '../customers.dto.js';

type CustomerCreate = z.infer<typeof createCustomerSchema>;

export interface CustomerStats {
  customerId: string;
  totalSpent: number;
  ordersCount: number;
  avgOrderValue: number;
  lastOrderAt: Date | null;
  firstOrderAt: Date | null;
  lastSeenAt: Date | null;
  marketingOptIn: boolean;
  tags: string[];
  segment: string | null;
}

/**
 * Customer directory v2 - offset pagination + lifecycle + relationship feeds.
 *
 * Tenant boundary: every query is storeId-scoped; ids from other stores are
 * indistinguishable from nonexistent (404), never 403 (no existence leak).
 */

export class CustomerDirectoryService {
  async createCustomer(storeId: string, data: CustomerCreate): Promise<Customer> {
    const waPhone = normalizePhone(data.waPhone);
    const clash = await prisma.customer.findFirst({ where: { storeId, waPhone } });
    if (clash) throw new ConflictError('A customer with this phone already exists');
    return prisma.customer.create({
      data: {
        storeId,
        waPhone,
        name: data.name,
        email: data.email,
        tags: data.tags,
        marketingOptIn: data.marketingOptIn,
        notes: data.notes,
        lastSeenAt: new Date(),
      },
    });
  }

  buildWhere(storeId: string, query: Partial<ListCustomersV2Query>): Prisma.CustomerWhereInput {
    const where: Prisma.CustomerWhereInput = { storeId };
    if (query.segment) where.segment = query.segment;
    if (query.tag) where.tags = { has: query.tag };
    if (query.marketingOptIn !== undefined) where.marketingOptIn = query.marketingOptIn;
    if (query.minSpent !== undefined || query.maxSpent !== undefined) {
      where.totalSpent = {
        ...(query.minSpent !== undefined ? { gte: query.minSpent } : {}),
        ...(query.maxSpent !== undefined ? { lte: query.maxSpent } : {}),
      };
    }
    if (query.q) {
      where.OR = [
        { name: { contains: query.q } },
        { waPhone: { contains: query.q } },
        { email: { contains: query.q } },
      ];
    }
    return where;
  }

  async listCustomers(
    storeId: string,
    query: ListCustomersV2Query,
  ): Promise<{ items: Customer[]; total: number }> {
    const where = this.buildWhere(storeId, query);
    const [items, total] = await Promise.all([
      prisma.customer.findMany({
        where,
        orderBy: [{ [query.sortBy]: query.sortOrder }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      prisma.customer.count({ where }),
    ]);
    return { items, total };
  }

  async countCustomers(storeId: string, query: Partial<ListCustomersV2Query> = {}): Promise<number> {
    return prisma.customer.count({ where: this.buildWhere(storeId, query) });
  }

  async getCustomerById(storeId: string, customerId: string): Promise<Customer> {
    const rows = await prisma.customer.findMany({ where: { id: customerId, storeId }, take: 1 });
    const customer = rows.at(0);
    if (!customer) throw new NotFoundError('Customer not found');
    return customer;
  }

  async getCustomerByPhone(storeId: string, phone: string): Promise<Customer | null> {
    const rows = await prisma.customer.findMany({
      where: { storeId, waPhone: normalizePhone(phone) },
      take: 1,
    });
    return rows.at(0) ?? null;
  }

  async getCustomerByEmail(storeId: string, email: string): Promise<Customer | null> {
    const rows = await prisma.customer.findMany({
      where: { storeId, email },
      take: 1,
    });
    return rows.at(0) ?? null;
  }

  async updateCustomer(
    storeId: string,
    customerId: string,
    patch: Partial<Pick<Customer, 'name' | 'email' | 'notes' | 'marketingOptIn'>> & { tags?: string[] },
  ): Promise<Customer> {
    await this.getCustomerById(storeId, customerId);
    return prisma.customer.update({ where: { id: customerId }, data: patch });
  }

  /** Hard delete of the CRM record; orders keep historical integrity via FK. */
  async deleteCustomer(storeId: string, customerId: string): Promise<void> {
    await this.getCustomerById(storeId, customerId);
    await prisma.$transaction([
      prisma.customerNote.deleteMany({ where: { customerId } }),
      prisma.customerSegmentMember.deleteMany({ where: { customerId } }),
      prisma.customer.delete({ where: { id: customerId } }),
    ]);
  }

  async getCustomerOrders(
    storeId: string,
    customerId: string,
    limit: number,
  ): Promise<Order[]> {
    await this.getCustomerById(storeId, customerId);
    return prisma.order.findMany({
      where: { customerId, storeId },
      orderBy: [{ createdAt: 'desc' }],
      take: limit,
    });
  }

  /**
   * Messages arrive via the conversation join: resolve the customer's
   * conversations first, then pull their messages newest-first.
   */
  async getCustomerMessages(
    storeId: string,
    customerId: string,
    limit: number,
  ): Promise<Message[]> {
    await this.getCustomerById(storeId, customerId);
    const conversations = await prisma.conversation.findMany({
      where: { customerId, storeId },
    });
    if (conversations.length === 0) return [];
    return prisma.message.findMany({
      where: { conversationId: { in: conversations.map((c) => c.id) } },
      orderBy: [{ createdAt: 'desc' }],
      take: limit,
    });
  }

  async getCustomerStats(storeId: string, customerId: string): Promise<CustomerStats> {
    const customer = await this.getCustomerById(storeId, customerId);
    const agg = await prisma.order.aggregate({
      where: { customerId, storeId },
      _sum: { total: true },
      _max: { createdAt: true },
      _min: { createdAt: true },
    });
    return {
      customerId: customer.id,
      totalSpent: Number(customer.totalSpent),
      ordersCount: customer.ordersCount,
      avgOrderValue: customer.ordersCount > 0 ? Number(customer.totalSpent) / customer.ordersCount : 0,
      lastOrderAt: agg._max.createdAt ?? null,
      firstOrderAt: agg._min.createdAt ?? null,
      lastSeenAt: customer.lastSeenAt,
      marketingOptIn: customer.marketingOptIn,
      tags: customer.tags,
      segment: customer.segment,
    };
  }
}

export const customerDirectoryService = new CustomerDirectoryService();
