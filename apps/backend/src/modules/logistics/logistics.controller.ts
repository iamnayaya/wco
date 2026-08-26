import type { Request, Response } from 'express';

import { getStoreId } from '../../middleware/rbac.js';
import { deliveriesService } from '../../services/deliveries.service.js';
import { sendSuccess } from '../../utils/api-response.js';

/** Deliveries controller - quotes, booking, tracking reads. */
export const deliveriesController = {
  async listCarriers(_req: Request, res: Response): Promise<void> {
    sendSuccess(res, { carriers: deliveriesService.listConfigured() });
  },

  async quote(req: Request, res: Response): Promise<void> {
    const carrier = typeof req.query.carrier === 'string' ? req.query.carrier : undefined;
    sendSuccess(res, await deliveriesService.quote(getStoreId(req), req.params.orderId, req.body, carrier));
  },

  async book(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await deliveriesService.book(getStoreId(req), req.params.id), undefined, 201);
  },

  async getByOrder(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await deliveriesService.get(getStoreId(req), req.params.orderId));
  },
} as const;
