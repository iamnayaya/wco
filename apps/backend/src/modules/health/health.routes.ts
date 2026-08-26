import { Router } from 'express';
import type { Request, Response } from 'express';

import { logger } from '../../lib/logger.js';
import { registry } from '../../lib/metrics.js';
import { checkDatabaseHealth, disconnectDatabase } from '../../lib/prisma.js';
import { checkRedisHealth, disconnectRedis } from '../../lib/redis.js';

/**
 * Health endpoints (k8s probes + Prometheus scrape).
 *
 *  GET /health        liveness  - process is up; touches NO dependencies so a
 *                                 database outage never causes pod restart loops.
 *  GET /health/live   alias of /health (some probes hardcode the suffix).
 *  GET /health/ready  readiness - checks Postgres + Redis in parallel; 503 with
 *                                 per-dependency detail so on-call sees WHY.
 *  GET /metrics       Prometheus exposition (mounted by app.ts).
 *
 * Readiness failures are reported but NEVER thrown: probe handlers must not
 * enter the error middleware and risk a 500 masking the real status payload.
 */

export const healthRouter: Router = Router();

const STARTED_AT = Date.now();

function liveness(_req: Request, res: Response): void {
  res.status(200).json({
    status: 'ok',
    service: 'wco-backend',
    uptimeSeconds: Math.floor((Date.now() - STARTED_AT) / 1000),
    timestamp: new Date().toISOString(),
  });
}

healthRouter.get('/health', liveness);
healthRouter.get('/health/live', liveness);

interface DependencyStatus {
  readonly name: string;
  healthy: boolean;
  readonly latencyMs: number;
}

async function probe(name: string, check: () => Promise<boolean>): Promise<DependencyStatus> {
  const start = Date.now();
  let healthy = false;
  try {
    healthy = await check();
  } catch {
    healthy = false;
  }
  return { name, healthy, latencyMs: Date.now() - start };
}

healthRouter.get('/health/ready', (_req: Request, res: Response): void => {
  void Promise.all([probe('postgres', checkDatabaseHealth), probe('redis', checkRedisHealth)])
    .then((dependencies) => {
      const healthy = dependencies.every((d) => d.healthy);
      res.status(healthy ? 200 : 503).json({
        status: healthy ? 'ok' : 'degraded',
        service: 'wco-backend',
        uptimeSeconds: Math.floor((Date.now() - STARTED_AT) / 1000),
        dependencies,
        timestamp: new Date().toISOString(),
      });
    })
    .catch((err: unknown) => {
      // Unreachable in practice (probe swallows) - belt & braces for probes.
      logger.error('health.ready-probe-crashed', { message: err instanceof Error ? err.message : String(err) });
      res.status(503).json({ status: 'degraded', dependencies: [] });
    });
});

/** Prometheus scrape target - text/plain version 0.0.4 exposition format. */
export async function metricsHandler(_req: Request, res: Response): Promise<void> {
  try {
    res.setHeader('Content-Type', registry.contentType);
    res.end(await registry.metrics());
  } catch (err) {
    logger.error('metrics.render-failed', { message: err instanceof Error ? err.message : String(err) });
    res.status(500).end();
  }
}

/** Ordered teardown used by main.ts during graceful shutdown. */
export async function shutdownDependencies(): Promise<void> {
  await Promise.allSettled([disconnectDatabase(), disconnectRedis()]);
}
