import { readFileSync } from 'node:fs';
import http from 'node:http';
import https from 'node:https';
import net from 'node:net';
import type { AddressInfo } from 'node:net';

import { createApp } from './app.js';
import { HTTP_TIMEOUTS_MS } from './config/constants.js';
import { env, isProd } from './config/env.js';
import { closeAllQueues } from './jobs/queues.js';
import { logger } from './lib/logger.js';
import { initObservability, captureException } from './lib/observability.js';
import { disconnectRabbit } from './lib/rabbit.js';
import { shutdownDependencies } from './modules/health/health.routes.js';

/**
 * Server entry point.
 *
 * Boot sequence:
 *   1. Sentry (must precede app code so boot errors are captured).
 *   2. App factory - config/env validation has already run at import time;
 *      invalid config aborts here with a readable error, never a half-up pod.
 *   3. HTTP or HTTPS listener depending on TLS cert configuration
 *      (TLS terminates at the ingress in k8s; HTTPS mode exists for
 *       bare-metal/single-box deployments without an LB).
 *
 * Graceful shutdown (SIGTERM from k8s / SIGINT locally):
 *   - stop accepting new connections,
 *   - let in-flight requests finish (bounded by GRACEFUL_SHUTDOWN_MS),
 *   - close BullMQ queues, RabbitMQ channel, Redis, then Postgres,
 *   - exit 0. SIGINT twice or the grace timeout force-exits 1.
 */

initObservability();

const app = createApp();

function buildListener(): http.Server | https.Server {
  if (env.HTTPS_KEY_PATH && env.HTTPS_CERT_PATH) {
    logger.info('server.tls-enabled', { keyPath: env.HTTPS_KEY_PATH });
    // TLS material paths come from validated env config, not request input.
    return https.createServer(
      {
        // eslint-disable-next-line security/detect-non-literal-fs-filename
        key: readFileSync(env.HTTPS_KEY_PATH),
        // eslint-disable-next-line security/detect-non-literal-fs-filename
        cert: readFileSync(env.HTTPS_CERT_PATH),
      },
      app,
    );
  }
  return http.createServer(app);
}

const server = buildListener();

// Keep-alive hygiene for L7 load balancers: idle sockets must die well below
// the LB's idle timeout or clients see sporadic 502s on recycled connections.
server.keepAliveTimeout = 65_000;
server.headersTimeout = 70_000;
server.requestTimeout = HTTP_TIMEOUTS_MS.OUTBOUND_HTTP + 60_000;

// Track sockets so shutdown can drain deterministically instead of waiting on
// keep-alive connections that would otherwise hold server.close() open.
const sockets = new Set<net.Socket>();
server.on('connection', (socket) => {
  sockets.add(socket);
  socket.on('close', () => sockets.delete(socket));
});

let shuttingDown = false;

async function shutdown(signal: string, exitCode = 0): Promise<void> {
  if (shuttingDown) process.exit(1); // second signal = operator insists
  shuttingDown = true;
  logger.info('server.shutdown-start', { signal });

  const forceTimer = setTimeout(() => {
    logger.error('server.shutdown-timeout', { graceMs: HTTP_TIMEOUTS_MS.GRACEFUL_SHUTDOWN });
    for (const socket of sockets) socket.destroy();
    process.exit(1);
  }, HTTP_TIMEOUTS_MS.GRACEFUL_SHUTDOWN);
  forceTimer.unref();

  // Stop admitting new work first.
  await new Promise<void>((resolve) => server.close(() => { resolve(); }));

  // End idle keep-alive sockets; destroy anything still open at deadline.
  for (const socket of sockets) socket.end();
  setTimeout(() => {
    for (const socket of sockets) socket.destroy();
  }, 5_000).unref();

  // Release infrastructure in dependency order (queues -> broker -> cache -> db).
  await Promise.allSettled([closeAllQueues(), Promise.resolve(disconnectRabbit())]);
  await shutdownDependencies();

  clearTimeout(forceTimer);
  logger.info('server.shutdown-complete');
  process.exit(exitCode);
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));

// A promise rejection nobody awaited is a bug we must see, but one rejected
// request handler should not kill a healthy serving fleet: log + alert.
process.on('unhandledRejection', (reason) => {
  logger.error('process.unhandled-rejection', {
    message: reason instanceof Error ? reason.message : String(reason),
    stack: reason instanceof Error ? reason.stack : undefined,
  });
  captureException(reason);
});

// Uncaught exceptions mean corrupted state: crash fast and let the orchestrator
// restart us (k8s restartPolicy) rather than serve from undefined behavior.
process.on('uncaughtException', (err) => {
  logger.error('process.uncaught-exception', { message: err.message, stack: err.stack });
  captureException(err);
  void shutdown('uncaughtException', 1);
});

server.listen(env.PORT, () => {
  const address = server.address() as AddressInfo;
  logger.info('server.started', {
    port: address.port,
    env: env.NODE_ENV,
    tls: server instanceof https.Server,
    pid: process.pid,
    node: process.version,
  });
  if (!isProd) {
    logger.info('server.endpoints', {
      health: `http://localhost:${address.port}/health`,
      docs: `http://localhost:${address.port}/docs`,
      metrics: `http://localhost:${address.port}/metrics`,
      api: `http://localhost:${address.port}/api/v1`,
    });
  }
});

export { server };
