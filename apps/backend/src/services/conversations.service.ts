import type { Conversation, Message } from '@prisma/client';
import { LIMITS, ROUTING_KEYS } from '@wco/shared';
import { NotFoundError, ValidationError } from '@wco/shared';

import { enqueueWhatsappSend } from '../jobs/queues.js';
import { prisma } from '../lib/prisma.js';
import { publishDomainEvent } from '../lib/rabbit.js';

/**
 * Conversations service — the WhatsApp inbox.
 *
 * Inbound pipeline (called by webhook routes):
 *   dedupe(waMessageId) -> resolve store -> upsert customer -> upsert
 *   conversation -> persist Message(RECEIVED) -> unread++ -> fan out to the
 *   AI engine over RabbitMQ.
 *
 * Outbound: messages are persisted as QUEUED then handed to the whatsapp-send
 * BullMQ queue; the processor calls @wco/messaging and records SENT/FAILED.
 */

export interface NormalizedInbound {
  readonly waMessageId: string;
  readonly storePhoneNumberId: string;
  readonly fromPhone: string;
  readonly type: 'text' | 'image' | 'audio' | 'video' | 'document' | 'location' | 'template' | 'interactive';
  readonly body: string | null;
  readonly mediaUrl: string | null;
  readonly timestamp: Date;
}

export class ConversationsService {
  constructor(private readonly db = prisma) {}

  async list(
    storeId: string,
    query: { status?: 'BOT' | 'HANDLED' | 'CLOSED'; q?: string; limit: number; cursor?: string },
  ): Promise<{ items: Conversation[]; nextCursor: string | null }> {
    const items = await this.db.conversation.findMany({
      where: {
        storeId,
        ...(query.status ? { status: query.status } : {}),
        ...(query.q
          ? {
              OR: [
                { customer: { name: { contains: query.q, mode: 'insensitive' } } },
                { customer: { waPhone: { contains: query.q.replace(/[^\d]/g, '') } } },
              ],
            }
          : {}),
        ...(query.cursor ? { id: { gt: Buffer.from(query.cursor, 'base64url').toString('utf8') } } : {}),
      },
      orderBy: [{ lastMessageAt: 'desc' }],
      take: query.limit,
      include: { customer: { select: { id: true, name: true, waPhone: true } } },
    });
    return {
      items,
      nextCursor:
        items.length === query.limit && items.length > 0
          ? Buffer.from(items[items.length - 1].id).toString('base64url')
          : null,
    };
  }

  async get(storeId: string, conversationId: string): Promise<Conversation> {
    const conversation = await this.db.conversation.findFirst({ where: { id: conversationId, storeId } });
    if (!conversation) throw new NotFoundError('Conversation');
    return conversation;
  }

  async messages(
    storeId: string,
    conversationId: string,
    query: { limit: number; cursor?: string },
  ): Promise<{ items: Message[]; nextCursor: string | null }> {
    await this.get(storeId, conversationId);
    const items = await this.db.message.findMany({
      where: {
        conversationId,
        ...(query.cursor ? { id: { lt: Buffer.from(query.cursor, 'base64url').toString('utf8') } } : {}),
      },
      orderBy: { id: 'desc' }, // newest first (chat UI), cursor walks backwards
      take: query.limit,
    });
    // Reset unread once an agent opens the thread.
    await this.db.conversation.updateMany({
      where: { id: conversationId, unreadCount: { gt: 0 } },
      data: { unreadCount: 0 },
    });
    return {
      items,
      nextCursor:
        items.length === query.limit && items.length > 0
          ? Buffer.from(items[items.length - 1].id).toString('base64url')
          : null,
    };
  }

  /** Agent/bot-initiated outbound message. */
  async sendMessage(
    storeId: string,
    conversationId: string,
    input: { body?: string; type?: 'TEXT' | 'IMAGE' | 'DOCUMENT'; mediaUrl?: string },
    opts: { sentByBot?: boolean } = {},
  ): Promise<Message> {
    const conversation = await this.get(storeId, conversationId);

    if (input.body && input.body.length > LIMITS.MAX_MESSAGE_LENGTH) {
      throw new ValidationError(`Message exceeds ${LIMITS.MAX_MESSAGE_LENGTH} characters`);
    }
    if (!input.body && !input.mediaUrl) {
      throw new ValidationError('Message requires body or mediaUrl');
    }

    const message = await this.db.message.create({
      data: {
        conversationId: conversation.id,
        direction: 'OUTBOUND',
        type: input.type ?? 'TEXT',
        body: input.body,
        mediaUrl: input.mediaUrl,
        status: 'QUEUED',
        sentByBot: opts.sentByBot ?? false,
      },
    });

    const preview = (input.body ?? '[media]').slice(0, 120);
    await this.db.conversation.update({
      where: { id: conversation.id },
      data: { lastMessageAt: new Date(), lastMessagePreview: preview },
    });

    await enqueueWhatsappSend({ messageId: message.id, storeId, conversationId: conversation.id });
    return message;
  }

  /**
   * Inbound message ingestion. Dedupe is enforced by the DB unique index on
   * waMessageId — provider retries are free.
   */
  async receiveInbound(inbound: NormalizedInbound): Promise<{ conversation: Conversation; duplicated: boolean }> {
    const store = await this.db.store.findFirst({
      where: { whatsappNameId: inbound.storePhoneNumberId },
      select: { id: true },
    });
    if (!store) throw new NotFoundError(`Store for phoneNumberId ${inbound.storePhoneNumberId}`);

    const existing = await this.db.message.findUnique({ where: { waMessageId: inbound.waMessageId } });
    if (existing) return { conversation: await this.db.conversation.findUniqueOrThrow({ where: { id: existing.conversationId } }), duplicated: true };

    const { customersService } = await import('./customers.service.js');
    const customer = await customersService.upsertByPhone(store.id, inbound.fromPhone);

    const conversation = await this.db.conversation.upsert({
      where: { storeId_customerId: { storeId: store.id, customerId: customer.id } },
      create: {
        storeId: store.id,
        customerId: customer.id,
        waPhone: customer.waPhone,
        status: 'BOT',
        botEnabled: true,
        lastMessageAt: inbound.timestamp,
        lastMessagePreview: (inbound.body ?? `[${inbound.type}]`).slice(0, 120),
        unreadCount: 1,
      },
      update: {
        lastMessageAt: inbound.timestamp,
        lastMessagePreview: (inbound.body ?? `[${inbound.type}]`).slice(0, 120),
        unreadCount: { increment: 1 },
      },
    });

    await this.db.message.create({
      data: {
        conversationId: conversation.id,
        direction: 'INBOUND',
        type: inbound.type.toUpperCase() as Message['type'],
        body: inbound.body,
        mediaUrl: inbound.mediaUrl,
        waMessageId: inbound.waMessageId,
        status: 'RECEIVED',
      },
    });

    void publishDomainEvent(ROUTING_KEYS.MESSAGE_INBOUND, {
      storeId: store.id,
      conversationId: conversation.id,
      waMessageId: inbound.waMessageId,
      body: inbound.body,
      type: inbound.type,
      fromPhone: inbound.fromPhone,
    });
    return { conversation, duplicated: false };
  }

  async assignAgent(storeId: string, conversationId: string, userId: string | null): Promise<Conversation> {
    await this.get(storeId, conversationId);
    return this.db.conversation.update({ where: { id: conversationId }, data: { assignedUserId: userId, status: 'HANDLED' } });
  }

  async setBotEnabled(storeId: string, conversationId: string, enabled: boolean): Promise<Conversation> {
    await this.get(storeId, conversationId);
    return this.db.conversation.update({ where: { id: conversationId }, data: { botEnabled: enabled } });
  }

  /** Human takeover — stops AI auto-replies and notifies subscribers. */
  async escalate(storeId: string, conversationId: string): Promise<Conversation> {
    const conversation = await this.get(storeId, conversationId);
    const updated = await this.db.conversation.update({
      where: { id: conversation.id },
      data: { status: 'HANDLED', botEnabled: false },
    });
    await this.db.outboxEvent.create({
      data: {
        aggregateType: 'conversation',
        aggregateId: conversation.id,
        eventType: 'conversation.escalated',
        payload: { storeId, conversationId, waPhone: conversation.waPhone },
      },
    });
    return updated;
  }
}

export const conversationsService = new ConversationsService();
