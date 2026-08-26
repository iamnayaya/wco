import type { Request } from 'express';
import morgan from 'morgan';

import { httpLogStream } from '../lib/logger.js';

import { getRequestContext } from './request-context.js';

/**
 * Morgan HTTP access log wired into Winston.
 * Token format includes requestId from ALS so access logs and application
 * logs are joinable in the aggregator by a single key.
 */
morgan.token('request-id', () => getRequestContext()?.requestId ?? '-');

const FORMAT =
  ':method :url :status :res[content-length] - :response-time ms req=:request-id ref=:referrer ua=:user-agent';

export const httpLogger = morgan(FORMAT, {
  stream: httpLogStream,
  skip: (req) => {
    const r = req as Request;
    return r.path === '/health' || r.path === '/metrics' || r.originalUrl.endsWith('/health');
  },
});
