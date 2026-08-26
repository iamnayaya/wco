import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { WhatsAppProvider } from '@wco/messaging';
import { MetaWhatsAppProvider, TwilioWhatsAppProvider } from '@wco/messaging';
import { PrismaService } from '@wco/database';
import { TenantContext } from '../../common/context/tenant-context';

/**
 * MessagingService — human-in-the-loop inbox.
 *
 * The bot handles the hot path (webhook-handler -> ai-engine); this service
 * is for AGENT replies and conversation management. When an agent takes over,
 * botEnabled flips off so AI never talks over a human.
 */
@Injectable()
export class MessagingService {
  private readonly provider: WhatsAppProvider;

  constructor(private readonly prisma: PrismaService) {
    this.provider =
      process.env.WHATSAPP_PROVIDER === 'meta'
        ? new MetaWhatsAppProvider(process.env.META_ACCESS_TOKEN ?? '')
        : new TwilioWhatsAppProvider(
            process.env.TWILIO_ACCOUNT_SID ?? '',
            process.env.TWILIO_AUTH_TOKEN ?? '',
          );
  }

  async listConversations(params: { status?: string; cursor?: string; limit?: number }) {
    const { storeId } = TenantContext.require();
    const limit = Math.min(params.limit ?? 25, 100);
    const items = await this.prisma.conversation.findMany({
      where: {
        storeId,
        ...(params.status ? { status: params.status as never } : {}),
      },
      take: limit + 1,
      cursor: params.cursor ? { id: params.cursor } : undefined,
      orderBy: [{ lastMessageAt: 'desc' }, { id: 'asc' }],
      include: {
        customer: { select: { id: true, name: true, waPhone: true, segment: true } },
        agent: { select: { id: true, fullName: true } },
      },
    });
    const hasNext = items.length > limit;
    return { items: hasNext ? items.slice(0, -1) : items, nextCursor: hasNext ? items[items.length - 2]?.id ?? null : null };
  }

  async getMessages(conversationId: string, cursor?: string, limit = 50) {
    const { storeId } = TenantContext.require();
    const conversation = await this.prisma.conversation.findFirst({
      where: { id: conversationId, storeId },
      select: { id: true },
    });
    if (!conversation) throw new NotFoundException('Conversation not found');

    const items = await this.prisma.message.findMany({
      where: { conversationId },
      take: Math.min(limit, 100) + 1,
      cursor: cursor ? { id: cursor } : undefined,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
    const hasNext = items.length > limit;
    // Chronological order for UI rendering
    const page = (hasNext ? items.slice(0, -1) : items).reverse();
    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { unreadCount: 0 },
    });
    return { items: page, nextCursor: hasNext ? items[0]?.id ?? null : null };
  }

  /** Agent-initiated outbound message. Marks conversation HANDLED. */
  async sendAgentMessage(conversationId: string, agentUserId: string, body: string) {
    const { storeId } = TenantContext.require();
    if (!body.trim()) throw new BadRequestException('Message body required');

    const conversation = await this.prisma.conversation.findFirst({
      where: { id: conversationId, storeId },
      include: { customer: { select: { waPhone: true } }, store: { select: { whatsappNameId: true } } },
    });
    if (!conversation) throw new NotFoundException('Conversation not found');

    const phoneNumberId = conversation.store.whatsappNameId;
    if (!phoneNumberId) throw new BadRequestException('Store has no connected WhatsApp number');

    const result = await this.provider.sendMessage(phoneNumberId, {
      to: conversation.customer.waPhone,
      type: 'TEXT',
      body,
    });

    const [message] = await this.prisma.$transaction([
      this.prisma.message.create({
        data: {
          conversationId,
          direction: 'OUTBOUND',
          type: 'TEXT',
          body,
          status: result.status === 'FAILED' ? 'FAILED' : 'SENT',
          sentByBot: false,
          errorReason: result.errorReason,
        },
      }),
      this.prisma.conversation.update({
        where: { id: conversationId },
        data: {
          status: 'HANDLED',
          botEnabled: false, // human took over — AI stands down
          assignedUserId: agentUserId,
          unreadCount: 0,
          lastMessagePreview: body.slice(0, 140),
          lastMessageAt: new Date(),
        },
      }),
    ]);
    return message;
  }

  /** Escalate/takeover without sending anything. */
  async assignAgent(conversationId: string, agentUserId: string) {
    const { storeId, userId } = TenantContext.require();
    if (agentUserId !== userId) {
      throw new ForbiddenException('You can only assign conversations to yourself');
    }
    const result = await this.prisma.conversation.updateMany({
      where: { id: conversationId, storeId },
      data: { assignedUserId: agentUserId, status: 'HANDLED', botEnabled: false },
    });
    if (result.count === 0) throw new NotFoundException('Conversation not found');
    return { ok: true };
  }

  async toggleBot(conversationId: string, enabled: boolean) {
    const { storeId } = TenantContext.require();
    const result = await this.prisma.conversation.updateMany({
      where: { id: conversationId, storeId },
      data: { botEnabled: enabled, ...(enabled ? { status: 'BOT', assignedUserId: null } : {}) },
    });
    if (result.count === 0) throw new NotFoundException('Conversation not found');
    return { ok: true };
  }
}
