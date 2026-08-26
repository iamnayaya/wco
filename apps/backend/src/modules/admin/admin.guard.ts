import { timingSafeEqual } from 'node:crypto';

import type { NextFunction, Request, Response } from 'express';

import { env } from '../../config/env.js';

/**
 * Admin API-key middleware - platform-operator access (internal ops dashboards).
 *
 * The key lives in a separate trust domain from user JWTs: it is compared
 * constant-time and never grants merchant data isolation bypasses beyond the
 * aggregate reads below. When ADMIN_API_KEY is unset the routes behave as
 * nonexistent (404), so staging builds without the secret don't leak an
 * admin surface.
 */
export function adminApiKeyGuard(req: Request, res: Response, next: NextFunction): void {
  const expected = env.ADMIN_API_KEY;
  if (!expected) {
    res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Route does not exist' } });
    return;
  }
  const provided = req.headers['x-admin-key'];
  if (typeof provided !== 'string' || !safeKeyEqual(provided, expected)) {
    res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Invalid admin key' } });
    return;
  }
  next();
}

function safeKeyEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
}
