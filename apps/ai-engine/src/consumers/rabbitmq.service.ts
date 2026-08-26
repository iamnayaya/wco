import * as amqp from 'amqplib';
import type { Channel, ChannelModel, ConsumeMessage } from 'amqplib';
import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { EXCHANGES } from '@wco/shared';

/**
 * RabbitMQService (AI Engine copy) — consumer-first broker client.
 * Identical topology contract to the backend publisher so both sides agree
 * on exchange names and routing keys without sharing runtime state.
 */
@Injectable()
export class RabbitMQService implements OnModuleDestroy {
  private readonly logger = new Logger(RabbitMQService.name);
  private connection: ChannelModel | null = null;
  private channel: Channel | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;

  constructor(private readonly url: string) {}

  async connect(): Promise<void> {
    try {
      this.connection = await amqp.connect(this.url);
      this.channel = await this.connection.createChannel();
      await this.channel.assertExchange(EXCHANGES.DOMAIN_EVENTS, 'topic', { durable: true });
      await this.channel.assertExchange(EXCHANGES.DEAD_LETTER, 'topic', { durable: true });
      this.connection.on('error', () => void this.scheduleReconnect());
      this.connection.on('close', () => void this.scheduleReconnect());
    } catch (error) {
      this.logger.error('rabbitmq.initial-connect-failed — retrying in 5s');
      await new Promise((r) => setTimeout(r, 5000));
      return this.connect();
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    await this.channel?.close().catch(() => undefined);
    await this.connection?.close().catch(() => undefined);
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    this.channel = null;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      void this.connect();
    }, 5000);
  }

  async publish(routingKey: string, payload: object): Promise<void> {
    if (!this.channel) throw new Error('RabbitMQ channel not ready');
    this.channel.publish(
      EXCHANGES.DOMAIN_EVENTS,
      routingKey,
      Buffer.from(JSON.stringify(payload)),
      { persistent: true, contentType: 'application/json', timestamp: Date.now() },
    );
  }

  async consume(
    queueName: string,
    routingPatterns: string[],
    handler: (payload: Record<string, unknown>) => Promise<void>,
    options: { prefetch?: number } = {},
  ): Promise<void> {
    const channel = this.getChannel();
    const dlxArgs: Record<string, unknown> = {
      'x-dead-letter-exchange': EXCHANGES.DEAD_LETTER,
      'x-dead-letter-routing-key': `dead.${queueName}`,
    };
    await channel.assertQueue(queueName, { durable: true, arguments: dlxArgs });
    for (const pattern of routingPatterns) {
      await channel.bindQueue(queueName, EXCHANGES.DOMAIN_EVENTS, pattern);
    }
    channel.prefetch(options.prefetch ?? 16);
    void channel.consume(queueName, async (msg) => {
      if (!msg) return;
      try {
        await handler(JSON.parse(msg.content.toString()) as Record<string, unknown>);
        channel.ack(msg);
      } catch (error) {
        // Poison messages go straight to DLQ; transient errors requeue once.
        const redelivered = msg.fields.redelivered;
        if (redelivered) {
          this.logger.error({ err: error }, `dead-lettering ${queueName} message`);
          channel.nack(msg, false, false);
        } else {
          channel.nack(msg, false, true);
        }
      }
    });
  }

  private getChannel(): Channel {
    if (!this.channel) throw new Error('RabbitMQ channel not ready');
    return this.channel;
  }
}
