import type { Campaign } from '@prisma/client';
import { NotFoundError, ValidationError } from '@wco/shared';

import { enqueueCampaignDispatch } from '../jobs/queues.js';
import { prisma } from '../lib/prisma.js';

/**
 * Marketing campaigns — bulk WhatsApp broadcasts to filtered audiences.
 *
 * Lifecycle: DRAFT -> SCHEDULED (future send) or RUNNING -> COMPLETED.
 * Launch materializes audience rows into campaign_messages (queued), then a
 * single BullMQ job fans out through the whatsapp-send pipeline with rate
 * limiting — Meta bans numbers that blast too fast, so the dispatch
 * processor paces sends and records per-customer status.
 */

export interface AudienceFilter {
  readonly tags?: string[];
  readonly segment?: string;
  readonly minOrders?: number;
  readonly marketingOptInOnly?: boolean;
}

export class CampaignsService {
  constructor(private readonly db = prisma) {}

  async create(
    storeId: string,
    input: { type: Campaign['type']; name: string; messageBody: string; audienceFilter: AudienceFilter; scheduledFor?: Date },
  ): Promise<Campaign> {
    if (!input.name.trim()) throw new ValidationError('Campaign name is required');
    return this.db.campaign.create({
      data: {
        storeId,
        type: input.type,
        name: input.name,
        messageBody: input.messageBody,
        audienceFilter: input.audienceFilter as object,
        scheduledFor: input.scheduledFor ?? null,
        status: input.scheduledFor ? 'SCHEDULED' : 'DRAFT',
      },
    });
  }

  async list(storeId: string): Promise<Campaign[]> {
    return this.db.campaign.findMany({ where: { storeId }, orderBy: { createdAt: 'desc' }, take: 100 });
  }

  async get(storeId: string, campaignId: string): Promise<Campaign> {
    const campaign = await this.db.campaign.findFirst({ where: { id: campaignId, storeId } });
    if (!campaign) throw new NotFoundError('Campaign');
    return campaign;
  }

  /** Materialize audience + enqueue fan-out. Idempotent while RUNNING. */
  async launch(storeId: string, campaignId: string): Promise<{ campaign: Campaign; audienceSize: number }> {
    const campaign = await this.get(storeId, campaignId);
    if (!['DRAFT', 'SCHEDULED', 'PAUSED'].includes(campaign.status)) {
      throw new ValidationError(`Cannot launch campaign in status ${campaign.status}`);
    }

    // Re-materialization on relaunch must not double-send: wipe pending rows.
    await this.db.campaignMessage.deleteMany({ where: { campaignId, status: 'queued' } });

    const filter = (campaign.audienceFilter ?? {}) as AudienceFilter;
    const audience = await this.db.customer.findMany({
      where: {
        storeId,
        ...(filter.tags?.length ? { tags: { hasSome: filter.tags } } : {}),
        ...(filter.segment ? { segment: filter.segment } : {}),
        ...(filter.minOrders ? { ordersCount: { gte: filter.minOrders } } : {}),
        ...(filter.marketingOptInOnly === false ? {} : { marketingOptIn: true }),
      },
      select: { id: true },
    });

    await this.db.$transaction(
      audience.map((customer) =>
        this.db.campaignMessage.create({
          data: { campaignId, customerId: customer.id, status: 'queued' },
        }),
      ),
    );

    const updated = await this.db.campaign.update({
      where: { id: campaignId },
      data: { status: 'RUNNING', startedAt: new Date() },
    });
    await enqueueCampaignDispatch({ campaignId, storeId });
    return { campaign: updated, audienceSize: audience.length };
  }

  async pause(storeId: string, campaignId: string): Promise<Campaign> {
    await this.get(storeId, campaignId);
    return this.db.campaign.update({ where: { id: campaignId }, data: { status: 'PAUSED' } });
  }

  async cancel(storeId: string, campaignId: string): Promise<Campaign> {
    await this.get(storeId, campaignId);
    await this.db.campaignMessage.deleteMany({ where: { campaignId, status: 'queued' } });
    return this.db.campaign.update({
      where: { id: campaignId },
      data: { status: 'PAUSED', completedAt: new Date() },
    });
  }

  async stats(storeId: string, campaignId: string): Promise<Record<string, number>> {
    await this.get(storeId, campaignId);
    const grouped = await this.db.campaignMessage.groupBy({
      by: ['status'],
      where: { campaignId },
      _count: { _all: true },
    });
    return Object.fromEntries(grouped.map((g) => [g.status, g._count._all]));
  }
}

export const campaignsService = new CampaignsService();
