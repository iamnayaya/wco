import Redis from 'ioredis';

import { env } from '../config/env.js';

import { logger } from './logger.js';

/**
 * Redis connection singleton (ioredis).
 *
 * - `maxRetriesPerRequest: 2` bounds request-level retries so a Redis blip
 *   surfaces as a fast error instead of a pile-up.
 * - Callers MUST treat Redis as a cache/coordination layer only — durable
 *   state lives in Postgres. Every cache read needs a DB fallback path.
 */

export interface CacheClient {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, mode: 'EX', ttlSeconds: number): Promise<unknown>;
  del(...keys: string[]): Promise<number>;
  incr(key: string): Promise<number>;
  expire(key: string, seconds: number): Promise<number>;
  pexpire(key: string, ms: number): Promise<number>;
  ttl(key: string): Promise<number>;
}

let redisSingleton: Redis | null = null;

export function getRedis(): Redis {
  if (!redisSingleton) {
    redisSingleton = new Redis(env.REDIS_URL, {
      maxRetriesPerRequest: 2,
      lazyConnect: false,
      retryStrategy: (times) => Math.min(times * 500, 5000),
    });
    redisSingleton.on('error', (err) => logger.error('redis.error', { message: err.message }));
    redisSingleton.on('connect', () => logger.info('redis.connected'));
  }
  return redisSingleton;
}

export async function checkRedisHealth(): Promise<boolean> {
  try {
    // Widen the literal: ioredis types zero-arg ping() as Promise<'PONG'>.
    const pong: string = await getRedis().ping();
    return pong === 'PONG';
  } catch {
    return false;
  }
}

export async function disconnectRedis(): Promise<void> {
  redisSingleton?.disconnect();
  redisSingleton = null;
}
