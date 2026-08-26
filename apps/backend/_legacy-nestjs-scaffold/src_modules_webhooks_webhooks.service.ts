import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { PrismaService } from '@wco/database';
import { EVENT_TYPES, type EventType } from '@wco/shared';
import { TenantContext } from '../../common/context/tenant-context';

/**
 * WebhooksService — merchant outbound subscriptions (WCO -> merchant URL).
 *
 * Delivery contract (docs/api/webhooks-outbound.md):
 *  - POST with JSON body; header `X-WCO-Signature: sha256=<hmac>`
 *  - HMAC-SHA256 over raw body using the subscription secret
 *  - At-least-once: retries 5x exponential backoff via queue workers
 */
@Injectable()
export class WebhooksService {
  constructor(private readonly prisma: PrismaService) {}

  listEventTypes(): string[] {
    return [...EVENT_TYPES];
  }

  async list() {
    const { storeId } = TenantContext.require();
    return this.prisma.webhookSubscription.findMany({
      where: { storeId },
      // secret NEVER leaves the API after creation
      select: { id: true, url: true, events: true, isActive: true, createdAt: true },
    });
  }

  async create(url: string, events: EventType[]) {
    const { storeId } = TenantContext.require();
    this.assertHttpsUrl(url);
    this.assertKnownEvents(events);

    const secret = `whsec_${randomBytes(24).toString('base64url')}`;
    const subscription = await this.prisma.webhookSubscription.create({
      data: { storeId, url, events, secret },
      select: { id: true, url: true, events: true, isActive: true, createdAt: true },
    });

    // The secret is shown exactly once at creation — Stripe-style UX
    return { ...subscription, secret };
  }

  async toggle(subscriptionId: string, isActive: boolean) {
    const { storeId } = TenantContext.require();
    const result = await this.prisma.webhookSubscription.updateMany({
      where: { id: subscriptionId, storeId },
      data: { isActive },
    });
    if (result.count === 0) throw new NotFoundException('Webhook subscription not found');
    return { ok: true };
  }

  async remove(subscriptionId: string) {
    const { storeId } = TenantContext.require();
    await this.prisma.webhookSubscription.deleteMany({
      where: { id: subscriptionId, storeId },
    });
    return { ok: true };
  }

  private assertHttpsUrl(url: string): void {
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      throw new BadRequestException('Invalid URL');
    }
    if (parsed.protocol !== 'https:' && process.env.NODE_ENV === 'production') {
      throw new BadRequestException('Webhook URLs must use HTTPS in production');
    }
  }

  private assertKnownEvents(events: EventType[]): void {
    const known = new Set<string>(EVENT_TYPES);
    const unknown = events.filter((e) => !known.has(e));
    if (unknown.length > 0) {
      throw new BadRequestException(`Unknown event types: ${unknown.join(', ')}`);
    }
  }
}
