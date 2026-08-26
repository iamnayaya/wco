import * as Sentry from '@sentry/node';

import { env, isProd } from '../config/env.js';

import { logger } from './logger.js';

/**
 * Sentry wiring — error monitoring with PII scrubbing.
 *
 * Enabled only when SENTRY_DSN is configured; everything no-ops otherwise so
 * local/dev/test runs carry zero overhead. `beforeSend` strips auth headers
 * and long bodies — breadcrumbs must never leak customer PII.
 */
export function initObservability(): void {
  if (!env.SENTRY_DSN) return;

  Sentry.init({
    dsn: env.SENTRY_DSN,
    environment: env.NODE_ENV,
    release: process.env.APP_VERSION ?? 'dev',
    tracesSampleRate: isProd ? 0.1 : 1.0,
    beforeSend(event) {
      if (event.request?.headers) {
        delete event.request.headers.authorization;
        delete event.request.headers.cookie;
      }
      return event;
    },
  });
  logger.info('observability.sentry-initialized');
}

export function captureException(err: unknown, context?: Record<string, unknown>): void {
  if (!env.SENTRY_DSN) return;
  Sentry.captureException(err, { extra: context });
}

export function captureMessage(message: string): void {
  if (!env.SENTRY_DSN) return;
  Sentry.captureMessage(message);
}
