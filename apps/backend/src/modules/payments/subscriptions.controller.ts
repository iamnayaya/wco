import type { Request, Response } from 'express';

import { getStoreId } from '../../middleware/rbac.js';
import { sendSuccess } from '../../utils/api-response.js';

import { subscriptionsService } from './services/subscriptions.service.js';

/**
 * Subscriptions controller — merchant billing lifecycle management.
 *
 * Each merchant has at most one active subscription. Handles creation,
 * renewal, upgrades, downgrades, and cancellations.
 */
export const subscriptionsController = {
  async getMySubscription(req: Request, res: Response): Promise<void> {
    const auth = req.auth!;
    sendSuccess(res, await subscriptionsService.getByMerchantId(auth.merchantId));
  },

  async create(req: Request, res: Response): Promise<void> {
    const auth = req.auth!;
    const subscription = await subscriptionsService.create(auth.merchantId, req.body);
    sendSuccess(res, subscription, undefined, 201);
  },

  async update(req: Request, res: Response): Promise<void> {
    const auth = req.auth!;
    sendSuccess(res, await subscriptionsService.update(auth.merchantId, req.body));
  },

  async cancel(req: Request, res: Response): Promise<void> {
    const auth = req.auth!;
    sendSuccess(res, await subscriptionsService.cancel(auth.merchantId, req.body));
  },

  async renew(req: Request, res: Response): Promise<void> {
    const auth = req.auth!;
    sendSuccess(res, await subscriptionsService.renew(auth.merchantId, req.body));
  },

  async upgrade(req: Request, res: Response): Promise<void> {
    const auth = req.auth!;
    sendSuccess(res, await subscriptionsService.changePlan(auth.merchantId, req.body, 'upgrade'));
  },

  async downgrade(req: Request, res: Response): Promise<void> {
    const auth = req.auth!;
    sendSuccess(res, await subscriptionsService.changePlan(auth.merchantId, req.body, 'downgrade'));
  },
} as const;
