import { AppError } from '@wco/shared';
import type { NextFunction, Request, Response } from 'express';
import type { Redis } from 'ioredis';

import { REDIS_PREFIX, RATE_LIMITS } from '../config/constants.js';
import { env } from '../config/env.js';
import { getRedis } from '../lib/redis.js';
import { logger } from '../lib/logger.js';

/**
 * Distributed sliding-window rate limiter on Redis.
 *
 * Implementation: fixed-window INCR + PEXPIRE via pipeline. A true token
 * bucket is smoother, but this costs one round-trip and at our window sizes
 * (< 1 min) boundary burst of 2x is an accepted trade-off — documented in
 * docs/adr/0007-rate-limiting.md. Keyed by authenticated user when present,
 * else IP; separate buckets per route class so /auth can be stricter than
 * general API traffic without coupling their budgets.
 *
 * Degradation: when Redis is unreachable (cache-less/free-tier deployments)
 * the limiter falls back to a single-process fixed-window counter so API
 * calls never 500 out because the cache is down. The fallback is not shared
 * across replicas — acceptable for single-instance deployments.
 */

export interface RateLimitOptions {
  readonly windowSeconds: number;
  readonly max: number;
  readonly keyPrefix: string;
}

interface MemoryWindow {
  count: number;
  resetAt: number;
}

const memoryStore = new Map<string, MemoryWindow>();
const MEMORY_MAX_KEYS = 10_000;

function memoryIncr(key: string, windowMs: number): number {
  const now = Date.now();
  if (memoryStore.size >= MEMORY_MAX_KEYS) {
    for (const [k, v] of memoryStore) if (v.resetAt <= now) memoryStore.delete(k);
  }
  const hit = memoryStore.get(key);
  if (!hit || hit.resetAt <= now) {
    memoryStore.set(key, { count: 1, resetAt: now + windowMs });
    return 1;
  }
  hit.count += 1;
  return hit.count;
}

function identity(req: Request): string {
  if (req.auth?.userId) return `u:${req.auth.userId}`;
  return `ip:${req.ip ?? 'unknown'}`;
}

export function rateLimit(options: RateLimitOptions): (req: Request, res: Response, next: NextFunction) => void {
  const redis: () => Redis = getRedis;

  return (req: Request, res: Response, next: NextFunction): void => {
    const window = Math.floor(Date.now() / (options.windowSeconds * 1000));
    const key = `${REDIS_PREFIX.RATE_LIMIT}${options.keyPrefix}:${identity(req)}:${window}`;
    const windowMs = options.windowSeconds * 1000;
    const resetAt = (window + 1) * windowMs;

    const applyLimits = (hits: number): void => {
      res.setHeader('X-RateLimit-Limit', options.max);
      res.setHeader('X-RateLimit-Remaining', Math.max(0, options.max - hits));
      res.setHeader('X-RateLimit-Reset', String(Math.ceil(resetAt / 1000)));

      if (hits > options.max) {
        const retryAfterSec = Math.max(1, Math.ceil((resetAt - Date.now()) / 1000));
        res.setHeader('Retry-After', retryAfterSec);
        next(new AppError('RATE_LIMITED', 'Too many requests — please slow down'));
        return;
      }
      next();
    };

    void redis()
      .pipeline().incr(key).pexpire(key, windowMs).exec()
      .then((result) => {
        // exec returns [[err, value], ...] — incr result is index 0
        const err0 = result?.[0]?.[0];
        if (err0) throw err0;
        applyLimits(Number(result?.[0]?.[1] ?? 1));
      })
      .catch((err: unknown) => {
        logger.warn('rate-limit.redis-fallback', {
          message: err instanceof Error ? err.message : String(err),
        });
        applyLimits(memoryIncr(key, windowMs));
      });
  };
}

/** Presets aligned with @wco/shared RATE_LIMITS. */
export const defaultApiRateLimit = (): ReturnType<typeof rateLimit> =>
  rateLimit({
    windowSeconds: env.RATE_LIMIT_WINDOW_SECONDS,
    max: env.RATE_LIMIT_MAX_REQUESTS,
    keyPrefix: 'api',
  });

export const authRateLimit = (): ReturnType<typeof rateLimit> =>
  rateLimit({
    windowSeconds: 60,
    max: Math.min(env.AUTH_RATE_LIMIT_MAX, RATE_LIMITS.AUTH_PER_MINUTE),
    keyPrefix: 'auth',
  });
