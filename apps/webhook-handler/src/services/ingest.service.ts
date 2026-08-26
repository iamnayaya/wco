import type Redis from 'ioredis';
import type { Channel } from 'amqplib';
import { EXCHANGES } from '@wco/shared';

/**
 * IngestService — the whole point of this service.
 *
 * Contract: verify -> dedupe -> persist-minimal -> publish -> 200 OK.
 * Target p99 under 50ms. NO business logic lives here; downstream
 * consumers own state transitions. If Redis or RabbitMQ is down we return
 * 503 so providers RETRY (their backoff is our durability).
 */
export class IngestService {
  constructor(
    private readonly redis: Redis,
    private readonly channelFn: () => Channel,
  ) {}

  /**
   * Idempotency gate — providers retry aggressively (Paystack up to 4x,
   * Meta indefinitely on timeout). SET NX with 48h TTL collapses duplicates
   * before they touch any queue.
   */
  async acquireDedupeKey(key: string): Promise<boolean> {
    if (!key) return true;
    const result = await this.redis.set(`wh:${key}`, '1', 'EX', 172_800, 'NX');
    return result === 'OK';
  }

  /** Release a claimed dedupe key when we fail BEFORE publishing. */
  async releaseDedupeKey(key: string): Promise<void> {
    if (key) await this.redis.del(`wh:${key}`);
  }

  async publish(routingKey: string, payload: object): Promise<void> {
    const channel = this.channelFn();
    if (!channel) throw new Error('RabbitMQ channel not ready');
    channel.publish(
      EXCHANGES.DOMAIN_EVENTS,
      routingKey,
      Buffer.from(JSON.stringify({ ...payload, ingestedAt: new Date().toISOString() })),
      { persistent: true, contentType: 'application/json', timestamp: Date.now() },
    );
  }
}
