import * as amqp from 'amqplib';
import type { Channel } from 'amqplib';
import { EXCHANGES, ROUTING_KEYS } from '@wco/shared';

/**
 * AnalyticsEventBus — publishes behavioral events to the domain topic
 * exchange. Fire-and-forget by design: analytics must never block or fail a
 * customer-facing request. Delivery risk is acceptable; rollups tolerate loss.
 */
export class AnalyticsEventBus {
  private channel: Channel | null = null;
  private connecting: Promise<Channel> | null = null;

  constructor(private readonly rabbitmqUrl: string) {}

  async publish(storeId: string, customerId: string | undefined, type: string, props: Record<string, unknown>): Promise<void> {
    try {
      const channel = await this.ensureChannel();
      channel.publish(
        EXCHANGES.DOMAIN_EVENTS,
        ROUTING_KEYS.ANALYTICS_EVENT,
        Buffer.from(
          JSON.stringify({
            storeId,
            customerId,
            type,
            props,
            occurredAt: new Date().toISOString(),
          }),
        ),
        { persistent: false, contentType: 'application/json' },
      );
    } catch {
      // Swallow: analytics loss < request latency. Counters alert via metrics.
    }
  }

  private async ensureChannel(): Promise<Channel> {
    if (this.channel) return this.channel;
    this.connecting ??= (async () => {
      const connection = await amqp.connect(this.rabbitmqUrl);
      const channel = await connection.createChannel();
      await channel.assertExchange(EXCHANGES.DOMAIN_EVENTS, 'topic', { durable: true });
      connection.on('error', () => {
        this.channel = null;
        this.connecting = null;
      });
      this.channel = channel;
      return channel;
    })();
    return this.connecting;
  }
}
