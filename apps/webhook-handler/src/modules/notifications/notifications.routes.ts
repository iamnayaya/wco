import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { IngestService } from '../../services/ingest.service';

/**
 * Notification callback routes — email/SMS delivery events.
 * SendGrid Event Webhook (shared secret in URL path) -> notification.status.
 * Bounces feed suppression lists so we never email dead addresses again.
 */
export function registerNotificationRoutes(app: FastifyInstance, ingest: IngestService): void {
  app.post('/webhooks/email/:token', async (request: FastifyRequest, reply: FastifyReply) => {
    if (request.params && (request.params as Record<string, string>).token !== process.env.EMAIL_WEBHOOK_TOKEN) {
      return reply.code(401).send({ ok: false });
    }

    const events = request.body as Array<Record<string, unknown>>;
    if (!Array.isArray(events)) return reply.code(400).send({ ok: false });

    for (const event of events) {
      const messageId = String(event['smtp-id'] ?? event['sg_message_id'] ?? '');
      const kind = String(event.event ?? '');
      await ingest.publish('notification.status', {
        channel: 'email',
        messageId,
        status: kind,
        reason: event.reason ? String(event.reason) : undefined,
        email: event.email ? String(event.email) : undefined,
        timestamp: event.timestamp ? new Date(Number(event.timestamp) * 1000) : new Date(),
      });
    }
    return reply.code(200).send({ received: events.length });
  });
}
