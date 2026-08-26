import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { verifyWebhookSignature } from '../../middleware/signature-verification';
import type { IngestService } from '../../services/ingest.service';

interface NormalizedInbound {
  provider: 'META' | 'TWILIO';
  waMessageId: string;
  fromPhone: string;
  storePhoneNumberId: string;
  type: string;
  body: string | null;
  mediaUrl: string | null;
  timestamp: Date;
}

/**
 * WhatsApp webhook routes.
 *
 * GET /webhooks/whatsapp — Meta subscription handshake (hub.challenge)
 * POST /webhooks/whatsapp — inbound messages + delivery statuses
 */
export function registerWhatsappRoutes(app: FastifyInstance, ingest: IngestService): void {
  // Meta webhook verification handshake
  app.get('/webhooks/whatsapp', async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as Record<string, string>;
    const mode = query['hub.mode'];
    const token = query['hub.verify_token'];
    const challenge = query['hub.challenge'];

    if (mode === 'subscribe' && token === process.env.META_WEBHOOK_VERIFY_TOKEN) {
      reply.code(200).type('text/plain').send(challenge);
      return;
    }
    reply.code(403).send({ ok: false });
  });

  app.post(
    '/webhooks/whatsapp',
    { config: { rawBody: true } },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const rawBody = request.body as Buffer; // content-type parser keeps raw
      const verification = verifyWebhookSignature('whatsapp-meta', rawBody, request.headers);
      if (!verification.valid) {
        app.log.warn({ reason: verification.reason }, 'whatsapp.signature.invalid');
        return reply.code(401).send({ ok: false });
      }

      let parsed: MetaWebhookPayload;
      try {
        parsed = JSON.parse(rawBody.toString()) as MetaWebhookPayload;
      } catch {
        return reply.code(400).send({ ok: false });
      }

      let accepted = 0;
      for (const entry of parsed.entry ?? []) {
        for (const change of entry.changes ?? []) {
          const value = change.value;
          const phoneNumberId = value.metadata?.phone_number_id ?? '';

          // Delivery/read statuses — cheap fan-in, no AI work needed
          for (const status of value.statuses ?? []) {
            await ingest.publish('message.status', {
              waMessageId: status.id,
              status: status.status,
              recipientId: status.recipient_id,
              timestamp: new Date(Number(status.timestamp) * 1000),
            });
            accepted++;
          }

          // Actual customer messages
          for (const message of value.messages ?? []) {
            const normalized = normalizeMetaMessage(message, phoneNumberId);
            // Dedupe on provider message id — retries are common
            const fresh = await ingest.acquireDedupeKey(`wa:${normalized.waMessageId}`);
            if (!fresh) continue;

            await ingest.publish('message.received', normalized);
            accepted++;
          }
        }
      }

      // ALWAYS 200 once signature passed — Meta punishes non-200 with retry storms
      return reply.code(200).send({ received: accepted });
    },
  );
}

interface MetaWebhookPayload {
  entry?: Array<{
    changes?: Array<{
      value?: {
        metadata?: { phone_number_id?: string };
        contacts?: Array<{ profile?: { name?: string }; wa_id?: string }>;
        messages?: Array<{
          from: string;
          id: string;
          timestamp: string;
          type: string;
          text?: { body?: string };
          image?: { link?: string };
          audio?: { link?: string };
          video?: { link?: string };
          document?: { link?: string };
          location?: { latitude?: number; longitude?: number };
        }>;
        statuses?: Array<{ id: string; status: string; recipient_id: string; timestamp: string }>;
      };
    }>;
  }>;
}

function normalizeMetaMessage(
  message: NonNullable<NonNullable<NonNullable<MetaWebhookPayload['entry']>[number]['changes']>[number]['value']>['messages'] extends Array<infer T> ? T : never,
  phoneNumberId: string,
): NormalizedInbound {
  return {
    provider: 'META',
    waMessageId: message.id,
    fromPhone: message.from.startsWith('+') ? message.from : `+${message.from}`,
    storePhoneNumberId: phoneNumberId,
    type: message.type,
    body:
      message.text?.body ??
      (message.type === 'location'
        ? `Location: ${message.location?.latitude ?? ''},${message.location?.longitude ?? ''}`
        : null),
    mediaUrl:
      message.image?.link ?? message.audio?.link ?? message.video?.link ?? message.document?.link ?? null,
    timestamp: new Date(Number(message.timestamp) * 1000),
  };
}
