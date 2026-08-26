import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { verifyWebhookSignature, type Provider } from '../../middleware/signature-verification';
import type { IngestService } from '../../services/ingest.service';

interface PSPWebhookContext {
  provider: Provider;
  routingKey: 'payment.succeeded' | 'payment.failed' | 'payment.refunded';
  extract: (payload: Record<string, unknown>) => {
    reference: string;
    providerReference: string;
    amount?: number;
    currency?: string;
  };
}

const CONTEXTS: Record<string, PSPWebhookContext> = {
  paystack: {
    provider: 'paystack',
    extract: (payload) => {
      const data = payload.data as Record<string, unknown> | undefined;
      const event = String(payload.event ?? '');
      const routingKey =
        event === 'charge.success'
          ? 'payment.succeeded'
          : event === 'refund.processed'
            ? 'payment.refunded'
            : 'payment.failed';
      return {
        routingKey,
        reference: String(data?.reference ?? ''),
        providerReference: String(data?.id ?? data?.reference ?? ''),
        amount: typeof data?.amount === 'number' ? (data.amount as number) / 100 : undefined,
      } as never;
    },
  },
  flutterwave: {
    provider: 'flutterwave',
    extract: (payload) => {
      const data = payload.data as Record<string, unknown> | undefined;
      const status = String(data?.status ?? '');
      return {
        routingKey:
          status === 'successful'
            ? ('payment.succeeded' as const)
            : status === 'cancelled'
              ? ('payment.abandoned' as never)
              : ('payment.failed' as const),
        reference: String(data?.tx_ref ?? ''),
        providerReference: String(data?.id ?? ''),
        amount: typeof data?.amount === 'number' ? (data.amount as number) : undefined,
        currency: data?.currency ? String(data.currency) : undefined,
      } as never;
    },
  },
  opay: {
    provider: 'opay',
    extract: (payload) => {
      const data = payload as Record<string, unknown>;
      return {
        routingKey:
          String(data.status) === 'SUCCESS'
            ? ('payment.succeeded' as const)
            : ('payment.failed' as const),
        reference: String(data.reference ?? ''),
        providerReference: String(data.orderNo ?? ''),
      } as never;
    },
  },
};

/**
 * Payment webhook routes — one route per PSP, one shared pipeline.
 * Signature check -> dedupe by provider transaction id -> normalize ->
 * publish payment.* domain events. Order state transitions happen in the
 * backend consumer (single writer principle for money tables).
 */
export function registerPaymentRoutes(app: FastifyInstance, ingest: IngestService): void {
  for (const [name, ctx] of Object.entries(CONTEXTS)) {
    app.post(
      `/webhooks/${name}`,
      { config: { rawBody: true } },
      async (request: FastifyRequest, reply: FastifyReply) => {
        const rawBody = request.body as Buffer;
        const verification = verifyWebhookSignature(ctx.provider, rawBody, request.headers);
        if (!verification.valid) {
          app.log.warn({ psp: name }, 'payment.webhook.signature.invalid');
          return reply.code(401).send({ ok: false });
        }

        let payload: Record<string, unknown>;
        try {
          payload = JSON.parse(rawBody.toString()) as Record<string, unknown>;
        } catch {
          return reply.code(400).send({ ok: false });
        }

        const extracted = ctx.extract(payload) as unknown as {
          routingKey: string;
          reference: string;
          providerReference: string;
          amount?: number;
          currency?: string;
        };

        // Dedupe on the PSP's own transaction id
        const fresh = await ingest.acquireDedupeKey(`psp:${ctx.provider}:${extracted.providerReference}`);
        if (!fresh) return reply.code(200).send({ duplicate: true });

        await ingest.publish(extracted.routingKey, {
          provider: name,
          ...extracted,
        });

        // 200 immediately — heavy work happens in consumers
        return reply.code(200).send({ received: true });
      },
    );
  }
}
