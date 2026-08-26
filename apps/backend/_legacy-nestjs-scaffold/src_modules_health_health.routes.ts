import { Router } from 'express';
import type { Request, Response } from 'express';
import { registry } from '../lib/metrics.js';
import { checkDatabaseHealth } from '../lib/prisma.js';
import { checkRedisHealth } from '../lib/redis.js';
import { env } from '../config/env.js';

/**
 * Health & metrics surface — the k8s contract.
 *
 *  /health/live   process is up (no deps)          -> liveness probe
 *  /health/ready  deps reachable                    -> readiness probe
 *  /health        detailed component status         -> humans & dashboards
 *  /metrics       Prometheus scrape (own registry)  -> monitoring
 *
 * Liveness MUST NOT touch dependencies: a slow DB must trigger restarts of
 * nothing — readiness handles traffic shedding.
 */
export const healthRouter = Router();

interface ComponentStatus {
  status: 'up' | 'down';
  latencyMs?: number;
}

async function probe(fn: () => Promise<boolean>): Promise<ComponentStatus> {
  const start = Date.now();
  try {
    const ok = await fn();
    return { status: ok ? 'up' : 'down', latencyMs: Date.now() - start };
  } catch {
    return { status: 'down', latencyMs: Date.now() - start };
  }
}

healthRouter.get('/live', (_req: Request, res: Response): void => {
  res.status(200).json({ ok: true });
});

healthRouter.get('/ready', async (_req: Request, res: Response): Promise<void> => {
  const [db, redis] = await Promise.all([probe(checkDatabaseHealth), probe(checkRedisHealth)]);
  const ready = db.status === 'up';
  res.status(ready ? 200 : 503).json({
    ok: ready,
    checks: {
      database: db.status,
      // Redis is cache-only: degraded-but-serving is still "ready".
      redis: redis.status === 'up' ? 'up' : 'degraded',
    },
  });
});

// Both /health and /api/v1/health resolve here (LB probes vary by platform).
const detailed = async (_req: Request, res: Response): Promise<void> => {
  const [db, redis] = await Promise.all([probe(checkDatabaseHealth), probe(checkRedisHealth)]);
  const allUp = db.status === 'up' && redis.status !== 'down';
  res.status(allUp ? 200 : 503).json({
    status: allUp ? 'ok' : 'degraded',
    service: 'wco-backend',
    version: process.env.APP_VERSION ?? 'dev',
    env: env.NODE_ENV,
    uptimeSeconds: Math.floor(process.uptime()),
    memory: process.memoryUsage.rss(),
    checks: { database: db, redis },
  });
};
healthRouter.get('/', detailed);
healthRouter.get('/detailed', detailed);

healthRouter.get('/metrics', async (_req: Request, res: Response): Promise<void> => {
  if (!env.METRICS_ENABLED) {
    res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'metrics disabled' } });
    return;
  }
  res.setHeader('Content-Type', registry.contentType);
  res.end(await registry.metrics());
});
