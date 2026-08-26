import type { Conversation } from '@prisma/client';
import { ConflictError, NotFoundError, ValidationError } from '@wco/shared';

import { prisma } from '../../../lib/prisma.js';

/**
 * Message threads (= the `conversations` table; "thread" is the API-facing
 * name). One thread per (store, customer) - enforced by the DB unique pair -
 * so `create` is find-or-create and webhook ingestion never duplicates.
 */

export interface ListThreadsFilters {
  readonly page: number;
  readonly pageSize: number;
  readonly status?: 'BOT' | 'HANDLED' | 'CLOSED';
  readonly q?: string;
  readonly customerId?: string;
  readonly assignedToMe: boolean;
}

export interface ThreadWithCustomer extends Conversation {
  readonly customer: { id: string; name: string | null; waPhone: string } | null;
}

export class ThreadsService {
  async create(storeId: string, customerId: string): Promise<ThreadWithCustomer> {
    const customer = await prisma.customer.findFirst({ where: { id: customerId, storeId } });
    if (!customer) throw new NotFoundError('Customer');

    const existing = await prisma.conversation.findUnique({
      where: { storeId_customerId: { storeId, customerId } },
    });
    const thread =
      existing ??
      (await prisma.conversation.create({
        data: {
          storeId,
          customerId,
          waPhone: customer.waPhone,
          status: 'BOT',
          botEnabled: true,
        },
      }));
    return this.decorate(thread);
  }

  async get(storeId: string, id: string): Promise<Conversation> {
    const thread = await prisma.conversation.findFirst({ where: { id, storeId } });
    if (!thread) throw new NotFoundError('Thread');
    return thread;
  }

  async getDecorated(storeId: string, id: string): Promise<ThreadWithCustomer> {
    return this.decorate(await this.get(storeId, id));
  }

  async getByCustomer(storeId: string, customerId: string): Promise<Conversation> {
    const thread = await prisma.conversation.findUnique({
      where: { storeId_customerId: { storeId, customerId } },
    });
    if (!thread) throw new NotFoundError('Thread');
    return thread;
  }

  /** Hot path for webhooks: phone -> thread without throwing. */
  async findByWhatsAppNumber(
    storeId: string,
    waPhone: string,
  ): Promise<Conversation | null> {
    return prisma.conversation.findFirst({ where: { storeId, waPhone } });
  }

  async list(
    storeId: string,
    filters: ListThreadsFilters,
    actorUserId: string,
  ): Promise<{ items: ThreadWithCustomer[]; meta: { page: number; pageSize: number; totalItems: number; totalPages: number } }> {
    const where = {
      storeId,
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.customerId ? { customerId: filters.customerId } : {}),
      ...(filters.assignedToMe ? { assignedUserId: actorUserId } : {}),
      ...(filters.q
        ? {
            OR: [
              { customer: { name: { contains: filters.q, mode: 'insensitive' as const } } },
              { waPhone: { contains: filters.q.replace(/[^\d]/g, '') } },
            ],
          }
        : {}),
    };

    const [rows, total] = await Promise.all([
      prisma.conversation.findMany({
        where,
        orderBy: { lastMessageAt: 'desc' },
        skip: (filters.page - 1) * filters.pageSize,
        take: filters.pageSize,
      }),
      prisma.conversation.count({ where }),
    ]);

    const items = await Promise.all(rows.map((row) => this.decorate(row)));
    const totalPages = Math.max(1, Math.ceil(total / filters.pageSize));
    return { items, meta: { page: filters.page, pageSize: filters.pageSize, totalItems: total, totalPages } };
  }

  /**
   * Buyer decoration is a single batched query over the page's customer ids -
   * deliberately NOT an include, so listing stays one flat query + one lookup
   * regardless of how many relations UIs ask for.
   */
  private async decorate(thread: Conversation): Promise<ThreadWithCustomer> {
    const customer = await prisma.customer.findUnique({
      where: { id: thread.customerId },
      select: { id: true, name: true, waPhone: true },
    });
    return { ...thread, customer: customer ?? null };
  }

  async update(
    storeId: string,
    id: string,
    data: { status?: 'BOT' | 'HANDLED'; botEnabled?: boolean; assignedUserId?: string | null },
  ): Promise<Conversation> {
    const thread = await this.get(storeId, id);
    if (thread.status === 'CLOSED') throw new ConflictError('Closed threads are read-only');
    return prisma.conversation.update({ where: { id: thread.id }, data });
  }

  /** Hard delete allowed only once a thread is CLOSED and empty-ish. */
  async remove(storeId: string, id: string): Promise<void> {
    const thread = await this.get(storeId, id);
    if (thread.status !== 'CLOSED') {
      throw new ConflictError('Close the thread before deleting it');
    }
    const messageCount = await prisma.message.count({ where: { conversationId: thread.id } });
    if (messageCount > 0) {
      throw new ValidationError(`Thread still holds ${messageCount} messages - export then purge via data lifecycle`);
    }
    await prisma.conversation.delete({ where: { id: thread.id } });
  }
}

export const threadsService = new ThreadsService();
