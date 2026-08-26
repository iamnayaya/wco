import type { Request, Response } from 'express';

import { sendSuccess } from '../../utils/api-response.js';
import { paginationMeta } from '../../utils/offset-pagination.js';

import { deliveryTrackingService } from './services/delivery-tracking.service.js';

export const deliveryTrackingController = {
  async listByDelivery(req: Request, res: Response): Promise<void> {
    const q = req.query as Record<string, unknown>;
    const page = Number(q.page) || 1;
    const pageSize = Math.min(Number(q.pageSize) || 50, 100);

    const [items, total] = await Promise.all([
      deliveryTrackingService.listByDelivery(req.params.id, page, pageSize),
      deliveryTrackingService.countByDelivery(req.params.id),
    ]);

    sendSuccess(res, items, { pagination: paginationMeta(page, pageSize, total) });
  },

  async getCurrentStatus(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await deliveryTrackingService.getCurrentStatus(req.params.id));
  },

  async create(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await deliveryTrackingService.create(req.params.id, req.body), undefined, 201);
  },
} as const;
