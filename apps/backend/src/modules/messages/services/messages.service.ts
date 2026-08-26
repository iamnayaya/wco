import type { Message } from '@prisma/client';
import { ConflictError, NotFoundError, ValidationError } from '@wco/shared';
import { LIMITS } from '@wco/shared';

import { enqueueWhatsappSend } from '../../../jobs/queues.js';
import { prisma } from '../../../lib/prisma.js';

/**
 * Message persistence + delivery hand-off.
 *
 * Outbound rows are created QUEUED and delivered asynchronously by the
 * wco.whatsapp-send worker (Meta/Twilio). Inbound rows are written by the
 * webhook pipeline with the provider's waMessageId as the dedupe key.
 */

export type OutboundInput = {
  readonly type: 'TEXT' | 'IMAGE' | 'DOCUMENT' | 'AUDIO' | 'VIDEO' | 'TEMPLATE';
  readonly body?: string;
  readonly mediaUrl?: string;
  readonly templateName?: string;
  readonly sentByBot: boolean;
};

export interface AttachmentSummary {
  readonly id: string;
  readonly url: string;
  readonly mimeType: string;
  readonly fileName: string;
}

export type MessageWithAttachments = Message & { readonly attachments: readonly AttachmentSummary[] };

export interface PageMetaShape {
  readonly page: number;
  readonly pageSize: number;
  readonly totalItems: number;
  readonly totalPages: number;
}

export interface FeedFilters {
  readonly threadId?: string;
  readonly customerId?: string;
  readonly direction?: 'INBOUND' | 'OUTBOUND';
  readonly type?: Message['type'];
  readonly status?: Message['status'];
  readonly createdAfter?: Date;
  readonly createdBefore?: Date;
}

function buildFeedWhere(storeId: string, f: FeedFilters): Record<string, unknown> {
  const conversation: Record<string, unknown> = { storeId };
  if (f.threadId !== undefined) conversation.id = f.threadId;
  if (f.customerId !== undefined) conversation.customerId = f.customerId;

  return {
    conversation,
    ...(f.direction !== undefined ? { direction: f.direction } : {}),
    ...(f.type !== undefined ? { type: f.type } : {}),
    ...(f.status !== undefined ? { status: f.status } : {}),
    ...(f.createdAfter !== undefined || f.createdBefore !== undefined
      ? {
          createdAt: {
            ...(f.createdAfter !== undefined ? { gte: f.createdAfter } : {}),
            ...(f.createdBefore !== undefined ? { lte: f.createdBefore } : {}),
          },
        }
      : {}),
  };
}

async function withAttachments(message: Message): Promise<MessageWithAttachments> {
  const attachments = await prisma.messageAttachment.findMany({
    where: { messageId: message.id },
    select: { id: true, url: true, mimeType: true, fileName: true },
  });
  return { ...message, attachments };
}

export class MessagesService {
  async getInThread(storeId: string, threadId: string, messageId: string): Promise<Message> {
    const thread = await prisma.conversation.findFirst({ where: { id: threadId, storeId } });
    if (!thread) throw new NotFoundError('Thread');
    const message = await prisma.message.findFirst({
      where: { id: messageId, conversationId: thread.id },
    });
    if (!message) throw new NotFoundError('Message');
    return message;
  }

  /** Store-scoped lookup for flat /messages/:id routes. */
  private async requireStoreMessage(storeId: string, messageId: string): Promise<Message> {
    const message = await prisma.message.findUnique({ where: { id: messageId } });
    if (!message) throw new NotFoundError('Message');
    const thread = await prisma.conversation.findFirst({
      where: { id: message.conversationId, storeId },
      select: { id: true },
    });
    if (!thread) throw new NotFoundError('Message');
    return message;
  }

  async getById(storeId: string, messageId: string): Promise<MessageWithAttachments> {
    return withAttachments(await this.requireStoreMessage(storeId, messageId));
  }

  /** Cursor list for chat UIs - newest first, cursor walks backwards. */
  async listInThread(
    storeId: string,
    threadId: string,
    query: { limit: number; cursor?: string },
    opts: { markRead?: boolean } = {},
  ): Promise<{ items: Message[]; nextCursor: string | null }> {
    const thread = await prisma.conversation.findFirst({ where: { id: threadId, storeId } });
    if (!thread) throw new NotFoundError('Thread');

    const items = await prisma.message.findMany({
      where: {
        conversationId: thread.id,
        ...(query.cursor ? { id: { lt: Buffer.from(query.cursor, 'base64url').toString('utf8') } } : {}),
      },
      orderBy: { id: 'desc' },
      take: query.limit,
    });

    if (opts.markRead === true) {
      await prisma.conversation.updateMany({
        where: { id: thread.id, unreadCount: { gt: 0 } },
        data: { unreadCount: 0 },
      });
    }

    return {
      items,
      nextCursor:
        items.length === query.limit && items.length > 0
          ? Buffer.from(items[items.length - 1].id).toString('base64url')
          : null,
    };
  }

  /**
   * Persist + queue an outbound message. Thread touch (preview/lastMessageAt)
   * rides along so inbox sorting stays correct even under queue latency.
   */
  async send(storeId: string, threadId: string, input: OutboundInput): Promise<Message> {
    const thread = await prisma.conversation.findFirst({ where: { id: threadId, storeId } });
    if (!thread) throw new NotFoundError('Thread');
    if (thread.status === 'CLOSED') throw new ConflictError('Closed threads are read-only');

    if (input.body !== undefined && input.body.length > LIMITS.MAX_MESSAGE_LENGTH) {
      throw new ValidationError(`Message exceeds ${LIMITS.MAX_MESSAGE_LENGTH} characters`);
    }
    if (!input.body && !input.mediaUrl && !input.templateName) {
      throw new ValidationError('Message requires body, mediaUrl or templateName');
    }

    const message = await prisma.message.create({
      data: {
        conversationId: thread.id,
        direction: 'OUTBOUND',
        type: input.type,
        body: input.body ?? null,
        mediaUrl: input.mediaUrl ?? null,
        templateName: input.templateName ?? null,
        status: 'QUEUED',
        sentByBot: input.sentByBot,
      },
    });

    await prisma.conversation.update({
      where: { id: thread.id },
      data: {
        lastMessageAt: new Date(),
        lastMessagePreview: (input.body ?? '[media]').slice(0, 120),
      },
    });

    await enqueueWhatsappSend({ messageId: message.id, storeId, conversationId: thread.id });
    return message;
  }

  /** Manual edits are allowed only before WhatsApp accepted the message. */
  async update(storeId: string, threadId: string, messageId: string, data: { body?: string }): Promise<Message> {
    const message = await this.getInThread(storeId, threadId, messageId);
    if (message.direction !== 'OUTBOUND') throw new ValidationError('Inbound messages cannot be edited');
    if (['SENT', 'DELIVERED', 'READ'].includes(message.status)) {
      throw new ConflictError('Message already handed to WhatsApp - it can no longer be edited');
    }
    return prisma.message.update({ where: { id: message.id }, data });
  }

  async updateById(storeId: string, messageId: string, data: { body?: string }): Promise<Message> {
    const message = await this.requireStoreMessage(storeId, messageId);
    return this.update(storeId, message.conversationId, messageId, data);
  }

  async removeById(storeId: string, messageId: string): Promise<void> {
    const message = await this.requireStoreMessage(storeId, messageId);
    await this.remove(storeId, message.conversationId, messageId);
  }

  async remove(storeId: string, threadId: string, messageId: string): Promise<void> {
    const message = await this.getInThread(storeId, threadId, messageId);
    if (message.direction !== 'OUTBOUND') throw new ValidationError('Inbound messages are an audit trail');
    if (['SENT', 'DELIVERED', 'READ'].includes(message.status)) {
      throw new ConflictError('Sent messages cannot be deleted');
    }
    await prisma.message.delete({ where: { id: message.id } });
  }

  // --- store-wide feed ---------------------------------------------------------

  async listStoreWide(
    storeId: string,
    filters: FeedFilters & { page: number; pageSize: number; sort: 'createdAt_asc' | 'createdAt_desc' },
  ): Promise<{ items: MessageWithAttachments[]; meta: PageMetaShape }> {
    const { page, pageSize, sort, ...rest } = filters;
    const where = buildFeedWhere(storeId, rest);
    const [rows, total] = await Promise.all([
      prisma.message.findMany({
        where,
        orderBy: { createdAt: sort === 'createdAt_asc' ? 'asc' : 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.message.count({ where }),
    ]);
    const items = await Promise.all(rows.map((row) => withAttachments(row)));
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    return { items, meta: { page, pageSize, totalItems: total, totalPages } };
  }

  /** Cross-thread search: body text hits OR buyer name / phone digits. */
  async search(
    storeId: string,
    q: string,
    filters: FeedFilters & { page: number; pageSize: number; sort: 'createdAt_asc' | 'createdAt_desc' },
  ): Promise<{ items: MessageWithAttachments[]; meta: PageMetaShape }> {
    const { page, pageSize, sort, ...rest } = filters;
    const digits = q.replace(/\D/g, '');
    const buyerMatches =
      digits.length >= 7 || q.length >= 3
        ? await prisma.conversation.findMany({
            where: {
              storeId,
              OR: [
                ...(digits.length >= 7 ? [{ waPhone: { contains: digits } }] : []),
                { customer: { name: { contains: q, mode: 'insensitive' as const } } },
              ],
            },
            select: { id: true },
          })
        : [];

    const where = {
      ...buildFeedWhere(storeId, rest),
      OR: [
        { body: { contains: q, mode: 'insensitive' as const } },
        ...(buyerMatches.length > 0 ? [{ conversationId: { in: buyerMatches.map((t) => t.id) } }] : []),
      ],
    };

    const [rows, total] = await Promise.all([
      prisma.message.findMany({
        where,
        orderBy: { createdAt: sort === 'createdAt_asc' ? 'asc' : 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.message.count({ where }),
    ]);
    const items = await Promise.all(rows.map((row) => withAttachments(row)));
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    return { items, meta: { page, pageSize, totalItems: total, totalPages } };
  }
}

export const messagesService = new MessagesService();
