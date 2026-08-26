import { Prisma } from '@prisma/client';
import { AppError } from '@wco/shared';
import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';

import { isProd } from '../config/env.js';
import { logger } from '../lib/logger.js';
import { captureException } from '../lib/observability.js';

import { getRequestContext } from './request-context.js';

/**
 * Global error pipeline — 404 fallthrough + single JSON error formatter.
 *
 * Rules:
 *  - Known AppErrors keep their stable machine codes (client contract).
 *  - Zod errors → 422 with field details.
 *  - Prisma known codes map to 404/409 (never leak SQL).
 *  - Unknown errors → generic 500, full stack logged + Sentry; internals
 *    stripped in production responses.
 */
export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    success: false,
    error: { code: 'NOT_FOUND', message: `Route ${req.method} ${req.path} does not exist` },
  });
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction): void {
  const requestId = getRequestContext()?.requestId;

  // Malformed JSON on the webhook path must return 200 to prevent Meta retry
  // storms. The route handler's own try-catch handles well-formed JSON; this
  // catches the SyntaxError that express.json() throws before the handler runs.
  if (
    err instanceof SyntaxError &&
    'status' in err &&
    (err as { status?: number }).status === 400 &&
    req.method === 'POST' &&
    req.path === '/api/v1/webhooks/inbound/whatsapp'
  ) {
    res.status(200).send('EVENT_RECEIVED');
    return;
  }

  if (err instanceof AppError) {
    logger.warn('http.app-error', { code: err.code, status: err.status, path: req.path });
    res.status(err.status).json({
      success: false,
      error: { code: err.code, message: err.message, details: err.details },
      requestId,
    });
    return;
  }

  if (err instanceof ZodError) {
    res.status(422).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed',
        details: Object.fromEntries(err.issues.map((i) => [i.path.join('.') || '(root)', i.message])),
      },
      requestId,
    });
    return;
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2025') {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Resource not found' },
        requestId,
      });
      return;
    }
    if (err.code === 'P2002') {
      res.status(409).json({
        success: false,
        error: { code: 'CONFLICT', message: 'A record with these unique values already exists' },
        requestId,
      });
      return;
    }
  }

  // Unexpected — log loudly, alert, sanitize.
  logger.error('http.unhandled-error', {
    path: req.path,
    method: req.method,
    message: err instanceof Error ? err.message : String(err),
    stack: err instanceof Error ? err.stack : undefined,
  });
  captureException(err, { path: req.path, requestId });

  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: isProd ? 'An unexpected error occurred' : String(err),
    },
    requestId,
  });
}
