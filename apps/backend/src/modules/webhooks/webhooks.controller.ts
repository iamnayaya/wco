import { randomBytes } from 'node:crypto';

import { NotFoundError } from '@wco/shared';
import type { Request, Response } from 'express';

import { prisma } from '../../lib/prisma.js';
import { getStoreId } from '../../middleware/rbac.js';
import { deliverOnce } from '../../services/outbound-webhooks.service.js';
import { sendSuccess } from '../../utils/api-response.js';

import { maskSecret, type SubscriptionView } from './webhooks.dto.js';

/**
 * Webhook subscriptions controller - merchant outbound webhooks CRUD + test fire.
 *
 * The signing secret is generated server-side (32 url-safe bytes) and
 * returned exactly once in the create response; merchants rotate by recreating.
 */
export const webhooksController = {
  async list(req: Request, res: Response): Promise<void> {
    const subs = await prisma.webhookSubscription.findMany({
      where: { storeId: getStoreId(req) },
      orderBy: { createdAt: 'desc' },
    });
    const views: SubscriptionView[] = subs.map((s) => ({
      id: s.id,
      url: s.url,
      events: s.events,
      isActive: s.isActive,
      secretMasked: maskSecret(s.secret),
      createdAt: s.createdAt,
    }));
    sendSuccess(res, views);
  },

  async create(req: Request, res: Response): Promise<void> {
    const secret = randomBytes(32).toString('base64url');
    const sub = await prisma.webhookSubscription.create({
      data: {
        storeId: getStoreId(req),
        url: req.body.url,
        events: req.body.events,
        secret,
      },
    });
    // Full secret ONLY here - the one time the merchant can read it.
    sendSuccess(res, { id: sub.id, url: sub.url, events: sub.events, secret }, undefined, 201);
  },

  async update(req: Request, res: Response): Promise<void> {
    const storeId = getStoreId(req);
    const existing = await prisma.webhookSubscription.findFirst({
      where: { id: req.params.id, storeId },
    });
    if (!existing) throw new NotFoundError('Webhook subscription');

    const updated = await prisma.webhookSubscription.update({
      where: { id: existing.id },
      data: req.body,
    });
    sendSuccess(res, {
      id: updated.id,
      url: updated.url,
      events: updated.events,
      isActive: updated.isActive,
      secretMasked: maskSecret(updated.secret),
    });
  },

  async remove(req: Request, res: Response): Promise<void> {
    const storeId = getStoreId(req);
    const existing = await prisma.webhookSubscription.findFirst({
      where: { id: req.params.id, storeId },
    });
    if (!existing) throw new NotFoundError('Webhook subscription');
    await prisma.webhookSubscription.delete({ where: { id: existing.id } });
    sendSuccess(res, { deleted: true });
  },

  /** Fires a sample event synchronously so merchants can verify their receiver. */
  async testFire(req: Request, res: Response): Promise<void> {
    const storeId = getStoreId(req);
    const sub = await prisma.webhookSubscription.findFirst({
      where: { id: req.params.id, storeId },
    });
    if (!sub) throw new NotFoundError('Webhook subscription');

    const delivered = await deliverOnce(sub.id, 'order.created', {
      test: true,
      message: 'This is a WCO webhook test event',
      orderId: 'test-order-id',
      orderNumber: 'WC-TEST00',
      total: 0,
      currency: 'NGN',
      customerId: 'test-customer-id',
      customerWaPhone: '+2348000000000',
    });
    sendSuccess(res, { delivered });
  },
} as const;
