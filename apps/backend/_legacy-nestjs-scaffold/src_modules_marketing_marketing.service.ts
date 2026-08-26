import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@wco/database';
import { RabbitMQService } from '../../infrastructure/queue/rabbitmq.service';
import { TenantContext } from '../../common/context/tenant-context';

/**
 * MarketingService — campaigns & automation rules.
 *
 * Campaign launch is ALWAYS async: a 10K-customer blast must never run in
 * the request path. Launch enqueues one job; workers fan out with rate
 * limiting to respect WhatsApp messaging tiers.
 */
@Injectable()
export class MarketingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rabbitmq: RabbitMQService,
  ) {}

  // ---- Campaigns -----------------------------------------------------------

  async listCampaigns() {
    const { storeId } = TenantContext.require();
    return this.prisma.campaign.findMany({
      where: { storeId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, name: true, type: true, status: true, scheduledFor: true,
        statsSent: true, statsDelivered: true, statsReplied: true, createdAt: true,
      },
    });
  }

  async createCampaign(input: {
    type: string;
    name: string;
    audienceFilter: Record<string, unknown>;
    messageBody: string;
    scheduledFor?: Date;
  }) {
    const { storeId } = TenantContext.require();
    if (!input.messageBody.trim()) throw new BadRequestException('Message body required');

    return this.prisma.campaign.create({
      data: {
        storeId,
        type: input.type as never,
        name: input.name,
        audienceFilter: input.audienceFilter as never,
        messageBody: input.messageBody,
        scheduledFor: input.scheduledFor,
        status: input.scheduledFor ? 'SCHEDULED' : 'DRAFT',
      },
      select: { id: true, name: true, status: true, scheduledFor: true },
    });
  }

  /**
   * Preview how many customers match — lets merchants sanity-check audience
   * size BEFORE paying for a send.
   */
  async previewAudience(audienceFilter: Record<string, unknown>) {
    const { storeId } = TenantContext.require();
    const where = this.buildAudienceWhere(storeId, audienceFilter);
    return { count: await this.prisma.customer.count({ where }) };
  }

  async launchCampaign(campaignId: string) {
    const { storeId } = TenantContext.require();
    const campaign = await this.prisma.campaign.findFirst({
      where: { id: campaignId, storeId },
    });
    if (!campaign) throw new NotFoundException('Campaign not found');
    if (!['DRAFT', 'PAUSED'].includes(campaign.status)) {
      throw new BadRequestException(`Campaign is ${campaign.status}`);
    }

    await this.prisma.campaign.update({
      where: { id: campaign.id },
      data: { status: 'RUNNING', startedAt: new Date() },
    });
    await this.rabbitmq.publish('marketing.campaign.launch', {
      campaignId: campaign.id,
      storeId,
    });
    return { ok: true };
  }

  private buildAudienceWhere(storeId: string, filter: Record<string, unknown>) {
    const f = filter as { tags?: string[]; minOrders?: number; minSpent?: number; segment?: string };
    return {
      storeId,
      marketingOptIn: true, // hard requirement — never message non-consenting users
      ...(f.tags?.length ? { tags: { hasSome: f.tags } } : {}),
      ...(f.segment ? { segment: f.segment } : {}),
      ...(f.minOrders ? { ordersCount: { gte: f.minOrders } } : {}),
      ...(f.minSpent ? { totalSpent: { gte: f.minSpent } } : {}),
    };
  }

  // ---- Automation rules ----------------------------------------------------

  async listRules() {
    const { storeId } = TenantContext.require();
    return this.prisma.automationRule.findMany({
      where: { storeId },
      orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
    });
  }

  async createRule(input: {
    trigger: string;
    conditions?: Record<string, unknown>;
    messageBody: string;
    delayMinutes?: number;
  }) {
    const { storeId } = TenantContext.require();
    return this.prisma.automationRule.create({
      data: {
        storeId,
        trigger: input.trigger as never,
        conditions: (input.conditions ?? {}) as never,
        messageBody: input.messageBody,
        delayMinutes: input.delayMinutes ?? 0,
      },
      select: { id: true, trigger: true, isEnabled: true },
    });
  }

  async toggleRule(ruleId: string, enabled: boolean) {
    const { storeId } = TenantContext.require();
    const result = await this.prisma.automationRule.updateMany({
      where: { id: ruleId, storeId },
      data: { isEnabled: enabled },
    });
    if (result.count === 0) throw new NotFoundException('Automation rule not found');
    return { ok: true };
  }
}
