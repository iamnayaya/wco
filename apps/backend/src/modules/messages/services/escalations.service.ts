import type { MessageEscalation } from '@prisma/client';
import { ConflictError, NotFoundError } from '@wco/shared';
import { ROUTING_KEYS } from '@wco/shared';

import { prisma } from '../../../lib/prisma.js';
import { publishDomainEvent } from '../../../lib/rabbit.js';

/**
 * Human hand-off queue. Escalations are created by the auto-responder
 * (low confidence / hard intents / keyword hits) or manually by agents, then
 * resolved with an audit note. OPEN items surface in the inbox badge.
 */

export interface ListEscalationsFilters {
  readonly page: number;
  readonly pageSize: number;
  readonly status?: MessageEscalation['status'];
  readonly reason?: MessageEscalation['reason'];
  readonly threadId?: string;
}

export class EscalationsService {
  async create(
    storeId: string,
    input: {
      threadId: string;
      messageId?: string;
      reason: MessageEscalation['reason'];
      notes?: string;
    },
    actorUserId: string | null,
  ): Promise<MessageEscalation> {
    const thread = await prisma.conversation.findFirst({ where: { id: input.threadId, storeId } });
    if (!thread) throw new NotFoundError('Thread');

    if (input.messageId !== undefined) {
      const message = await prisma.message.findFirst({
        where: { id: input.messageId, conversationId: thread.id },
      });
      if (!message) throw new NotFoundError('Message');
    }

    // One open escalation per thread is plenty - re-open semantics live on
    // the existing row so agents never chase duplicates.
    const open = await prisma.messageEscalation.findFirst({
      where: { threadId: thread.id, status: 'OPEN' },
    });
    if (open) return open;

    const row = await prisma.messageEscalation.create({
      data: {
        storeId,
        threadId: thread.id,
        messageId: input.messageId ?? null,
        reason: input.reason,
        notes: input.notes ?? null,
        status: 'OPEN',
        assignedUserId: actorUserId,
      },
    });

    await prisma.conversation.update({
      where: { id: thread.id },
      data: { status: 'HANDLED', botEnabled: false },
    });
    await publishDomainEvent(ROUTING_KEYS.CONVERSATION_ESCALATED, {
      storeId,
      threadId: thread.id,
      escalationId: row.id,
      reason: input.reason,
    }).catch(() => undefined);
    return row;
  }

  async list(storeId: string, filters: ListEscalationsFilters): Promise<{
    items: Array<Record<string, unknown>>;
    meta: { page: number; pageSize: number; totalItems: number; totalPages: number };
  }> {
    const where = {
      storeId,
      ...(filters.status !== undefined ? { status: filters.status } : {}),
      ...(filters.reason !== undefined ? { reason: filters.reason } : {}),
      ...(filters.threadId !== undefined ? { threadId: filters.threadId } : {}),
    };
    const [rows, total] = await Promise.all([
      prisma.messageEscalation.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (filters.page - 1) * filters.pageSize,
        take: filters.pageSize,
      }),
      prisma.messageEscalation.count({ where }),
    ]);
    const items = await Promise.all(rows.map((row) => this.decorate(row)));
    const totalPages = Math.max(1, Math.ceil(total / filters.pageSize));
    return { items, meta: { page: filters.page, pageSize: filters.pageSize, totalItems: total, totalPages } };
  }

  async get(storeId: string, id: string): Promise<MessageEscalation> {
    const row = await prisma.messageEscalation.findFirst({ where: { id, storeId } });
    if (!row) throw new NotFoundError('Escalation');
    return row;
  }

  /** PUT - notes + reassignment only; terminal states own dedicated verbs. */
  async update(storeId: string, id: string, data: { status?: MessageEscalation['status']; assignedUserId?: string | null; notes?: string }): Promise<MessageEscalation> {
    const row = await this.get(storeId, id);
    if (data.status === 'RESOLVED') throw new ConflictError('Use POST /message-escalations/:id/resolve to resolve');
    if (data.status === 'DISMISSED') throw new ConflictError('Use DELETE /message-escalations/:id to dismiss');
    if (row.status === 'RESOLVED') throw new ConflictError('Resolved escalations are immutable');
    return prisma.messageEscalation.update({
      where: { id: row.id },
      data: {
        ...(data.notes !== undefined ? { notes: data.notes } : {}),
        ...(data.assignedUserId !== undefined ? { assignedUserId: data.assignedUserId } : {}),
      },
    });
  }

  async resolve(storeId: string, id: string, resolutionNote: string | undefined, actorUserId: string): Promise<MessageEscalation> {
    const row = await this.get(storeId, id);
    if (row.status === 'RESOLVED') throw new ConflictError('Escalation already resolved');
    // The closing note lives in `notes` - the schema keeps one audit field.
    return prisma.messageEscalation.update({
      where: { id: row.id },
      data: {
        status: 'RESOLVED',
        resolvedAt: new Date(),
        resolvedById: actorUserId,
        ...(resolutionNote !== undefined ? { notes: resolutionNote } : {}),
      },
    });
  }

  /** DELETE = dismiss without resolution (false positive cleanup). */
  async remove(storeId: string, id: string): Promise<void> {
    const row = await this.get(storeId, id);
    if (row.status === 'RESOLVED') throw new ConflictError('Resolved escalations cannot be deleted');
    await prisma.messageEscalation.update({
      where: { id: row.id },
      data: { status: 'DISMISSED', resolvedAt: new Date() },
    });
  }

  private async decorate(row: MessageEscalation): Promise<Record<string, unknown>> {
    const thread = await prisma.conversation.findUnique({
      where: { id: row.threadId },
      select: { waPhone: true, lastMessagePreview: true, customerId: true },
    });
    return {
      ...row,
      thread: thread ?? null,
    };
  }
}

export const escalationsService = new EscalationsService();
