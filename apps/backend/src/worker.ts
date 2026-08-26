import { resolveProvider } from '@wco/messaging';
import { MESSAGE_TYPES } from '@wco/shared';
import { Worker, type Job } from 'bullmq';
import Redis from 'ioredis';

import { env } from './config/env.js';
import {
  QUEUE_NAMES,
  JOB_NAMES,
  getCampaignQueue,
  getMaintenanceQueue,
  enqueueWhatsappSend,
  closeAllQueues,
} from './jobs/queues.js';
import { logger } from './lib/logger.js';
import { initObservability } from './lib/observability.js';
import { prisma } from './lib/prisma.js';
import { publishDomainEvent, disconnectRabbit } from './lib/rabbit.js';
import { disconnectRedis } from './lib/redis.js';
import { responderService } from './modules/messages/services/responder.service.js';
import { sendEmail } from './services/email.service.js';
import { deliverOnce } from './services/outbound-webhooks.service.js';

/**
 * Background worker fleet entry point.
 *
 * Runs as a SEPARATE deployment (same image, different command) so CPU-bound
 * and bursty job processing never steals event-loop capacity from the HTTP
 * API. Processors:
 *
 *   wco.whatsapp-send        Meta/Twilio outbound message delivery + status write-back.
 *   wco.email-send           SMTP transactional email (templates in email.service).
 *   wco.campaign-dispatch    Paced fan-out of campaign_messages -> whatsapp-send
 *                            (Meta rate limits: ~80 msg/s ceiling; we pace at 20/s).
 *   wco.webhook-delivery     Merchant webhook POSTs; throwing triggers BullMQ retry
 *                            with exponential backoff (8 attempts ~ 6h spread).
 *   wco.maintenance          Repeatable jobs: outbox relay (transactional outbox ->
 *                            RabbitMQ) + daily store metric rollups.
 *
 * Failure contract: a processor either completes or THROWS. Throwing lets
 * BullMQ's backoff/retry machinery own the policy instead of hand-rolled loops.
 */

initObservability();

const CAMPAIGN_PACE_PER_TICK = 20;
const OUTBOX_BATCH = 100;

// ---------------------------------------------------------------------------
// Processors
// ---------------------------------------------------------------------------

interface WhatsappSendJob {
  messageId: string;
  storeId: string;
  conversationId: string;
}

interface AiRespondJob {
  waMessageId: string;
  storeId: string;
  conversationId: string;
}

async function processAiRespond(job: Job<AiRespondJob>): Promise<void> {
  // Throwing propagates to BullMQ retry (3 attempts) - the turn pipeline is
  // idempotent per waMessageId so replays are safe.
  await responderService.processTurn(job.data);
}

async function processWhatsappSend(job: Job<WhatsappSendJob>): Promise<void> {
  const { messageId } = job.data;
  const message = await prisma.message.findUnique({
    where: { id: messageId },
    include: { conversation: { include: { store: true, customer: true } } },
  });
  // Idempotent replay: already handed to the provider, nothing to do.
  if (!message || message.status === 'SENT' || message.status === 'DELIVERED') return;

  const store = message.conversation.store;
  const provider = resolveProvider((store.settings ?? {}) as { provider?: string });
  const result = await provider.sendMessage(store.whatsappNameId ?? '', {
    to: message.conversation.waPhone,
    type: message.type as Exclude<(typeof MESSAGE_TYPES)[number], 'INBOUND'>,
    body: message.body ?? undefined,
    mediaUrl: message.mediaUrl ?? undefined,
    templateName: message.templateName ?? undefined,
  });

  await prisma.message.update({
    where: { id: messageId },
    data: {
      status: result.status,
      waMessageId: result.providerMessageId,
      errorReason: result.errorReason,
    },
  });
  if (result.status === 'FAILED') throw new Error(`whatsapp send failed: ${result.errorReason ?? 'unknown'}`);
}

async function processEmailSend(job: Job<{ template: string; to: string; data: Record<string, unknown> }>): Promise<void> {
  await sendEmail(job.data.to, job.data.template, job.data.data);
}

/**
 * Campaign dispatch is chunked: each job sends up to CAMPAIGN_PACE_PER_TICK
 * messages then re-enqueues itself if rows remain. This converts an
 * unbounded fan-out into a paced stream that survives worker restarts and
 * respects WhatsApp anti-spam pacing.
 */
async function processCampaignDispatch(job: Job<{ campaignId: string; storeId: string }>): Promise<void> {
  const { campaignId } = job.data;
  const campaign = await prisma.campaign.findUnique({ where: { id: campaignId } });
  if (!campaign || !['RUNNING', 'SCHEDULED'].includes(campaign.status)) return;

  const batch = await prisma.campaignMessage.findMany({
    where: { campaignId, status: 'queued' },
    take: CAMPAIGN_PACE_PER_TICK,
    orderBy: { id: 'asc' },
  });

  for (const cm of batch) {
    try {
      const customer = await prisma.customer.findUnique({ where: { id: cm.customerId } });
      if (!customer) throw new Error('customer deleted');
      const message = await prisma.message.create({
        data: {
          conversationId: (
            await prisma.conversation.upsert({
              where: { storeId_customerId: { storeId: campaign.storeId, customerId: customer.id } },
              create: { storeId: campaign.storeId, customerId: customer.id, waPhone: customer.waPhone },
              update: {},
            })
          ).id,
          direction: 'OUTBOUND',
          type: 'TEXT',
          body: campaign.messageBody,
          sentByBot: false,
        },
      });
      await prisma.campaignMessage.update({ where: { id: cm.id }, data: { messageId: message.id } });
      const jobId = await enqueueWhatsappSend({ messageId: message.id, storeId: campaign.storeId, conversationId: message.conversationId });
      await prisma.campaignMessage.update({
        where: { id: cm.id },
        data: { status: jobId ? 'queued' : 'failed', errorReason: jobId ? null : 'queue unavailable' },
      });
    } catch (err) {
      await prisma.campaignMessage.update({
        where: { id: cm.id },
        data: { status: 'failed', errorReason: err instanceof Error ? err.message.slice(0, 255) : 'error' },
      });
    }
  }

  const remaining = await prisma.campaignMessage.count({ where: { campaignId, status: 'queued' } });
  if (remaining > 0) {
    await getCampaignQueue().add(JOB_NAMES.CAMPAIGN_DISPATCH, job.data, { delay: 1000 }); // ~20 msg/s sustained
  } else {
    await prisma.campaign.update({ where: { id: campaignId }, data: { status: 'COMPLETED', completedAt: new Date() } });
  }
}

/** Throwing on non-delivery makes BullMQ schedule the next attempt (backoff). */
async function processWebhookDelivery(
  job: Job<{ subscriptionId: string; eventType: string; payload: Record<string, unknown> }>,
): Promise<void> {
  const delivered = await deliverOnce(job.data.subscriptionId, job.data.eventType, job.data.payload);
  if (!delivered) throw new Error(`webhook delivery failed after timeout/non-2xx (attempt ${job.attemptsMade + 1})`);
}

/** Transactional outbox relay: Postgres rows -> RabbitMQ topic exchange. */
async function relayOutbox(): Promise<number> {
  const events = await prisma.outboxEvent.findMany({
    where: { processedAt: null },
    orderBy: { createdAt: 'asc' },
    take: OUTBOX_BATCH,
  });
  for (const event of events) {
    await publishDomainEvent(event.eventType, event.payload as Record<string, unknown>);
    await prisma.outboxEvent.update({ where: { id: event.id }, data: { processedAt: new Date() } });
  }
  if (events.length > 0) logger.debug('worker.outbox-relay', { published: events.length });
  return events.length;
}

/** Nightly rollup of orders/customers/messages into DailyStoreMetric. */
async function rollupDailyMetrics(): Promise<number> {
  const yesterday = new Date();
  yesterday.setUTCHours(0, 0, 0, 0);
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);

  const stores = await prisma.store.findMany({ select: { id: true }, where: { status: 'ACTIVE' } });
  let written = 0;
  for (const store of stores) {
    const start = yesterday;
    const end = new Date(yesterday);
    end.setUTCDate(end.getUTCDate() + 1);

    const [orders, customers, messages] = await Promise.all([
      prisma.order.aggregate({
        where: { storeId: store.id, createdAt: { gte: start, lt: end } },
        _count: { _all: true },
        _sum: { total: true },
      }),
      prisma.customer.count({ where: { storeId: store.id, createdAt: { gte: start, lt: end } } }),
      prisma.message.count({
        where: { conversation: { storeId: store.id }, createdAt: { gte: start, lt: end } },
      }),
    ]);

    await prisma.dailyStoreMetric.upsert({
      where: { storeId_date: { storeId: store.id, date: start } },
      create: {
        storeId: store.id,
        date: start,
        revenue: orders._sum.total ?? 0,
        ordersCount: orders._count._all,
        newCustomers: customers,
        messagesCount: messages,
      },
      update: {
        revenue: orders._sum.total ?? 0,
        ordersCount: orders._count._all,
        newCustomers: customers,
        messagesCount: messages,
      },
    });
    written += 1;
  }
  logger.info('worker.metrics-rollup', { date: yesterday.toISOString().slice(0, 10), stores: written });
  return written;
}

// ---------------------------------------------------------------------------
// Worker bootstrap
// ---------------------------------------------------------------------------

// BullMQ workers use blocking commands, which require maxRetriesPerRequest=null
// on their connection (ioredis default of 2 would make BRPOPLPUSH un-retryable).
const workerConnection = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });

const WORKER_OPTS = { concurrency: env.WORKER_CONCURRENCY, connection: workerConnection };

const workers: Worker[] = [
  new Worker<WhatsappSendJob>(QUEUE_NAMES.WHATSAPP_SEND, processWhatsappSend, WORKER_OPTS),
  new Worker<{ template: string; to: string; data: Record<string, unknown> }>(QUEUE_NAMES.EMAIL_SEND, processEmailSend, WORKER_OPTS),
  new Worker<{ campaignId: string; storeId: string }>(QUEUE_NAMES.CAMPAIGN_DISPATCH, processCampaignDispatch, WORKER_OPTS),
  new Worker<AiRespondJob>(QUEUE_NAMES.AI_RESPOND, processAiRespond, WORKER_OPTS),
  new Worker<{ subscriptionId: string; eventType: string; payload: Record<string, unknown> }>(
    QUEUE_NAMES.WEBHOOK_DELIVER,
    processWebhookDelivery,
    WORKER_OPTS,
  ),
];

const maintenance = getMaintenanceQueue();
void Promise.all([
  maintenance.add(
    JOB_NAMES.OUTBOX_RELAY,
    {},
    { repeat: { every: 10_000 }, jobId: `${JOB_NAMES.OUTBOX_RELAY}-repeatable` },
  ),
  maintenance.add(
    JOB_NAMES.ANALYTICS_ROLLUP,
    {},
    { repeat: { pattern: '30 1 * * *' }, jobId: `${JOB_NAMES.ANALYTICS_ROLLUP}-repeatable` },
  ),
]).catch((err: unknown) => logger.error('worker.repeatables-setup-failed', { message: String(err) }));

const maintenanceProcessor = async (job: Job): Promise<unknown> => {
  switch (job.name) {
    case JOB_NAMES.OUTBOX_RELAY:
      return relayOutbox();
    case JOB_NAMES.ANALYTICS_ROLLUP:
      return rollupDailyMetrics();
    default:
      logger.warn('worker.unknown-maintenance-job', { name: job.name });
      return null;
  }
};

workers.push(new Worker(QUEUE_NAMES.MAINTENANCE, maintenanceProcessor, WORKER_OPTS));

for (const worker of workers) {
  worker.on('failed', (job, err) => {
    logger.error('worker.job-failed', {
      queue: worker.name,
      jobId: job?.id,
      attempts: job?.attemptsMade,
      message: err.message,
    });
  });
  worker.on('completed', (job) => {
    logger.debug('worker.job-completed', { queue: worker.name, jobId: job.id });
  });
  worker.on('error', (err) => {
    // Non-job errors (connection issues); BullMQ retries internally.
    logger.error('worker.error', { queue: worker.name, message: err.message });
  });
}

let shuttingDown = false;
async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) process.exit(1);
  shuttingDown = true;
  logger.info('worker.shutdown-start', { signal, queues: workers.map((w) => w.name) });
  await Promise.allSettled(workers.map((w) => w.close())); // finish current jobs only
  await Promise.allSettled([closeAllQueues(), disconnectRabbit(), disconnectRedis()]);
  workerConnection.disconnect();
  await prisma.$disconnect();
  logger.info('worker.shutdown-complete');
  process.exit(0);
}
process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));

process.on('unhandledRejection', (reason) => {
  logger.error('worker.unhandled-rejection', { message: String(reason) });
});

logger.info('worker.started', {
  queues: [QUEUE_NAMES.WHATSAPP_SEND, QUEUE_NAMES.EMAIL_SEND, QUEUE_NAMES.CAMPAIGN_DISPATCH, QUEUE_NAMES.WEBHOOK_DELIVER, QUEUE_NAMES.MAINTENANCE],
  concurrency: env.WORKER_CONCURRENCY,
  pid: process.pid,
});
