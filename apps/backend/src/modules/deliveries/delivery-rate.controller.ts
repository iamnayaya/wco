import type { Request, Response } from 'express';

import { sendSuccess } from '../../utils/api-response.js';
import { paginationMeta } from '../../utils/offset-pagination.js';

import { deliveryRateService } from './services/delivery-rate.service.js';

export const deliveryRateController = {
  async listByProvider(req: Request, res: Response): Promise<void> {
    const q = req.query as Record<string, unknown>;
    const page = Number(q.page) || 1;
    const pageSize = Math.min(Number(q.pageSize) || 20, 100);

    const [items, total] = await Promise.all([
      deliveryRateService.listByProvider(req.params.providerId, page, pageSize),
      deliveryRateService.countByProvider(req.params.providerId),
    ]);

    sendSuccess(res, items, { pagination: paginationMeta(page, pageSize, total) });
  },

  async getById(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await deliveryRateService.getById(req.params.providerId, req.params.id));
  },

  async create(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await deliveryRateService.create(req.params.providerId, req.body), undefined, 201);
  },

  async update(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await deliveryRateService.update(req.params.providerId, req.params.id, req.body));
  },

  async remove(req: Request, res: Response): Promise<void> {
    await deliveryRateService.remove(req.params.providerId, req.params.id);
    sendSuccess(res, { deleted: true });
  },

  async calculate(req: Request, res: Response): Promise<void> {
    const { providerId, ...data } = req.body;
    const distanceKm = await estimateDistance(data.pickupAddress, data.dropoffAddress);
    const dimensions = data.length && data.width && data.height
      ? { length: data.length, width: data.width, height: data.height }
      : undefined;
    sendSuccess(res, await deliveryRateService.calculateRate(providerId, distanceKm, data.weight, dimensions));
  },
} as const;

async function estimateDistance(pickup: string, dropoff: string): Promise<number> {
  // Placeholder — integrate with Google Maps Distance Matrix API
  // For now, estimate based on string similarity (rough heuristic)
  return 10;
}
