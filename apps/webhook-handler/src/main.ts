import Fastify from 'fastify';
import type { Channel, ChannelModel } from 'amqplib';
import * as amqp from 'amqplib';
import Redis from 'ioredis';
import { EXCHANGES } from '@wco/shared';
import { IngestService } from './services/ingest.service';
import { registerWhatsappRoutes } from './modules/whatsapp/whatsapp.routes';
import { registerPaymentRoutes } from './modules/payments/payments.routes';
import { registerLogisticsRoutes } from './modules/logistics/logistics.routes';
import { registerNotificationRoutes } from './modules/notifications/notifications.routes';

/**
 * WCO Webhook Handler — the platform's front door for provider callbacks.
 *
 * Design contract (see docs/architecture/system-architecture.md §4.1):
 *   verify signature -> dedupe -> publish -> 200 in <50ms p99.
 *
 * Why a separate service: webhook bursts (Black Friday payment spikes,
 * Meta retry storms) must NEVER compete with dashboard traffic for
 * backend capacity. This service scales independently on KEDA queue-depth.
 */
async function bootstrap(): Promise<void> {
  const app = Fastify({
    logger: {
      level: process.env.LOG_LEVEL ?? 'info',
      transport:
        process.env.NODE_ENV === 'development'
          ? { target: 'pino-pretty', options: { singleLine: true } }
          : undefined,
      redact: ['req.headers.authorization', '*.secret', '*.token'],
    },
    trustProxy: true,
    // Providers can send large payloads (batched events)
    bodyLimit: 2 * 1024 * 1024,
  });

  // Raw-body preservation is REQUIRED for HMAC verification. We register a
  // parser that keeps exact bytes and expose them as request.body.
  app.addContentTypeParser(
    'application/json',
    { parseAs: 'buffer' },
    (_req, body: Buffer, done) => done(null, body),
  );

  // --- Infrastructure -------------------------------------------------------
  const redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
    maxRetriesPerRequest: 3,
    lazyConnect: true,
  });

  let connection: ChannelModel | null = null;
  let channel: Channel | null = null;
  const connectRabbit = async (): Promise<void> => {
    connection = await amqp.connect(process.env.RABBITMQ_URL ?? 'amqp://localhost:5672');
    channel = await connection.createChannel();
    await channel.assertExchange(EXCHANGES.DOMAIN_EVENTS, 'topic', { durable: true });
    await channel.assertExchange(EXCHANGES.DEAD_LETTER, 'topic', { durable: true });
    connection.on('error', () => void reconnect());
    connection.on('close', () => void reconnect());
  };
  const reconnect = async (): Promise<void> => {
    channel = null;
    setTimeout(() => connectRabbit().catch(() => undefined), 5000);
  };
  await redis.connect();
  await connectRabbit();

  const ingest = new IngestService(redis, () => {
    if (!channel) throw new Error('rabbitmq channel not ready');
    return channel;
  });

  // --- Routes -----------------------------------------------------------------
  app.get('/health', async () => {
    const [redisUp, rabbitUp] = await Promise.all([
      redis.ping().then(() => true).catch(() => false),
      Promise.resolve(channel !== null),
    ]);
    return {
      status: redisUp && rabbitUp ? 'ok' : 'degraded',
      service: 'wco-webhook-handler',
      checks: { redis: redisUp ? 'up' : 'down', rabbitmq: rabbitUp ? 'up' : 'down' },
    };
  });
  app.get('/health/live', async () => ({ ok: true }));

  registerWhatsappRoutes(app, ingest);
  registerPaymentRoutes(app, ingest);
  registerLogisticsRoutes(app, ingest);
  registerNotificationRoutes(app, ingest);

  // Global error handler — never leak internals to providers
  app.setErrorHandler((error, _request, reply) => {
    app.log.error({ err: error }, 'webhook.unhandled-error');
    reply.code(500).send({ ok: false });
  });

  const port = Number(process.env.PORT ?? 4100);
  await app.listen({ port, host: '0.0.0.0' });
  app.log.info(`webhook-handler up on :${port}`);

  // Graceful shutdown — stop accepting, flush, close broker last
  for (const signal of ['SIGTERM', 'SIGINT'] as const) {
    process.on(signal, () => {
      app.log.info(`${signal} received — draining`);
      void app.close().finally(() => {
        void channel?.close();
        void connection?.close();
        redis.disconnect();
        process.exit(0);
      });
    });
  }
}

void bootstrap();
