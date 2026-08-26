import { CACHE_TTL } from '@wco/shared';
import type { NextFunction, Request, Response } from 'express';

import { REDIS_PREFIX } from '../config/constants.js';
import { getRedis } from '../lib/redis.js';

/**
 * Idempotency-Key middleware for unsafe methods (POST /payments, /orders).
 *
 * Contract: client sends a unique key per logical operation. First execution
 * caches the response for 24h; retries with the same key replay the cached
 * response with `Idempotent-Replayed: true` instead of double-charging.
 * Keys in flight (no cached response yet) reject concurrent duplicates.
 */
export function idempotency(): (req: Request, res: Response, next: NextFunction) => void {
  return (req, res, next): void => {
    if (!['POST', 'PATCH', 'PUT'].includes(req.method)) { next(); return; }

    const key = req.headers['idempotency-key'];
    if (typeof key !== 'string' || key.length < 8 || key.length > 255) { next(); return; }

    const redisKey = `${REDIS_PREFIX.IDEMPOTENCY}${req.method}:${req.originalUrl}:${key}`;
    const redis = getRedis();

    void redis
      .set(redisKey, '__in_flight__', 'EX', 30, 'NX')
      .then((claimed) => {
        if (!claimed) {
          void redis
            .get(redisKey)
            .then((existing) => {
              if (existing && existing !== '__in_flight__') {
                res.setHeader('Idempotent-Replayed', 'true');
                res.status(200).json(JSON.parse(existing));
                return;
              }
              res.status(409).json({
                success: false,
                error: { code: 'IDEMPOTENCY_REPLAY', message: 'Request already in flight' },
              });
            })
            .catch(next);
          return;
        }

        const originalJson = res.json.bind(res);
        res.json = (body) => {
          if (res.statusCode < 500) {
            void redis.set(redisKey, JSON.stringify(body), 'EX', CACHE_TTL.IDEMPOTENCY_SECONDS);
          }
          return originalJson(body);
        };
        next();
      })
      .catch(() => { next(); }); // Redis down → fail open; DB constraints are the backstop
  };
}
