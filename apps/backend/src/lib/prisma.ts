import { PrismaClient } from '@prisma/client';

import { env, isDev } from '../config/env.js';

import { logger } from './logger.js';

/**
 * Process-wide Prisma client singleton.
 *
 * Connection pooling: Prisma manages a pool per process sized by
 * `connection_limit`. Rule of thumb — pool_size * replicas must stay below
 * Postgres max_connections (we run pgbouncer in front in prod).
 */
const datasourceUrl = new URL(env.DATABASE_URL);
if (!datasourceUrl.searchParams.has('connection_limit')) {
  datasourceUrl.searchParams.set('connection_limit', String(env.DATABASE_POOL_SIZE));
}

const prisma = new PrismaClient({
  datasources: { db: { url: datasourceUrl.toString() } },
  log: isDev ? [{ emit: 'stdout', level: 'warn' }] : [{ emit: 'stdout', level: 'error' }],
});

// Slow-query telemetry (>250ms) — feeds the DB latency alert rules.
const SLOW_QUERY_MS = 250;
prisma.$use(async (params, next) => {
  const start = Date.now();
  const result = await next(params);
  const ms = Date.now() - start;
  if (ms > SLOW_QUERY_MS && !['$queryRaw', '$executeRaw'].includes(params.action)) {
    logger.warn('db.slow-query', { model: params.model, action: params.action, ms });
  }
  return result;
});

/** Liveness probe for the readiness endpoint. Cheap round-trip. */
export async function checkDatabaseHealth(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}

export async function disconnectDatabase(): Promise<void> {
  await prisma.$disconnect();
  logger.info('db.disconnected');
}

export { prisma };
