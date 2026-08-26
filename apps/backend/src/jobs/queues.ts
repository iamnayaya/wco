import { Queue } from 'bullmq';
import type { ConnectionOptions } from 'bullmq';

import { env } from '../config/env.js';

/**
 * BullMQ queue registry.
 *
 * Naming: `wco.<purpose>` — these are infrastructure contracts; the worker
 * fleet (apps/backend/src/jobs/workers.ts) consumes exactly these names.
 * Queues are lazy singletons so importing this module never opens sockets
 * (unit tests import service code that enqueues).
 */

export const JOB_NAMES = {
  WHATSAPP_SEND: 'whatsapp.send',
  EMAIL_SEND: 'email.send',
  CAMPAIGN_DISPATCH: 'campaign.dispatch',
  WEBHOOK_DELIVER: 'webhook.deliver',
  ANALYTICS_ROLLUP: 'analytics.rollup',
  OUTBOX_RELAY: 'outbox.relay',
  AI_RESPOND: 'ai.respond',
} as const;

export const QUEUE_NAMES = {
  WHATSAPP_SEND: 'wco.whatsapp-send',
  EMAIL_SEND: 'wco.email-send',
  CAMPAIGN_DISPATCH: 'wco.campaign-dispatch',
  WEBHOOK_DELIVER: 'wco.webhook-delivery',
  MAINTENANCE: 'wco.maintenance',
  AI_RESPOND: 'wco.ai-respond',
} as const;

function connection(): ConnectionOptions {
  return { url: env.REDIS_URL } as ConnectionOptions;
}

const defaultJobOptions = {
  attempts: 5,
  backoff: { type: 'exponential' as const, delay: 3_000 },
  removeOnComplete: { age: 3_600, count: 1_000 },
  removeOnFail: { age: 86_400 },
};

let whatsappQueue: Queue | null = null;
let emailQueue: Queue | null = null;
let campaignQueue: Queue | null = null;
let webhookQueue: Queue | null = null;
let maintenanceQueue: Queue | null = null;
let aiQueue: Queue | null = null;

export function getWhatsappQueue(): Queue {
  whatsappQueue ??= new Queue(QUEUE_NAMES.WHATSAPP_SEND, { connection: connection(), defaultJobOptions });
  return whatsappQueue;
}

export function getEmailQueue(): Queue {
  emailQueue ??= new Queue(QUEUE_NAMES.EMAIL_SEND, { connection: connection(), defaultJobOptions });
  return emailQueue;
}

export function getCampaignQueue(): Queue {
  campaignQueue ??= new Queue(QUEUE_NAMES.CAMPAIGN_DISPATCH, { connection: connection(), defaultJobOptions });
  return campaignQueue;
}

export function getWebhookQueue(): Queue {
  webhookQueue ??= new Queue(QUEUE_NAMES.WEBHOOK_DELIVER, {
    connection: connection(),
    defaultJobOptions: { ...defaultJobOptions, attempts: 8 },
  });
  return webhookQueue;
}

/** Repeatable jobs (rollups, outbox relay) live here. */
export function getMaintenanceQueue(): Queue {
  maintenanceQueue ??= new Queue(QUEUE_NAMES.MAINTENANCE, {
    connection: connection(),
    defaultJobOptions: { ...defaultJobOptions, attempts: 3 },
  });
  return maintenanceQueue;
}

/** AI auto-responder turns - bursty LLM latency isolated from the API. */
export function getAiQueue(): Queue {
  aiQueue ??= new Queue(QUEUE_NAMES.AI_RESPOND, {
    connection: connection(),
    defaultJobOptions: { ...defaultJobOptions, attempts: 3 },
  });
  return aiQueue;
}

/** Graceful-shutdown hook: closes every lazily-created producer. */
export async function closeAllQueues(): Promise<void> {
  await Promise.allSettled(
    [whatsappQueue, emailQueue, campaignQueue, webhookQueue, maintenanceQueue, aiQueue]
      .filter((q): q is Queue => q !== null)
      .map((q) => q.close()),
  );
}

// ---------------------------------------------------------------------------
// Typed enqueue helpers — call sites never touch raw queue objects.
// ---------------------------------------------------------------------------

interface WhatsappSendPayload {
  readonly messageId: string;
  readonly storeId: string;
  readonly conversationId: string;
}

interface EmailPayload {
  readonly template: string;
  readonly to: string;
  readonly data: Record<string, unknown>;
}

interface CampaignDispatchPayload {
  readonly campaignId: string;
  readonly storeId: string;
}

interface WebhookDeliverPayload {
  readonly subscriptionId: string;
  readonly eventType: string;
  readonly payload: Record<string, unknown>;
}

interface AiRespondPayload {
  readonly waMessageId: string;
  readonly storeId: string;
  readonly conversationId: string;
}

async function safeAdd(queue: () => Queue, name: string, payload: object, opts?: object): Promise<string | null> {
  try {
    const job = await queue().add(name, payload, opts);
    return job.id ?? null;
  } catch {
    // Redis down must not fail API requests — log-and-drop; durable paths
    // (outbox relay) re-enqueue what matters.
    return null;
  }
}

export function enqueueWhatsappSend(payload: WhatsappSendPayload): Promise<string | null> {
  return safeAdd(getWhatsappQueue, JOB_NAMES.WHATSAPP_SEND, payload);
}

export function enqueueEmail(template: string, to: string, data: Record<string, unknown> = {}): Promise<string | null> {
  return safeAdd(getEmailQueue, JOB_NAMES.EMAIL_SEND, { template, to, data } satisfies EmailPayload);
}

export function enqueueCampaignDispatch(payload: CampaignDispatchPayload): Promise<string | null> {
  return safeAdd(getCampaignQueue, JOB_NAMES.CAMPAIGN_DISPATCH, payload);
}

export function enqueueWebhookDelivery(payload: WebhookDeliverPayload): Promise<string | null> {
  return safeAdd(getWebhookQueue, JOB_NAMES.WEBHOOK_DELIVER, payload);
}

export function enqueueAiRespond(payload: AiRespondPayload): Promise<string | null> {
  return safeAdd(getAiQueue, JOB_NAMES.AI_RESPOND, payload);
}
