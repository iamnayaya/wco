import { CACHE_TTL } from '@wco/shared';
import type { Redis } from 'ioredis';

import { REDIS_PREFIX } from '../config/constants.js';
import { logger } from '../lib/logger.js';
import { getRedis } from '../lib/redis.js';

/**
 * Cache service — thin JSON layer over Redis with a read-through helper.
 *
 * Contract: cache is ALWAYS optional. Every method swallows Redis errors and
 * falls back to the loader — a Redis outage degrades latency, not correctness.
 */

export class CacheService {
  constructor(private readonly client: () => Redis = getRedis) {}

  async get<T>(key: string): Promise<T | null> {
    try {
      const raw = await this.client().get(`${REDIS_PREFIX.CACHE}${key}`);
      return raw ? (JSON.parse(raw) as T) : null;
    } catch {
      return null;
    }
  }

  async set(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    try {
      await this.client().set(`${REDIS_PREFIX.CACHE}${key}`, JSON.stringify(value), 'EX', ttlSeconds);
    } catch {
      // best-effort
    }
  }

  /** Read-through: return cached value or compute via loader and store it. */
  async wrap<T>(key: string, ttlSeconds: number, loader: () => Promise<T>): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) return cached;
    const fresh = await loader();
    await this.set(key, fresh, ttlSeconds);
    return fresh;
  }

  async invalidate(...keys: string[]): Promise<void> {
    if (keys.length === 0) return;
    try {
      await this.client().del(...keys.map((k) => `${REDIS_PREFIX.CACHE}${k}`));
    } catch (err) {
      logger.warn('cache.invalidate-failed', { message: err instanceof Error ? err.message : String(err) });
    }
  }

  /**
   * Pattern invalidation via SCAN (never KEYS — O(n) blocking in prod Redis).
   * Used when catalog changes must flush `catalog:{storeId}:*`.
   */
  async invalidatePattern(pattern: string): Promise<number> {
    let deleted = 0;
    try {
      const stream = this.client().scanStream({ match: `${REDIS_PREFIX.CACHE}${pattern}`, count: 200 });
      await new Promise<void>((resolve) => {
        stream.on('data', (keys: string[]) => {
          if (keys.length === 0) return;
          deleted += keys.length;
          void this.client().del(...keys);
        });
        stream.on('end', () => { resolve(); });
        stream.on('error', () => { resolve(); });
      });
    } catch (err) {
      logger.warn('cache.invalidate-pattern-failed', {
        pattern,
        message: err instanceof Error ? err.message : String(err),
      });
    }
    return deleted;
  }

  /** Warm frequently-read keys (called after deploys / cache flushes). */
  async warm(storeId: string, loaders: Record<string, () => Promise<unknown>>): Promise<void> {
    for (const [key, load] of Object.entries(loaders)) {
      await this.wrap(key, CACHE_TTL.PRODUCT_CATALOG_SECONDS, load);
    }
    logger.info('cache.warmed', { storeId, keys: Object.keys(loaders).length });
  }
}

export const cacheService = new CacheService();
