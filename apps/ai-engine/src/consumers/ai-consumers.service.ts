import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import type { WhatsAppProvider } from '@wco/messaging';
import { MetaWhatsAppProvider, TwilioWhatsAppProvider } from '@wco/messaging';
import { PrismaService } from '@wco/database';
import type { InboundMessagePayload } from '@wco/shared';
import { RabbitMQService } from './rabbitmq.service';
import { AutoResponderService } from '../modules/auto-responder/auto-responder.service';
import { PricingOptimizerService } from '../modules/pricing-optimizer/pricing-optimizer.service';
import { DemandForecastingService } from '../modules/demand-forecasting/demand-forecasting.service';
import { CustomerSegmentationService } from '../modules/customer-segmentation/customer-segmentation.service';

/**
 * AiConsumers — the AI engine's real entrypoints.
 *
 *   message.received      -> sentiment triage -> auto-responder -> send
 *   ai.pricing.optimize   -> nightly/queued price suggestion batch
 *   cron (2am)            -> demand forecasting + segmentation
 */
@Injectable()
export class AiConsumers implements OnApplicationBootstrap {
  private readonly logger = new Logger(AiConsumers.name);
  private readonly provider: WhatsAppProvider;

  constructor(
    private readonly rabbitmq: RabbitMQService,
    private readonly prisma: PrismaService,
    private readonly autoResponder: AutoResponderService,
    private readonly pricingOptimizer: PricingOptimizerService,
    private readonly forecaster: DemandForecastingService,
    private readonly segmentation: CustomerSegmentationService,
  ) {
    this.provider =
      process.env.WHATSAPP_PROVIDER === 'meta'
        ? new MetaWhatsAppProvider(process.env.META_ACCESS_TOKEN ?? '')
        : new TwilioWhatsAppProvider(
            process.env.TWILIO_ACCOUNT_SID ?? '',
            process.env.TWILIO_AUTH_TOKEN ?? '',
          );
  }

  async onApplicationBootstrap(): Promise<void> {
    await this.rabbitmq.connect();

    await this.rabbitmq.consume(
      'ai-engine.messages',
      ['message.received'],
      (payload) => this.handleInboundMessage(payload as unknown as InboundMessagePayload),
      { prefetch: Number(process.env.AI_QUEUE_CONCURRENCY ?? 16) },
    );

    await this.rabbitmq.consume('ai-engine.pricing', ['ai.pricing.optimize'], (payload) =>
      this.handlePricingOptimize(payload),
    );
  }

  /** Flagship path: customer message in, AI reply out, target <5s. */
  private async handleInboundMessage(payload: InboundMessagePayload): Promise<void> {
    if (payload.type !== 'text' || !payload.body) return; // media: agent review only

    const conversation = await this.prisma.conversation.findFirst({
      where: { id: payload.conversationId, storeId: payload.storeId },
      include: {
        store: { select: { whatsappNameId: true } },
        customer: { select: { name: true, ordersCount: true } },
      },
    });
    if (!conversation) throw new Error(`Conversation ${payload.conversationId} not found`);

    // Human took over — bot stands down
    if (!conversation.botEnabled) return;

    // Angry customer? Escalate to a human instead of bot-replying.
    if (process.env.FEATURE_AI_SENTIMENT_ANALYSIS === 'true') {
      // v1: cheap keyword pre-filter; full classifier runs post-reply
      const angry = /(refund|scam|report you|police|lawyer|angry|useless)/i.test(payload.body);
      if (angry) {
        await this.escalate(conversation.id);
        return;
      }
    }

    const reply = await this.autoResponder.generateReply({
      messageId: payload.messageId,
      storeId: payload.storeId,
      customerPhone: payload.fromPhone,
      customerName: conversation.customer.name?.split(' ')[0] ?? 'there',
      body: payload.body,
      previousOrders: conversation.customer.ordersCount,
    });

    const phoneNumberId = conversation.store.whatsappNameId;
    if (!phoneNumberId) throw new Error('Store has no connected WhatsApp number');

    const result = await this.provider.sendMessage(phoneNumberId, {
      to: payload.fromPhone,
      type: 'TEXT',
      body: reply.text,
    });

    await this.persistOutbound(conversation.id, reply.text, result.providerMessageId);

    await this.rabbitmq.publish('ai.reply.generated', {
      conversationId: conversation.id,
      storeId: payload.storeId,
      messageId: result.providerMessageId,
      modelUsed: reply.modelUsed,
      latencyMs: reply.latencyMs,
      escalated: reply.escalate,
    });

    if (reply.escalate) await this.escalate(conversation.id);
  }

  private async escalate(conversationId: string): Promise<void> {
    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { status: 'HANDLED', botEnabled: false },
    });
    await this.rabbitmq.publish('conversation.escalated', { conversationId });
  }

  private async persistOutbound(
    conversationId: string,
    body: string,
    providerMessageId: string,
  ): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.message.create({
        data: {
          conversationId,
          direction: 'OUTBOUND',
          type: 'TEXT',
          body,
          waMessageId: providerMessageId || undefined,
          status: 'SENT',
          sentByBot: true,
        },
      }),
      this.prisma.conversation.update({
        where: { id: conversationId },
        data: { lastMessagePreview: body.slice(0, 140), lastMessageAt: new Date() },
      }),
    ]);
  }

  private async handlePricingOptimize(payload: Record<string, unknown>): Promise<void> {
    const storeId = String(payload.storeId ?? '');
    if (!storeId) throw new Error('ai.pricing.optimize missing storeId');
    const created = await this.pricingOptimizer.optimizeStore(storeId);
    this.logger.log({ storeId, suggestionsCreated: created }, 'pricing.run.complete');
  }

  /** Nightly demand forecast across all active stores. */
  @Cron(process.env.CRON_DEMAND_FORECAST ?? '0 4 * * *', {
    timeZone: process.env.CRON_TIMEZONE ?? 'Africa/Lagos',
  })
  async nightlyForecast(): Promise<void> {
    const stores = await this.prisma.store.findMany({
      where: { status: 'ACTIVE' },
      select: { id: true },
    });
    for (const store of stores) {
      try {
        const count = await this.forecaster.forecastStore(store.id);
        this.logger.log({ storeId: store.id, productsForecasted: count }, 'forecast.complete');
      } catch (error) {
        // One bad store must never stop the batch
        this.logger.error({ err: error, storeId: store.id }, 'forecast.failed');
      }
    }
  }

  /** Weekly customer segmentation refresh. */
  @Cron(process.env.CRON_CUSTOMER_SEGMENTATION ?? '0 5 * * 1', {
    timeZone: process.env.CRON_TIMEZONE ?? 'Africa/Lagos',
  })
  async weeklySegmentation(): Promise<void> {
    const stores = await this.prisma.store.findMany({
      where: { status: 'ACTIVE' },
      select: { id: true },
    });
    for (const store of stores) {
      try {
        const updated = await this.segmentation.segmentStore(store.id);
        this.logger.log({ storeId: store.id, customersSegmented: updated }, 'segmentation.complete');
      } catch (error) {
        this.logger.error({ err: error, storeId: store.id }, 'segmentation.failed');
      }
    }
  }
}
