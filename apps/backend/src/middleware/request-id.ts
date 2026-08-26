import { randomUUID } from 'node:crypto';

import type { Request, Response, NextFunction } from 'express';

import { runWithRequestContext } from './request-context.js';

/**
 * Request ID + timing middleware.
 *
 * - Assigns/propagates `X-Request-Id` (honors upstream LB header) so a single
 *   request can be traced across gateway -> API -> worker logs.
 * - Records `X-Response-Time` and wraps the handler in the ALS context so
 *   every downstream log line carries the requestId automatically.
 */
export function requestIdMiddleware(): (req: Request, res: Response, next: NextFunction) => void {
  return (req, res, next) => {
    const incoming = req.headers['x-request-id'];
    const requestId = typeof incoming === 'string' && incoming.length <= 64 ? incoming : randomUUID();
    res.setHeader('X-Request-Id', requestId);
    res.setHeader('X-Request-Started-At', String(Date.now()));

    runWithRequestContext({ requestId, startedAt: Date.now() }, () => { next(); });
  };
}

/** Timing middleware — sets X-Response-Time on finish. */
export function timingMiddleware(): (req: Request, res: Response, next: NextFunction) => void {
  return (_req, res, next) => {
    const start = process.hrtime.bigint();
    res.on('finish', () => {
      const ms = Number(process.hrtime.bigint() - start) / 1_000_000;
      if (!res.headersSent) res.setHeader('X-Response-Time', `${ms.toFixed(2)}ms`);
    });
    next();
  };
}
