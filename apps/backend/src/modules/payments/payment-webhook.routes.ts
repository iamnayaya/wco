import type { Request, Response } from 'express';
import { Router } from 'express';

import { logger } from '../../lib/logger.js';
import { prisma } from '../../lib/prisma.js';
import { paymentsService } from '../../services/payments.service.js';
import { asyncHandler } from '../../utils/async-handler.js';

/**
 * Inbound payment webhook routes — public (no auth).
 *
 * Mounted at /api/v1/webhooks/inbound/paystack etc. These handle raw PSP
 * callbacks. Every handler follows the same pattern:
 *   1. Log the raw event (PaymentWebhook table) for audit + replay
 *   2. Verify signature (provider-specific)
 *   3. Process via paymentsService.handleWebhook
 *   4. Return 200 immediately — PSPs retry on non-2xx
 *
 * Duplicate events are idempotent: PaymentWebhook has a unique
 * (provider, eventId) constraint and handleWebhook checks Payment.status.
 */

const inboundPaymentRouter: Router = Router();

// --- Paystack --------------------------------------------------------------

inboundPaymentRouter.post(
  '/inbound/paystack',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const rawBody = (req as Request & { rawBody?: Buffer }).rawBody;
    const signature = req.headers['x-paystack-signature'] as string | undefined;

    // Log raw event before processing
    const logged = await logWebhookEvent('PAYSTACK', rawBody, signature, req.body);

    try {
      if (!rawBody || !signature) {
        res.status(400).json({ error: 'Missing signature' });
        return;
      }

      const payment = await paymentsService.handleWebhook('PAYSTACK', rawBody, signature);

      if (logged) {
        await prisma.paymentWebhook.update({
          where: { id: logged.id },
          data: { status: 'PROCESSED', processedAt: new Date() },
        });
      }

      res.status(200).json({ status: 'ok', paymentId: payment?.id });
    } catch (err) {
      logger.warn('webhook.paystack.processing-failed', {
        error: err instanceof Error ? err.message : String(err),
      });

      if (logged) {
        await prisma.paymentWebhook.update({
          where: { id: logged.id },
          data: { status: 'FAILED', errorReason: err instanceof Error ? err.message : String(err) },
        });
      }

      // Still return 200 — PSP would retry otherwise, and we've logged the failure
      res.status(200).json({ status: 'error', message: 'Processing failed' });
    }
  }),
);

// --- Flutterwave ------------------------------------------------------------

inboundPaymentRouter.post(
  '/inbound/flutterwave',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const rawBody = (req as Request & { rawBody?: Buffer }).rawBody;
    const signature = req.headers['verif-hash'] as string | undefined;

    const logged = await logWebhookEvent('FLUTTERWAVE', rawBody, signature, req.body);

    try {
      if (!rawBody || !signature) {
        res.status(400).json({ error: 'Missing signature' });
        return;
      }

      const payment = await paymentsService.handleWebhook('FLUTTERWAVE', rawBody, signature);

      if (logged) {
        await prisma.paymentWebhook.update({
          where: { id: logged.id },
          data: { status: 'PROCESSED', processedAt: new Date() },
        });
      }

      res.status(200).json({ status: 'ok', paymentId: payment?.id });
    } catch (err) {
      logger.warn('webhook.flutterwave.processing-failed', {
        error: err instanceof Error ? err.message : String(err),
      });

      if (logged) {
        await prisma.paymentWebhook.update({
          where: { id: logged.id },
          data: { status: 'FAILED', errorReason: err instanceof Error ? err.message : String(err) },
        });
      }

      res.status(200).json({ status: 'error', message: 'Processing failed' });
    }
  }),
);

// --- OPay -------------------------------------------------------------------

inboundPaymentRouter.post(
  '/inbound/opay',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const rawBody = (req as Request & { rawBody?: Buffer }).rawBody;
    const signature = req.headers['x-opay-signature'] as string | undefined;

    const logged = await logWebhookEvent('OPAY', rawBody, signature, req.body);

    try {
      if (!rawBody || !signature) {
        res.status(400).json({ error: 'Missing signature' });
        return;
      }

      const payment = await paymentsService.handleWebhook('OPAY', rawBody, signature);

      if (logged) {
        await prisma.paymentWebhook.update({
          where: { id: logged.id },
          data: { status: 'PROCESSED', processedAt: new Date() },
        });
      }

      res.status(200).json({ status: 'ok', paymentId: payment?.id });
    } catch (err) {
      logger.warn('webhook.opay.processing-failed', {
        error: err instanceof Error ? err.message : String(err),
      });

      if (logged) {
        await prisma.paymentWebhook.update({
          where: { id: logged.id },
          data: { status: 'FAILED', errorReason: err instanceof Error ? err.message : String(err) },
        });
      }

      res.status(200).json({ status: 'error', message: 'Processing failed' });
    }
  }),
);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function logWebhookEvent(
  provider: 'PAYSTACK' | 'FLUTTERWAVE' | 'OPAY',
  rawBody: Buffer | undefined,
  signature: string | undefined,
  payload: Record<string, unknown>,
): Promise<{ id: string } | null> {
  try {
    // Extract event ID for deduplication (provider-specific)
    const eventId = extractEventId(provider, payload);

    const logged = await prisma.paymentWebhook.create({
      data: {
        provider,
        eventId,
        eventType: String(payload.event ?? payload.type ?? 'unknown'),
        rawPayload: payload as never,
        signature: signature ?? null,
        status: 'PENDING',
      },
    });
    return logged;
  } catch (err) {
    // Duplicate event IDs hit the unique constraint — that's fine, it's a replay
    logger.debug('webhook.log-duplicate-or-failed', {
      provider,
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

function extractEventId(provider: string, payload: Record<string, unknown>): string | null {
  switch (provider) {
    case 'PAYSTACK':
      return String(payload.id ?? payload.data?.id ?? null);
    case 'FLUTTERWAVE':
      return String(payload.id ?? payload.data?.id ?? null);
    case 'OPay':
      return String(payload.orderNo ?? payload.data?.orderNo ?? null);
    default:
      return null;
  }
}

export { inboundPaymentRouter };
