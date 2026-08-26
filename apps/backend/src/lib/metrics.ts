import type { Request, Response, NextFunction } from 'express';
import client from 'prom-client';

import { env } from '../config/env.js';

/**
 * Prometheus metrics (prom-client).
 *
 * The /metrics endpoint is scraped by the cluster Prometheus; the histogram
 * below drives RED dashboards (Rate/Error/Duration) and SLO burn alerts.
 * Metrics are opt-out via METRICS_ENABLED=false for local/test runs.
 */

export const registry = new client.Registry();
registry.setDefaultLabels({ app: 'wco-backend' });
if (env.METRICS_ENABLED) {
  client.collectDefaultMetrics({ register: registry });
}

export const httpRequestDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'route', 'status_code'] as const,
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [registry],
});

export const httpRequestsTotal = new client.Counter({
  name: 'http_requests_total',
  help: 'Total HTTP requests',
  labelNames: ['method', 'route', 'status_code'] as const,
  registers: [registry],
});

/** Normalizes dynamic path segments so cardinality stays bounded. */
function routeLabel(req: Request): string {
  return req.baseUrl ? `${req.baseUrl}${req.route?.path ?? ''}` : req.path;
}

export function metricsMiddleware(): (req: Request, res: Response, next: NextFunction) => void {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!env.METRICS_ENABLED) { next(); return; }
    const end = httpRequestDuration.startTimer();
    res.on('finish', () => {
      const labels = { method: req.method, route: routeLabel(req), status_code: res.statusCode };
      end(labels);
      httpRequestsTotal.inc(labels);
    });
    next();
  };
}
