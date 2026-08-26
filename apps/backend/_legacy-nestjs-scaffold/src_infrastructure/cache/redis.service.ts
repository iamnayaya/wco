import { Inject, Injectable } from '@nestjs/common';
import type Redis from 'ioredis';

export const REDIS_CLIENT = Symbol('REDIS_CLIENT');

const IDEMPOTENCY_TTL_SECONDS = 24 * 60 * 60;

/**
 * RedisService — typed facade over the shared ioredis client.
 * Keep all cache key conventions in ONE place:
 *   idem:<userId>:<route>:<key>   idempotent response replay
 *   rl:<scope>:<identifier>       rate-limit counters (throttler storage)
 *   conv:<storeId>:<customerId>   hot conversation cache
 *   dash:<storeId>:<range>        dashboard aggregate cache
 */
@Injectable()
export class RedisService {
  constructor(@Inject(REDIS_CLIENT) public readonly client: Redis) {}

  async getJson<T>(key: string): Promise<T | null> {
    const raw = await this.client.get(key);
    return raw ? (JSON.parse(raw) as T) : null;
  }

  async setJson(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    await this.client.setex(key, ttlSeconds, JSON.stringify(value));
  }

  async getIdempotentResponse(
    key: string,
  ): Promise<{ status: number; body: unknown } | null> {
    return this.getJson(key);
  }

  async setIdempotentResponse(key: string, status: number, body: unknown): Promise<void> {
    await this.setJson(key, { status, body }, IDEMPOTENCY_TTL_SECONDS);
  }

  async invalidatePattern(pattern: string): Promise<number> {
    let invalidated = 0;
    let cursor = '0';
    do {
      const [next, keys] = await this.client.scan(cursor, 'MATCH', pattern, 'COUNT', 200);
      cursor = next;
      if (keys.length > 0) {
        await this.client.del(...keys);
        invalidated += keys.length;
      }
    } while (cursor !== '0');
    return invalidated;
  }

  async healthCheck(): Promise<boolean> {
    try {
      const pong = await this.client.ping();
      return pong === 'PONG';
    } catch {
      return false;
    }
  }
}
