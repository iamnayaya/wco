import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@wco/database';
import { TenantContext } from '../../common/context/tenant-context';

/**
 * CustomersService — WhatsApp CRM.
 *
 * NDPR/GDPR duties implemented here:
 *  - export()   → full data portability (Art. 20)
 *  - erasure()  → anonymize while preserving financial audit trail (Art. 17)
 */
@Injectable()
export class CustomersService {
  constructor(private readonly prisma: PrismaService) {}

  async list(params: {
    search?: string;
    segment?: string;
    tag?: string;
    cursor?: string;
    limit?: number;
  }) {
    const { storeId } = TenantContext.require();
    const limit = Math.min(params.limit ?? 25, 100);

    const items = await this.prisma.customer.findMany({
      where: {
        storeId,
        ...(params.segment ? { segment: params.segment } : {}),
        ...(params.tag ? { tags: { has: params.tag } } : {}),
        ...(params.search
          ? { OR: [
              { name: { contains: params.search, mode: 'insensitive' } },
              { waPhone: { contains: params.search } },
            ] }
          : {}),
      },
      take: limit + 1,
      cursor: params.cursor ? { id: params.cursor } : undefined,
      orderBy: [{ lastOrderAt: 'desc' }, { id: 'asc' }],
      select: {
        id: true, waPhone: true, name: true, segment: true, sentiment: true,
        totalSpent: true, ordersCount: true, lastOrderAt: true,
        marketingOptIn: true, tags: true,
      },
    });

    const hasNext = items.length > limit;
    return {
      items: hasNext ? items.slice(0, -1) : items,
      nextCursor: hasNext ? items[items.length - 2]?.id ?? null : null,
    };
  }

  /** Full customer 360: profile + orders + conversations. */
  async get(customerId: string) {
    const { storeId } = TenantContext.require();
    const customer = await this.prisma.customer.findFirst({
      where: { id: customerId, storeId },
      include: {
        orders: {
          orderBy: { createdAt: 'desc' },
          take: 20,
          select: { id: true, orderNumber: true, status: true, total: true, createdAt: true },
        },
        conversations: {
          orderBy: { lastMessageAt: 'desc' },
          take: 5,
          select: { id: true, status: true, unreadCount: true, lastMessagePreview: true, lastMessageAt: true },
        },
      },
    });
    if (!customer) throw new NotFoundException('Customer not found');
    return customer;
  }

  async updateTags(customerId: string, tags: string[]) {
    const { storeId } = TenantContext.require();
    const result = await this.prisma.customer.updateMany({
      where: { id: customerId, storeId },
      data: { tags },
    });
    if (result.count === 0) throw new NotFoundException('Customer not found');
    return { ok: true };
  }

  async setMarketingOptIn(customerId: string, optedIn: boolean) {
    const { storeId } = TenantContext.require();
    // Opt-in is only meaningful with explicit consent evidence
    const result = await this.prisma.customer.updateMany({
      where: { id: customerId, storeId },
      data: { marketingOptIn: optedIn },
    });
    if (result.count === 0) throw new NotFoundException('Customer not found');
    await this.prisma.auditLog.create({
      data: {
        storeId,
        action: optedIn ? 'customer.marketing_optin' : 'customer.marketing_optout',
        resource: 'customer',
        resourceId: customerId,
      },
    });
    return { ok: true };
  }

  /** GDPR/NDPR Art. 20 — machine-readable export of everything we hold. */
  async export(customerId: string) {
    const { storeId } = TenantContext.require();
    const customer = await this.prisma.customer.findFirst({
      where: { id: customerId, storeId },
      include: {
        orders: { include: { items: true, payment: true, delivery: true } },
        conversations: { include: { messages: { orderBy: { createdAt: 'asc' } } } },
        campaignMsgs: true,
      },
    });
    if (!customer) throw new NotFoundException('Customer not found');

    return {
      exportedAt: new Date().toISOString(),
      format: 'WCO-CUSTOMER-EXPORT-v1',
      profile: { ...customer, store: undefined, orders: undefined, conversations: undefined, campaignMsgs: undefined },
      orders: customer.orders,
      conversations: customer.conversations,
      campaignMessages: customer.campaignMsgs,
    };
  }

  /**
   * GDPR/NDPR Art. 17 — right to erasure. Financial records must be kept
   * (tax law), so the customer row is ANONYMIZED instead of deleted; linked
   * message bodies are scrubbed. Order/payment records persist with no PII.
   */
  async erase(customerId: string, actorUserId: string) {
    const { storeId } = TenantContext.require();
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.customer.findFirst({ where: { id: customerId, storeId } });
      if (!existing) throw new NotFoundException('Customer not found');

      await tx.message.updateMany({
        where: { conversation: { customerId, storeId } },
        data: { body: '[ERASED PER DATA-SUBJECT REQUEST]', mediaUrl: null },
      });

      const anon = await tx.customer.update({
        where: { id: customerId },
        data: {
          waPhone: `anonymized-${customerId}@erased.wco`,
          name: 'Erased User',
          email: null,
          notes: null,
          tags: [],
          marketingOptIn: false,
        },
        select: { id: true },
      });

      await tx.auditLog.create({
        data: {
          storeId,
          actorUserId,
          action: 'customer.erasure',
          resource: 'customer',
          resourceId: customerId,
          before: { waPhone: 'redacted-from-audit-log', email: 'redacted-from-audit-log' },
        },
      });

      return anon;
    });
  }
}
