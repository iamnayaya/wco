import { enqueueWebhookDelivery } from '../jobs/queues.js';
import { logger } from '../lib/logger.js';
import { prisma } from '../lib/prisma.js';
import { signPayload } from '../utils/crypto.js';

/**
 * Outbound merchant webhooks — WCO -> merchant systems.
 *
 * Delivery contract (documented in docs/api/webhooks.md):
 *  - POST JSON with headers X-WCO-Event, X-WCO-Signature (HMAC-SHA256 hex of
 *    the raw body using the subscription secret), X-WCO-Delivery (idempotency).
 *  - 2xx within 10s = delivered; anything else retries with exponential
 *    backoff via BullMQ (8 attempts ≈ spread over ~6 hours).
 */

const DELIVERY_TIMEOUT_MS = 10_000;

export async function dispatchEvent(storeId: string, eventType: string, payload: Record<string, unknown>): Promise<void> {
  const subscriptions = await prisma.webhookSubscription.findMany({
    where: { storeId, isActive: true, OR: [{ events: { has: eventType } }, { events: { isEmpty: true } }] },
  });
  for (const sub of subscriptions) {
    await enqueueWebhookDelivery({ subscriptionId: sub.id, eventType, payload });
  }
}

export async function deliverOnce(subscriptionId: string, eventType: string, payload: Record<string, unknown>): Promise<boolean> {
  const sub = await prisma.webhookSubscription.findUnique({ where: { id: subscriptionId } });
  if (!sub || !sub.isActive) return true; // deactivated -> treat as delivered (stop retrying)

  const body = JSON.stringify({
    event: eventType,
    createdAt: new Date().toISOString(),
    data: payload,
  });
  const signature = signPayload(body, sub.secret);

  try {
    const res = await fetch(sub.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'WCO-Webhooks/1.0',
        'X-WCO-Event': eventType,
        'X-WCO-Signature': `sha256=${signature}`,
        'X-WCO-Delivery': `${subscriptionId}:${Date.now()}`,
      },
      body,
      signal: AbortSignal.timeout(DELIVERY_TIMEOUT_MS),
    });
    if (!res.ok) {
      logger.warn('outbound-webhook.non-2xx', { url: sub.url, status: res.status, eventType });
      return false;
    }
    return true;
  } catch (err) {
    logger.warn('outbound-webhook.delivery-error', {
      url: sub.url,
      eventType,
      message: err instanceof Error ? err.message : String(err),
    });
    return false;
  }
}
