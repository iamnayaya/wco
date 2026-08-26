import type { Request, Response } from 'express';
import { Router } from 'express';

import { logger } from '../../lib/logger.js';
import { asyncHandler } from '../../utils/async-handler.js';

import { responderService } from './services/responder.service.js';
import { metaHandshake, normalizeMetaPayload, verifyMetaSignature } from './services/webhook.service.js';

/**
 * Public Meta webhook - mounted BEFORE the authenticated routers.
 *
 * GET  -> subscription handshake (hub.challenge echo).
 * POST -> HMAC-verified payload; every flattened message goes through the
 * same ingestion + AI dispatch pipeline as POST /messages/receive. We always
 * answer 200 once the signature passes: non-2xx makes Meta retry and we
 * dedupe on waMessageId anyway.
 */
export const whatsappWebhookRouter: Router = Router();

whatsappWebhookRouter.get(
  '/inbound/whatsapp',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    // Express's qs parser nests `hub.mode=subscribe` into { hub: { mode: 'subscribe' } }
    // but metaHandshake expects flat keys: { mode, verifyToken, challenge }.
    const raw = req.query as Record<string, unknown>;
    const hub = (typeof raw.hub === 'object' && raw.hub !== null ? raw.hub : {}) as Record<string, unknown>;
    const flat: Record<string, unknown> = {
      ...raw,
      ...hub,
      // Meta sends `hub.verify_token` (snake_case) but the service expects `verifyToken`.
      verifyToken: hub.verify_token ?? raw.verifyToken,
    };
    res.status(200).send(metaHandshake(flat));
  }),
);

whatsappWebhookRouter.post(
  '/inbound/whatsapp',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    // Signature covers the RAW bytes - express-json's verify hook stores them
    // in req.rawBody (see app.ts). Header may arrive duplicated; take first.
    const rawSig = req.headers['x-hub-signature-256'];
    const signature = Array.isArray(rawSig) ? rawSig[0] : rawSig;
    const rawBody = (req as Request & { rawBody?: Buffer }).rawBody;
    verifyMetaSignature(rawBody ?? Buffer.alloc(0), signature);

    let payload: unknown;
    try {
      payload = JSON.parse((rawBody ?? Buffer.from('{}')).toString('utf8'));
    } catch {
      res.status(200).send('EVENT_RECEIVED');
      return;
    }

    const messages = normalizeMetaPayload(payload);
    for (const message of messages) {
      try {
        await responderService.ingestAndDispatch(message);
      } catch (err) {
        // One poison message must not fail the batch - Meta would redeliver
        // everything; dedupe handles retries but latency spikes do not.
        logger.warn('webhook.message-ingest-failed', {
          waMessageId: message.waMessageId,
          message: err instanceof Error ? err.message : String(err),
        });
      }
    }
    res.status(200).send('EVENT_RECEIVED');
  }),
);
