import compression from 'compression';
import cors from 'cors';
import express, { type Express } from 'express';
import helmet from 'helmet';

import { env, isProd } from './config/env.js';
import { docsRouter } from './docs/openapi.js';
import { metricsMiddleware } from './lib/metrics.js';
import { notFoundHandler, errorHandler } from './middleware/error-handler.js';
import { httpLogger } from './middleware/http-logger.js';
import { defaultApiRateLimit } from './middleware/rate-limit.js';
import { requestIdMiddleware, timingMiddleware } from './middleware/request-id.js';
import { healthRouter, metricsHandler } from './modules/health/health.routes.js';
import { apiRouter } from './routes/index.js';

/**
 * Express application factory.
 *
 * Middleware order is a security + correctness contract:
 *
 *   1. trust proxy        - honor LB X-Forwarded-* ONLY when configured,
 *                           otherwise req.ip is attacker-spoofable.
 *   2. request-id/timing  - ALS context first so EVERY log line downstream
 *                           carries the correlation id.
 *   3. helmet             - security headers before any body handling.
 *   4. cors               - origin allow-list from env (no reflections).
 *   5. compression        - skip for /metrics (Prometheus wants raw bytes).
 *   6. body parsing       - 1 MiB JSON cap; WhatsApp text payloads never
 *                           approach this and it bounds memory-abuse DoS.
 *   7. access log         - after parse so logged requests have real bodies'
 *                           sizes; skips /health + /metrics noise.
 *   8. metrics observer   - RED metrics for every route below.
 *   9. routes             - health (unmetered) -> api v1 (rate limited).
 *  10. 404 fallthrough    - unknown routes get the canonical envelope.
 *  11. error handler      - LAST; single JSON error formatter.
 */
export function createApp(): Express {
  const app = express();

  app.disable('x-powered-by');
  app.set('etag', 'strong');
  if (env.TRUST_PROXY) app.set('trust proxy', true);

  // --- Observability context -------------------------------------------------
  app.use(requestIdMiddleware());
  app.use(timingMiddleware());

  // --- Security & transport --------------------------------------------------
  app.use(
    helmet({
      contentSecurityPolicy: isProd ? undefined : false, // swagger-ui needs inline scripts in dev
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );
  app.use(
    cors({
      origin(origin, cb) {
        if (!origin || env.CORS_ORIGIN.includes('*') || env.CORS_ORIGIN.includes(origin)) {
          cb(null, true);
          return;
        }
        cb(new Error(`Origin ${origin} not allowed by CORS`));
      },
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: [
        'Content-Type',
        'Authorization',
        'X-Store-Id',
        'X-Request-Id',
        'Idempotency-Key',
        'X-Admin-Key',
      ],
      exposedHeaders: ['X-Request-Id', 'X-Response-Time', 'X-RateLimit-Limit', 'X-RateLimit-Remaining', 'Retry-After'],
      maxAge: 86_400,
    }),
  );
  app.use(compression({ filter: (req, res) => req.path !== '/metrics' && compression.filter(req, res) }));

  // --- Body parsing ------------------------------------------------------------
  // rawBody is captured for HMAC webhook verification (Meta X-Hub-Signature-256
  // signs the exact bytes on the wire, not the re-serialized object).
  app.use(
    express.json({
      limit: '1mb',
      verify: (req, _res, buf) => {
        (req as typeof req & { rawBody?: Buffer }).rawBody = buf;
      },
    }),
  );
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));

  // --- Logging & metrics ---------------------------------------------------------
  app.use(httpLogger);
  app.use(metricsMiddleware());

  // --- Routes ----------------------------------------------------------------------
  app.use('/', healthRouter); // /health, /health/live, /health/ready
  app.get('/metrics', metricsHandler);
  app.use('/api/v1', defaultApiRateLimit(), apiRouter);
  app.use(docsRouter);

  // --- Error pipeline -----------------------------------------------------------------
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
